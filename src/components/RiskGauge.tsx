import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface RiskGaugeProps {
  score: number;
  color: string;
  size?: number;
}

export function RiskGauge({ score, color, size = 170 }: RiskGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = (size - 18) / 2;
  const circumference = 2 * Math.PI * radius;
  const stroke = 9;

  useEffect(() => {
    const start = displayScore;
    const diff = score - start;
    const duration = 900;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(start + diff * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(30,41,59,0.6)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}AA)` }}
        />
        {[25, 50, 75].map((pct) => {
          const angle = (pct / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const inner = radius - stroke / 2 - 2;
          const outer = radius + stroke / 2 + 2;
          const x1 = size / 2 + inner * Math.cos(rad);
          const y1 = size / 2 + inner * Math.sin(rad);
          const x2 = size / 2 + outer * Math.cos(rad);
          const y2 = size / 2 + outer * Math.sin(rad);
          return <line key={pct} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(71,85,105,0.5)" strokeWidth={1.5} />;
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          key={displayScore}
          initial={{ opacity: 0.5, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-4xl font-bold tabular-nums"
          style={{ color }}
        >
          {displayScore}
        </motion.span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Priority Score
        </span>
      </div>
    </div>
  );
}