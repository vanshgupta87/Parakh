import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck,
  CheckCircle2, AlertCircle, Sparkles, Stethoscope, HeartPulse
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link } from '@/lib/router';

export function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      });

      // Role-based redirection
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'doctor') {
        navigate('/doctor/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#070B14] text-slate-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Background ambient glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-teal-500/10 blur-[140px]" />

      {/* LEFT PANEL: Brand & Visual Presentation */}
      <div className="relative lg:w-1/2 flex flex-col justify-between p-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-800/60 bg-gradient-to-br from-slate-950/80 via-slate-900/60 to-[#070B14]">
        {/* Top Logo */}
        <div>
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <span className="absolute inset-0 rounded-xl border border-emerald-500/40 animate-ping opacity-25" />
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/40 shadow-[0_0_20px_-2px_rgba(16,185,129,0.4)]">
                <Activity className="h-6 w-6 text-emerald-400" />
              </span>
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white flex items-center gap-1.5">
                PARAKH <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">परख</span>
              </span>
              <p className="text-[11px] font-medium tracking-wider uppercase text-slate-400">Dermatology AI & Hospital Platform</p>
            </div>
          </Link>
        </div>

        {/* Center Showcase */}
        <div className="my-12 lg:my-0 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            Next-Gen Healthcare Management
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
            Intelligent Dermatology.<br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Better Skin Health.
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-base leading-relaxed text-slate-400">
            A unified clinical ecosystem bridging dermatologists, patients, and healthcare administrators with verifiable AI diagnostics, explainable Grad-CAM heatmaps, and secure medical workflows.
          </p>

          {/* Key pillars */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 backdrop-blur-sm">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Verified Clinicians</p>
                <p className="text-[11px] text-slate-400">Vetted medical registry</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 backdrop-blur-sm">
              <div className="rounded-lg bg-teal-500/10 p-2 text-teal-400">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Patient Centric</p>
                <p className="text-[11px] text-slate-400">Private health records</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Encrypted Session Security
          </span>
          <span>© 2026 PARAKH</span>
        </div>
      </div>

      {/* RIGHT PANEL: Sign In Form */}
      <div className="relative lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-[#070B14]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-6"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Welcome Back</h2>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to access your PARAKH clinical workspace or patient portal.
            </p>
          </div>

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/70 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/70 pl-10 pr-10 py-2.5 text-sm text-slate-100 placeholder-slate-500 transition-all focus:border-emerald-500/60 focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30"
                />
                <span className="text-xs text-slate-400">Remember this device (30 days)</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-3px_rgba(16,185,129,0.5)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_26px_-2px_rgba(16,185,129,0.7)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Links */}
          <div className="pt-4 text-center border-t border-slate-800/60">
            <p className="text-xs text-slate-400">
              Don't have an account yet?{' '}
              <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                Create an account
              </Link>
            </p>
          </div>

          {/* Demo / Admin Quick helper note */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-500 space-y-1">
            <p className="font-semibold text-slate-400">Administrator Initial Access:</p>
            <p>Admin accounts are managed strictly server-side. Seed default: <code className="text-emerald-400/90">admin@parakh.org</code> / <code className="text-emerald-400/90">Admin@Parakh2026!</code></p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
