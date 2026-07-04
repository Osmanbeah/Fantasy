import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import PlayerAvatar from '../components/Avatar';

export default function GameweekStats() {
  const [gameweeks, setGameweeks] = useState([]);
  const [selectedGameweekId, setSelectedGameweekId] = useState('');
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const [gws, pls] = await Promise.all([
        request('/gameweeks'),
        request('/players')
      ]);

      setGameweeks(gws);
      if (gws.length > 0) {
        // Default to active gameweek or first gameweek
        const active = gws.find(g => g.isActive) || gws[0];
        setSelectedGameweekId(active.id.toString());
      }
      
      setPlayers(pls);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGameweekChange = (e) => {
    setSelectedGameweekId(e.target.value);
  };

  const selectedGw = gameweeks.find(g => g.id.toString() === selectedGameweekId);

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.club.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-on-surface">Gameweeks & Stats</h2>
          <p className="text-xs text-on-surface-variant">Check deadlines, scheduled matches, and player point tallies</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Gameweek Selector */}
          <select 
            value={selectedGameweekId}
            onChange={handleGameweekChange}
            className="bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary"
          >
            {gameweeks.map(gw => (
              <option key={gw.id} value={gw.id}>
                {gw.name} {gw.isActive ? '(Active)' : gw.isCompleted ? '(Completed)' : ''}
              </option>
            ))}
          </select>

          {/* Search players */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
            <input 
              type="text"
              placeholder="Search player or club..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container-low border border-outline-variant text-on-surface text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-primary w-60"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-on-surface-variant">Loading stats...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gameweek details and matches */}
          <div className="space-y-6">
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
              <h3 className="text-lg font-bold text-on-surface mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">calendar_today</span>
                <span>{selectedGw?.name} Status</span>
              </h3>
              
              <div className="space-y-3 mt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-medium">Deadline:</span>
                  <span className="font-mono text-on-surface">{selectedGw ? new Date(selectedGw.deadline).toLocaleString() : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-medium">Status:</span>
                  <span>
                    {selectedGw?.isCompleted ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-error/15 text-tertiary font-bold">COMPLETED</span>
                    ) : selectedGw?.isActive ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-secondary/15 text-secondary font-bold">ACTIVE</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs bg-surface-container-high text-on-surface-variant font-bold">UPCOMING</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
              <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">sports_soccer</span>
                <span>Scheduled Matches</span>
              </h3>

              {!selectedGw?.matches || selectedGw.matches.length === 0 ? (
                <div className="text-xs text-on-surface-variant text-center py-4">No matches scheduled for this gameweek.</div>
              ) : (
                <div className="space-y-3">
                  {selectedGw.matches.map(match => (
                    <div 
                      key={match.id}
                      className="bg-surface-container border border-outline-variant/40 rounded-lg p-3 flex flex-col items-center justify-center gap-1"
                    >
                      <div className="flex items-center justify-between w-full font-bold text-sm px-4">
                        <span>{match.homeClub}</span>
                        <span className="text-primary font-mono text-xs">VS</span>
                        <span>{match.awayClub}</span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant font-mono mt-1">
                        {new Date(match.kickoff).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Players Points Registry */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">analytics</span>
              <span>Player Points Directory</span>
            </h3>

            <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container/50 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      <th className="px-6 py-4">Player / Club</th>
                      <th className="px-6 py-4 text-center">Price</th>
                      <th className="px-6 py-4 text-right">Season Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 text-sm">
                    {filteredPlayers.map((player) => (
                      <tr 
                        key={player.id}
                        className="hover:bg-surface-container-high/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="w-9 h-9 text-xs" />
                            <div>
                              <div className="font-bold text-on-surface">{player.name}</div>
                              <div className="text-xs text-on-surface-variant">{player.club}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-xs font-bold text-on-surface">
                          ${player.price}M
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-secondary text-base">
                          {player.totalPoints}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
