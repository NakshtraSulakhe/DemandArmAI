'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  Shield,
  User as UserIcon,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  Lock,
  Mail,
  UserCheck,
  Check,
  AtSign,
  KeyRound,
} from 'lucide-react';
import { SessionUser, UserRole } from '../../lib/types';

interface SafeUserItem {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

interface UserManagementSectionProps {
  currentUser?: SessionUser | null;
}

export default function UserManagementSection({ currentUser }: UserManagementSectionProps) {
  const [users, setUsers] = useState<SafeUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [mounted, setMounted] = useState(false);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('USER');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close modal on Escape key press
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const fetchUsers = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setUsername('');
    setName('');
    setEmail('');
    setRole('USER');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMessage('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      setErrorMessage('Username is required.');
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setErrorMessage('Username may only contain letters, numbers, hyphens, underscores, and dots.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          name: name.trim() || cleanUsername,
          email: email.trim() || undefined,
          role,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to create user account.');
        return;
      }

      setSuccessMessage(`User "${cleanUsername}" created successfully with role ${role}!`);
      resetForm();
      setIsModalOpen(false);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected network error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: SafeUserItem) => {
    const isSelf = currentUser && (currentUser.id === userToDelete.id || currentUser.username.toLowerCase() === userToDelete.username.toLowerCase());
    if (isSelf) {
      alert('You cannot delete your own signed-in account.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user "${userToDelete.username}" (${userToDelete.role})? This cannot be undone.`)) {
      return;
    }

    setDeletingId(userToDelete.id);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userToDelete.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Could not delete user.');
        return;
      }
      setSuccessMessage(`User "${userToDelete.username}" has been removed.`);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Error deleting user.');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // The modal markup rendered into document.body via Portal to guarantee true screen centering
  const modalContent = isModalOpen && mounted && typeof document !== 'undefined' ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-xl animate-modal-backdrop"
      onClick={() => setIsModalOpen(false)}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] text-slate-100 flex flex-col animate-modal-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-sm">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 tracking-tight">
                Create New User Account
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign user credentials, access tier, and role permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0"
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form - Single cohesive non-scrollable layout */}
        <form onSubmit={handleCreateUser} className="p-6 space-y-4.5 text-xs">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Profile Info (3 Columns in wide layout) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. sarah_connor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-sm"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Lowercase letters, numbers, hyphens, dots
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Full Display Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. Sarah Connor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-sm"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Shown on activity audit logs and header avatar
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address <span className="text-slate-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="e.g. sarah@demandflowarm.tech"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-sm"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                For notifications and alerts
              </span>
            </div>
          </div>

          {/* Row 2: Role Selection Cards (2 Side-by-Side Cards) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select User Role & Access Tier
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* USER CARD */}
              <div
                onClick={() => setRole('USER')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                  role === 'USER'
                    ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                  role === 'USER' ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-600 bg-slate-900'
                }`}>
                  {role === 'USER' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                      Standard Operator
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      USER
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Access to <strong>All Leads</strong>, <strong>Processing Queue</strong>, and <strong>Configuration</strong>. Pipeline execution controls (Start Pipeline) are hidden and disabled.
                  </p>
                </div>
              </div>

              {/* ADMIN CARD */}
              <div
                onClick={() => setRole('ADMIN')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                  role === 'ADMIN'
                    ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10 ring-1 ring-purple-500/40'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                  role === 'ADMIN' ? 'border-purple-500 bg-purple-500 text-white' : 'border-slate-600 bg-slate-900'
                }`}>
                  {role === 'ADMIN' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                      <Shield className="w-3.5 h-3.5 text-purple-400" />
                      Administrator
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Full system access: <strong>Start/Pause Pipeline</strong>, <strong>Run Queue</strong>, <strong>CRM Sync</strong>, API Credentials, and <strong>User Management</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Passwords (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Password <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all shadow-sm"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Minimum 6 characters
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                {passwordsMatch && (
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Matches
                  </span>
                )}
                {passwordsMismatch && (
                  <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-1">
                    Does not match
                  </span>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-slate-950/90 border rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none focus:ring-1 transition-all shadow-sm ${
                    passwordsMismatch
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/30'
                      : passwordsMatch
                      ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/30'
                      : 'border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/30'
                  }`}
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Must match password above
              </span>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            User Accounts & Role Permissions
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Create and manage application users with fine-grained access control for Administrators and standard Users.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 hover:bg-slate-800/60 transition-colors"
            title="Refresh Users"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create New User</span>
          </button>
        </div>
      </div>

      {/* Global Toast / Feedback */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by username, name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              roleFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('ADMIN')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              roleFilter === 'ADMIN' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Admins ({users.filter((u) => u.role === 'ADMIN').length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('USER')}
            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
              roleFilter === 'USER' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Users ({users.filter((u) => u.role === 'USER').length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                  Loading user directory...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isCurrent = currentUser && (currentUser.id === u.id || currentUser.username.toLowerCase() === u.username.toLowerCase());
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            u.role === 'ADMIN'
                              ? 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-sm'
                              : 'bg-gradient-to-tr from-slate-700 to-slate-600 text-slate-200'
                          }`}
                        >
                          {(u.name || u.username).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">@{u.username}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {u.role === 'ADMIN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <Shield className="w-3 h-3 text-purple-400" />
                          ADMIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          <UserIcon className="w-3 h-3 text-blue-400" />
                          USER
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                      {u.email ? (
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                          {u.email}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isCurrent ? (
                        <span className="text-[10px] text-slate-500 italic">Active session</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingId === u.id}
                          className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                          title={`Delete user @${u.username}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Role explanation callout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/80">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-200">Admin Role Privileges</span>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Full control over pipeline operations (Start/Pause Pipeline, Process Queue, CRM Sync), managing client configurations, system API credentials, and creating/managing users.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-200">User Role Permissions</span>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Access to view All Leads, Queue, and Configurations. Pipeline execution controls (Start Pipeline, Run Worker) and sensitive API Settings are hidden and restricted.
            </p>
          </div>
        </div>
      </div>

      {/* Portal-rendered Modal */}
      {modalContent && createPortal(modalContent, document.body)}
    </div>
  );
}
