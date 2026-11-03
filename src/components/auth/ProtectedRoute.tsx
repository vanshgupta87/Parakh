import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/lib/router';
import { ShieldAlert, AlertCircle, ArrowLeft, Clock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'doctor' | 'patient')[];
  requireApprovedDoctor?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requireApprovedDoctor = false,
}: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { navigate, path } = useRouter();

  // Redirect unauthenticated users to /login (with return path preserved)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', true);
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Verifying session security...</span>
        </div>
      </div>
    );
  }

  // 1. Not Authenticated — show brief message while redirect fires
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400">Redirecting to sign in...</span>
        </div>
      </div>
    );
  }

  // 2. Suspended Account Check
  if (user.account_status === 'suspended') {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900/80 p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Account Suspended</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your PARAKH user account has been suspended by an administrator. Access to clinical records and tools is prohibited.
          </p>
        </div>
      </div>
    );
  }

  // 3. Role-Based Check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400">
            Your account role (<code className="text-amber-400">{user.role}</code>) is not authorized to access this section ({path}).
          </p>
          <button
            onClick={() => {
              if (user.role === 'admin') navigate('/admin/dashboard');
              else if (user.role === 'doctor') navigate('/doctor/dashboard');
              else navigate('/patient/dashboard');
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Go to Your Portal
          </button>
        </div>
      </div>
    );
  }

  // 4. Doctor Verification Status Check (if route strictly requires approved doctor)
  if (requireApprovedDoctor && user.role === 'doctor') {
    const docStatus = user.doctor_profile?.verification_status || 'pending';
    if (docStatus !== 'approved') {
      return (
        <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-amber-500/30 bg-slate-900/80 p-8 text-center space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
              <Clock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-white">Pending Medical Verification</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your doctor account is currently <b className="text-amber-400">{docStatus.toUpperCase()}</b>. In accordance with healthcare regulations, clinical diagnostic tools and patient records remain locked until an administrator verifies your medical council registration number.
            </p>
            <button
              onClick={() => navigate('/doctor/dashboard')}
              className="rounded-lg bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
            >
              Back to Overview
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
