import { useState } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Grid3x3, RotateCw, Eye, Layers, Maximize2, Minimize2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface DiagnosticViewerProps {
  imageUrl: string;
  heatmapUrl: string;
  primaryPrediction: string;
  confidence: number;
}

export function DiagnosticViewer({ imageUrl, heatmapUrl, primaryPrediction, confidence }: DiagnosticViewerProps) {
  const [opacity, setOpacity] = useState(60);
  const [zoom, setZoom] = useState(1);
  const [showMesh, setShowMesh] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Convert decimal (e.g., 0.954) or percentage (e.g., 95.4) safely
  const confidencePercent = confidence <= 1 ? (confidence * 100).toFixed(1) : confidence.toFixed(1);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.min(3, Math.max(1, +(z + delta).toFixed(2))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom === 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className={cn('flex flex-col gap-3', fullscreen && 'fixed inset-0 z-[70] bg-slate-950/95 p-6 backdrop-blur-xl')}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-slate-100">Grad-CAM Diagnostic Viewer</h3>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
            {confidencePercent}% conf.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolBtn onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><ZoomIn className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))}><ZoomOut className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={reset}><RotateCw className="h-3.5 w-3.5" /></ToolBtn>
          <button
            onClick={() => setShowMesh((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              showMesh ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-slate-400 hover:text-slate-200',
            )}
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            Mesh
          </button>
          <ToolBtn onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </ToolBtn>
        </div>
      </div>

      {/* Dual view */}
      <div className={cn('grid gap-3', fullscreen ? 'grid-cols-2 h-full' : 'grid-cols-1 md:grid-cols-2')}>
        {/* Original */}
        <div className="dp-glass group relative overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-800/50 bg-slate-900/40 px-3 py-1.5">
            <Eye className="h-3 w-3 text-slate-500" />
            <span className="text-[11px] font-medium text-slate-400">Source Lesion Photo</span>
          </div>
          <div
            className="relative aspect-square overflow-hidden bg-black/40"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
            style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              src={imageUrl}
              alt="Original lesion"
              className="h-full w-full object-cover"
              style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`, transition: dragging ? 'none' : 'transform 0.15s ease-out' }}
              draggable={false}
            />
            {showMesh && <MeshOverlay />}
          </div>
        </div>

        {/* Grad-CAM overlay */}
        <div className="dp-glass group relative overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-slate-800/50 bg-slate-900/40 px-3 py-1.5">
            <Layers className="h-3 w-3 text-rose-400" />
            <span className="text-[11px] font-medium text-slate-400">Grad-CAM Heatmap Overlay</span>
            <span className="ml-auto rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
              {primaryPrediction} ({confidencePercent}%)
            </span>
          </div>
          <div className="relative aspect-square overflow-hidden bg-black/40">
            <img src={imageUrl} alt="Underlay" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
            <motion.img
              key={heatmapUrl}
              src={heatmapUrl}
              alt="Grad-CAM heatmap"
              className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: opacity / 100 }}
              transition={{ duration: 0.3 }}
              style={{ filter: 'saturate(2.8) hue-rotate(-15deg) contrast(1.4) brightness(1.1)' }}
              draggable={false}
            />
            {showMesh && <MeshOverlay />}
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-medium text-slate-200 backdrop-blur-sm">
              Overlay: {opacity}%
            </div>
          </div>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="flex items-center gap-3 rounded-lg border border-slate-800/50 bg-slate-900/40 px-4 py-3">
        <Layers className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-slate-400">Heatmap Opacity</span>
        <Slider value={[opacity]} onValueChange={(v) => setOpacity(v[0])} min={0} max={100} step={1} className="flex-1" />
        <span className="w-10 text-right text-xs font-semibold tabular-nums text-slate-100">{opacity}%</span>
      </div>
    </div>
  );
}

function ToolBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
    >
      {children}
    </button>
  );
}

function MeshOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(14,165,233,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,165,233,0.25) 1px, transparent 1px)',
          backgroundSize: '11.11% 11.11%',
        }}
      />
    </div>
  );
}