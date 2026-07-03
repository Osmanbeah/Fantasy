import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import PlayerAvatar from '../components/Avatar';

export default function MyTeam() {
  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [playersList, setPlayersList] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [starterIds, setStarterIds] = useState([]);
  const [captainId, setCaptainId] = useState(null);
  const [viceCaptainId, setViceCaptainId] = useState(null);
  
  const [activeChips, setActiveChips] = useState([]);
  const [usedChips, setUsedChips] = useState([]);
  
  const [settings, setSettings] = useState({ creditBudget: 100, numStarters: 5, numSubs: 2 });
  const [loading, setLoading] = useState(true);

  // Search & Filter Panel states
  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState('All');
  const [clubs, setClubs] = useState([]);
  const [sortBy, setSortBy] = useState('price'); // 'price' or 'points'
  const [activeSlot, setActiveSlot] = useState(null); // { index, isStarter } represents the slot user wants to replace

  // Dialog & Message states
  const [confirmChip, setConfirmChip] = useState(null); // chip code if confirming
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchData = async () => {
    try {
      const sett = await request('/admin/settings');
      setSettings(sett);

      const teamData = await request('/teams/my-team');
      if (teamData && teamData.team) {
        setTeam(teamData.team);
        setTeamName(teamData.team.name);
        setCaptainId(teamData.team.captainId);
        setViceCaptainId(teamData.team.viceCaptainId);
        
        const ids = teamData.team.players.map(p => p.playerId);
        setSelectedPlayerIds(ids);
        
        const starters = teamData.team.players.filter(p => p.isStarter).map(p => p.playerId);
        setStarterIds(starters);
      }
      setActiveChips(teamData.activeChips || []);
      setUsedChips(teamData.usedChips || []);

      const plList = await request('/players');
      setPlayersList(plList);

      const uniqueClubs = ['All', ...new Set(plList.map(p => p.club))];
      setClubs(uniqueClubs);
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

  const totalCost = playersList
    .filter(p => selectedPlayerIds.includes(p.id))
    .reduce((sum, p) => sum + p.price, 0);

  const budgetExceeded = totalCost > settings.creditBudget;
  const squadCount = selectedPlayerIds.length;
  const startersCount = starterIds.length;

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
    try {
      const res = await request('/teams/save', {
        method: 'POST',
        body: JSON.stringify({
          name: teamName,
          playerIds: selectedPlayerIds,
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

  // Replace a player in squad
  const handleSwapPlayer = (currentPlayerId, newPlayer) => {
    if (selectedPlayerIds.includes(newPlayer.id)) {
      setError('Player is already in your squad.');
      return;
    }

    // Replace the player ID in selection list
    const newSelection = selectedPlayerIds.map(id => id === currentPlayerId ? newPlayer.id : id);
    setSelectedPlayerIds(newSelection);

    // If the swapped player was starter, preserve starter status
    if (starterIds.includes(currentPlayerId)) {
      setStarterIds(starterIds.map(id => id === currentPlayerId ? newPlayer.id : id));
    }

    // Preserve captain/vice-captain if swapping them
    if (captainId === currentPlayerId) {
      setCaptainId(newPlayer.id);
    }
    if (viceCaptainId === currentPlayerId) {
      setViceCaptainId(newPlayer.id);
    }

    setActiveSlot(null);
  };

  // Add player to first empty slot
  const handleAddPlayerToEmptySlot = (player) => {
    if (selectedPlayerIds.includes(player.id)) {
      setError('Player is already in your squad.');
      return;
    }

    const totalSlots = settings.numStarters + settings.numSubs;
    if (selectedPlayerIds.length >= totalSlots) {
      setError('Your squad is full. Click on a player to swap them out.');
      return;
    }

    setSelectedPlayerIds([...selectedPlayerIds, player.id]);

    // Set as starter if starter spots are not full
    if (starterIds.length < settings.numStarters) {
      setStarterIds([...starterIds, player.id]);
    }

    // Set default captain/vice-captain if none
    if (!captainId) setCaptainId(player.id);
    else if (!viceCaptainId) setViceCaptainId(player.id);
  };

  // Remove player completely
  const handleRemovePlayer = (playerId) => {
    setSelectedPlayerIds(selectedPlayerIds.filter(id => id !== playerId));
    setStarterIds(starterIds.filter(id => id !== playerId));
    if (captainId === playerId) setCaptainId(null);
    if (viceCaptainId === playerId) setViceCaptainId(null);
  };

  // Build grid slot allocations (1-2-2 Pitch Layout)
  const starterPlayers = playersList.filter(p => selectedPlayerIds.includes(p.id) && starterIds.includes(p.id));
  const subPlayers = playersList.filter(p => selectedPlayerIds.includes(p.id) && !starterIds.includes(p.id));

  // Sort and filter browsers list
  const filteredBrowserPlayers = playersList
    .filter(p => {
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
            disabled={budgetExceeded || selectedPlayerIds.length !== (settings.numStarters + settings.numSubs)}
            className="px-6 py-3 bg-secondary text-on-secondary font-bold text-sm rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-secondary/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Squad Changes
          </button>
        </div>
      </div>

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

      {/* Main Pitch and Browser view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: CSS Football Pitch */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">sports_soccer</span>
            <span>Squad Pitch View (5 Starters + 2 Subs)</span>
          </h3>

          <div className="pitch-container p-4 flex flex-col justify-between aspect-[3/4] lg:aspect-[4/5] min-h-[420px] max-w-md mx-auto">
            {/* White Pitch Markings */}
            <div className="pitch-line top-0 left-0 right-0 h-1/2 border-b border-white/10"></div>
            <div className="pitch-line top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/10"></div>
            <div className="pitch-line top-0 left-1/4 right-1/4 h-14 border-x border-b border-white/10"></div>
            <div className="pitch-line bottom-0 left-1/4 right-1/4 h-14 border-x border-t border-white/10"></div>

            {/* Starter positions (1-2-2 layout) */}
            <div className="relative z-10 flex-1 flex flex-col justify-around py-4">
              
              {/* Row 1: Forward (1 player) */}
              <div className="flex justify-center">
                {starterPlayers[0] ? (
                  <PitchCard 
                    player={starterPlayers[0]} 
                    isCaptain={captainId === starterPlayers[0].id}
                    isVice={viceCaptainId === starterPlayers[0].id}
                    onMakeCaptain={() => setCaptainId(starterPlayers[0].id)}
                    onMakeVice={() => setViceCaptainId(starterPlayers[0].id)}
                    onSwap={() => setActiveSlot(0)}
                    onRemove={() => handleRemovePlayer(starterPlayers[0].id)}
                  />
                ) : (
                  <EmptySlot placeholder="Forward slot" onClick={() => setActiveSlot(0)} />
                )}
              </div>

              {/* Row 2: Midfield (2 players) */}
              <div className="flex justify-around">
                {[1, 2].map((idx) => {
                  const player = starterPlayers[idx];
                  return player ? (
                    <PitchCard 
                      key={player.id}
                      player={player} 
                      isCaptain={captainId === player.id}
                      isVice={viceCaptainId === player.id}
                      onMakeCaptain={() => setCaptainId(player.id)}
                      onMakeVice={() => setViceCaptainId(player.id)}
                      onSwap={() => setActiveSlot(idx)}
                      onRemove={() => handleRemovePlayer(player.id)}
                    />
                  ) : (
                    <EmptySlot key={idx} placeholder="Midfield slot" onClick={() => setActiveSlot(idx)} />
                  );
                })}
              </div>

              {/* Row 3: Defense (2 players) */}
              <div className="flex justify-around">
                {[3, 4].map((idx) => {
                  const player = starterPlayers[idx];
                  return player ? (
                    <PitchCard 
                      key={player.id}
                      player={player} 
                      isCaptain={captainId === player.id}
                      isVice={viceCaptainId === player.id}
                      onMakeCaptain={() => setCaptainId(player.id)}
                      onMakeVice={() => setViceCaptainId(player.id)}
                      onSwap={() => setActiveSlot(idx)}
                      onRemove={() => handleRemovePlayer(player.id)}
                    />
                  ) : (
                    <EmptySlot key={idx} placeholder="Defense slot" onClick={() => setActiveSlot(idx)} />
                  );
                })}
              </div>

            </div>
          </div>

          {/* Substitutes row */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 max-w-md mx-auto w-full">
            <div className="text-xs font-mono font-bold text-on-surface-variant uppercase mb-3 tracking-wider">Substitutes</div>
            <div className="flex justify-around gap-4">
              {[0, 1].map((subIdx) => {
                const player = subPlayers[subIdx];
                return player ? (
                  <PitchCard 
                    key={player.id}
                    player={player}
                    isSub={true}
                    onSwap={() => setActiveSlot(5 + subIdx)}
                    onRemove={() => handleRemovePlayer(player.id)}
                  />
                ) : (
                  <EmptySlot key={subIdx} placeholder="Sub Slot" onClick={() => setActiveSlot(5 + subIdx)} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Player browser */}
        <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 flex flex-col max-h-[650px] overflow-hidden">
          <h3 className="text-lg font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person_search</span>
            <span>Roster Directory</span>
          </h3>

          <div className="space-y-3 mb-4 flex-shrink-0">
            {/* Search */}
            <input 
              type="text"
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-3 py-2 text-xs"
            />
            {/* Club Filter & Sorting */}
            <div className="flex gap-2 justify-between">
              <select 
                value={clubFilter}
                onChange={(e) => setClubFilter(e.target.value)}
                className="bg-surface-container-high border border-outline-variant text-on-surface text-[10px] rounded px-2 py-1 flex-1"
              >
                {clubs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-container-high border border-outline-variant text-on-surface text-[10px] rounded px-2 py-1 flex-1"
              >
                <option value="price">Sort by Price</option>
                <option value="points">Sort by Points</option>
              </select>
            </div>
          </div>

          {/* Browser list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredBrowserPlayers.map(player => {
              const inSquad = selectedPlayerIds.includes(player.id);
              return (
                <div 
                  key={player.id}
                  className={`flex justify-between items-center p-3 rounded-lg border text-xs transition-colors ${
                    inSquad 
                      ? 'bg-surface-container/30 border-outline-variant/20 opacity-50' 
                      : 'bg-surface-container border-outline-variant hover:border-primary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <PlayerAvatar name={player.name} className="w-8 h-8 text-[10px]" />
                    <div>
                      <div className="font-bold text-on-surface">{player.name}</div>
                      <div className="text-[10px] text-on-surface-variant">{player.club}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono font-bold text-primary">${player.price}M</div>
                      <div className="text-[9px] text-on-surface-variant font-mono">{player.totalPoints} pts</div>
                    </div>
                    {inSquad ? (
                      <button 
                        onClick={() => handleRemovePlayer(player.id)}
                        className="p-1 rounded bg-error-container/20 text-error hover:bg-error hover:text-on-error"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          if (activeSlot !== null) {
                            // Swap player
                            const currentId = selectedPlayerIds[activeSlot];
                            handleSwapPlayer(currentId, player);
                          } else {
                            handleAddPlayerToEmptySlot(player);
                          }
                        }}
                        className="p-1.5 rounded bg-primary-container text-on-primary-container hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

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

// Helpers components for Pitch cards
function PitchCard({ player, isCaptain, isVice, isSub, onMakeCaptain, onMakeVice, onSwap, onRemove }) {
  return (
    <div className="flex flex-col items-center select-none group relative">
      
      {/* Absolute controls overlay on hover */}
      {!isSub && (
        <div className="absolute -top-8 bg-surface-container-lowest border border-outline-variant rounded-md shadow-md p-1 hidden group-hover:flex gap-1.5 z-20">
          <button 
            onClick={onMakeCaptain}
            className={`p-1 rounded flex items-center justify-center ${isCaptain ? 'text-amber-500' : 'text-on-surface-variant hover:text-amber-500'}`}
            title="Set Captain"
          >
            <span className="material-symbols-outlined text-sm font-black">emoji_events</span>
          </button>
          <button 
            onClick={onMakeVice}
            className={`p-1 rounded flex items-center justify-center ${isVice ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
            title="Set Vice Captain"
          >
            <span className="material-symbols-outlined text-sm">shield</span>
          </button>
        </div>
      )}

      {/* Main card body */}
      <div 
        onClick={onSwap}
        className="w-16 h-20 md:w-20 md:h-24 bg-surface-container-lowest/80 border border-outline-variant hover:border-primary cursor-pointer rounded-lg p-2 flex flex-col items-center justify-between text-center relative backdrop-blur-sm"
      >
        <PlayerAvatar name={player.name} className="w-8 h-8 md:w-10 md:h-10 text-[10px] md:text-xs" />
        
        <div className="w-full">
          <div className="font-bold text-[9px] md:text-[10px] text-on-surface truncate w-full">{player.name}</div>
          <div className="text-[8px] md:text-[9px] text-on-surface-variant font-mono">${player.price}M</div>
        </div>

        {/* Roles status badges */}
        {isCaptain && (
          <span className="absolute top-1 right-1 bg-amber-500 text-surface text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">C</span>
        )}
        {isVice && (
          <span className="absolute top-1 right-1 bg-primary text-surface text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">V</span>
        )}
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="text-[8px] font-bold text-tertiary hover:underline mt-1 bg-surface-container-lowest/50 px-1 py-0.5 rounded"
      >
        Remove
      </button>
    </div>
  );
}

function EmptySlot({ placeholder, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="w-16 h-20 md:w-20 md:h-24 border-2 border-dashed border-outline-variant/40 hover:border-primary/60 cursor-pointer rounded-lg flex flex-col items-center justify-center text-center p-2"
    >
      <span className="material-symbols-outlined text-on-surface-variant/40 text-lg">add_circle</span>
      <span className="text-[8px] text-on-surface-variant/50 mt-1 uppercase tracking-wider">{placeholder}</span>
    </div>
  );
}
