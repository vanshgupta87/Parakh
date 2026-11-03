import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Camera, CheckCircle2, Loader2, ScanLine, Crosshair, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SAMPLES } from '@/data/samples';
import { API_BASE_URL } from '@/lib/api';
import type { SampleLesion } from '@/types';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onAnalyze: (sample: SampleLesion) => void;
}

export function UploadModal({ open, onClose, onAnalyze }: UploadModalProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selected, setSelected] = useState<SampleLesion | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Function to send file to your FastAPI backend
  const uploadFileToApi = async (file: File) => {
    setUploading(true);
    setSelected(null);
    const localImageUrl = URL.createObjectURL(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result)
          : reject(new Error('Unable to read the uploaded image.'));
        reader.onerror = () => reject(new Error('Unable to read the uploaded image.'));
        reader.readAsDataURL(file);
      });

      // POST request to local FastAPI server
      const response = await fetch(`${API_BASE_URL}/api/v1/diagnose`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();

      // Transform FastAPI response into the SampleLesion structure expected by UI
      const backendSample: SampleLesion = {
        id: 'upload-' + Date.now(),
        name: file.name,
        subtitle: 'Live API Diagnosis',
        imageUrl: localImageUrl,
        imageData,
        heatmapUrl: data.heatmap_base64 || localImageUrl,
        primaryPrediction: data.prediction,
        confidence: data.confidence,
        riskScore: data.risk_score,
        riskTier: data.risk_level.toLowerCase() as 'low' | 'moderate' | 'high' | 'critical',
        probabilities: Object.entries(data.probabilities || {}).map(([key, value], idx) => {
          const colors = ['#F43F5E', '#F59E0B', '#EAB308', '#10B981', '#0EA5E9', '#A78BFA', '#EC4899'];
          return {
            id: `prob-${idx}`,
            label: key,
            short: key.slice(0, 3).toUpperCase(),
            probability: (value as number) * 100,
            color: colors[idx % colors.length],
          };
        }),
        abcde: SAMPLES[2].abcde.map((a) => ({ ...a, flag: data.risk_score > 50 })),
        action: data.recommendation,
        quality: { lighting: 'Good', resolution: '224×224', focus: '95%' },
      };

      setSelected(backendSample);
    } catch (error) {
      console.error("API Connection Error:", error);
      alert("Failed to connect to FastAPI server at http://127.0.0.1:8000. Please ensure 'python main.py' is running in your terminal!");
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFileToApi(files[0]);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="upload-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-modal-title"
            initial={{ scale: 0.94, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 24 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="dp-glass mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto dp-scroll p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-emerald-400" />
                <h2 id="upload-modal-title" className="text-base font-semibold text-slate-100">Upload & Analyze Skin Lesion</h2>
              </div>
              <button onClick={onClose} className="text-slate-500 transition-colors hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dual input area */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Upload zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all',
                  dragOver
                    ? 'border-emerald-500/60 bg-emerald-500/5 shadow-[0_0_24px_-4px_rgba(16,185,129,0.25)]'
                    : 'border-slate-700/60 bg-slate-900/40 hover:border-emerald-500/40',
                )}
              >
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/dcm,application/dicom" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 transition-transform group-hover:scale-110">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-400" /> : <Upload className="h-6 w-6 text-emerald-400" />}
                </div>
                <p className="text-sm font-medium text-slate-200">
                  {uploading ? 'Analyzing Image via API...' : 'Drag & drop image'}
                </p>
                <p className="mt-1 text-xs text-slate-500">JPG, PNG, DICOM</p>
                {uploading && (
                  <div className="pointer-events-none absolute inset-2 overflow-hidden rounded-md">
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/70 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)] dp-scan-sweep" />
                  </div>
                )}
              </div>

              {/* Camera zone */}
              <button
                onClick={() => setCameraOpen(true)}
                className="group flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-slate-700/60 bg-slate-900/40 p-4 text-center transition-all hover:border-emerald-500/40"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30 transition-transform group-hover:scale-110">
                  <Camera className="h-6 w-6 text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-slate-200">Snap Photo via Webcam</p>
                <p className="mt-1 text-xs text-slate-500">Live macro capture</p>
              </button>
            </div>

            {/* Quality + Analyze */}
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <QualityBadge icon={<ScanLine className="h-3 w-3" />} label="Lighting" value={selected.quality.lighting} />
                  <QualityBadge label="Framing" value="Centered" />
                  <QualityBadge label="Resolution" value={selected.quality.resolution + ' Ready'} />
                </div>

                <button
                  onClick={() => onAnalyze(selected)}
                  disabled={uploading}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-3 text-sm font-bold text-slate-950 shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_32px_-2px_rgba(16,185,129,0.7)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  Analyze Lesion Now
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}

      {/* Camera modal */}
      <CameraModal key="camera-modal" open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={() => { setCameraOpen(false); setSelected(SAMPLES[1]); }} />
    </AnimatePresence>
  );
}

function CameraModal({ open, onClose, onCapture }: { open: boolean; onClose: () => void; onCapture: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="camera-modal-title"
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20 }}
            className="dp-glass mx-4 w-full max-w-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-emerald-400" />
                <h3 id="camera-modal-title" className="text-sm font-semibold text-slate-100">Live Camera Capture</h3>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
              {/* Reticle overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-32 w-32 rounded-full border-2 border-emerald-500/40">
                  <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-emerald-500/60" />
                  <div className="absolute left-1/2 bottom-0 h-3 w-px -translate-x-1/2 bg-emerald-500/60" />
                  <div className="absolute top-1/2 left-0 h-px w-3 -translate-y-1/2 bg-emerald-500/60" />
                  <div className="absolute top-1/2 right-0 h-px w-3 -translate-y-1/2 bg-emerald-500/60" />
                  <Crosshair className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50" />
                </div>
              </div>
              <p className="absolute bottom-3 text-center text-xs text-slate-500">Position lesion within the reticle circle</p>
            </div>
            <button
              onClick={onCapture}
              className="mt-3 w-full rounded-lg bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30 transition-colors hover:bg-emerald-500/25"
            >
              Capture Close-Up
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QualityBadge({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-800/50 bg-slate-900/40 px-2 py-1">
      <span className="text-emerald-400">{icon || <CheckCircle2 className="h-3 w-3" />}</span>
      <span className="text-[10px] text-slate-500">{label}:</span>
      <span className="text-[10px] font-medium text-slate-200">{value}</span>
    </div>
  );
}