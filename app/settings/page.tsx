'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { AppShell } from '@/app/components/AppShell';
import { useAuth } from '@/app/context/AuthContext';
import { apiPatch, apiPost } from '@/lib/api';

function SettingsContent() {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSuccess('');
    if (!name.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    setNameLoading(true);
    try {
      const updated = await apiPatch<{ name: string }>('/api/auth/me', { name: name.trim() });
      updateUser({ name: updated.name });
      setNameSuccess('Name updated successfully');
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPwError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPwError('Password must contain at least one digit');
      return;
    }
    setPwLoading(true);
    try {
      await apiPost('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppShell title="Settings">
      <div className="p-8 flex-1 max-w-2xl">
        {/* Profile Section */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-white mb-6">Profile</h2>
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-1">Email</p>
              <p className="text-white">{user?.email}</p>
            </div>
            <form onSubmit={handleNameSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  disabled={nameLoading}
                />
              </div>
              {nameError && <p className="text-red-400 text-sm">{nameError}</p>}
              {nameSuccess && <p className="text-green-400 text-sm">{nameSuccess}</p>}
              <button
                type="submit"
                disabled={nameLoading}
                className="px-6 py-2 bg-gradient-to-r from-cyan-400 to-cyan-600 text-slate-900 font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {nameLoading ? 'Saving...' : 'Save Name'}
              </button>
            </form>
          </div>
        </section>

        {/* Password Section */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6">Change Password</h2>
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  disabled={pwLoading}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  disabled={pwLoading}
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">Min 8 characters, one uppercase, one digit</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                  disabled={pwLoading}
                  required
                />
              </div>
              {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
              {pwSuccess && <p className="text-green-400 text-sm">{pwSuccess}</p>}
              <button
                type="submit"
                disabled={pwLoading}
                className="px-6 py-2 bg-gradient-to-r from-cyan-400 to-cyan-600 text-slate-900 font-bold rounded-lg hover:opacity-90 transition disabled:opacity-50"
              >
                {pwLoading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default function Settings() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
