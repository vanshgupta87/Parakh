import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useRouter, Link } from '@/lib/router';

export function ResetPasswordPage() {
  const { query, navigate } = useRouter();
  const token = query.token || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const getPasswordStrength = () => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/\d/.test(password)) score += 25;
    if (/[@$!%*?&#^()_\-+=\[\]{}|:;<>,./~`]/.test(password)) score += 25;
    return score;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!token) {
      setErrorMsg('Missing or invalid password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (getPasswordStrength() < 75) {
      setErrorMsg('Password must be at least 8 characters with uppercase, numbers, and special symbols.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword({
        token,
        new_password: password,
        confirm_password: confirmPassword,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password. The link may have expired or already been used.');
    } finally {
      setIsLoading(false);
    }
  };

  const pwStrength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl space-y-6"
      >
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/40 text-emerald-400">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Choose New Password</h1>
          <p className="text-xs text-slate-400">Ensure your new password meets healthcare privacy standards</p>
        </div>

        {isSuccess ? (
          <div className="space-y-4 pt-2 text-center">
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 text-left">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>Your password has been securely updated. All previous sessions have been invalidated.</span>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-all"
            >
              Log In with New Password
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!token && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>No reset token provided. Please request a new reset link from the forgot password page.</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 pr-10 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </div>

            {password && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Strength:</span>
                  <span className={pwStrength >= 75 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {pwStrength < 50 ? 'Weak' : pwStrength < 75 ? 'Moderate' : 'Strong'}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      pwStrength < 50 ? 'bg-rose-500' : pwStrength < 75 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pwStrength}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-3px_rgba(16,185,129,0.5)] transition-all hover:bg-emerald-400 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Set New Password</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
