import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import PlayerAvatar from '../components/Avatar';

export default function AdminDashboard() {
  const [settings, setSettings] = useState({ creditBudget: 100, numStarters: 5, numSubs: 2 });
  const [players, setPlayers] = useState([]);
  const [gameweeks, setGameweeks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newPlayer, setNewPlayer] = useState({ name: '', club: '', price: 10 });
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [newGameweek, setNewGameweek] = useState({ name: '', deadline: '' });
  const [newMatch, setNewMatch] = useState({ homeClub: '', awayClub: '', gameweekId: '', kickoff: '' });
  const [newStat, setNewStat] = useState({ playerId: '', matchId: '', minutesPlayed: 90, goals: 0, assists: 0, cleanSheet: false });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const setts = await request('/admin/settings');
      setSettings(setts);
      
      const pls = await request('/players');
      setPlayers(pls);

      const gws = await request('/gameweeks');
      setGameweeks(gws);
      if (gws.length > 0) {
        setNewMatch(prev => ({ ...prev, gameweekId: gws[0].id.toString() }));
      }
    } catch (e) {
      console.error(e);
      setError('Failed to fetch admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await request('/admin/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      setSettings(res.settings);
      setMessage('Settings updated successfully!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      if (editingPlayerId) {
        // Edit Mode
        const res = await request(`/admin/players/${editingPlayerId}`, {
          method: 'PUT',
          body: JSON.stringify(newPlayer)
        });
        setPlayers(players.map(p => p.id === editingPlayerId ? res : p));
        setEditingPlayerId(null);
        setMessage(`Player "${res.name}" updated successfully!`);
      } else {
        // Add Mode
        const res = await request('/admin/players', {
          method: 'POST',
          body: JSON.stringify(newPlayer)
        });
        setPlayers([...players, res]);
        setMessage(`Player "${res.name}" added successfully!`);
      }
      setNewPlayer({ name: '', club: '', price: 10 });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePlayer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this player?')) return;
    setMessage('');
    setError('');
    try {
      await request(`/admin/players/${id}`, { method: 'DELETE' });
      setPlayers(players.filter(p => p.id !== id));
      setMessage('Player deleted successfully.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddGameweek = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await request('/admin/gameweeks', {
        method: 'POST',
        body: JSON.stringify(newGameweek)
      });
      setGameweeks([...gameweeks, { ...res, matches: [] }]);
      setNewGameweek({ name: '', deadline: '' });
      setMessage(`Gameweek "${res.name}" added!`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await request('/admin/matches', {
        method: 'POST',
        body: JSON.stringify(newMatch)
      });
      fetchData(); // reload matching info
      setNewMatch(prev => ({ ...prev, homeClub: '', awayClub: '', kickoff: '' }));
      setMessage(`Match scheduled!`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveStat = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      await request('/admin/stats', {
        method: 'POST',
        body: JSON.stringify(newStat)
      });
      setNewStat({ playerId: '', matchId: '', minutesPlayed: 90, goals: 0, assists: 0, cleanSheet: false });
      setMessage('Stats saved and standing points recalculated!');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCompleteGameweek = async (id) => {
    if (!window.confirm('Complete gameweek? This will freeze its scores and revert Free Hit squads.')) return;
    setMessage('');
    setError('');
    try {
      const res = await request(`/admin/gameweeks/${id}/complete`, { method: 'POST' });
      setMessage(res.message);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLockGameweek = async (id) => {
    if (!window.confirm('Lock gameweek? This will take a snapshot of all teams and lock transfers.')) return;
    setMessage('');
    setError('');
    try {
      const res = await request(`/admin/gameweeks/${id}/lock`, { method: 'POST' });
      setMessage(res.message);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Build match options for stat entry
  const selectedGwForStat = gameweeks.find(g => g.matches && g.matches.some(m => m.id.toString() === newStat.matchId));
  const allMatchesList = gameweeks.flatMap(g => (g.matches || []).map(m => ({ ...m, gwName: g.name })));

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-3xl font-black text-on-surface">Admin Dashboard</h2>
        <p className="text-xs text-on-surface-variant">System rules settings, players registry, and matches results stats</p>
      </div>

      {message && (
        <div className="bg-secondary/15 border border-secondary/40 text-secondary text-sm rounded-lg p-3">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-error-container/20 border border-error/50 text-error-container text-sm rounded-lg p-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-on-surface-variant">Loading dashboard details...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings & Rules Panel */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">settings</span>
              <span>League Rules Settings</span>
            </h3>
            
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Credit Budget</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={settings.creditBudget}
                    onChange={(e) => setSettings({ ...settings, creditBudget: parseFloat(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Starters Count</label>
                  <input 
                    type="number"
                    value={settings.numStarters}
                    onChange={(e) => setSettings({ ...settings, numStarters: parseInt(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Subs Count</label>
                  <input 
                    type="number"
                    value={settings.numSubs}
                    onChange={(e) => setSettings({ ...settings, numSubs: parseInt(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="px-6 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs hover:brightness-110 transition-all"
              >
                Save Configuration
              </button>
            </form>
          </div>

          {/* Gameweeks Scheduling Panel */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">calendar_today</span>
              <span>Create Gameweek</span>
            </h3>
            
            <form onSubmit={handleAddGameweek} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Name</label>
                  <input 
                    type="text"
                    placeholder="Gameweek 1"
                    value={newGameweek.name}
                    onChange={(e) => setNewGameweek({ ...newGameweek, name: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Deadline Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={newGameweek.deadline}
                    onChange={(e) => setNewGameweek({ ...newGameweek, deadline: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="px-6 py-2 bg-secondary text-on-secondary rounded-lg font-bold text-xs hover:brightness-110 transition-all"
              >
                Add Gameweek
              </button>
            </form>
          </div>

          {/* Match Scheduling Panel */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">schedule</span>
              <span>Schedule Match</span>
            </h3>

            <form onSubmit={handleAddMatch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Home Club</label>
                  <input 
                    type="text"
                    placeholder="Home Club"
                    value={newMatch.homeClub}
                    onChange={(e) => setNewMatch({ ...newMatch, homeClub: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Away Club</label>
                  <input 
                    type="text"
                    placeholder="Away Club"
                    value={newMatch.awayClub}
                    onChange={(e) => setNewMatch({ ...newMatch, awayClub: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Gameweek</label>
                  <select 
                    value={newMatch.gameweekId}
                    onChange={(e) => setNewMatch({ ...newMatch, gameweekId: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  >
                    {gameweeks.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Kickoff Time</label>
                  <input 
                    type="datetime-local"
                    value={newMatch.kickoff}
                    onChange={(e) => setNewMatch({ ...newMatch, kickoff: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="px-6 py-2 bg-primary-container text-on-primary-container rounded-lg font-bold text-xs hover:brightness-110 transition-all"
              >
                Schedule Match
              </button>
            </form>
          </div>

          {/* Live Stat Entry Panel */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">edit_document</span>
              <span>Live Stat Entry</span>
            </h3>

            <form onSubmit={handleSaveStat} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Player</label>
                  <select 
                    value={newStat.playerId}
                    onChange={(e) => setNewStat({ ...newStat, playerId: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select Player...</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.club})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Match</label>
                  <select 
                    value={newStat.matchId}
                    onChange={(e) => setNewStat({ ...newStat, matchId: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Select Match...</option>
                    {allMatchesList.map(m => (
                      <option key={m.id} value={m.id}>{m.gwName}: {m.homeClub} vs {m.awayClub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Minutes Played</label>
                  <input 
                    type="number"
                    value={newStat.minutesPlayed}
                    onChange={(e) => setNewStat({ ...newStat, minutesPlayed: parseInt(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Goals</label>
                  <input 
                    type="number"
                    value={newStat.goals}
                    onChange={(e) => setNewStat({ ...newStat, goals: parseInt(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Assists</label>
                  <input 
                    type="number"
                    value={newStat.assists}
                    onChange={(e) => setNewStat({ ...newStat, assists: parseInt(e.target.value) })}
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="flex items-center pt-6 gap-2">
                  <input 
                    type="checkbox"
                    id="cleanSheet"
                    checked={newStat.cleanSheet}
                    onChange={(e) => setNewStat({ ...newStat, cleanSheet: e.target.checked })}
                    className="w-4 h-4 text-primary bg-surface-container-high border-outline-variant rounded"
                  />
                  <label htmlFor="cleanSheet" className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider cursor-pointer">Clean Sheet</label>
                </div>
              </div>
              <button 
                type="submit"
                className="px-6 py-2 bg-secondary text-on-secondary rounded-lg font-bold text-xs hover:brightness-110 transition-all"
              >
                Save Player Stats
              </button>
            </form>
          </div>

          {/* Player Registry Creation / Editing */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">{editingPlayerId ? 'edit' : 'person_add'}</span>
              <span>{editingPlayerId ? 'Edit Player' : 'Add Player to Registry'}</span>
            </h3>

            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Player Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. John Doe"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Price (M)</label>
                  <input 
                    type="number"
                    step="0.1"
                    placeholder="10.0"
                    value={newPlayer.price}
                    onChange={(e) => setNewPlayer({ ...newPlayer, price: parseFloat(e.target.value) })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Club / Affiliation</label>
                  <input 
                    type="text"
                    placeholder="e.g. Kinetic FC"
                    value={newPlayer.club}
                    onChange={(e) => setNewPlayer({ ...newPlayer, club: e.target.value })}
                    required
                    className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit"
                  className="px-6 py-2 bg-primary text-on-primary rounded-lg font-bold text-xs hover:brightness-110 transition-all"
                >
                  {editingPlayerId ? 'Save Changes' : 'Add Player'}
                </button>
                {editingPlayerId && (
                  <button 
                    type="button"
                    onClick={() => {
                      setEditingPlayerId(null);
                      setNewPlayer({ name: '', club: '', price: 10 });
                    }}
                    className="px-6 py-2 bg-outline-variant text-on-surface rounded-lg font-bold text-xs hover:brightness-110 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Gameweek status freeze registry */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">lock</span>
              <span>Gameweek Action Control</span>
            </h3>

            <div className="space-y-3">
              {gameweeks.map(gw => (
                <div key={gw.id} className="flex justify-between items-center bg-surface-container p-3 rounded-lg border border-outline-variant/30">
                  <div>
                    <div className="font-bold text-sm text-on-surface">{gw.name}</div>
                    <div className="text-[10px] text-on-surface-variant font-mono">Deadline: {new Date(gw.deadline).toLocaleString()}</div>
                  </div>
                  <div>
                    {gw.isCompleted ? (
                      <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded">CLOSED</span>
                    ) : gw.isLocked ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/15 border border-primary/30 px-2.5 py-1 rounded">LOCKED</span>
                        <button 
                          onClick={() => handleCompleteGameweek(gw.id)}
                          className="text-[10px] font-bold text-tertiary border border-tertiary/30 bg-tertiary/10 hover:bg-tertiary hover:text-on-tertiary px-3 py-1 rounded transition-colors"
                        >
                          CLOSE & REVERT SQUADS
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => handleLockGameweek(gw.id)}
                        className="text-[10px] font-bold text-secondary border border-secondary/30 bg-secondary/10 hover:bg-secondary hover:text-on-secondary px-3 py-1 rounded transition-colors"
                      >
                        LOCK SQUADS & DEADLINE
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Players Registry Table for Delete actions */}
      {!loading && (
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">group</span>
            <span>Registered Players ({players.length})</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant text-xs text-on-surface-variant uppercase font-semibold">
                  <th className="py-2">Player</th>
                  <th className="py-2">Club</th>
                  <th className="py-2">Price</th>
                  <th className="py-2">Season Points</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {players.map(p => (
                  <tr key={p.id}>
                    <td className="py-3 flex items-center gap-2">
                      <PlayerAvatar name={p.name} className="w-8 h-8 text-xs" />
                      <span className="font-bold">{p.name}</span>
                    </td>
                    <td className="py-3">{p.club}</td>
                    <td className="py-3 font-mono">${p.price}M</td>
                    <td className="py-3 font-mono text-secondary font-bold">{p.totalPoints} pts</td>
                    <td className="py-3 text-right space-x-1">
                      <button 
                        onClick={() => {
                          setEditingPlayerId(p.id);
                          setNewPlayer({ name: p.name, club: p.club, price: p.price });
                        }}
                        className="text-xs font-semibold text-primary hover:underline px-2"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeletePlayer(p.id)}
                        className="text-xs font-semibold text-tertiary hover:underline px-2"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
