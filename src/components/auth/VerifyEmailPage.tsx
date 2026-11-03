import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, MailCheck, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useRouter, Link } from '@/lib/router';

export function VerifyEmailPage() {
  const { query, navigate } = useRouter();
  const token = query.token || '';

  const [statusState, setStatusState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatusState('error');
      setMessage('No verification token provided in URL. Please click the link received in your email.');
      return;
    }

    const runVerification = async () => {
      try {
        const res = await authApi.verifyEmail(token);
        setStatusState('success');
        setMessage(res?.message || 'Email verified successfully! You may now sign in.');
      } catch (err: any) {
        setStatusState('error');
        setMessage(err.message || 'Verification link is invalid or has expired.');
      }
    };

    runVerification();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-2xl space-y-6"
      >
        {statusState === 'loading' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <div className="h-6 w-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-white">Verifying Account</h2>
            <p className="text-xs text-slate-400">{message}</p>
          </div>
        )}

        {statusState === 'success' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/40 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Email Confirmed!</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-all"
              >
                <span>Continue to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {statusState === 'error' && (
          <div className="space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 ring-1 ring-rose-500/40 text-rose-400">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Verification Failed</h2>
            <p className="text-xs text-rose-300 leading-relaxed">{message}</p>
            <div className="pt-2">
              <Link
                to="/login"
                className="block w-full rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all"
              >
                Return to Login
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
