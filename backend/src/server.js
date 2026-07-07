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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.get('/', (req, res) => {
  res.json({ message: "Kinetic Fantasy League API is running!" });
});

// Helper to generate invite codes
function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// -------------------------------------------------------------
// 1. AUTH ROUTES
// -------------------------------------------------------------
// Helper for generating AI kit avatar using Gemini Vision and Pollinations.ai
async function generateKitAvatar(photoBase64, clubName) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. Using default placeholder.");
    const fallbackPrompt = `A realistic headshot portrait of a professional football player wearing a ${clubName || 'Real Madrid'} kit jersey`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=512&height=512&nologo=true`;
  }

  try {
    // Strip header if present
    const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
    
    // Call Gemini Vision to describe the face
    const visionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const visionResponse = await fetch(visionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Describe this person's physical appearance (gender, skin tone, hair style and color, facial hair) in a single short line under 15 words. Do not write full sentences." },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }
        ]
      })
    });

    const visionData = await visionResponse.json();
    let description = visionData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (description) {
      description = description.replace(/[\r\n]+/g, " ").trim();
    } else {
      description = "athletic person, neutral features";
    }

    console.log("Gemini Vision profile description:", description);

    // Build the pollinations prompt
    const kitJersey = clubName || 'Real Madrid';
    const pollinationsPrompt = `A high-quality realistic 3D sports game headshot portrait of a football player with features: ${description}. They are wearing a professional ${kitJersey} football kit jersey. Epic stadium lighting, athletic profile picture, EA Sports FC game style, photorealistic rendering.`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(pollinationsPrompt)}?width=512&height=512&nologo=true`;
  } catch (error) {
    console.error("Failed to generate AI kit avatar:", error);
    const fallbackPrompt = `A realistic headshot portrait of a professional football player wearing a ${clubName || 'Real Madrid'} kit jersey`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=512&height=512&nologo=true`;
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { email, username, password, playerName, club, photo } = req.body;
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
    const count = await prisma.user.count();
    const role = count === 0 ? 'ADMIN' : 'USER';

    // Generate the AI kit avatar if photo is uploaded
    let finalPhotoUrl = null;
    if (photo) {
      finalPhotoUrl = await generateKitAvatar(photo, club || 'Real Madrid');
    }

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

    // Fetch default price from settings
    const settings = await prisma.settings.findFirst() || { defaultPlayerPrice: 5.0 };
    const defaultPrice = settings.defaultPlayerPrice ?? 5.0;

    // Auto-create draftable player record linked to the user
    await prisma.player.create({
      data: {
        name: playerName || username,
        club: club || 'Free Agent',
        price: defaultPrice,
        userId: user.id,
        photoUrl: finalPhotoUrl
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

app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const player = await prisma.player.findUnique({
      where: { userId: req.user.id }
    });
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
  const { playerName, club, photoUrl, photo } = req.body;
  try {
    const player = await prisma.player.findUnique({
      where: { userId: req.user.id }
    });

    if (!player) {
      return res.status(404).json({ error: 'Linked player record not found' });
    }

    let finalPhotoUrl = photoUrl;
    if (photo) {
      const kitJersey = club !== undefined ? club : player.club;
      finalPhotoUrl = await generateKitAvatar(photo, kitJersey || 'Real Madrid');
    }

    const updatedPlayer = await prisma.player.update({
      where: { id: player.id },
      data: {
        name: playerName !== undefined ? playerName : player.name,
        club: club !== undefined ? club : player.club,
        photoUrl: finalPhotoUrl !== undefined ? finalPhotoUrl : player.photoUrl
      }
    });

    res.json(updatedPlayer);
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

    // Optional user authentication to exclude self
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.id) {
            where.NOT = { userId: decoded.id };
          }
        } catch (e) {
          // Ignore invalid token
        }
      }
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

app.get('/api/players/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const player = await prisma.player.findUnique({
      where: { id: parseInt(id) },
      include: {
        matchStats: {
          include: {
            match: {
              include: {
                gameweek: true
              }
            }
          },
          orderBy: {
            match: {
              kickoff: 'desc'
            }
          }
        }
      }
    });

    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
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
      where: { isCompleted: false },
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

    res.json({ team, activeChips, usedChips, activeGameweek });
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
      where: { isCompleted: false },
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

    if (captainId === viceCaptainId) {
      return res.status(400).json({ error: 'Captain and Vice-Captain must be different players.' });
    }

    if (!starterIds.includes(captainId) || !starterIds.includes(viceCaptainId)) {
      return res.status(400).json({ error: 'Both Captain and Vice-Captain must be in the starting XI.' });
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

    const draftedSelf = players.some(p => p.userId === req.user.id);
    if (draftedSelf) {
      return res.status(400).json({ error: 'You cannot pick yourself as a player on your own team' });
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
      where: { isCompleted: false },
      orderBy: { deadline: 'asc' }
    });

    if (!activeGameweek) {
      return res.status(400).json({ error: 'The transfer deadline has passed or no gameweeks are configured.' });
    }

    if (activeGameweek.isLocked) {
      return res.status(400).json({ error: `Squads are locked for ${activeGameweek.name}. You can't make changes until it finishes.` });
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
          include: { fantasyTeam: true, player: true }
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
        points: member.fantasyTeam?.points || 0,
        photoUrl: member.player?.photoUrl || null
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
      include: { fantasyTeam: true, player: true }
    });

    const standings = users
      .map(user => ({
        userId: user.id,
        username: user.username,
        teamName: user.fantasyTeam?.name || `${user.username}'s Squad`,
        points: user.fantasyTeam?.points || 0,
        photoUrl: user.player?.photoUrl || null
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
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst() || { id: 1, creditBudget: 100.0, numStarters: 5, numSubs: 2 };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.delete('/api/admin/gameweeks/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await prisma.gameweek.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: `Gameweek "${deleted.name}" deleted successfully.`, deleted });
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

    // Recalculate points for all teams using locked GameweekSquad snapshots
    const teams = await prisma.fantasyTeam.findMany();

    for (const team of teams) {
      const squads = await prisma.gameweekSquad.findMany({
        where: { fantasyTeamId: team.id }
      });

      let totalTeamPoints = 0;

      for (const squad of squads) {
        const matches = await prisma.match.findMany({
          where: { gameweekId: squad.gameweekId }
        });
        const matchIds = matches.map(m => m.id);

        const squadPlayers = Array.isArray(squad.players) ? squad.players : [];
        const playerIds = squadPlayers.map(sp => sp.playerId);

        const gwPlayerStats = await prisma.playerMatchStat.findMany({
          where: {
            matchId: { in: matchIds },
            playerId: { in: playerIds }
          }
        });

        const gwPoints = calculateTeamGameweekPoints(
          { captainId: squad.captainId, viceCaptainId: squad.viceCaptainId, players: squadPlayers },
          gwPlayerStats
        );

        await prisma.gameweekSquad.update({
          where: { id: squad.id },
          data: { points: gwPoints }
        });

        totalTeamPoints += gwPoints;
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

app.post('/api/admin/gameweeks/:id/lock', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const gwId = parseInt(id);

  try {
    const gw = await prisma.gameweek.findUnique({ where: { id: gwId } });
    if (!gw) return res.status(404).json({ error: 'Gameweek not found.' });

    // 1. Fetch all fantasy teams with their current players
    const teams = await prisma.fantasyTeam.findMany({
      include: { players: true }
    });

    // 2. Snapshot each team into GameweekSquad table
    for (const team of teams) {
      const playersSnapshot = team.players.map(p => ({
        playerId: p.playerId,
        isStarter: p.isStarter
      }));

      await prisma.gameweekSquad.upsert({
        where: {
          fantasyTeamId_gameweekId: {
            fantasyTeamId: team.id,
            gameweekId: gwId
          }
        },
        update: {
          captainId: team.captainId,
          viceCaptainId: team.viceCaptainId,
          players: playersSnapshot
        },
        create: {
          fantasyTeamId: team.id,
          gameweekId: gwId,
          captainId: team.captainId,
          viceCaptainId: team.viceCaptainId,
          players: playersSnapshot
        }
      });
    }

    // 3. Mark the gameweek as locked
    const updatedGw = await prisma.gameweek.update({
      where: { id: gwId },
      data: { isLocked: true, isActive: true }
    });

    // Make other gameweeks inactive for live scoring entry
    await prisma.gameweek.updateMany({
      where: { id: { not: gwId } },
      data: { isActive: false }
    });

    res.json({ message: `Gameweek "${gw.name}" locked successfully! Squad snapshots saved.`, gameweek: updatedGw });
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
      where: { isCompleted: false },
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
