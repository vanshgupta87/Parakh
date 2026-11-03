import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { RISK_TIER_META } from '@/data/samples';
import type { SampleLesion } from '@/types';
import { cn } from '@/lib/utils';

interface ActionCardProps {
  sample: SampleLesion;
}

export function ActionCard({ sample }: ActionCardProps) {
  const tier = RISK_TIER_META[sample.riskTier];
  const isUrgent = sample.riskTier === 'high' || sample.riskTier === 'critical';
  const Icon = isUrgent ? ShieldAlert : ShieldCheck;

  return (
    <motion.div
      key={sample.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('dp-glass rounded-lg p-4', isUrgent ? 'border-rose-500/30' : 'border-emerald-500/25')}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', isUrgent ? 'text-rose-400' : 'text-emerald-400')} />
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: tier.color }}>
          Recommended Medical Action
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-200">{sample.action}</p>

      <div className="mt-3 flex items-start gap-2 border-t border-slate-800/50 pt-3">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-[10px] leading-relaxed text-slate-500">
          Parakh is an AI screening tool, not a definitive clinical diagnosis. All outputs must be
          validated by a board-certified dermatologist.
        </p>
      </div>
    </motion.div>
  );
}
