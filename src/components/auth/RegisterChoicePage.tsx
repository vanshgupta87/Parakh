import { motion } from 'framer-motion';
import { Stethoscope, User, ArrowRight, ShieldCheck, FileCheck, CheckCircle2 } from 'lucide-react';
import { Link, useRouter } from '@/lib/router';

export function RegisterChoicePage() {
  const { navigate } = useRouter();

  return (
    <div className="relative min-h-screen w-full bg-[#070B14] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 dp-radial-glow opacity-50" />

      <div className="relative z-10 w-full max-w-3xl space-y-8 text-center">
        {/* Header */}
        <div className="space-y-3">
          <Link to="/" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30 hover:bg-emerald-500/20 transition-all">
            PARAKH (परख) Healthcare Platform
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Join the PARAKH Network</h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto">
            Choose your account type below to get started with dedicated clinical tools or personalized skin health management.
          </p>
        </div>

        {/* Two Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {/* DOCTOR CARD */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={() => navigate('/register/doctor')}
            className="cursor-pointer group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl transition-all hover:border-emerald-500/50 hover:bg-slate-900/90 hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/30 text-emerald-400 group-hover:scale-105 transition-transform">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Medical Specialist
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Dermatologist / Doctor
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Access clinical diagnostic workspace, multi-class lesion classification, Grad-CAM heatmaps, patient consultation records, and digital triage.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>AI Lesion Diagnostic & Explainability Head</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Patient management & longitudinal records</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <FileCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="text-amber-300/90 text-[11px]">Requires medical credential verification</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Register as Doctor</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.div>

          {/* PATIENT CARD */}
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={() => navigate('/register/patient')}
            className="cursor-pointer group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl transition-all hover:border-teal-500/50 hover:bg-slate-900/90 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.3)] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-teal-500/10 p-3 ring-1 ring-teal-500/30 text-teal-400 group-hover:scale-105 transition-transform">
                  <User className="h-6 w-6" />
                </div>
                <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Personal Health
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white group-hover:text-teal-300 transition-colors">
                  Patient Portal
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Track personal skin lesions over time, schedule appointments with verified dermatologists, and securely access medical records.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>Personal skin scan history & image timeline</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>Private health data & prescription access</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span className="text-slate-300 text-[11px]">Instant activation after email verification</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-xs font-semibold text-teal-400 group-hover:translate-x-1 transition-transform">
              <span>Register as Patient</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </motion.div>
        </div>

        {/* Existing account footer */}
        <div className="pt-4 text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
