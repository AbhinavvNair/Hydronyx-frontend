'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Droplet, Eye, EyeOff } from 'lucide-react';
import { apiUrl } from '@/lib/api';

const RainEffect = () => {
  const [drops, setDrops] = useState<{ left: string; delay: string; duration: string }[]>([]);

  useEffect(() => {
    const newDrops = Array.from({ length: 50 }).map(() => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${0.5 + Math.random() * 0.5}s`,
    }));
    setDrops(newDrops);
  }, []);

  return (
    <div className="rain-container absolute inset-0 pointer-events-none z-0">
      {drops.map((drop, i) => (
        <div
          key={i}
          className="rain-drop"
          style={{
            left: drop.left,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
          }}
        />
      ))}
      <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-[#0a1428] via-[#0a1428]/80 to-transparent z-10" />
    </div>
  );
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Login failed');
      }

      const data = await response.json();

      // Store auth tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      // Always clear saved persona so the role picker shows on every login
      localStorage.removeItem('hydroai_persona');

      // Small delay to ensure tokens are persisted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to persona selection
      window.location.href = '/personas';
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060b16] flex items-center justify-center px-4 relative overflow-hidden text-white selection:bg-cyan-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-[#0a1428] to-[#060b16] z-0" />
      <RainEffect />

      <div className="relative z-20 w-full max-w-md">
        <div className="bg-[#0a1428]/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(6,182,212,0.1)]">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <Droplet className="w-8 h-8 text-cyan-400 fill-cyan-400/20" />
            <span className="text-2xl font-bold text-white tracking-wide">HydroAI</span>
          </div>

          <h1 className="text-3xl font-bold text-center text-white mb-8 text-shadow-glow">Sign In</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg backdrop-blur-sm">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-400 to-cyan-600 text-slate-900 font-bold rounded-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="text-center">
              <Link
                href="/forgot-password"
                className="text-cyan-400 hover:text-cyan-300 text-sm transition hover:underline decoration-cyan-400/50 underline-offset-4"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Don't have an account?{' '}
                <Link
                  href="/signup"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold transition hover:underline decoration-cyan-400/50 underline-offset-4"
                >
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-cyan-100/40 text-xs mt-8 font-light tracking-wider">
          Physics-Informed Groundwater Monitoring System
        </p>
      </div>
    </div>
  );
}