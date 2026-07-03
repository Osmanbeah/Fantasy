import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { request } from '../utils/api';
import PlayerAvatar from '../components/Avatar';

export default function Leaderboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [standings, setStandings] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(leagueId || 'global');
  const [leagueName, setLeagueName] = useState('Global Standings');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeagues = async () => {
    try {
      const data = await request('/leagues');
      setLeagues(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStandings = async () => {
    setLoading(true);
    try {
      if (selectedLeagueId === 'global') {
        const data = await request('/leaderboard/global');
        setStandings(data.standings || []);
        setLeagueName('Global Leaderboard');
      } else {
        const data = await request(`/leagues/${selectedLeagueId}/leaderboard`);
        setStandings(data.standings || []);
        setLeagueName(data.leagueName || 'League Leaderboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  useEffect(() => {
    fetchStandings();
  }, [selectedLeagueId]);

  // Sync selected league with path param if it changes
  useEffect(() => {
    if (leagueId) {
      setSelectedLeagueId(leagueId);
    } else {
      setSelectedLeagueId('global');
    }
  }, [leagueId]);

  const handleLeagueChange = (e) => {
    const value = e.target.value;
    setSelectedLeagueId(value);
    if (value === 'global') {
      navigate('/leaderboard');
    } else {
      navigate(`/leaderboard/${value}`);
    }
  };

  const filteredStandings = standings.filter(item => 
    item.teamName.toLowerCase().includes(search.toLowerCase()) ||
    item.username.toLowerCase().includes(search.toLowerCase())
  );

  const topThree = filteredStandings.slice(0, 3);
  const remaining = filteredStandings.slice(3);

  // Helper for rank badge styling
  const getRankBadgeClass = (rank) => {
    if (rank === 1) return 'bg-amber-500 text-surface font-black';
    if (rank === 2) return 'bg-slate-300 text-surface font-black';
    if (rank === 3) return 'bg-amber-700 text-surface font-black';
    return 'bg-surface-container-high text-on-surface-variant';
  };

  return (
    <div className="space-y-8">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-on-surface">{leagueName}</h2>
          <p className="text-xs text-on-surface-variant">Real-time manager ranks and point totals</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* League Dropdown Selector */}
          <select 
            value={selectedLeagueId}
            onChange={handleLeagueChange}
            className="bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary"
          >
            <option value="global">Global Leaderboard</option>
            {leagues.map(l => (
              <option key={l.id} value={l.id}>{l.name} (Code: {l.inviteCode})</option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
            <input 
              type="text"
              placeholder="Search team or manager..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-primary w-60"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-on-surface-variant">Loading standings...</div>
      ) : filteredStandings.length === 0 ? (
        <div className="bg-surface-container border border-outline-variant rounded-xl p-8 text-center text-on-surface-variant text-sm">
          No team rankings available matching your criteria.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Podium for top 3 (only shown if not filtering/searching or if top 3 match) */}
          {topThree.length > 0 && !search && (
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 py-6 max-w-2xl mx-auto border-b border-outline-variant/30">
              {/* 2nd place */}
              {topThree[1] && (
                <div className="flex flex-col items-center order-2 md:order-1 translate-y-3">
                  <div className="relative mb-2">
                    <PlayerAvatar name={topThree[1].username} className="w-16 h-16 text-lg border-2 border-slate-300 shadow-lg" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs bg-slate-300 text-surface font-black">2</span>
                  </div>
                  <span className="text-sm font-bold text-on-surface">{topThree[1].teamName}</span>
                  <span className="text-xs text-on-surface-variant">@{topThree[1].username}</span>
                  <span className="text-lg font-black text-slate-300 font-mono mt-1">{topThree[1].points} pts</span>
                </div>
              )}

              {/* 1st place */}
              {topThree[0] && (
                <div className="flex flex-col items-center order-1 md:order-2">
                  <div className="relative mb-2">
                    <span className="material-symbols-outlined absolute -top-6 left-1/2 -translate-x-1/2 text-amber-500 text-3xl animate-bounce">emoji_events</span>
                    <PlayerAvatar name={topThree[0].username} className="w-20 h-20 text-xl border-4 border-amber-500 shadow-xl shadow-amber-500/10" />
                    <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm bg-amber-500 text-surface font-black">1</span>
                  </div>
                  <span className="text-base font-black text-on-surface">{topThree[0].teamName}</span>
                  <span className="text-xs text-on-surface-variant">@{topThree[0].username}</span>
                  <span className="text-2xl font-black text-amber-500 font-mono mt-1">{topThree[0].points} pts</span>
                </div>
              )}

              {/* 3rd place */}
              {topThree[2] && (
                <div className="flex flex-col items-center order-3 translate-y-6">
                  <div className="relative mb-2">
                    <PlayerAvatar name={topThree[2].username} className="w-14 h-14 text-sm border-2 border-amber-700 shadow-md" />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs bg-amber-700 text-surface font-black">3</span>
                  </div>
                  <span className="text-xs font-bold text-on-surface">{topThree[2].teamName}</span>
                  <span className="text-xs text-on-surface-variant">@{topThree[2].username}</span>
                  <span className="text-base font-black text-amber-700 font-mono mt-1">{topThree[2].points} pts</span>
                </div>
              )}
            </div>
          )}

          {/* Standings Table */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container/50 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    <th className="px-6 py-4 w-20 text-center">Rank</th>
                    <th className="px-6 py-4">Manager / Team</th>
                    <th className="px-6 py-4 text-right font-mono">Total Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 text-sm">
                  {filteredStandings.map((item) => (
                    <tr 
                      key={item.userId}
                      className="hover:bg-surface-container-high/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-xs font-bold ${getRankBadgeClass(item.rank)}`}>
                          {item.rank}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <PlayerAvatar name={item.username} className="w-9 h-9 text-xs" />
                          <div>
                            <div className="font-bold text-on-surface">{item.teamName}</div>
                            <div className="text-xs text-on-surface-variant">@{item.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-base text-primary">
                        {item.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
