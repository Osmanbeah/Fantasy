import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import PlayerAvatar from '../components/Avatar';

export default function MyTeam() {
  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [playersList, setPlayersList] = useState([]);
  
  // Explicit 7 slots state (0-4 are Starters, 5-6 are Subs)
  const [squad, setSquad] = useState([null, null, null, null, null, null, null]);
  const [captainId, setCaptainId] = useState(null);
  const [viceCaptainId, setViceCaptainId] = useState(null);
  
  const [activeChips, setActiveChips] = useState([]);
  const [usedChips, setUsedChips] = useState([]);
  
  const [settings, setSettings] = useState({ creditBudget: 100, numStarters: 5, numSubs: 2 });
  const [loading, setLoading] = useState(true);

  // Search & Filter state for the picker modal
  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState('All');
  const [clubs, setClubs] = useState([]);
  const [sortBy, setSortBy] = useState('price'); // 'price' or 'points'
  const [activeSlot, setActiveSlot] = useState(null); // index (0-6) of slot being populated/replaced

  // Player Profile details state
  const [profilePlayerId, setProfilePlayerId] = useState(null);
  const [profileSlotIndex, setProfileSlotIndex] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [activeGameweek, setActiveGameweek] = useState(null);
  const [myPlayerProfile, setMyPlayerProfile] = useState(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ playerName: '', club: '', photoUrl: '' });

  // Dialog & Message states
  const [confirmChip, setConfirmChip] = useState(null); // chip code if confirming
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pickerWarning, setPickerWarning] = useState('');

  const fetchData = async () => {
    try {
      const sett = await request('/settings');
      setSettings(sett);

      const teamData = await request('/teams/my-team');
      setActiveGameweek(teamData.activeGameweek || null);
      if (teamData && teamData.team) {
        setTeam(teamData.team);
        setTeamName(teamData.team.name);
        setCaptainId(teamData.team.captainId);
        setViceCaptainId(teamData.team.viceCaptainId);
        
        // Populate the 7 slots
        const loadedStarters = teamData.team.players.filter(p => p.isStarter).map(p => p.player);
        const loadedSubs = teamData.team.players.filter(p => !p.isStarter).map(p => p.player);
        
        const initialSquad = [
          loadedStarters[0] || null,
          loadedStarters[1] || null,
          loadedStarters[2] || null,
          loadedStarters[3] || null,
          loadedStarters[4] || null,
          loadedSubs[0] || null,
          loadedSubs[1] || null
        ];
        setSquad(initialSquad);
      }
      setActiveChips(teamData.activeChips || []);
      setUsedChips(teamData.usedChips || []);

      const plList = await request('/players');
      setPlayersList(plList);

      const uniqueClubs = ['All', ...new Set(plList.map(p => p.club))];
      setClubs(uniqueClubs);

      const myProfile = await request('/users/profile');
      setMyPlayerProfile(myProfile);
      setProfileForm({ playerName: myProfile.name, club: myProfile.club, photoUrl: myProfile.photoUrl || '' });
    } catch (e) {
      console.error(e);
      setError('Failed to fetch squad data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch player profile stats on demand
  useEffect(() => {
    if (profilePlayerId) {
      request(`/players/${profilePlayerId}`)
        .then(data => setProfileData(data))
        .catch(err => console.error(err));
    } else {
      setProfileData(null);
      setConfirmRemove(false);
    }
  }, [profilePlayerId]);

  // Budget calculation driven ONLY by the 7 slots
  const totalCost = squad
    .filter(p => p !== null)
    .reduce((sum, p) => sum + p.price, 0);

  const budgetExceeded = totalCost > settings.creditBudget;
  const filledCount = squad.filter(p => p !== null).length;

  const handlePlayChip = async (chip) => {
    setConfirmChip(null);
    setError('');
    setMessage('');
    try {
      const res = await request('/teams/play-chip', {
        method: 'POST',
        body: JSON.stringify({ chip })
      });
      setMessage(res.message);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveTeam = async () => {
    setError('');
    setMessage('');
    const playerIds = squad.map(p => p?.id).filter(Boolean);
    const starterIds = squad.slice(0, 5).map(p => p?.id).filter(Boolean);

    try {
      const res = await request('/teams/save', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName,
          playerIds,
          starterIds,
          captainId,
          viceCaptainId
        })
      });
      setMessage(res.message);
      setTeam(res.team);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const updated = await request('/users/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm)
      });
      setMyPlayerProfile(updated);
      setShowProfileEdit(false);
      setMessage('Player profile updated successfully!');
      
      // Refresh players pool
      const plList = await request('/players');
      setPlayersList(plList);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetCaptain = (id) => {
    setCaptainId(id);
    if (viceCaptainId === id) {
      setViceCaptainId(null);
    }
  };

  const handleSetViceCaptain = (id) => {
    setViceCaptainId(id);
    if (captainId === id) {
      setCaptainId(null);
    }
  };

  // Move from Starter slots to Sub slots
  const handleMoveToBench = (starterIndex) => {
    const player = squad[starterIndex];
    if (!player) return;

    const firstEmptySub = squad.slice(5, 7).findIndex(p => p === null);
    if (firstEmptySub !== -1) {
      const newSquad = [...squad];
      const targetSubIndex = 5 + firstEmptySub;
      newSquad[targetSubIndex] = player;
      newSquad[starterIndex] = null;
      setSquad(newSquad);
      setProfileSlotIndex(targetSubIndex); // Shift modal focus to sub index

      // Captain/Vice-Captain cannot be a sub
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
    } else {
      setError('No empty slots available on the bench.');
    }
  };

  // Move from Sub slots to Starter slots
  const handleMoveToStartingXI = (subIndex) => {
    const player = squad[subIndex];
    if (!player) return;

    const firstEmptyStarter = squad.slice(0, 5).findIndex(p => p === null);
    if (firstEmptyStarter !== -1) {
      const newSquad = [...squad];
      newSquad[firstEmptyStarter] = player;
      newSquad[subIndex] = null;
      setSquad(newSquad);
      setProfileSlotIndex(firstEmptyStarter); // Shift modal focus to starter index
    } else {
      setError('No empty slots available in the starting XI.');
    }
  };

  // Replace a player in a specific slot
  const handleSelectPlayerForSlot = (player) => {
    setPickerWarning('');
    
    // Check if player is already in squad in another slot
    const alreadySelected = squad.some((p, idx) => idx !== activeSlot && p && p.id === player.id);
    if (alreadySelected) {
      setPickerWarning('Player is already in your squad.');
      return;
    }

    // Check if selection would exceed budget
    const currentSlotPrice = squad[activeSlot]?.price || 0;
    const projectCost = totalCost - currentSlotPrice + player.price;
    if (projectCost > settings.creditBudget) {
      setPickerWarning(`Selecting this player would exceed budget by $${(projectCost - settings.creditBudget).toFixed(1)}M.`);
      return;
    }

    // Update slot
    const newSquad = [...squad];
    newSquad[activeSlot] = player;
    setSquad(newSquad);

    // If we replace a captain/vice-captain, update references
    const prevPlayer = squad[activeSlot];
    if (prevPlayer) {
      if (captainId === prevPlayer.id) setCaptainId(player.id);
      if (viceCaptainId === prevPlayer.id) setViceCaptainId(player.id);
    } else {
      // If setting a player, auto-assign captain if empty
      if (!captainId) setCaptainId(player.id);
      else if (!viceCaptainId) setViceCaptainId(player.id);
    }

    setActiveSlot(null);
    setSearch('');
  };

  // Remove player completely from slot
  const handleRemovePlayer = (slotIndex) => {
    const player = squad[slotIndex];
    if (!player) return;

    const newSquad = [...squad];
    newSquad[slotIndex] = null;
    setSquad(newSquad);

    if (captainId === player.id) setCaptainId(null);
    if (viceCaptainId === player.id) setViceCaptainId(null);
  };

  // Sort and filter player options
  const availableOptions = playersList
    .filter(p => {
      // Exclude players already in the squad (except the one in the currently active slot we are replacing)
      const inSquadElsewhere = squad.some((sp, idx) => idx !== activeSlot && sp && sp.id === p.id);
      if (inSquadElsewhere) return false;

      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchClub = clubFilter === 'All' || p.club === clubFilter;
      return matchSearch && matchClub;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price;
      if (sortBy === 'points') return b.totalPoints - a.totalPoints;
      return 0;
    });

  const getChipStatus = (chip) => {
    if (activeChips.includes(chip)) return 'ACTIVE';
    if (usedChips.includes(chip)) return 'USED';
    return 'AVAILABLE';
  };

  const getChipBadgeClass = (status) => {
    if (status === 'ACTIVE') return 'bg-secondary text-surface border-secondary font-black scale-105';
    if (status === 'USED') return 'bg-surface-container border-outline-variant/30 text-on-surface-variant/40 line-through opacity-50 cursor-not-allowed';
    return 'bg-surface-container-low border-outline-variant text-on-surface hover:border-primary cursor-pointer active:scale-95';
  };

  // Aggregated profile stats
  const totalGoals = profileData?.matchStats?.reduce((sum, s) => sum + s.goals, 0) || 0;
  const totalAssists = profileData?.matchStats?.reduce((sum, s) => sum + s.assists, 0) || 0;
  const totalCleanSheets = profileData?.matchStats?.reduce((sum, s) => sum + (s.cleanSheet ? 1 : 0), 0) || 0;
  const totalMinutes = profileData?.matchStats?.reduce((sum, s) => sum + s.minutesPlayed, 0) || 0;
  const recentForm = profileData?.matchStats?.slice(0, 5) || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low border border-outline-variant rounded-xl p-6">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3">
            <input 
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="text-2xl font-black bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary focus:outline-none text-on-surface max-w-sm"
              placeholder="Enter Team Name"
            />
            <span className="material-symbols-outlined text-on-surface-variant text-sm">edit</span>
          </div>
          
          {/* Progress Budget Bar */}
          <div className="space-y-1 max-w-md">
            <div className="flex justify-between text-xs font-mono font-semibold">
              <span className="text-on-surface-variant">Credits: ${totalCost.toFixed(1)}M / ${settings.creditBudget}M</span>
              <span className={budgetExceeded ? 'text-tertiary font-black animate-pulse' : 'text-secondary'}>
                {budgetExceeded ? 'BUDGET EXCEEDED' : `$${(settings.creditBudget - totalCost).toFixed(1)}M remaining`}
              </span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${budgetExceeded ? 'bg-tertiary' : 'bg-primary'}`}
                style={{ width: `${Math.min((totalCost / settings.creditBudget) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleSaveTeam}
            disabled={budgetExceeded || filledCount !== 7 || activeGameweek?.isLocked}
            className="px-6 py-3 bg-secondary text-on-secondary font-bold text-sm rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {activeGameweek?.isLocked ? 'Squad Locked' : 'Save Squad Changes'}
          </button>
          <button 
            onClick={() => {
              if (myPlayerProfile) {
                setProfileForm({
                  playerName: myPlayerProfile.name,
                  club: myPlayerProfile.club,
                  photoUrl: myPlayerProfile.photoUrl || ''
                });
              }
              setShowProfileEdit(true);
            }}
            className="px-6 py-3 bg-surface-container-high text-on-surface border border-outline-variant font-bold text-sm rounded-lg hover:bg-surface-container-highest active:scale-95 transition-all"
          >
            Customize Profile
          </button>
        </div>
      </div>

      {activeGameweek?.isLocked && (
        <div className="bg-primary/10 border border-primary/30 text-primary text-xs rounded-lg p-3.5 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm font-black">lock</span>
          <span>Squad transfers are locked because <strong>{activeGameweek.name}</strong> has been locked by the admin. You can still view player profiles.</span>
        </div>
      )}

      {error && (
        <div className="bg-error-container/20 border border-error/50 text-error-container text-xs rounded-lg p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-secondary/15 border border-secondary/40 text-secondary text-xs rounded-lg p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>{message}</span>
        </div>
      )}

      {/* Chip Selection bar */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <div className="text-xs font-mono font-bold text-on-surface-variant uppercase mb-2 tracking-wider">Manager Chips</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {['WILDCARD', 'FREE_HIT', 'BENCH_BOOST', 'TRIPLE_CAPTAIN'].map(chip => {
            const status = getChipStatus(chip);
            return (
              <div 
                key={chip}
                onClick={() => status === 'AVAILABLE' && setConfirmChip(chip)}
                className={`border p-3 rounded-lg text-center select-none transition-all flex flex-col items-center justify-center gap-1 ${getChipBadgeClass(status)}`}
              >
                <div className="text-xs font-black tracking-tight">{chip.replace('_', ' ')}</div>
                <div className="text-[9px] font-mono font-bold opacity-80">{status}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pitch view column centered */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-on-surface flex items-center gap-2 justify-center">
          <span className="material-symbols-outlined text-primary">sports_soccer</span>
          <span>Squad Configuration ({filledCount}/7 Filled)</span>
        </h3>

        <div className="pitch-container p-4 flex flex-col justify-between aspect-[3/4] lg:aspect-[4/5] min-h-[420px] max-w-md mx-auto">
          {/* White Pitch Markings */}
          <div className="pitch-line top-0 left-0 right-0 h-1/2 border-b border-white/10"></div>
          <div className="pitch-line top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/10"></div>
          <div className="pitch-line top-0 left-1/4 right-1/4 h-14 border-x border-b border-white/10"></div>
          <div className="pitch-line bottom-0 left-1/4 right-1/4 h-14 border-x border-t border-white/10"></div>

          {/* Starter positions (1-2-2 layout) */}
          <div className="relative z-10 flex-1 flex flex-col justify-around py-4">
            
            {/* Row 1: Forward (Slot 0) */}
            <div className="flex justify-center">
              {squad[0] ? (
                <PitchCard 
                  player={squad[0]} 
                  isCaptain={captainId === squad[0].id}
                  isVice={viceCaptainId === squad[0].id}
                  onViewProfile={() => { setProfileSlotIndex(0); setProfilePlayerId(squad[0].id); }}
                />
              ) : (
                <EmptySlot placeholder="Forward" onClick={() => !activeGameweek?.isLocked && setActiveSlot(0)} />
              )}
            </div>

            {/* Row 2: Midfield (Slots 1, 2) */}
            <div className="flex justify-around">
              {[1, 2].map((idx) => {
                const player = squad[idx];
                return player ? (
                  <PitchCard 
                    key={idx}
                    player={player} 
                    isCaptain={captainId === player.id}
                    isVice={viceCaptainId === player.id}
                    onViewProfile={() => { setProfileSlotIndex(idx); setProfilePlayerId(player.id); }}
                  />
                ) : (
                  <EmptySlot key={idx} placeholder="Midfield" onClick={() => !activeGameweek?.isLocked && setActiveSlot(idx)} />
                );
              })}
            </div>

            {/* Row 3: Defense (Slots 3, 4) */}
            <div className="flex justify-around">
              {[3, 4].map((idx) => {
                const player = squad[idx];
                return player ? (
                  <PitchCard 
                    key={idx}
                    player={player} 
                    isCaptain={captainId === player.id}
                    isVice={viceCaptainId === player.id}
                    onViewProfile={() => { setProfileSlotIndex(idx); setProfilePlayerId(player.id); }}
                  />
                ) : (
                  <EmptySlot key={idx} placeholder="Defense" onClick={() => !activeGameweek?.isLocked && setActiveSlot(idx)} />
                );
              })}
            </div>

          </div>
        </div>

        {/* Substitutes row */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 max-w-md mx-auto w-full">
          <div className="text-xs font-mono font-bold text-on-surface-variant uppercase mb-3 tracking-wider text-center">Substitutes</div>
          <div className="flex justify-around gap-4">
            {[5, 6].map((idx) => {
              const player = squad[idx];
              return player ? (
                <PitchCard 
                  key={idx}
                  player={player}
                  isSub={true}
                  onViewProfile={() => { setProfileSlotIndex(idx); setProfilePlayerId(player.id); }}
                />
              ) : (
                <EmptySlot key={idx} placeholder="Substitute" onClick={() => !activeGameweek?.isLocked && setActiveSlot(idx)} />
              );
            })}
          </div>
        </div>
      </div>

      {/* ----------------- MODAL PLAYER PICKER ----------------- */}
      {activeSlot !== null && (
        <div className="fixed inset-0 bg-surface/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 max-w-md w-full flex flex-col max-h-[85vh] shadow-2xl relative">
            
            {/* Close button */}
            <button 
              onClick={() => { setActiveSlot(null); setPickerWarning(''); setSearch(''); }}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person_search</span>
              <span>Draft a Player for {activeSlot < 5 ? `Starter Slot #${activeSlot + 1}` : `Sub Slot #${activeSlot - 4}`}</span>
            </h3>

            {pickerWarning && (
              <div className="bg-error-container/20 border border-error/50 text-error-container text-xs rounded-lg p-2.5 mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>{pickerWarning}</span>
              </div>
            )}

            {/* Filters */}
            <div className="space-y-3 mb-4 flex-shrink-0">
              <input 
                type="text"
                placeholder="Search player name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-xs"
              />
              <div className="flex gap-2 justify-between">
                <select 
                  value={clubFilter}
                  onChange={(e) => setClubFilter(e.target.value)}
                  className="bg-surface-container-high border border-outline-variant text-on-surface text-[10px] rounded px-2 py-1 flex-1 font-semibold"
                >
                  {clubs.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-surface-container-high border border-outline-variant text-on-surface text-[10px] rounded px-2 py-1 flex-1 font-semibold"
                >
                  <option value="price">Sort by Price</option>
                  <option value="points">Sort by Points</option>
                </select>
              </div>
            </div>

            {/* List options */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {availableOptions.map(player => (
                <div 
                  key={player.id}
                  className="flex justify-between items-center p-3 bg-surface-container border border-outline-variant hover:border-primary rounded-lg text-xs transition-all animate-fade-in"
                >
                  <div 
                    className="flex items-center gap-2 cursor-pointer hover:opacity-85" 
                    title="Click to view player profile"
                    onClick={() => { setProfileSlotIndex(null); setProfilePlayerId(player.id); }}
                  >
                    <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="w-8 h-8 text-[10px]" />
                    <div className="text-left">
                      <div className="font-bold text-on-surface flex items-center gap-1">
                        <span>{player.name}</span>
                        <span className="material-symbols-outlined text-[10px] text-primary">info</span>
                      </div>
                      <div className="text-[10px] text-on-surface-variant">{player.club}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-primary">${player.price}M</div>
                      <div className="text-[9px] text-on-surface-variant font-mono">{player.totalPoints} pts</div>
                    </div>
                    <button 
                      onClick={() => handleSelectPlayerForSlot(player)}
                      className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:brightness-110 font-bold"
                    >
                      DRAFT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ----------------- PLAYER PROFILE MODAL / BOTTOM SHEET ----------------- */}
      {profilePlayerId !== null && (
        <div 
          className="fixed inset-0 bg-surface/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => { setProfilePlayerId(null); setProfileData(null); }}
        >
          <div 
            className="bg-surface-container-low border border-outline-variant p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden relative
              max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:rounded-t-3xl max-sm:animate-slide-up
              sm:rounded-2xl sm:max-w-md sm:w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => { setProfilePlayerId(null); setProfileData(null); }}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface z-10"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {!profileData ? (
              <div className="text-xs text-on-surface-variant text-center py-20 font-mono">Loading statistics...</div>
            ) : (
              <div className="space-y-5 overflow-y-auto pr-1">
                {/* Header Information */}
                <div className="flex items-start gap-4">
                  <PlayerAvatar name={profileData.name} photoUrl={profileData.photoUrl} className="w-14 h-14 text-lg border-2 border-primary/20" />
                  <div className="text-left flex-1 relative">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-base text-on-surface leading-tight">{profileData.name}</h4>
                      {captainId === profileData.id && (
                        <span className="flex items-center gap-0.5 bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          <span className="material-symbols-outlined text-[10px]">emoji_events</span>CAPTAIN
                        </span>
                      )}
                      {viceCaptainId === profileData.id && (
                        <span className="flex items-center gap-0.5 bg-primary/20 text-primary border border-primary/30 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                          <span className="material-symbols-outlined text-[10px]">shield</span>VICE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{profileData.club}</p>
                    <div className="mt-2 text-xs font-mono font-bold text-primary">
                      Price: ${profileData.price}M
                    </div>
                  </div>
                </div>

                {/* Season stats section */}
                <div className="bg-surface-container border border-outline-variant p-4 rounded-xl space-y-3">
                  <h5 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider text-left">Aggregated Season Stats</h5>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-surface-container-high p-2 rounded border border-outline-variant/30">
                      <div className="text-[10px] text-on-surface-variant">PTS</div>
                      <div className="text-sm font-black text-secondary font-mono">{profileData.totalPoints}</div>
                    </div>
                    <div className="bg-surface-container-high p-2 rounded border border-outline-variant/30">
                      <div className="text-[10px] text-on-surface-variant">MIN</div>
                      <div className="text-xs font-bold text-on-surface font-mono">{totalMinutes}</div>
                    </div>
                    <div className="bg-surface-container-high p-2 rounded border border-outline-variant/30">
                      <div className="text-[10px] text-on-surface-variant">GLS</div>
                      <div className="text-xs font-bold text-on-surface font-mono">{totalGoals}</div>
                    </div>
                    <div className="bg-surface-container-high p-2 rounded border border-outline-variant/30">
                      <div className="text-[10px] text-on-surface-variant">AST</div>
                      <div className="text-xs font-bold text-on-surface font-mono">{totalAssists}</div>
                    </div>
                    <div className="bg-surface-container-high p-2 rounded border border-outline-variant/30">
                      <div className="text-[10px] text-on-surface-variant">CS</div>
                      <div className="text-xs font-bold text-on-surface font-mono">{totalCleanSheets}</div>
                    </div>
                  </div>
                </div>

                {/* Recent Form */}
                <div className="space-y-2">
                  <h5 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-wider text-left">Recent Form (Last 5 Games)</h5>
                  {recentForm.length === 0 ? (
                    <div className="text-[10px] text-on-surface-variant text-center py-4 bg-surface-container/50 rounded-lg">No matches played recently</div>
                  ) : (
                    <div className="flex gap-2 justify-start overflow-x-auto py-1">
                      {recentForm.map(stat => (
                        <div key={stat.id} className="flex-shrink-0 bg-surface-container-high border border-outline-variant/50 p-2.5 rounded-lg text-center min-w-[70px]">
                          <div className="text-[8px] font-bold text-on-surface-variant uppercase truncate w-14">{stat.match.gameweek.name}</div>
                          <div className="text-xs font-black text-secondary font-mono mt-1">+{stat.points} pts</div>
                          <div className="text-[7px] text-on-surface-variant/75 mt-0.5 truncate w-14 font-mono">{stat.minutesPlayed} mins</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions at the bottom of the modal */}
                {profileSlotIndex !== null && !activeGameweek?.isLocked && (
                  <div className="border-t border-outline-variant pt-4 space-y-3">
                    {/* Role toggles (only if in Starting XI) */}
                    {profileSlotIndex < 5 && (
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => handleSetCaptain(profileData.id)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs border transition-all ${
                            captainId === profileData.id 
                              ? 'bg-amber-500/20 border-amber-500 text-amber-500' 
                              : 'bg-surface-container border-outline-variant text-on-surface hover:border-amber-500'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">emoji_events</span>
                          <span>{captainId === profileData.id ? 'Captain Active' : 'Make Captain'}</span>
                        </button>
                        <button 
                          onClick={() => handleSetViceCaptain(profileData.id)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs border transition-all ${
                            viceCaptainId === profileData.id 
                              ? 'bg-primary/20 border-primary text-primary font-black' 
                              : 'bg-surface-container border-outline-variant text-on-surface hover:border-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">shield</span>
                          <span>{viceCaptainId === profileData.id ? 'Vice Active' : 'Make Vice'}</span>
                        </button>
                      </div>
                    )}

                    {/* Move to Bench / Moving to Starting XI */}
                    {profileSlotIndex < 5 ? (
                      <button 
                        onClick={() => handleMoveToBench(profileSlotIndex)}
                        disabled={squad[5] !== null && squad[6] !== null}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-surface-container border border-outline-variant hover:border-primary disabled:opacity-40 disabled:hover:border-outline-variant text-on-surface rounded-lg font-bold text-xs transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        <span>Move to Bench</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleMoveToStartingXI(profileSlotIndex)}
                        disabled={!squad.slice(0, 5).includes(null)}
                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-surface-container border border-outline-variant hover:border-primary disabled:opacity-40 disabled:hover:border-outline-variant text-on-surface rounded-lg font-bold text-xs transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        <span>Move to Starting XI</span>
                      </button>
                    )}

                    {/* Remove from Squad block */}
                    <div className="pt-1">
                      {confirmRemove ? (
                        <div className="bg-error-container/15 border border-error/50 p-2.5 rounded-lg flex items-center justify-between text-xs animate-fade-in">
                          <span className="text-on-surface font-semibold">Confirm removal?</span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => setConfirmRemove(false)}
                              className="px-2 py-1 text-on-surface font-bold hover:underline"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleRemovePlayer(profileSlotIndex)}
                              className="px-2.5 py-1 bg-error text-on-error font-bold rounded"
                            >
                              Yes, Remove
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmRemove(true)}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border border-error/40 text-error hover:bg-error hover:text-on-error rounded-lg font-bold text-xs transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                          <span>Remove from Squad</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container border border-outline-variant rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">account_circle</span>
              <span>Customize Player Profile</span>
            </h3>
            <p className="text-xs text-on-surface-variant">Update how you appear as a draftable player in everyone's team selection pool.</p>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Player Name</label>
                <input 
                  type="text" 
                  value={profileForm.playerName}
                  onChange={(e) => setProfileForm({ ...profileForm, playerName: e.target.value })}
                  required
                  className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="Your Name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Club / Affiliation</label>
                <input 
                  type="text" 
                  value={profileForm.club}
                  onChange={(e) => setProfileForm({ ...profileForm, club: e.target.value })}
                  required
                  className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="Your Club"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Photo URL</label>
                <input 
                  type="url" 
                  value={profileForm.photoUrl}
                  onChange={(e) => setProfileForm({ ...profileForm, photoUrl: e.target.value })}
                  className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-[10px] text-on-surface-variant/80 mt-1">Provide an image link from the web to show your photo.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowProfileEdit(false)}
                  className="px-4 py-2 text-xs font-bold bg-surface-container-high text-on-surface border border-outline-variant rounded-lg hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-primary text-on-primary rounded-lg hover:brightness-110 transition-colors"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chip Play Confirmation Modal */}
      {confirmChip && (
        <div className="fixed inset-0 bg-surface/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-surface-container border border-outline-variant rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h4 className="text-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">warning</span>
              <span>Confirm Chip Play</span>
            </h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to activate the **{confirmChip.replace('_', ' ')}** chip for the upcoming gameweek? 
              <br/><br/>
              <span className="text-xs text-tertiary">This action cannot be undone once confirmed.</span>
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => setConfirmChip(null)}
                className="px-4 py-2 border border-outline-variant text-on-surface text-xs font-bold rounded-lg hover:bg-surface-container-high"
              >
                CANCEL
              </button>
              <button 
                onClick={() => handlePlayChip(confirmChip)}
                className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:brightness-110"
              >
                CONFIRM PLAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper components for Pitch cards
function PitchCard({ player, isCaptain, isVice, isSub, onViewProfile }) {
  return (
    <div className="flex flex-col items-center select-none group relative">
      {/* Main card body */}
      <div 
        onClick={onViewProfile}
        className="w-16 h-20 md:w-20 md:h-24 bg-surface-container-lowest/80 border border-outline-variant hover:border-primary cursor-pointer rounded-lg p-2 flex flex-col items-center justify-between text-center relative backdrop-blur-sm transition-transform active:scale-95"
      >
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} className="w-8 h-8 md:w-10 md:h-10 text-[10px] md:text-xs" />
        
        <div className="w-full space-y-1">
          <div className="font-bold text-[9px] md:text-[10px] text-on-surface truncate w-full">{player.name}</div>
          <div className="bg-primary/15 border border-primary/30 text-primary font-bold text-[8px] md:text-[9px] px-1.5 py-0.5 rounded-sm w-fit mx-auto font-mono">
            {player.totalPoints || 0} pts
          </div>
        </div>

        {/* Roles status badges */}
        {isCaptain && (
          <span className="absolute top-1 right-1 bg-amber-500 text-surface text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">C</span>
        )}
        {isVice && (
          <span className="absolute top-1 right-1 bg-primary text-surface text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow">V</span>
        )}
      </div>
    </div>
  );
}

function EmptySlot({ placeholder, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="w-16 h-20 md:w-20 md:h-24 border-2 border-dashed border-outline-variant/40 hover:border-primary/60 cursor-pointer rounded-lg flex flex-col items-center justify-center text-center p-2 transition-transform active:scale-95"
    >
      <span className="material-symbols-outlined text-on-surface-variant/40 text-lg">add_circle</span>
      <span className="text-[8px] text-on-surface-variant/50 mt-1 uppercase tracking-wider">{placeholder}</span>
    </div>
  );
}
