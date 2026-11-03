import { motion } from 'framer-motion';
import {
  Activity, FileDown, RotateCcw, Printer, ArrowLeft, CheckCircle2, ScanLine,
} from 'lucide-react';
import { DiagnosticViewer } from '@/components/DiagnosticViewer';
import { LesionTimeline } from '@/components/LesionTimeline';
import { ModelTransparency } from '@/components/ModelTransparency';
import { PatientTriage } from '@/components/PatientTriage';
import { ResultsPanel } from '@/components/ResultsPanel';
import { ActionCard } from '@/components/ActionCard';
import { IntakeForm } from '@/components/IntakeForm';
import { PrintReport } from '@/components/PrintReport';
import { RISK_TIER_META } from '@/data/samples';
import type { SampleLesion, PatientMetadata, HistoricalScan } from '@/types';

const EMPTY_HISTORICAL_SCANS: HistoricalScan[] = [];

interface ResultsPageProps {
  sample: SampleLesion;
  scanId: string | null;
  historicalScans?: HistoricalScan[];
  persistenceMessage?: string;
  patientMeta: PatientMetadata;
  onUpdatePatientMeta: (updated: PatientMetadata) => void;
  onScanAnother?: () => void;
  onBackHome: () => void;
}

export function ResultsPage({
  sample,
  scanId,
  historicalScans = EMPTY_HISTORICAL_SCANS,
  persistenceMessage,
  patientMeta,
  onUpdatePatientMeta,
  onScanAnother,
  onBackHome,
}: ResultsPageProps) {
  const tier = RISK_TIER_META[sample.riskTier];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen">
      <nav className="no-print sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-6">
          <button onClick={onBackHome} className="flex items-center gap-2 text-slate-400 transition-colors hover:text-slate-100">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-emerald-500/50 dp-pulse-ring" />
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <Activity className="h-4 w-4 text-emerald-400" />
              </span>
            </div>
            <span className="text-sm font-bold text-slate-100">Parakh</span>
          </div>
          <div className="flex items-center gap-2">
            <ActionBtn onClick={handlePrint} icon={<FileDown className="h-3.5 w-3.5" />} label="Download PDF" />
            <ActionBtn onClick={handlePrint} icon={<Printer className="h-3.5 w-3.5" />} label="Print" />
          </div>
        </div>
      </nav>

      <main className="no-print mx-auto max-w-[1600px] px-4 py-5 md:px-6 print:hidden">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="dp-glass mb-5 flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">Diagnostic Report Generated Successfully</p>
              <p className="text-xs text-slate-500">
                {scanId ? <>Scan ID: <span className="font-mono text-slate-300">#{scanId}</span></> : 'This scan is not archived.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Risk Tier:</span>
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: `${tier.color}1a`, color: tier.color, boxShadow: `inset 0 0 0 1px ${tier.color}40` }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: tier.color, boxShadow: `0 0 6px ${tier.color}` }} />
              {tier.label}
            </span>
          </div>
        </motion.div>

        {persistenceMessage && (
          <p
            role="status"
            className={`mb-5 rounded-lg border px-4 py-2.5 text-xs ${
              persistenceMessage.startsWith('Scan saved')
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            {persistenceMessage}
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_370px]">
          {/* Main Column */}
          <div className="flex flex-col gap-5">
            <section className="dp-glass p-4">
              <DiagnosticViewer
                imageUrl={sample.imageUrl}
                heatmapUrl={sample.heatmapUrl}
                primaryPrediction={sample.primaryPrediction}
                confidence={sample.confidence}
              />
            </section>

            {/* Model Transparency & Calibration Section */}
            <ModelTransparency
              imageUrl={sample.imageUrl}
              heatmapUrl={sample.heatmapUrl}
              confidence={sample.confidence}
            />

            {/* 5. Patient Communication & Triage Flow */}
            <PatientTriage
              priorityTier={sample.riskTier === 'high' ? 'high' : sample.riskTier === 'moderate' ? 'moderate' : 'low'}
              confidenceScore={sample.confidence}
            />

            <LesionTimeline scans={historicalScans} />

            <IntakeForm metadata={patientMeta} onChange={onUpdatePatientMeta} />

            <ActionCard sample={sample} />
          </div>

          {/* Sidebar Column */}
          <aside className="flex flex-col gap-5">
            <div className="flex flex-col gap-5 xl:sticky xl:top-[80px]">
              <ResultsPanel sample={sample} />

              <div className="dp-glass p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ScanLine className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Analysis Metadata</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px]">
                  <MetaRow label="Model" value="EfficientNet-B0" />
                  <MetaRow label="Quantization" value="FP16" />
                  <MetaRow label="Version" value="v2.4" />
                  <MetaRow label="Input" value="224 × 224 × 3" />
                  <MetaRow label="Classes" value="7 (ISIC HAM10000)" />
                  <MetaRow label="Grad-CAM" value="Layer 7, conv-head" />
                </div>
              </div>

              {onScanAnother && (
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={onScanAnother}
                    className="group flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/15 py-2.5 text-sm font-bold text-emerald-400 ring-1 ring-emerald-500/30 transition-all hover:bg-emerald-500/25 hover:shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]"
                  >
                    <RotateCcw className="h-4 w-4 transition-transform group-hover:-rotate-180" />
                    Scan Another Lesion
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <PrintReport sample={sample} scanId={scanId ?? ''} patientMeta={patientMeta} />
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-800/60 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-slate-100"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-200">{value}</span>
    </div>
  );
}