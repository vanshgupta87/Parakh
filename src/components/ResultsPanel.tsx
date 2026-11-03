import { motion } from 'framer-motion';
import { AlertTriangle, Gauge, CheckCircle2, Info } from 'lucide-react';
import { RiskGauge } from './RiskGauge';
import { RISK_TIER_META } from '@/data/samples';
import type { SampleLesion } from '@/types';
import { cn } from '@/lib/utils';

interface ResultsPanelProps {
  sample: SampleLesion | any;
}

export function ResultsPanel({ sample }: ResultsPanelProps) {
  // Safely normalize confidence to percentage (handles 0.45 -> 45.0)
  const rawConfidence = sample.confidence ?? sample.model_confidence ?? 0;
  const confidencePercent = rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence;
  
  const priorityScore = sample.riskScore ?? sample.priority_score ?? 50;
  const predictionName = sample.primaryPrediction ?? sample.prediction ?? "Unknown Lesion";
  
  // Normalize risk tier key safely with type safety casting
  const rawTierKey = sample.riskTier || (priorityScore >= 70 ? 'critical' : priorityScore >= 40 ? 'moderate' : 'low');
  const riskTierKey = (Object.keys(RISK_TIER_META).includes(rawTierKey) ? rawTierKey : 'moderate') as keyof typeof RISK_TIER_META;

  const tier = RISK_TIER_META[riskTierKey] || {
    color: '#f59e0b',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    dotClass: 'bg-amber-400',
    label: sample.risk_level || 'Moderate Priority'
  };

  const formattedPrediction = predictionName === "Actinic Keratosis" 
    ? "Actinic Keratosis / Bowen's Disease" 
    : predictionName;

  // Handle probabilities mapping safely from dictionary or array
  const probabilitiesArray = sample.probabilities 
    ? (Array.isArray(sample.probabilities) 
        ? sample.probabilities 
        : Object.entries(sample.probabilities).map(([name, prob]: [string, any]) => ({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            short: name.substring(0, 4).toUpperCase(),
            label: name,
            probability: prob <= 1 ? prob * 100 : prob,
            color: '#3b82f6'
          }))
      )
    : [];

  const sorted = [...probabilitiesArray].map((c) => ({
    ...c,
    probability: c.probability <= 1 ? c.probability * 100 : c.probability,
    label: c.short === "AKIEC" ? "AKIEC (Actinic Keratosis)" : c.label || c.short
  })).sort((a, b) => b.probability - a.probability);

  return (
    <motion.div
      key={sample.id || predictionName}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-4"
    >
      {/* 1. MODEL-BASED PRIORITY SCORE & TRIAGE INDICATOR */}
      <div className="dp-glass flex flex-col items-center gap-3 p-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-slate-500" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
              AI Screening Indicator
            </span>
          </div>
          <span className="text-[10px] text-slate-500 italic">Priority Score: {priorityScore}/100</span>
        </div>
        
        <RiskGauge score={priorityScore} color={tier.color} size={170} />
        
        <div className={cn('flex items-center gap-2 rounded-full px-3 py-1 ring-1', tier.bgClass, tier.borderClass)}>
          <span className={cn('h-2 w-2 rounded-full', tier.dotClass)} style={{ boxShadow: `0 0 6px ${tier.color}` }} />
          <span className="text-xs font-bold tracking-wide" style={{ color: tier.color }}>
            {sample.risk_level || tier.label}
          </span>
        </div>
        <p className="text-center text-[11px] text-slate-400">
          Model-Based Priority Ranking — Triage indicator only, not a clinical risk probability.
        </p>
      </div>

      {/* 2. PRIMARY AI PREDICTION & MODEL CONFIDENCE */}
      <div className="dp-glass p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Primary AI Prediction</p>
        <p className="mt-1 text-lg font-bold leading-tight text-slate-100">{formattedPrediction}</p>
        
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800/60">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${confidencePercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
              style={{ background: '#3b82f6', boxShadow: `0 0 8px #3b82f680` }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums text-blue-400">
            {confidencePercent.toFixed(1)}%
          </span>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400 font-medium">
          Model Confidence <span className="text-slate-500 font-normal">(Statistical certainty of predicted class)</span>
        </p>
      </div>

      {/* 7-Class ISIC Probability Breakdown */}
      {sorted.length > 0 && (
        <div className="dp-glass p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">
            7-Class ISIC Probability Breakdown
          </p>
          <div className="flex flex-col gap-2.5">
            {sorted.map((c, i) => (
              <div key={c.id || i} className="flex items-center gap-2.5">
                <span className="w-14 shrink-0 text-[11px] font-medium text-slate-500">{c.short || "CLASS"}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-slate-800/50">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded"
                    initial={{ width: 0 }}
                    animate={{ width: `${c.probability}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 * i }}
                    style={{ background: c.color || '#3b82f6', boxShadow: `0 0 6px ${c.color || '#3b82f6'}55` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-left text-[11px] font-medium text-slate-400 truncate">
                  {c.label || c.short} 
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABCDE Visual Criteria (if available) */}
      {sample.abcde && sample.abcde.length > 0 && (
        <div className="dp-glass p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">ABCDE Visual Criteria</p>
          <div className="flex flex-col gap-2">
            {sample.abcde.map((item: any) => (
              <div
                key={item.letter}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2',
                  item.flag ? 'border-rose-500/25 bg-rose-500/[0.06]' : 'border-emerald-500/20 bg-emerald-500/[0.04]',
                )}
              >
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold', item.flag ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400')}>
                  {item.letter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-200">{item.label}</p>
                  <p className="text-[10px] text-slate-500">{item.detail}</p>
                </div>
                {item.flag ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medical Disclaimer Banner */}
      <div className="flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
        <p className="text-[10px] leading-relaxed text-slate-500 italic">
          Parakh is an investigative decision-support tool, not a clinical diagnostic device. 
          Model confidence represents statistical probability and does not equal clinical cancer probability.
        </p>
      </div>
    </motion.div>
  );
}