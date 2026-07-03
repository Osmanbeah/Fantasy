const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireRole, JWT_SECRET } = require('./middleware/auth');
const { calculatePlayerPoints, calculateTeamGameweekPoints } = require('./utils/scoring');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Helper to generate invite codes
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// -------------------------------------------------------------
// 1. AUTH ROUTES
// -------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // The first user registered can be admin if we want, or default everyone to USER
    const count = await prisma.user.count();
    const role = count === 0 ? 'ADMIN' : 'USER';

    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role
      }
    });

    // Create empty fantasy team for the user
    await prisma.fantasyTeam.create({
      data: {
        userId: user.id,
        name: `${username}'s Squad`
      }
    });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 2. PLAYERS ROUTES
// -------------------------------------------------------------
app.get('/api/players', async (req, res) => {
  const { search, club } = req.query;
  try {
    const where = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (club && club !== 'All') {
      where.club = club;
    }
    const players = await prisma.player.findMany({
      where,
      orderBy: { price: 'desc' }
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. TEAM BUILDER ROUTES
// -------------------------------------------------------------
app.get('/api/teams/my-team', authenticateToken, async (req, res) => {
  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId: req.user.id },
      include: {
        players: {
          include: { player: true }
        }
      }
    });

    const activeGameweek = await prisma.gameweek.findFirst({
      where: { isActive: true }
    }) || await prisma.gameweek.findFirst({
      where: { deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' }
    });

    let activeChips = [];
    let usedChips = [];
    if (activeGameweek) {
      const usages = await prisma.chipUsage.findMany({
        where: { userId: req.user.id }
      });
      usages.forEach(u => {
        if (u.gameweekId === activeGameweek.id) {
          activeChips.push(u.chip);
        } else {
          usedChips.push(u.chip);
        }
      });
    }

    res.json({ team, activeChips, usedChips });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams/play-chip', authenticateToken, async (req, res) => {
  const { chip } = req.body;
  if (!['WILDCARD', 'FREE_HIT', 'BENCH_BOOST', 'TRIPLE_CAPTAIN'].includes(chip)) {
    return res.status(400).json({ error: 'Invalid chip type' });
  }

  try {
    const activeGameweek = await prisma.gameweek.findFirst({
      where: { deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' }
    });

    if (!activeGameweek) {
      return res.status(400).json({ error: 'No active upcoming gameweek to play chip.' });
    }

    const existingUsage = await prisma.chipUsage.findFirst({
      where: { userId: req.user.id, chip }
    });

    if (existingUsage) {
      return res.status(400).json({ error: `Chip ${chip} has already been played this season.` });
    }

    const gameweekChip = await prisma.chipUsage.findUnique({
      where: {
        userId_gameweekId: {
          userId: req.user.id,
          gameweekId: activeGameweek.id
        }
      }
    });

    if (gameweekChip) {
      return res.status(400).json({ error: 'You can only activate one chip per gameweek.' });
    }

    const usage = await prisma.chipUsage.create({
      data: {
        userId: req.user.id,
        chip,
        gameweekId: activeGameweek.id
      }
    });

    res.json({ message: `Chip ${chip} activated successfully for ${activeGameweek.name}`, usage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/teams/save', authenticateToken, async (req, res) => {
  const { name, playerIds, starterIds, captainId, viceCaptainId } = req.body;

  try {
    // 1. Get system rules settings
    const settings = await prisma.settings.findFirst() || { creditBudget: 100, numStarters: 5, numSubs: 2 };
    const maxPlayers = settings.numStarters + settings.numSubs;

    if (!playerIds || playerIds.length !== maxPlayers) {
      return res.status(400).json({ error: `Your squad must contain exactly ${maxPlayers} players.` });
    }

    if (!starterIds || starterIds.length !== settings.numStarters) {
      return res.status(400).json({ error: `You must select exactly ${settings.numStarters} starters.` });
    }

    if (!captainId || !viceCaptainId) {
      return res.status(400).json({ error: 'You must select a Captain and a Vice-Captain.' });
    }

    // 2. Fetch all selected players to validate budget
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } }
    });

    if (players.length !== maxPlayers) {
      return res.status(400).json({ error: 'One or more selected players are invalid.' });
    }

    const totalCost = players.reduce((sum, p) => sum + p.price, 0);
    if (totalCost > settings.creditBudget) {
      return res.status(400).json({ error: `Squad total price (${totalCost}m) exceeds budget (${settings.creditBudget}m).` });
    }

    // Find the team
    const team = await prisma.fantasyTeam.findUnique({
      where: { userId: req.user.id },
      include: { players: true }
    });

    if (!team) {
      return res.status(404).json({ error: 'Fantasy Team not found.' });
    }

    const activeGameweek = await prisma.gameweek.findFirst({
      where: { deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' }
    });

    if (!activeGameweek) {
      return res.status(400).json({ error: 'The transfer deadline has passed or no gameweeks are configured.' });
    }

    // Check chips active for upcoming gameweek
    const activeChip = await prisma.chipUsage.findUnique({
      where: {
        userId_gameweekId: {
          userId: req.user.id,
          gameweekId: activeGameweek.id
        }
      }
    });

    // 3. FREE HIT Logic:
    // If Free Hit is active, snapshot the CURRENT team configuration before applying changes, 
    // but only if a snapshot hasn't already been saved for this chip usage.
    if (activeChip && activeChip.chip === 'FREE_HIT' && !activeChip.squadSnapshot) {
      const currentSquad = team.players.map(tp => ({
        playerId: tp.playerId,
        isStarter: tp.isStarter
      }));
      await prisma.chipUsage.update({
        where: { id: activeChip.id },
        data: {
          squadSnapshot: {
            name: team.name,
            captainId: team.captainId,
            viceCaptainId: team.viceCaptainId,
            players: currentSquad
          }
        }
      });
    }

    // Delete existing team players and save the new list
    await prisma.fantasyTeamPlayer.deleteMany({
      where: { fantasyTeamId: team.id }
    });

    const teamPlayerData = playerIds.map(pId => ({
      fantasyTeamId: team.id,
      playerId: pId,
      isStarter: starterIds.includes(pId)
    }));

    await prisma.fantasyTeamPlayer.createMany({
      data: teamPlayerData
    });

    // Update Team main details
    const updatedTeam = await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: {
        name: name || team.name,
        captainId,
        viceCaptainId
      },
      include: {
        players: {
          include: { player: true }
        }
      }
    });

    res.json({ message: 'Team squad changes saved successfully!', team: updatedTeam });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. LEAGUES ROUTES
// -------------------------------------------------------------
app.get('/api/leagues', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        leagues: {
          include: {
            members: {
              include: { fantasyTeam: true }
            }
          }
        }
      }
    });
    const leaguesInfo = user.leagues.map(league => {
      const myRank = [...league.members]
        .sort((a, b) => (b.fantasyTeam?.points || 0) - (a.fantasyTeam?.points || 0))
        .findIndex(m => m.id === req.user.id) + 1;

      return {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        memberCount: league.members.length,
        myRank: myRank || 1
      };
    });
    res.json(leaguesInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leagues/create', authenticateToken, async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'League name is required' });
  }

  try {
    const inviteCode = generateInviteCode();
    const league = await prisma.league.create({
      data: {
        name,
        inviteCode,
        members: {
          connect: { id: req.user.id }
        }
      }
    });
    res.json(league);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leagues/join', authenticateToken, async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  try {
    const league = await prisma.league.findUnique({
      where: { inviteCode: inviteCode.trim().toUpperCase() },
      include: { members: true }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    if (league.members.some(m => m.id === req.user.id)) {
      return res.status(400).json({ error: 'You are already a member of this league' });
    }

    const updatedLeague = await prisma.league.update({
      where: { id: league.id },
      data: {
        members: {
          connect: { id: req.user.id }
        }
      }
    });

    res.json({ message: `Successfully joined ${updatedLeague.name}!`, league: updatedLeague });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leagues/:id/leaderboard', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const league = await prisma.league.findUnique({
      where: { id: parseInt(id) },
      include: {
        members: {
          include: { fantasyTeam: true }
        }
      }
    });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }

    const standings = league.members
      .map(member => ({
        userId: member.id,
        username: member.username,
        teamName: member.fantasyTeam?.name || `${member.username}'s Squad`,
        points: member.fantasyTeam?.points || 0
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    res.json({ leagueName: league.name, standings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. GLOBAL LEADERBOARD ROUTE
// -------------------------------------------------------------
app.get('/api/leaderboard/global', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      include: { fantasyTeam: true }
    });

    const standings = users
      .map(user => ({
        userId: user.id,
        username: user.username,
        teamName: user.fantasyTeam?.name || `${user.username}'s Squad`,
        points: user.fantasyTeam?.points || 0
      }))
      .sort((a, b) => b.points - a.points)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));

    res.json({ standings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. GAMEWEEKS & MATCHES
// -------------------------------------------------------------
app.get('/api/gameweeks', async (req, res) => {
  try {
    const gameweeks = await prisma.gameweek.findMany({
      include: { matches: true },
      orderBy: { deadline: 'asc' }
    });
    res.json(gameweeks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. ADMIN DASHBOARD & CONTROLS (GATED BY ADMIN ROLE)
// -------------------------------------------------------------
app.get('/api/admin/settings', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst() || { id: 1, creditBudget: 100.0, numStarters: 5, numSubs: 2 };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/settings', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { creditBudget, numStarters, numSubs } = req.body;
  try {
    const existing = await prisma.settings.findFirst();
    let settings;
    if (existing) {
      settings = await prisma.settings.update({
        where: { id: existing.id },
        data: {
          creditBudget: creditBudget !== undefined ? parseFloat(creditBudget) : existing.creditBudget,
          numStarters: numStarters !== undefined ? parseInt(numStarters) : existing.numStarters,
          numSubs: numSubs !== undefined ? parseInt(numSubs) : existing.numSubs
        }
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          creditBudget: creditBudget !== undefined ? parseFloat(creditBudget) : 100.0,
          numStarters: numStarters !== undefined ? parseInt(numStarters) : 5,
          numSubs: numSubs !== undefined ? parseInt(numSubs) : 2
        }
      });
    }
    res.json({ message: 'Settings updated successfully!', settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/players', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { name, club, price } = req.body;
  if (!name || !club || price === undefined) {
    return res.status(400).json({ error: 'Name, club, and price are required' });
  }

  try {
    const player = await prisma.player.create({
      data: { name, club, price: parseFloat(price) }
    });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/players/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, club, price } = req.body;

  try {
    const player = await prisma.player.update({
      where: { id: parseInt(id) },
      data: {
        name,
        club,
        price: price !== undefined ? parseFloat(price) : undefined
      }
    });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/players/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.player.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/gameweeks', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { name, deadline } = req.body;
  if (!name || !deadline) {
    return res.status(400).json({ error: 'Name and deadline are required' });
  }

  try {
    // Check if there is already an active gameweek
    const active = await prisma.gameweek.count({ where: { isActive: true } });
    const isActive = active === 0;

    const gw = await prisma.gameweek.create({
      data: { name, deadline: new Date(deadline), isActive }
    });
    res.json(gw);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/matches', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { homeClub, awayClub, gameweekId, kickoff } = req.body;
  if (!homeClub || !awayClub || !gameweekId || !kickoff) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const match = await prisma.match.create({
      data: {
        homeClub,
        awayClub,
        gameweekId: parseInt(gameweekId),
        kickoff: new Date(kickoff)
      }
    });
    res.json(match);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/stats', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { playerId, matchId, minutesPlayed, goals, assists, cleanSheet } = req.body;

  try {
    const statData = {
      playerId: parseInt(playerId),
      matchId: parseInt(matchId),
      minutesPlayed: parseInt(minutesPlayed || 0),
      goals: parseInt(goals || 0),
      assists: parseInt(assists || 0),
      cleanSheet: !!cleanSheet
    };

    const calculatedPoints = calculatePlayerPoints(statData);
    statData.points = calculatedPoints;

    // Save stat
    const stat = await prisma.playerMatchStat.upsert({
      where: {
        playerId_matchId: {
          playerId: statData.playerId,
          matchId: statData.matchId
        }
      },
      update: statData,
      create: statData,
      include: {
        match: {
          include: {
            gameweek: true
          }
        }
      }
    });

    const gameweek = stat.match.gameweek;

    // Update Player's cumulative total points
    const playerAllStats = await prisma.playerMatchStat.findMany({
      where: { playerId: statData.playerId }
    });
    const cumulativePoints = playerAllStats.reduce((sum, s) => sum + s.points, 0);
    await prisma.player.update({
      where: { id: statData.playerId },
      data: { totalPoints: cumulativePoints }
    });

    // If the gameweek is active or completed, let's recalculate the points of all teams for this gameweek
    const allTeams = await prisma.fantasyTeam.findMany({
      include: {
        players: true
      }
    });

    for (const team of allTeams) {
      const activeChip = await prisma.chipUsage.findUnique({
        where: {
          userId_gameweekId: {
            userId: team.userId,
            gameweekId: gameweek.id
          }
        }
      });

      // Get all stats for this gameweek's matches
      const matches = await prisma.match.findMany({
        where: { gameweekId: gameweek.id }
      });
      const matchIds = matches.map(m => m.id);

      const gwPlayerStats = await prisma.playerMatchStat.findMany({
        where: {
          matchId: { in: matchIds },
          playerId: { in: team.players.map(p => p.playerId) }
        }
      });

      const gwTeamPoints = calculateTeamGameweekPoints(team, gwPlayerStats, activeChip);

      // Now we accumulate total points of the team across all gameweeks
      // For this, we'll store user's team points in team.points. Let's sum this gameweek's points to cumulative team points.
      // Wait, we can sum points for all previous gameweeks too. To make it simple, let's recalculate the cumulative points:
      // Let's find all completed gameweeks + current active gameweek, get matches, get stats, and calculate.
      const allCompletedOrActiveGWs = await prisma.gameweek.findMany({
        where: { OR: [{ isCompleted: true }, { isActive: true }] }
      });

      let totalTeamPoints = 0;
      for (const gwIter of allCompletedOrActiveGWs) {
        const gwMatches = await prisma.match.findMany({ where: { gameweekId: gwIter.id } });
        const gwMatchIds = gwMatches.map(m => m.id);

        const gwIterChip = await prisma.chipUsage.findUnique({
          where: {
            userId_gameweekId: {
              userId: team.userId,
              gameweekId: gwIter.id
            }
          }
        });

        // Get players belonging to this user during that gameweek
        // Wait, what if the user used FREE HIT? For that gameweek, their squad snapshot was used.
        // Let's check if the chip usage has a squadSnapshot. If it is FREE HIT, we use the snapshot instead of current team players.
        let squadPlayers = team.players;
        let cId = team.captainId;
        let vcId = team.viceCaptainId;

        if (gwIterChip && gwIterChip.chip === 'FREE_HIT' && gwIterChip.squadSnapshot) {
          const snapshot = gwIterChip.squadSnapshot; // snapshot format: { name, captainId, viceCaptainId, players: [{ playerId, isStarter }] }
          squadPlayers = snapshot.players.map(p => ({
            playerId: p.playerId,
            isStarter: p.isStarter
          }));
          cId = snapshot.captainId;
          vcId = snapshot.viceCaptainId;
        }

        const gwIterPlayerStats = await prisma.playerMatchStat.findMany({
          where: {
            matchId: { in: gwMatchIds },
            playerId: { in: squadPlayers.map(p => p.playerId) }
          }
        });

        const pointsForThisGW = calculateTeamGameweekPoints(
          { captainId: cId, viceCaptainId: vcId, players: squadPlayers },
          gwIterPlayerStats,
          gwIterChip
        );
        totalTeamPoints += pointsForThisGW;
      }

      await prisma.fantasyTeam.update({
        where: { id: team.id },
        data: { points: totalTeamPoints }
      });
    }

    res.json({ message: 'Stat saved and all team standings recalculated!', stat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin command to trigger gameweek completion (reverts Free Hit squads)
app.post('/api/admin/gameweeks/:id/complete', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const gwId = parseInt(id);

  try {
    const gw = await prisma.gameweek.findUnique({ where: { id: gwId } });
    if (!gw) return res.status(404).json({ error: 'Gameweek not found' });

    // Mark gameweek as completed
    await prisma.gameweek.update({
      where: { id: gwId },
      data: { isCompleted: true, isActive: false }
    });

    // Revert squads for users who used FREE_HIT in this gameweek
    const freeHitUsages = await prisma.chipUsage.findMany({
      where: { gameweekId: gwId, chip: 'FREE_HIT' }
    });

    for (const usage of freeHitUsages) {
      if (usage.squadSnapshot) {
        const snapshot = usage.squadSnapshot; // { name, captainId, viceCaptainId, players: [{ playerId, isStarter }] }
        const team = await prisma.fantasyTeam.findUnique({
          where: { userId: usage.userId }
        });

        if (team) {
          // Revert players
          await prisma.fantasyTeamPlayer.deleteMany({
            where: { fantasyTeamId: team.id }
          });
          const teamPlayerData = snapshot.players.map(p => ({
            fantasyTeamId: team.id,
            playerId: p.playerId,
            isStarter: p.isStarter
          }));
          await prisma.fantasyTeamPlayer.createMany({
            data: teamPlayerData
          });

          // Revert team details
          await prisma.fantasyTeam.update({
            where: { id: team.id },
            data: {
              name: snapshot.name || team.name,
              captainId: snapshot.captainId,
              viceCaptainId: snapshot.viceCaptainId
            }
          });
        }
      }
    }

    // Set next gameweek to active
    const nextGW = await prisma.gameweek.findFirst({
      where: { deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' }
    });
    if (nextGW) {
      await prisma.gameweek.update({
        where: { id: nextGW.id },
        data: { isActive: true }
      });
    }

    res.json({ message: 'Gameweek completed successfully. Free Hit squads reverted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
