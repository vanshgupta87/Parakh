import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope, Eye, EyeOff, Lock, Mail, Phone, User, Building, MapPin,
  Award, Clock, FileText, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, ShieldAlert
} from 'lucide-react';
import { authApi } from '@/lib/api';
import { Link, useRouter } from '@/lib/router';

export function DoctorRegisterPage() {
  const { navigate } = useRouter();

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    medicalRegNumber: '',
    qualification: '',
    specialization: 'Dermatology & Venereology',
    experienceYears: 5,
    clinicName: '',
    clinicAddress: '',
    professionalBio: '',
    termsAgreed: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Password strength check
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
      setErrorMsg('Please confirm compliance with clinical medical ethics and terms.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authApi.registerDoctor({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        confirm_password: formData.confirmPassword,
        medical_registration_number: formData.medicalRegNumber,
        qualification: formData.qualification,
        specialization: formData.specialization,
        experience_years: Number(formData.experienceYears),
        clinic_name: formData.clinicName,
        clinic_address: formData.clinicAddress,
        professional_bio: formData.professionalBio,
      });

      setIsSuccess(true);
      if (res?.dev_verification_url) {
        setDevVerifyUrl(res.dev_verification_url);
      }
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/40 text-emerald-400">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Application Submitted!</h2>
            <p className="text-sm text-slate-400">
              Your registration as a verified Dermatologist on PARAKH is currently{' '}
              <span className="font-semibold text-amber-400">Pending Administrative Review</span>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left text-xs space-y-2.5 text-slate-300">
            <div className="flex items-start gap-2">
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px] font-bold">1</span>
              <span>A verification email has been dispatched to <b>{formData.email}</b>. Click the link to verify your email.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="rounded-full bg-amber-500/20 text-amber-400 px-1.5 py-0.5 text-[10px] font-bold">2</span>
              <span>A healthcare platform administrator will review your medical council registration number (<b>{formData.medicalRegNumber}</b>).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="rounded-full bg-teal-500/20 text-teal-400 px-1.5 py-0.5 text-[10px] font-bold">3</span>
              <span>Once approved, full clinical workspace and AI diagnostics will be unlocked for your account.</span>
            </div>
          </div>

          {devVerifyUrl && (
            <div className="rounded-lg border border-teal-500/30 bg-teal-500/10 p-3 text-left">
              <p className="text-[11px] font-semibold text-teal-300 mb-1">Development Mode Email Verification Shortcut:</p>
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
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400"
            >
              Return to Login
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const pwStrength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Back Link & Header */}
        <div className="space-y-3">
          <Link to="/register" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Account Selection
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/40 text-emerald-400">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Dermatologist Clinical Registration</h1>
              <p className="text-xs sm:text-sm text-slate-400">Register your medical profile for verified clinical diagnostics on PARAKH</p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Multi-Section Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: Personal Information */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">1. Personal & Contact Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Full Name (with Title) *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Dr. Ananya Sharma"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Phone Number *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Professional Credentials */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Award className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">2. Medical Credentials & License</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Medical Registration Number (MCI / State Council) *</label>
                <input
                  type="text"
                  name="medicalRegNumber"
                  value={formData.medicalRegNumber}
                  onChange={handleChange}
                  placeholder="e.g. MCI-2018-84920"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
                <p className="text-[10px] text-slate-500">Will be verified by an administrator prior to clinical feature activation.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Highest Qualification *</label>
                <input
                  type="text"
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  placeholder="e.g. MBBS, MD (Dermatology), DNB"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Specialization *</label>
                <input
                  type="text"
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Clinical Dermatology, Dermato-Oncology"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Years of Clinical Experience *</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    min="0"
                    max="60"
                    name="experienceYears"
                    value={formData.experienceYears}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Clinic / Hospital Details */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Building className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">3. Practice & Clinic Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Clinic / Hospital Name *</label>
                <input
                  type="text"
                  name="clinicName"
                  value={formData.clinicName}
                  onChange={handleChange}
                  placeholder="e.g. Apex Skin Institute & Laser Centre"
                  required
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Full Practice Address *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    name="clinicAddress"
                    value={formData.clinicAddress}
                    onChange={handleChange}
                    placeholder="Floor, Building, Road, City, Pincode"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">Professional Biography (Optional)</label>
                <textarea
                  name="professionalBio"
                  rows={2}
                  value={formData.professionalBio}
                  onChange={handleChange}
                  placeholder="Brief summary of clinical focus, memberships, or expertise..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Account Credentials */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">4. Account Credentials & Security</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Official Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="dr.sharma@hospital.org"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 8 chars"
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
                  <label className="text-xs font-medium text-slate-300">Confirm Password *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    required
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Password strength meter */}
              {formData.password && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Password Security Level:</span>
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
            </div>
          </div>

          {/* SECTION 5: Terms & Verification Consent */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md space-y-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                <b>Administrator Verification Policy:</b> To ensure patient safety, all doctor accounts undergo independent administrative review of medical license credentials before clinical access is granted. Unverified accounts cannot view protected patient diagnostic data.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                name="termsAgreed"
                checked={formData.termsAgreed}
                onChange={handleChange}
                required
                className="h-4 w-4 rounded border-slate-800 bg-slate-900 text-emerald-500 focus:ring-emerald-500/30 mt-0.5"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I attest that I am a licensed medical professional, the submitted registration credentials are valid, and I agree to PARAKH clinical terms of service and patient privacy regulations.
              </span>
            </label>
          </div>

          {/* Submit Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <p className="text-xs text-slate-400">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">
                Sign in
              </Link>
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_20px_-3px_rgba(16,185,129,0.5)] transition-all hover:bg-emerald-400 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Application...</span>
                </>
              ) : (
                <>
                  <span>Submit Doctor Registration</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
