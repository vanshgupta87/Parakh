import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';

export type PriorityTier = 'high' | 'moderate' | 'low';

interface PatientTriageProps {
  priorityTier?: PriorityTier;
  confidenceScore?: number;
}

const TIER_CONFIG = {
  high: {
    title: 'High Priority Assessment',
    recommendation: 'Prompt Dermatologist Evaluation Recommended within 1–2 Weeks',
    description: 'Based on the lesion features and AI risk score, we strongly advise scheduling an in-person clinical biopsy and dermoscopy evaluation.',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
    cardClass: 'border-red-500/40 bg-red-950/10',
    icon: ShieldAlert,
    urgencyText: 'Action Recommended within 7-14 Days',
  },
  moderate: {
    title: 'Moderate Risk Assessment',
    recommendation: 'Dermatologist Follow-Up Recommended within 4–6 Weeks',
    description: 'Features warrant clinical monitoring. Track the lesion for changes in size, shape, or color using the digital timeline tool.',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cardClass: 'border-amber-500/40 bg-amber-950/10',
    icon: Clock,
    urgencyText: 'Action Recommended within 30 Days',
  },
  low: {
    title: 'Low Risk Assessment',
    recommendation: 'Routine Annual Skin Check Recommended',
    description: 'No immediate features of concern detected. Continue standard sun protection practices and monitor during regular wellness exams.',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cardClass: 'border-emerald-500/40 bg-emerald-950/10',
    icon: CheckCircle2,
    urgencyText: 'Standard Annual Screening',
  },
};

export function PatientTriage({
  priorityTier = 'high',
  confidenceScore = 0.89,
}: PatientTriageProps) {
  const config = TIER_CONFIG[priorityTier];
  const IconComponent = config.icon;

  return (
    <div className="dp-glass space-y-6 p-6">
      {/* SECTION HEADER */}
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span>5. Patient Communication & Triage Flow</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Clinical risk guidance to support a thoughtful next step
        </p>
      </div>

      {/* 1. NEXT-STEP GUIDANCE ENGINE */}
      <div className={`rounded-xl border p-5 transition-all ${config.cardClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${config.badgeClass}`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.badgeClass}`}>
                {config.urgencyText}
              </span>
              <h3 className="text-base font-bold text-slate-100 mt-1">
                {config.title}
              </h3>
            </div>
          </div>

          <div className="text-left sm:text-right font-mono text-xs">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">AI Confidence</span>
            <span className="text-indigo-400 font-bold text-sm">{(confidenceScore * 100).toFixed(1)}%</span>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-lg bg-slate-950/60 p-4 border border-slate-800">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Primary Recommendation
            </h4>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              "{config.recommendation}"
            </p>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {config.description}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}