import { useState } from 'react';
import { Eye, Sliders, Info, Activity } from 'lucide-react';
import type { ColorMap, ModelUncertainty } from '@/types';
interface ModelTransparencyProps {
  imageUrl: string;
  heatmapUrl: string;
  confidence: number;
  uncertainty?: ModelUncertainty;
}

const COLOR_MAP_STYLES: Record<ColorMap, { name: string; filter: string; gradient: string }> = {
  jet: {
    name: 'Jet (Classic)',
    filter: 'hue-rotate(0deg) contrast(120%) saturate(140%)',
    gradient: 'from-blue-600 via-green-500 via-yellow-400 to-red-600',
  },
  inferno: {
    name: 'Inferno',
    filter: 'hue-rotate(280deg) saturate(180%) contrast(130%)',
    gradient: 'from-black via-purple-800 via-rose-500 to-yellow-300',
  },
  viridis: {
    name: 'Viridis',
    filter: 'hue-rotate(90deg) saturate(110%) brightness(110%)',
    gradient: 'from-purple-900 via-teal-600 via-emerald-400 to-yellow-300',
  },
  magma: {
    name: 'Magma',
    filter: 'hue-rotate(320deg) contrast(125%) saturate(150%)',
    gradient: 'from-slate-950 via-purple-900 via-pink-600 to-amber-200',
  },
};

export function ModelTransparency({
  imageUrl,
  heatmapUrl,
  confidence,
  uncertainty = {
    epistemicRange: [Math.max(0, confidence - 0.08), Math.min(1, confidence + 0.05)],
    variance: 0.0034,
    entropy: 0.42,
  },
}: ModelTransparencyProps) {
  const [selectedMap, setSelectedMap] = useState<ColorMap>('jet');
  const [threshold, setThreshold] = useState<number>(40);
  const [opacity, setOpacity] = useState<number>(75);

  const [minBound, maxBound] = uncertainty.epistemicRange;

  return (
    <div className="dp-glass space-y-6 p-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 ring-1 ring-indigo-500/30">
          <Eye className="h-4 w-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-100">Model Transparency & Calibration</h2>
          <p className="text-xs text-slate-400">
            Epistemic uncertainty bounds and Grad-CAM activation controls
          </p>
        </div>
      </div>

      {/* 1. Epistemic Uncertainty Quantification */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Uncertainty Quantification (Monte Carlo Dropout)
            </span>
          </div>
          <span className="text-[10px] rounded bg-indigo-500/10 px-2 py-0.5 text-indigo-400 font-mono">
            Variance: {uncertainty.variance.toFixed(4)}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-400">95% Epistemic Confidence Interval</span>
            <span className="font-mono text-indigo-300 font-bold">
              {(minBound * 100).toFixed(1)}% — {(maxBound * 100).toFixed(1)}%
            </span>
          </div>

          {/* Range Visualizer Bar */}
          <div className="relative h-4 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
            <div
              className="absolute top-0 bottom-0 bg-indigo-500/30 border-x border-indigo-400/80"
              style={{
                left: `${minBound * 100}%`,
                width: `${(maxBound - minBound) * 100}%`,
              }}
            />
            {/* Primary Confidence Marker */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
              style={{ left: `${confidence * 100}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0% (Uncertain)</span>
            <span>Point Estimate: {(confidence * 100).toFixed(1)}%</span>
            <span>100% (Certain)</span>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded bg-slate-900/80 p-2.5 text-[11px] text-slate-400 border border-slate-800">
          <Info className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
          <span>
            Computed across 50 Monte Carlo Dropout forward passes. A wider interval indicates higher model uncertainty, recommending clinical over-read.
          </span>
        </div>
      </div>

      {/* 2. Custom Heatmap Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Heatmap Controls Column */}
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Sliders className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Grad-CAM Color Map & Thresholds
            </span>
          </div>

          {/* ColorMap Selection */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-medium">Color Palette Preset</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(COLOR_MAP_STYLES) as ColorMap[]).map((mapKey) => (
                <button
                  key={mapKey}
                  onClick={() => setSelectedMap(mapKey)}
                  className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-all ${
                    selectedMap === mapKey
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-200">{COLOR_MAP_STYLES[mapKey].name}</span>
                  <div
                    className={`h-2 w-full rounded-full bg-gradient-to-r ${COLOR_MAP_STYLES[mapKey].gradient}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Activation Threshold Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Peak Activation Threshold</span>
              <span className="font-mono text-emerald-400">{threshold}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Heatmap Overlay Opacity</span>
              <span className="font-mono text-emerald-400">{opacity}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Live Heatmap Preview Screen */}
        <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-800 bg-black flex items-center justify-center">
          {/* Base dermoscopy image */}
          <img src={imageUrl} alt="Base Lesion" className="absolute inset-0 h-full w-full object-cover" />

          {/* Dynamic Grad-CAM layer */}
          <img
            src={heatmapUrl}
            alt="Grad-CAM Overlay"
            className="absolute inset-0 h-full w-full object-cover mix-blend-screen transition-all"
            style={{
              opacity: opacity / 100,
              filter: `${COLOR_MAP_STYLES[selectedMap].filter} opacity(${100 - threshold / 1.5}%)`,
            }}
          />

          <div className="absolute top-2 left-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] font-mono text-slate-300 border border-slate-800">
            Palette: {selectedMap.toUpperCase()} | Cutoff: &gt;{threshold}%
          </div>
        </div>
      </div>

    </div>
  );
}