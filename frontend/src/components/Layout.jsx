import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getUser, logout } from '../utils/api';
import PlayerAvatar from './Avatar';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return <>{children}</>;
  }

  const navLinks = [
    { name: 'My Team', path: '/team-builder', icon: 'groups' },
    { name: 'Stats', path: '/stats', icon: 'query_stats' },
    { name: 'Leaderboard', path: '/leaderboard', icon: 'leaderboard' },
    { name: 'Leagues', path: '/leagues', icon: 'emoji_events' },
  ];

  if (user.role === 'ADMIN') {
    navLinks.push({ name: 'Admin', path: '/admin', icon: 'admin_panel_settings' });
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col pb-16 md:pb-0">
      {/* Desktop TopAppBar */}
      <header className="fixed top-0 w-full z-50 border-b border-outline-variant bg-surface-container-low/80 backdrop-blur-md">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          {/* Logo */}
          <div 
            onClick={() => navigate('/team-builder')}
            className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-primary text-[32px]">sports_score</span>
            <h1 className="text-xl font-black tracking-tighter text-primary">KINETIC FANTASY</h1>
          </div>
          
          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link 
                key={link.path}
                to={link.path}
                className={`font-semibold text-sm transition-colors py-2 ${
                  location.pathname === link.path 
                    ? 'text-primary' 
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>
          
          {/* User Profile / Logout */}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-xs font-semibold text-on-surface-variant font-mono uppercase bg-surface-container-high px-2 py-1 rounded">
              {user.role}
            </span>
            <div className="flex items-center gap-2 group relative">
              <PlayerAvatar name={user.username} className="w-9 h-9 text-xs cursor-pointer hover:ring-2 hover:ring-primary transition-all" />
              <button 
                onClick={handleLogout}
                className="hidden md:flex items-center justify-center p-2 rounded-full hover:bg-error-container/20 text-on-surface-variant hover:text-error transition-all"
                title="Logout"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-2 text-on-surface-variant hover:text-primary"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-surface/90 backdrop-blur-md pt-20 px-6 flex flex-col gap-4 md:hidden">
          {navLinks.map(link => (
            <Link 
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 p-4 rounded-xl border border-outline-variant font-bold text-lg ${
                location.pathname === link.path 
                  ? 'bg-primary-container/20 border-primary text-primary' 
                  : 'bg-surface-container text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined">{link.icon}</span>
              <span>{link.name}</span>
            </Link>
          ))}
          <button 
            onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
            className="flex items-center gap-3 p-4 rounded-xl border border-error/30 bg-error-container/10 text-error font-bold text-lg mt-auto mb-20"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="pt-28 md:pt-32 flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container border-t border-outline-variant z-35 flex justify-around py-2">
        {navLinks.filter(l => l.name !== 'Admin').map(link => (
          <Link 
            key={link.path}
            to={link.path}
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              location.pathname === link.path ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{link.icon}</span>
            <span>{link.name}</span>
          </Link>
        ))}
        {user.role === 'ADMIN' && (
          <Link 
            to="/admin"
            className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
              location.pathname === '/admin' ? 'text-primary' : 'text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
