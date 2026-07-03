import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { request } from '../utils/api';

export default function Leagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const navigate = useNavigate();

  const fetchLeagues = async () => {
    try {
      const data = await request('/leagues');
      setLeagues(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    setIsJoining(true);
    try {
      const res = await request('/leagues/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: joinCode })
      });
      setJoinSuccess(res.message);
      setJoinCode('');
      fetchLeagues();
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setIsCreating(true);
    try {
      const res = await request('/leagues/create', {
        method: 'POST',
        body: JSON.stringify({ name: newLeagueName })
      });
      setCreateSuccess(`League "${res.name}" created! Invite code: ${res.inviteCode}`);
      setNewLeagueName('');
      fetchLeagues();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-black text-on-surface">Private Leagues</h2>
        <p className="text-xs text-on-surface-variant">Create or join private friend groups using unique codes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Joined Leagues List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">groups</span>
            <span>My Leagues</span>
          </h3>

          {loading ? (
            <div className="text-sm text-on-surface-variant">Loading leagues...</div>
          ) : leagues.length === 0 ? (
            <div className="bg-surface-container border border-outline-variant rounded-xl p-8 text-center text-on-surface-variant text-sm">
              You are not in any leagues yet. Create one or join using an invite code!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leagues.map((league) => (
                <div 
                  key={league.id} 
                  onClick={() => navigate(`/leagues/${league.id}`)}
                  className="bg-surface-container-low border border-outline-variant hover:border-primary rounded-xl p-5 cursor-pointer transition-all hover:-translate-y-0.5"
                >
                  <div className="flex justify-between items-start">
                    <h4 className="text-lg font-bold text-on-surface leading-tight mb-1">{league.name}</h4>
                    <span className="text-[10px] font-mono bg-primary/20 text-primary-fixed px-2 py-0.5 rounded">
                      Rank #{league.myRank}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-6 text-xs text-on-surface-variant font-medium">
                    <span>{league.memberCount} members</span>
                    <span className="font-mono bg-surface-container px-2 py-1 rounded select-all cursor-pointer" title="Click to copy invite code">
                      Code: {league.inviteCode}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join / Create Actions */}
        <div className="space-y-6">
          {/* Join League */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
            <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">add_circle</span>
              <span>Join a League</span>
            </h3>
            
            {joinError && (
              <div className="bg-error-container/20 border border-error/50 text-error-container text-xs rounded-lg p-2.5 mb-3">
                {joinError}
              </div>
            )}
            {joinSuccess && (
              <div className="bg-secondary/15 border border-secondary/40 text-secondary text-xs rounded-lg p-2.5 mb-3">
                {joinSuccess}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-3">
              <input 
                type="text" 
                placeholder="INVITE CODE (e.g. A9B8C7)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                required
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary text-sm font-mono text-center"
              />
              <button 
                type="submit"
                disabled={isJoining}
                className="w-full py-2.5 bg-secondary text-on-secondary font-bold rounded-lg text-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'JOIN LEAGUE'}
              </button>
            </form>
          </div>

          {/* Create League */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6">
            <h3 className="text-base font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">create_new_folder</span>
              <span>Create League</span>
            </h3>

            {createError && (
              <div className="bg-error-container/20 border border-error/50 text-error-container text-xs rounded-lg p-2.5 mb-3">
                {createError}
              </div>
            )}
            {createSuccess && (
              <div className="bg-primary/20 border border-primary/40 text-primary-fixed text-xs rounded-lg p-2.5 mb-3 font-mono">
                {createSuccess}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <input 
                type="text" 
                placeholder="League Name"
                value={newLeagueName}
                onChange={(e) => setNewLeagueName(e.target.value)}
                required
                maxLength={30}
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary text-sm"
              />
              <button 
                type="submit"
                disabled={isCreating}
                className="w-full py-2.5 bg-primary-container text-on-primary-container font-bold rounded-lg text-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'CREATE LEAGUE'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
