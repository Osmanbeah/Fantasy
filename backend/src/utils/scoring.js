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

function calculateTeamGameweekPoints(team, playerStats) {
  const statsMap = new Map();
  playerStats.forEach(stat => {
    statsMap.set(stat.playerId, stat);
  });

  let totalPoints = 0;
  const captainId = team.captainId;
  const viceCaptainId = team.viceCaptainId;

  const captainStat = statsMap.get(captainId);
  const captainMinutes = captainStat ? captainStat.minutesPlayed : 0;
  const captainPlayed = captainMinutes > 0;

  const players = Array.isArray(team.players) ? team.players : [];

  players.forEach(p => {
    const playerId = p.playerId;
    const stat = statsMap.get(playerId);
    const basePoints = calculatePlayerPoints(stat);

    let multiplier = 1;
    if (playerId === captainId && captainPlayed) {
      multiplier = 2;
    } else if (playerId === viceCaptainId && !captainPlayed) {
      multiplier = 2;
    }

    totalPoints += basePoints * multiplier;
  });

  return totalPoints;
}

module.exports = {
  calculatePlayerPoints,
  calculateTeamGameweekPoints
};
