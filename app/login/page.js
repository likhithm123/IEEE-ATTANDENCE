'use client';

import { useMemo, useState } from 'react';
import { createClient } from '../../utils/supabase/client';

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Success. Check your email for a confirmation link.');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(error.message);
      } else {
        const profilesRes = await fetch('/api/profiles');
        const profilesData = await profilesRes.json();
        const profile = profilesData.profiles?.find((item) => item.email?.toLowerCase() === data.user.email.toLowerCase());
        const defaultPassword = profile?.name ? `${profile.name.trim()}@123` : null;

        if (defaultPassword && password === defaultPassword) {
          setRequiresPasswordReset(true);
          setMessage('Please set a new password before continuing.');
          setLoading(false);
          return;
        }

        window.location.href = '/';
      }
    }

    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage('Password updated. Redirecting...');
    window.location.href = '/';
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[1fr_420px]">
        <div className="hidden bg-slate-900 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-sm font-bold text-slate-900">AR</div>
            <h1 className="mt-8 text-4xl font-semibold tracking-tight">Attendance Registry</h1>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
              A focused workspace for participant requests, manager attendance marking, and admin user management.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="font-semibold">Role-aware</p>
              <p className="mt-1 text-slate-400">Protected access</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="font-semibold">Fast edits</p>
              <p className="mt-1 text-slate-400">Instant updates</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="font-semibold">CSV ready</p>
              <p className="mt-1 text-slate-400">Admin imports</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <div className="mb-8 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">AR</div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Attendance Registry</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage the attendance workspace.</p>
          </div>

          <div className="mb-8 hidden lg:block">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{isSignUp ? 'Create access' : 'Welcome back'}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {isSignUp ? 'Create your account' : 'Sign in to continue'}
            </h2>
          </div>

          {requiresPasswordReset ? (
            <form onSubmit={handlePasswordReset} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Set a secure password"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Repeat your new password"
                />
              </div>

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          ) : (
          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="name@domain.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>
          )}

          {!requiresPasswordReset && (
          <div className="mt-6 text-center text-sm text-slate-500">
            {isSignUp ? 'Already have an account?' : 'Need an access account?'}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1.5 font-semibold text-blue-600 transition hover:text-blue-700"
            >
              {isSignUp ? 'Sign in instead' : 'Sign up here'}
            </button>
          </div>
          )}
        </div>
      </section>
    </main>
  );
}
