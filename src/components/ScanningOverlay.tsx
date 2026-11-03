import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Loader2 } from 'lucide-react';
import type { SampleLesion } from '@/types';

interface ScanningOverlayProps {
  open: boolean;
  sample: SampleLesion;
  onComplete: () => void;
}

const STATUS_TEXTS = [
  'Normalizing pixel tensors (224×224)...',
  'Running forward pass through EfficientNet-B0 backbone...',
  'Computing Grad-CAM gradient activations...',
  'Calculating Malignancy Risk Score...',
];

export function ScanningOverlay({ open, sample, onComplete }: ScanningOverlayProps) {
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    if (!open) { setStatusIdx(0); return; }
    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_TEXTS.length - 1));
    }, 500);
    const timer = setTimeout(onComplete, 2200);
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [open, onComplete]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex w-full max-w-md flex-col items-center px-6"
          >
            {/* Scanning image with radar */}
            <div className="relative h-64 w-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <img src={sample.imageUrl} alt="Scanning" className="h-full w-full object-cover opacity-70" draggable={false} />

              {/* Radar sweep overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-56 w-56 rounded-full">
                  <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
                  <div className="absolute inset-4 rounded-full border border-emerald-500/15" />
                  <div className="absolute inset-8 rounded-full border border-emerald-500/10" />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.3) 60deg, transparent 90deg)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                </div>
              </div>

              {/* Scan line */}
              <motion.div
                className="absolute left-0 right-0 h-0.5 bg-emerald-400/80 shadow-[0_0_12px_3px_rgba(16,185,129,0.5)]"
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />

              {/* Corner brackets */}
              <CornerBrackets />
            </div>

            {/* Status */}
            <div className="mt-8 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <Activity className="h-4 w-4 text-emerald-400 dp-glow-emerald" />
            </div>
            <motion.p
              key={statusIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-center text-sm font-medium text-slate-300"
            >
              {STATUS_TEXTS[statusIdx]}
            </motion.p>

            {/* Progress dots */}
            <div className="mt-5 flex gap-2">
              {STATUS_TEXTS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i <= statusIdx ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-700'}`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CornerBrackets() {
  const base = 'absolute h-5 w-5 border-emerald-400/60';
  return (
    <>
      <div className={cn(base, 'left-2 top-2 border-l-2 border-t-2')} />
      <div className={cn(base, 'right-2 top-2 border-r-2 border-t-2')} />
      <div className={cn(base, 'bottom-2 left-2 border-b-2 border-l-2')} />
      <div className={cn(base, 'bottom-2 right-2 border-b-2 border-r-2')} />
    </>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
