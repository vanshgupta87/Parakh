import { useState, type FormEvent } from 'react';
import {
  AlertCircle, BadgeCheck, Building2, CheckCircle2, KeyRound, LogOut,
  Mail, ShieldCheck, UserRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import { useRouter } from '@/lib/router';

function formatStatus(status?: string) {
  if (!status) return 'Unavailable';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AccountSettings() {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handlePasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('Your new password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Your new password must be at least 8 characters long.');
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccessMessage(response?.message || 'Your password was updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setLogoutLoading(false);
    }
  };

  const accountDetails = [
    { label: 'Full name', value: user?.full_name || 'Unavailable', icon: UserRound },
    { label: 'Email address', value: user?.email || 'Unavailable', icon: Mail },
    { label: 'Account role', value: formatStatus(user?.role), icon: ShieldCheck },
    { label: 'Account status', value: formatStatus(user?.account_status), icon: BadgeCheck },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/25">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Account & security</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Settings</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Review your account details, update your password, and securely sign out.
              Notification alerts remain available from the bell in the top bar.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4">
          <UserRound className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Account information</h3>
            <p className="mt-1 text-xs text-slate-400">Your registered identity and access status</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accountDetails.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <Icon className="h-3.5 w-3.5 text-emerald-500/80" />
                {label}
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </div>
        {user?.role === 'patient' && (
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Patient ID</p>
            <p className="mt-2 font-mono text-sm font-semibold text-slate-200">
              {user.patient_profile?.patient_unique_id || 'Unavailable'}
            </p>
          </div>
        )}
        {user?.role === 'doctor' && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                <Building2 className="h-3.5 w-3.5 text-emerald-500/80" /> Clinic
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-200">{user.doctor_profile?.clinic_name || 'Not provided'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Verification</p>
              <p className="mt-2 text-sm font-semibold capitalize text-slate-200">
                {formatStatus(user.doctor_profile?.verification_status)}
              </p>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          {user?.email_verified
            ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Email address verified</>
            : <><AlertCircle className="h-4 w-4 text-amber-400" /> Email address not verified</>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4">
          <KeyRound className="h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="text-sm font-bold text-white">Change password</h3>
            <p className="mt-1 text-xs text-slate-400">Use your current password to set a new one</p>
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { label: 'Current password', value: currentPassword, setValue: setCurrentPassword, autocomplete: 'current-password' },
              { label: 'New password', value: newPassword, setValue: setNewPassword, autocomplete: 'new-password' },
              { label: 'Confirm new password', value: confirmPassword, setValue: setConfirmPassword, autocomplete: 'new-password' },
            ].map(({ label, value, setValue, autocomplete }) => (
              <label key={label} className="space-y-1.5">
                <span className="text-xs font-medium text-slate-300">{label}</span>
                <input
                  type="password"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  autoComplete={autocomplete}
                  required
                  minLength={label === 'Current password' ? undefined : 8}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/15"
                />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Your password must be at least 8 characters and meet the account security requirements.</p>
          <button
            type="submit"
            disabled={passwordLoading}
            className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordLoading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300">
            <LogOut className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">Sign out</h3>
            <p className="mt-1 text-xs text-slate-400">End your current session on this device.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={logoutLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {logoutLoading ? 'Signing out…' : 'Sign out'}
        </button>
      </section>
    </div>
  );
}
