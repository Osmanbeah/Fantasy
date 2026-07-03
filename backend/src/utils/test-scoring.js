const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculatePlayerPoints, calculateTeamGameweekPoints } = require('./scoring');

async function runTests() {
  console.log('=== Starting Scoring Engine Tests ===');

  try {
    // 1. Clean up or set up a test user & players
    const userEmail = `test_manager_${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        username: `test_mgr_${Date.now()}`,
        password: 'hashedpassword',
        role: 'USER'
      }
    });

    const team = await prisma.fantasyTeam.create({
      data: {
        name: 'Test Team A',
        userId: user.id
      }
    });

    // Create 7 test players
    const players = [];
    for (let i = 1; i <= 7; i++) {
      const p = await prisma.player.create({
        data: {
          name: `Test Player ${i}`,
          club: 'Test Club',
          price: 5.0,
          totalPoints: 0
        }
      });
      players.push(p);
    }

    // Set captain as player 0
    await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: {
        captainId: players[0].id
      }
    });

    // Populate team players
    for (let i = 0; i < 7; i++) {
      await prisma.fantasyTeamPlayer.create({
        data: {
          fantasyTeamId: team.id,
          playerId: players[i].id,
          isStarter: i < 5
        }
      });
    }

    // Create a gameweek
    const gw = await prisma.gameweek.create({
      data: {
        name: `Test GW ${Date.now()}`,
        deadline: new Date(Date.now() + 60000), // 1 min in future
        isLocked: false,
        isActive: false
      }
    });

    // 2. Test Gameweek Locking
    console.log('Testing locking endpoint logic...');
    // Simulated lock operation
    const playersSnapshot = players.map((p, idx) => ({
      playerId: p.id,
      isStarter: idx < 5
    }));

    const squad = await prisma.gameweekSquad.create({
      data: {
        fantasyTeamId: team.id,
        gameweekId: gw.id,
        captainId: players[0].id,
        viceCaptainId: players[1].id,
        players: playersSnapshot
      }
    });
    console.log('✔ Squad snapshot locked and created successfully.');

    // 3. Test Match Stat calculation
    console.log('Testing match stats point calculation...');
    const match = await prisma.match.create({
      data: {
        homeClub: 'Test Club',
        awayClub: 'Other Club',
        kickoff: new Date(),
        gameweekId: gw.id
      }
    });

    // Give captain (player 0) 1 goal (5pts) and 60 minutes played (2pts) = 7pts base
    const captainStat = await prisma.playerMatchStat.create({
      data: {
        playerId: players[0].id,
        matchId: match.id,
        minutesPlayed: 60,
        goals: 1,
        assists: 0,
        cleanSheet: false,
        points: 7 // 1 (minutes > 0) + 1 (minutes >= 60) + 5 (goal)
      }
    });

    // Give another player (player 1) 1 assist (3pts) and 90 minutes (2pts) = 5pts base
    const otherStat = await prisma.playerMatchStat.create({
      data: {
        playerId: players[1].id,
        matchId: match.id,
        minutesPlayed: 90,
        goals: 0,
        assists: 1,
        cleanSheet: false,
        points: 5
      }
    });

    // Calculate squad points
    const gwPlayerStats = [captainStat, otherStat];
    const calculatedPoints = calculateTeamGameweekPoints(
      { captainId: squad.captainId, viceCaptainId: players[1].id, players: squad.players },
      gwPlayerStats
    );

    // Assert calculated points
    // Expected: captain (player 0) base points 7 * 2 = 14
    // Expected: other player (player 1) base points 5 * 1 = 5
    // Expected: other 5 players have 0 points
    // Total = 14 + 5 = 19
    console.log(`Calculated GW points: ${calculatedPoints} (Expected: 19)`);
    if (calculatedPoints !== 19) {
      throw new Error(`Assertion failed: expected 19 points, got ${calculatedPoints}`);
    }
    console.log('✔ Captain point doubling validated successfully.');

    // Test Vice-Captain doubling when Captain did not feature (0 minutes)
    console.log('Testing Vice-Captain doubling logic (Captain at 0 minutes)...');
    const zeroMinutesCaptainStat = { ...captainStat, minutesPlayed: 0, goals: 0, assists: 0, points: 0 };
    const vcCalculatedPoints = calculateTeamGameweekPoints(
      { captainId: squad.captainId, viceCaptainId: players[1].id, players: squad.players },
      [zeroMinutesCaptainStat, otherStat]
    );
    // Expected: captain (player 0) base points 0 * 2 = 0
    // Expected: vice-captain (player 1) base points 5 * 2 = 10
    // Expected: other 5 players have 0 points
    // Total = 10
    console.log(`Calculated VC GW points: ${vcCalculatedPoints} (Expected: 10)`);
    if (vcCalculatedPoints !== 10) {
      throw new Error(`Assertion failed: expected 10 points for vice-captain doubling, got ${vcCalculatedPoints}`);
    }
    console.log('✔ Vice-Captain point doubling validated successfully.');

    // Write computed points back to GameweekSquad
    await prisma.gameweekSquad.update({
      where: { id: squad.id },
      data: { points: calculatedPoints }
    });

    // Update cumulative team points
    await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: { points: calculatedPoints }
    });

    // 4. Test Retroactive protection
    console.log('Testing retroactive score protection...');
    // Create an 8th player who is NOT in the locked squad at all
    const outsiderPlayer = await prisma.player.create({
      data: {
        name: 'Outsider Player',
        club: 'Test Club',
        price: 5.0,
        totalPoints: 0
      }
    });

    // Swap player 1 out for the outsider on the live team
    await prisma.fantasyTeamPlayer.delete({
      where: {
        fantasyTeamId_playerId: {
          fantasyTeamId: team.id,
          playerId: players[1].id
        }
      }
    });
    await prisma.fantasyTeamPlayer.create({
      data: {
        fantasyTeamId: team.id,
        playerId: outsiderPlayer.id,
        isStarter: true
      }
    });

    // Create a new stat for the outsider player in the match (who was NOT in the locked squad)
    const newStatForOutsider = await prisma.playerMatchStat.create({
      data: {
        playerId: outsiderPlayer.id,
        matchId: match.id,
        minutesPlayed: 90,
        goals: 2, // 10 pts
        assists: 0,
        cleanSheet: false,
        points: 12
      }
    });

    // Recalculate using snapshot
    const updatedSquad = await prisma.gameweekSquad.findUnique({
      where: { id: squad.id }
    });

    const currentStats = await prisma.playerMatchStat.findMany({
      where: { matchId: match.id }
    });

    const recalculatedPoints = calculateTeamGameweekPoints(
      { captainId: updatedSquad.captainId, viceCaptainId: updatedSquad.viceCaptainId, players: updatedSquad.players },
      currentStats
    );

    console.log(`Recalculated GW points after transfer/live edit: ${recalculatedPoints} (Expected: 19)`);
    if (recalculatedPoints !== 19) {
      throw new Error(`Assertion failed: retroactive protection failed. Expected 19 points, but got ${recalculatedPoints}`);
    }
    console.log('✔ Retroactive point stealing protection validated successfully!');

    // Cleanup
    await prisma.playerMatchStat.deleteMany({ where: { matchId: match.id } });
    await prisma.match.delete({ where: { id: match.id } });
    await prisma.gameweekSquad.delete({ where: { id: squad.id } });
    await prisma.gameweek.delete({ where: { id: gw.id } });
    await prisma.fantasyTeamPlayer.deleteMany({ where: { fantasyTeamId: team.id } });
    await prisma.fantasyTeam.delete({ where: { id: team.id } });
    for (const p of players) {
      await prisma.player.delete({ where: { id: p.id } });
    }
    await prisma.player.delete({ where: { id: outsiderPlayer.id } });
    await prisma.user.delete({ where: { id: user.id } });

    console.log('=== All Tests Passed Successfully ===');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
