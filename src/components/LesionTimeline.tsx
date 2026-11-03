import { useEffect, useState } from 'react';
import { Activity, Calendar, History, ImageOff } from 'lucide-react';
import type { HistoricalScan, RiskTier } from '@/types';
import { RISK_TIER_META } from '@/data/samples';

interface LesionTimelineProps {
  scans: HistoricalScan[];
}

export function LesionTimeline({ scans }: LesionTimelineProps) {
  const [baselineId, setBaselineId] = useState('');
  const [currentId, setCurrentId] = useState('');
  const [viewMode, setViewMode] = useState<'source' | 'heatmap'>('source');
  const orderedScans = scans
    .filter((scan) => scan.imageUrl.trim() && Number.isFinite(Date.parse(scan.createdAt)))
    .filter((scan, index, list) => list.findIndex((entry) => entry.id === scan.id) === index)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));

  useEffect(() => {
    setBaselineId(orderedScans[0]?.id || '');
    setCurrentId(orderedScans[orderedScans.length - 1]?.id || '');
  }, [scans]);

  const baselineScan = orderedScans.find((scan) => scan.id === baselineId) || orderedScans[0];
  const currentScan = orderedScans.find((scan) => scan.id === currentId) || orderedScans[orderedScans.length - 1];

  if (orderedScans.length === 0) {
    return (
      <div className="dp-glass space-y-4 p-5">
        <TimelineHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <div className="flex min-h-32 flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/30 px-5 py-8 text-center">
          <ImageOff className="h-5 w-5 text-slate-500" />
          <h3 className="mt-3 text-sm font-semibold text-slate-200">No saved scan images</h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-400">
            This patient has no eligible archived images yet. Upload and save scans to build a longitudinal comparison.
          </p>
        </div>
      </div>
    );
  }

  if (orderedScans.length === 1 && currentScan) {
    return (
      <div className="dp-glass space-y-4 p-5">
        <TimelineHeader viewMode={viewMode} onViewModeChange={setViewMode} />
        <MetricCard
          label="Latest Saved Scan"
          date={currentScan.date}
          prediction={currentScan.primaryPrediction}
          confidence={currentScan.confidence}
          tier={currentScan.riskTier}
        />
        <p className="text-xs text-slate-400">
          One eligible image is on file. A second distinct scan is needed for a side-by-side comparison.
        </p>
        <ScanImage scan={currentScan} viewMode={viewMode} label="Latest saved scan" />
      </div>
    );
  }

  if (!baselineScan || !currentScan) return null;

  const confidenceDelta = ((currentScan.confidence - baselineScan.confidence) * 100).toFixed(1);
  const sameImageReference = baselineScan.imageUrl === currentScan.imageUrl;

  return (
    <div className="dp-glass space-y-6 p-5">
      {/* Header */}
      <TimelineHeader viewMode={viewMode} onViewModeChange={setViewMode} />

      {/* Comparative Key Metrics Strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Baseline Scan"
          date={baselineScan.date}
          prediction={baselineScan.primaryPrediction}
          confidence={baselineScan.confidence}
          tier={baselineScan.riskTier}
        />

        {/* Delta Indicator */}
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 text-center">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">AI Confidence Difference</span>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-slate-200">
            <Activity className="h-4 w-4 text-slate-400" />
            {Number(confidenceDelta) > 0 ? '+' : ''}{confidenceDelta} percentage points
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {baselineScan.primaryPrediction === currentScan.primaryPrediction
              ? `Model category remains ${currentScan.primaryPrediction}.`
              : `Model category changed from ${baselineScan.primaryPrediction} to ${currentScan.primaryPrediction}.`}
            {' '}Confidence difference does not measure lesion growth.
          </p>
        </div>

        <MetricCard
          label="Current Scan"
          date={currentScan.date}
          prediction={currentScan.primaryPrediction}
          confidence={currentScan.confidence}
          tier={currentScan.riskTier}
        />
      </div>

      {/* Side-by-Side Dual View Area */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Baseline View */}
        <div className="relative rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Baseline ({baselineScan.date})</span>
            <span className="text-slate-500">#{baselineScan.id}</span>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
            <ScanImageContent scan={baselineScan} viewMode={viewMode} label="Baseline scan" />
          </div>
        </div>

        {/* Current View */}
        <div className="relative rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">Current ({currentScan.date})</span>
            <span className="text-slate-500">#{currentScan.id}</span>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
            <ScanImageContent scan={currentScan} viewMode={viewMode} label="Current scan" />
          </div>
        </div>
      </div>

      {/* Chronological Scan Selector */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Historical Scan Records ({orderedScans.length})
        </h3>
        <div className="dp-scroll flex items-center gap-3 overflow-x-auto pb-2">
          {orderedScans.map((scan) => {
            const isBaseline = scan.id === baselineScan.id;
            const isCurrent = scan.id === currentScan.id;
            const tierMeta = RISK_TIER_META[scan.riskTier];

            return (
              <div
                key={scan.id}
                className={`min-w-[150px] flex-shrink-0 cursor-pointer rounded-lg border p-2.5 transition-all ${
                  isCurrent
                    ? 'border-emerald-500/80 bg-emerald-500/10'
                    : isBaseline
                    ? 'border-sky-500/80 bg-sky-500/10'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
                onClick={() => {
                  if (!isBaseline && !isCurrent) setCurrentId(scan.id);
                }}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{scan.date}</span>
                  {tierMeta && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: tierMeta.color }}
                    />
                  )}
                </div>

                <div className="my-2 h-16 w-full overflow-hidden rounded border border-slate-800 bg-black">
                  <img src={scan.imageUrl} alt={scan.date} className="h-full w-full object-cover" />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="truncate font-semibold text-slate-200">{scan.primaryPrediction}</span>
                </div>

                <div className="mt-2 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBaselineId(scan.id);
                    }}
                    className={`flex-1 rounded py-0.5 text-[9px] font-bold ${
                      isBaseline ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Baseline
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentId(scan.id);
                    }}
                    className={`flex-1 rounded py-0.5 text-[9px] font-bold ${
                      isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Current
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {sameImageReference && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          These saved records reference the same source image. Visual change cannot be assessed from this pair.
        </p>
      )}
    </div>
  );
}

type TimelineViewMode = 'source' | 'heatmap';

function TimelineHeader({
  viewMode,
  onViewModeChange,
}: {
  viewMode: TimelineViewMode;
  onViewModeChange: (mode: TimelineViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <History className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Longitudinal Lesion Tracking</h2>
          <p className="text-xs text-slate-400">Saved source images and model results in chronological order</p>
        </div>
      </div>
      <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/60 p-1">
        {(['source', 'heatmap'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-all ${
              viewMode === mode
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScanImage({
  scan,
  viewMode,
  label,
}: {
  scan: HistoricalScan;
  viewMode: TimelineViewMode;
  label: string;
}) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
      <ScanImageContent scan={scan} viewMode={viewMode} label={label} />
    </div>
  );
}

function ScanImageContent({
  scan,
  viewMode,
  label,
}: {
  scan: HistoricalScan;
  viewMode: TimelineViewMode;
  label: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const source = viewMode === 'heatmap' ? scan.heatmapUrl : scan.imageUrl;

  useEffect(() => {
    setImageFailed(false);
  }, [source]);

  if (!source || imageFailed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-900/70 p-4 text-center text-xs text-slate-400">
        <ImageOff className="h-5 w-5 text-slate-500" />
        <span>{viewMode === 'heatmap' ? 'No saved heatmap for this scan.' : `${label} image is unavailable.`}</span>
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={`${label}${viewMode === 'heatmap' ? ' Grad-CAM heatmap' : ' source image'}`}
      className="h-full w-full object-cover"
      onError={() => setImageFailed(true)}
    />
  );
}

function MetricCard({
  label,
  date,
  prediction,
  confidence,
  tier,
}: {
  label: string;
  date: string;
  prediction: string;
  confidence: number;
  tier: RiskTier;
}) {
  const tierMeta = RISK_TIER_META[tier];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="flex items-center text-[10px] text-slate-500">
          <Calendar className="mr-1 h-3 w-3" /> {date}
        </span>
      </div>
      <p className="mt-1 text-sm font-bold text-slate-100">{prediction}</p>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-slate-400">Confidence: {(confidence * 100).toFixed(1)}%</span>
        {tierMeta && (
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: `${tierMeta.color}20`, color: tierMeta.color }}
          >
            {tierMeta.label}
          </span>
        )}
      </div>
    </div>
  );
}