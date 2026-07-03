import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-hidden min-h-screen bg-surface">
      {/* Hero Section */}
      <section className="relative px-4 md:px-6 lg:px-8 py-16 max-w-7xl mx-auto overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 -left-24 w-64 h-64 bg-secondary/10 blur-[100px] rounded-full"></div>
        
        <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
          {/* Hero Copy */}
          <div className="w-full lg:w-1/2 space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-surface-container-highest border border-outline-variant">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-xs font-mono uppercase tracking-widest text-on-surface-variant">Season 2026 Now Live</span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-black text-on-surface leading-tight tracking-tight">
              Build your dream squad. <br/>
              <span className="text-primary italic">Compete with friends.</span>
            </h2>
            
            <p className="text-base md:text-lg text-on-surface-variant max-w-xl">
              The ultimate custom fantasy sports platform for friend groups. Build your squad, compete on leaderboards, and manage private leagues without goalkeeper restrictions.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <button 
                onClick={() => navigate('/register')}
                className="px-8 py-3 bg-primary-container text-on-primary-container rounded-lg font-bold text-base hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Register Now
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-transparent border border-outline-variant text-on-surface rounded-lg font-bold text-base hover:bg-surface-container-highest active:scale-95 transition-all"
              >
                Login
              </button>
            </div>
          </div>

          {/* Hero Graphic (Asymmetric Layout) */}
          <div className="w-full lg:w-1/2 relative">
            <div className="relative grid grid-cols-2 gap-4 transform rotate-2 lg:rotate-6 scale-105">
              <div className="space-y-4">
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 translate-y-8 backdrop-blur-md">
                  <div className="w-full aspect-[3/4] rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-container">
                    <span className="material-symbols-outlined text-6xl">sports_soccer</span>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs font-mono text-secondary uppercase">Elite Draft</span>
                    <span className="text-lg font-bold text-primary">$100M</span>
                  </div>
                </div>
                <div className="bg-surface-container-high border border-outline-variant rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary">query_stats</span>
                    </div>
                    <div>
                      <div className="text-on-surface font-bold text-sm">Live Analytics</div>
                      <div className="text-on-surface-variant text-xs">Real-time data feeds</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 -translate-y-8">
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <div className="text-primary font-bold text-sm mb-1">Active Scouting</div>
                  <div className="flex -space-x-2">
                    <div className="w-8 h-8 rounded-full border-2 border-surface-container bg-red-400 flex items-center justify-center text-xs text-white">Y</div>
                    <div className="w-8 h-8 rounded-full border-2 border-surface-container bg-blue-400 flex items-center justify-center text-xs text-white">A</div>
                    <div className="w-8 h-8 rounded-full border-2 border-surface-container bg-green-400 flex items-center justify-center text-xs text-white">M</div>
                    <div className="w-8 h-8 rounded-full border-2 border-surface-container bg-primary-container flex items-center justify-center text-[10px] font-bold text-white">+12</div>
                  </div>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 backdrop-blur-md">
                  <div className="w-full aspect-square rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-6xl">leaderboard</span>
                  </div>
                  <div className="text-on-surface font-bold text-sm mt-3 uppercase tracking-tighter">Global Leaderboard</div>
                  <div className="w-full bg-outline-variant h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-primary w-2/3 h-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 md:px-6 lg:px-8 py-16 max-w-7xl mx-auto">
        <div className="mb-10 text-center lg:text-left">
          <h3 className="text-3xl font-black text-on-surface mb-2">Engineered for Victory</h3>
          <p className="text-sm text-on-surface-variant">The tools you need to dominate your private and public leagues.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Feature Card */}
          <div className="md:col-span-8 bg-surface-container-low border border-outline-variant rounded-2xl p-6 relative overflow-hidden group">
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center mb-4 shadow-lg shadow-primary/30 text-white">
                  <span className="material-symbols-outlined text-2xl">groups</span>
                </div>
                <h4 className="text-2xl font-bold text-on-surface mb-2">Advanced Squad Management</h4>
                <p className="text-sm text-on-surface-variant max-w-md">
                  Tactical substitutions and roster changes without goalkeeper restrictions. All outfield players are interchangeable, allowing complete freedom to maximize your points.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="flex-1 h-[1px] bg-outline-variant"></div>
                <Link to="/register" className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                  Explore Manager <span className="material-symbols-outlined">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Secondary Card 1 */}
          <div className="md:col-span-4 bg-surface-container border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/login')}>
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-secondary text-4xl">leaderboard</span>
              <div className="px-2 py-1 bg-secondary/10 text-secondary rounded-full text-[10px] font-bold">LIVE</div>
            </div>
            <div className="mt-6">
              <h4 className="text-xl font-bold text-on-surface mb-1">Live Standings</h4>
              <p className="text-xs text-on-surface-variant">Real-time points update as the action happens on the pitch.</p>
            </div>
          </div>

          {/* Secondary Card 2 */}
          <div className="md:col-span-4 bg-surface-container border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/login')}>
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-primary text-4xl">emoji_events</span>
            </div>
            <div className="mt-6">
              <h4 className="text-xl font-bold text-on-surface mb-1">Custom Leagues</h4>
              <p className="text-xs text-on-surface-variant">Create private friend groups using a generated invite code.</p>
            </div>
          </div>

          {/* Secondary Card 3 */}
          <div className="md:col-span-8 bg-surface-container border border-outline-variant rounded-2xl p-6 flex flex-col justify-between hover:border-primary transition-colors cursor-pointer" onClick={() => navigate('/login')}>
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-tertiary text-4xl">flash_on</span>
            </div>
            <div className="mt-6">
              <h4 className="text-xl font-bold text-on-surface mb-1">Power-up Chips</h4>
              <p className="text-xs text-on-surface-variant">Activate Wildcard, Free Hit, Bench Boost, or Triple Captain to gain a competitive edge.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 max-w-7xl mx-auto text-center">
        <div className="bg-surface-container-low border border-outline-variant rounded-[2rem] p-8 md:p-12 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <h2 className="text-3xl md:text-4xl font-black text-on-surface">Ready to start your legacy?</h2>
            <p className="text-base text-on-surface-variant max-w-2xl mx-auto">Create your account now and start booking your league wins today.</p>
            <div className="pt-4">
              <button 
                onClick={() => navigate('/register')}
                className="px-8 py-3 bg-primary text-on-primary font-black rounded-full text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/40"
              >
                GET STARTED FOR FREE
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
