import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { request, setToken, setUser } from '../utils/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [club, setClub] = useState('Real Madrid');
  const [customClub, setCustomClub] = useState('');
  const [photoBase64, setPhotoBase64] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!photoBase64) {
      setError('A portrait photo of yourself is required to register!');
      return;
    }

    setLoading(true);

    const finalClub = club === 'Custom' ? customClub : club;

    try {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          username, 
          password, 
          playerName, 
          club: finalClub || 'Real Madrid', 
          photo: photoBase64 
        })
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

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-0.5 uppercase tracking-wider">Player Name (Optional)</label>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="e.g. Cristiano"
            />
            <p className="text-[10px] text-on-surface-variant/80 mt-1">How you'll appear as a draftable player (optional - defaults to username)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-0.5 uppercase tracking-wider">Choose Jersey / Kit</label>
            <select
              value={club}
              onChange={(e) => setClub(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
            >
              <option value="Real Madrid">Real Madrid</option>
              <option value="Barcelona">Barcelona</option>
              <option value="Manchester United">Manchester United</option>
              <option value="Manchester City">Manchester City</option>
              <option value="Liverpool">Liverpool</option>
              <option value="Arsenal">Arsenal</option>
              <option value="Chelsea">Chelsea</option>
              <option value="Bayern Munich">Bayern Munich</option>
              <option value="PSG">PSG</option>
              <option value="Al Nassr">Al Nassr</option>
              <option value="Inter Miami">Inter Miami</option>
              <option value="Custom">Other / Custom Kit...</option>
            </select>
            <p className="text-[10px] text-on-surface-variant/80 mt-1">Select the football jersey your AI player avatar will wear.</p>

            {club === 'Custom' && (
              <div className="mt-3">
                <input 
                  type="text" 
                  value={customClub}
                  onChange={(e) => setCustomClub(e.target.value)}
                  className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2.5 focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="e.g. AC Milan, Dortmund, Al Hilal"
                  required
                />
                <p className="text-[10px] text-on-surface-variant/80 mt-1">Type the name of any club or team kit you want to wear.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-0.5 uppercase tracking-wider">Your Portrait Photo (Required)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              required
              className="w-full bg-surface-container-high border border-outline-variant text-on-surface rounded-lg px-4 py-2 focus:outline-none focus:border-primary transition-colors text-sm file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-on-primary hover:file:brightness-110"
            />
            <p className="text-[10px] text-on-surface-variant/80 mt-1">Upload a clear photo of yourself. We will use AI to render you in a football player kit!</p>
            {photoBase64 && (
              <div className="mt-3 flex items-center justify-center">
                <img 
                  src={photoBase64} 
                  alt="Preview" 
                  className="w-20 h-20 object-cover rounded-full border border-outline-variant"
                />
              </div>
            )}
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
