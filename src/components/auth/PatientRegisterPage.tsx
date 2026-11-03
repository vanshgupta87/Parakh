import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User, Eye, EyeOff, Lock, Mail, Phone, Calendar, CheckCircle2,
  AlertCircle, ArrowRight, ArrowLeft, ShieldCheck
} from 'lucide-react';
import { authApi } from '@/lib/api';
import { Link, useRouter } from '@/lib/router';

export function PatientRegisterPage() {
  const { navigate } = useRouter();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: 'prefer_not_to_say',
    password: '',
    confirmPassword: '',
    termsAgreed: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [devVerifyUrl, setDevVerifyUrl] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const getPasswordStrength = () => {
    const pw = formData.password;
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score += 25;
    if (/[A-Z]/.test(pw)) score += 25;
    if (/\d/.test(pw)) score += 25;
    if (/[@$!%*?&#^()_\-+=\[\]{}|:;<>,./~`]/.test(pw)) score += 25;
    return score;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (getPasswordStrength() < 75) {
      setErrorMsg('Password must be at least 8 characters and include uppercase, numbers, and special characters.');
      return;
    }

    if (!formData.termsAgreed) {
      setErrorMsg('Please accept the privacy terms to continue.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.registerPatient({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        date_of_birth: formData.dateOfBirth,
        gender: formData.gender,
        password: formData.password,
        confirm_password: formData.confirmPassword,
      });

      setIsSuccess(true);
      if (res?.patient_id) setPatientId(res.patient_id);
      if (res?.dev_verification_url) setDevVerifyUrl(res.dev_verification_url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#070B14] text-slate-100 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center backdrop-blur-xl shadow-2xl space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10 ring-1 ring-teal-500/40 text-teal-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Welcome to PARAKH!</h2>
            <p className="text-sm text-slate-400">
              Your patient account has been created.
              {patientId && (
                <span className="block mt-1 font-mono text-xs text-teal-400">
                  Unique Patient ID: {patientId}
                </span>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left text-xs space-y-2 text-slate-300">
            <p>
              We've sent a verification link to <b className="text-white">{formData.email}</b>.
            </p>
            <p className="text-slate-400">
              Please click the link in your email to verify your address, then sign in to access your personal dermatology health portal.
            </p>
          </div>

          {devVerifyUrl && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-left">
              <p className="text-[11px] font-semibold text-teal-300 mb-1">Development Mode Verification Link:</p>
              <a
                href={devVerifyUrl}
                className="text-xs text-teal-400 underline break-all hover:text-teal-300"
              >
                {devVerifyUrl}
              </a>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => navigate('/login')}
              className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:bg-teal-400"
            >
              Go to Sign In
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const pwStrength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <Link to="/register" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Account Selection
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 ring-1 ring-teal-500/40 text-teal-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Create Patient Account</h1>
              <p className="text-xs text-slate-400">Manage your skin health and consultation history privately</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-8 backdrop-blur-md space-y-5">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Rohit Verma"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Email Address *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="rohit@example.com"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                />
              </div>
            </div>
          </div>

          {/* DOB & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Date of Birth *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              >
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Password & Confirm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 8 characters"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 pr-10 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
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
              <label className="text-xs font-medium text-slate-300">Confirm Password *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
            </div>
          </div>

          {/* Password Strength */}
          {formData.password && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Password Security:</span>
                <span className={pwStrength >= 75 ? 'text-teal-400 font-semibold' : 'text-amber-400'}>
                  {pwStrength < 50 ? 'Weak' : pwStrength < 75 ? 'Moderate' : 'Strong'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    pwStrength < 50 ? 'bg-rose-500' : pwStrength < 75 ? 'bg-amber-500' : 'bg-teal-500'
                  }`}
                  style={{ width: `${pwStrength}%` }}
                />
              </div>
            </div>
          )}

          {/* Privacy Consent */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                name="termsAgreed"
                checked={formData.termsAgreed}
                onChange={handleChange}
                required
                className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-teal-500 focus:ring-teal-500/30 mt-0.5"
              />
              <span className="text-xs text-slate-400 leading-relaxed">
                I agree to the PARAKH Terms of Service and Privacy Policy. My personal skin records and demographic data will remain confidential and accessible only to authorized consulting doctors.
              </span>
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-3px_rgba(20,184,166,0.5)] transition-all hover:bg-teal-400 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Patient Registration</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 pt-1">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-teal-400 hover:text-teal-300">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
