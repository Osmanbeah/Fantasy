/**
 * Calculates the fantasy points for a single match stat record.
 * Standard points (uniform for all players since there are no positions):
 * - Minutes played > 0: 1 point
 * - Minutes played >= 60: +1 point (2 total)
 * - Goal scored: 5 points
 * - Assist: 3 points
 * - Clean sheet (must play >= 60 mins): 4 points
 */
function calculatePlayerPoints(stat) {
  let points = 0;
  if (!stat) return 0;

  if (stat.minutesPlayed > 0) {
    points += 1;
  }
  if (stat.minutesPlayed >= 60) {
    points += 1;
  }
  points += stat.goals * 5;
  points += stat.assists * 3;

  if (stat.cleanSheet && stat.minutesPlayed >= 60) {
    points += 4;
  }

  return points;
}

/**
 * Calculates the total team points for a user in a given gameweek.
 * @param {Object} team - FantasyTeam containing players relation
 * @param {Array} playerStats - Array of PlayerMatchStat for the gameweek
 * @param {Object} activeChipUsage - ChipUsage active for this gameweek if any (Bench Boost / Triple Captain)
 */
function calculateTeamGameweekPoints(team, playerStats, activeChipUsage) {
  const chipType = activeChipUsage ? activeChipUsage.chip : null;
  const isBenchBoost = chipType === 'BENCH_BOOST';
  const isTripleCaptain = chipType === 'TRIPLE_CAPTAIN';

  const statsMap = new Map();
  playerStats.forEach(stat => {
    statsMap.set(stat.playerId, stat);
  });

  let totalPoints = 0;
  const captainId = team.captainId;
  const viceCaptainId = team.viceCaptainId;

  // Let's determine if captain played
  const captainStat = statsMap.get(captainId);
  const captainMinutes = captainStat ? captainStat.minutesPlayed : 0;
  const captainPlayed = captainMinutes > 0;

  team.players.forEach(teamPlayer => {
    const playerId = teamPlayer.playerId;
    const isStarter = teamPlayer.isStarter;
    const stat = statsMap.get(playerId);
    const basePoints = calculatePlayerPoints(stat);

    // If player is a sub and Bench Boost is NOT active, ignore points
    if (!isStarter && !isBenchBoost) {
      return;
    }

    let multiplier = 1;

    // Apply Captain / Vice-Captain multipliers
    if (playerId === captainId && captainPlayed) {
      multiplier = isTripleCaptain ? 3 : 2;
    } else if (playerId === viceCaptainId && !captainPlayed) {
      multiplier = isTripleCaptain ? 3 : 2;
    }

    totalPoints += basePoints * multiplier;
  });

  return totalPoints;
}

module.exports = {
  calculatePlayerPoints,
  calculateTeamGameweekPoints
};
