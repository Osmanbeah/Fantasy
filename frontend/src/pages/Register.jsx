import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request, setToken, setUser } from '../utils/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password })
      });
      setToken(data.token);
      setUser(data.user);
      navigate('/team-builder');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant rounded-2xl p-8 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-2 justify-center mb-6 cursor-pointer" onClick={() => navigate('/')}>
          <span className="material-symbols-outlined text-primary text-[32px]">sports_score</span>
          <h1 className="text-2xl font-black tracking-tighter text-primary">KINETIC FANTASY</h1>
        </div>

        <h2 className="text-xl font-bold text-center text-on-surface mb-2">Create Account</h2>
        <p className="text-xs text-center text-on-surface-variant mb-6">Build your squad and dominate private leagues</p>

        {error && (
          <div className="bg-error-container/30 border border-error/50 text-error-container text-xs rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="name@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="yassin123"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-container text-on-primary-container font-bold rounded-lg text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-center text-on-surface-variant mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-semibold">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
