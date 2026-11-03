import {
  Activity, BrainCircuit, CheckCircle2, FileImage, ScanLine,
  ShieldCheck, Upload,
} from 'lucide-react';
import { LesionTimeline } from '@/components/LesionTimeline';
import type { HistoricalScan } from '@/types';
import './DoctorAiAnalysisCenter.css';

interface DoctorAiAnalysisCenterProps {
  onUpload: () => void;
  patientId: string;
  onPatientIdChange: (patientId: string) => void;
  onLoadHistory: () => void;
  historyPatientId: string;
  historyScans: HistoricalScan[];
  historyLoaded: boolean;
  historyLoading: boolean;
  historyError: string;
  patients?: Array<{
    patient_id: string;
    patient_unique_id: string;
    full_name: string;
  }>;
}

const ANALYSIS_STEPS = [
  {
    number: '01',
    title: 'Image intake',
    description: 'Prepare a dermoscopic image for review.',
    icon: FileImage,
  },
  {
    number: '02',
    title: 'Model assessment',
    description: 'Review the seven-class model output.',
    icon: BrainCircuit,
  },
  {
    number: '03',
    title: 'Explainability',
    description: 'Inspect Grad-CAM visual guidance.',
    icon: ScanLine,
  },
];

export function DoctorAiAnalysisCenter({
  onUpload,
  patientId,
  onPatientIdChange,
  onLoadHistory,
  historyPatientId,
  historyScans,
  historyLoaded,
  historyLoading,
  historyError,
  patients = [],
}: DoctorAiAnalysisCenterProps) {
  return (
    <section className="doctor-ai-center" aria-labelledby="doctor-ai-title">
      <header className="doctor-ai-heading">
        <div>
          <p className="doctor-ai-kicker"><span /> CLINICAL IMAGING / AI-ASSISTED REVIEW</p>
          <h2 id="doctor-ai-title">AI Analysis Centre</h2>
          <p className="doctor-ai-subtitle">Bring a dermoscopic image into focus and review the model output with clinical context.</p>
        </div>
        <div className="doctor-ai-status">
          <span className="doctor-ai-status-dot" />
          <span>VERIFIED WORKSPACE</span>
        </div>
      </header>

      <div className="doctor-ai-patient-context">
        <label htmlFor="doctor-ai-patient-id">
          <div className="flex items-center justify-between">
            <span>PATIENT CONTEXT</span>
            {patients.length > 0 && (
              <span className="text-[10px] text-slate-400 font-normal">
                {patients.length} patient(s) registered
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-1">
            <input
              id="doctor-ai-patient-id"
              value={patientId}
              onChange={(event) => onPatientIdChange(event.target.value)}
              placeholder="Enter Patient ID (PRK-... or pat_...)"
              autoComplete="off"
              className="flex-1"
            />
            {patients.length > 0 && (
              <select
                aria-label="Select Patient"
                value={patientId}
                onChange={(e) => {
                  if (e.target.value) {
                    onPatientIdChange(e.target.value);
                  }
                }}
                className="bg-slate-900 border border-slate-700 text-[11px] text-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 max-w-xs shrink-0"
              >
                <option value="">Quick Select Patient...</option>
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.full_name} ({p.patient_unique_id})
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
        <button
          type="button"
          className="doctor-ai-history-button"
          onClick={onLoadHistory}
          disabled={!patientId.trim() || historyLoading}
        >
          {historyLoading ? 'Loading history…' : 'Load scan history'}
        </button>
        {historyError && <p className="doctor-ai-history-error" role="alert">{historyError}</p>}
      </div>

      <div className="doctor-ai-workspace">
        <section className="doctor-ai-intake" aria-labelledby="doctor-ai-intake-title">
          <div className="doctor-ai-panel-heading">
            <div className="doctor-ai-panel-title">
              <span className="doctor-ai-step-mark">01</span>
              <div>
                <p>IMAGE INTAKE</p>
                <h3 id="doctor-ai-intake-title">Start an analysis</h3>
              </div>
            </div>
            <span className="doctor-ai-formats">JPG <i /> PNG <i /> DICOM</span>
          </div>

          <div className="doctor-ai-upload-stage">
            <div className="doctor-ai-scan-graphic" aria-hidden="true">
              <span className="doctor-ai-scan-ring doctor-ai-scan-ring-outer" />
              <span className="doctor-ai-scan-ring doctor-ai-scan-ring-inner" />
              <span className="doctor-ai-scan-corner doctor-ai-scan-corner-top" />
              <span className="doctor-ai-scan-corner doctor-ai-scan-corner-bottom" />
              <FileImage size={29} strokeWidth={1.6} />
            </div>
            <h4>Bring a clinical image into focus</h4>
            <p>Upload an image to begin model assessment and visual explainability review.</p>
            <button type="button" className="doctor-ai-upload-button" onClick={onUpload} disabled={!patientId.trim()}>
              <Upload size={16} aria-hidden="true" />
              Upload lesion image
            </button>
            <span className="doctor-ai-upload-hint">
              {patientId.trim() ? 'Select an image to continue to intake' : 'Select a patient before starting an analysis'}
            </span>
          </div>

          <div className="doctor-ai-intake-note">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>AI output supports clinical review and is not a standalone diagnosis.</span>
          </div>
        </section>

        <aside className="doctor-ai-pathway" aria-labelledby="doctor-ai-pathway-title">
          <div className="doctor-ai-pathway-heading">
            <span>ANALYSIS PATHWAY</span>
            <h3 id="doctor-ai-pathway-title">From image to insight</h3>
          </div>
          <ol>
            {ANALYSIS_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.number}>
                  <span className="doctor-ai-pathway-number">{step.number}</span>
                  <span className="doctor-ai-pathway-icon"><Icon size={17} aria-hidden="true" /></span>
                  <div>
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="doctor-ai-pathway-foot">
            <Activity size={16} aria-hidden="true" />
            <span>Results are presented for clinician interpretation.</span>
          </div>
        </aside>
      </div>

      <div className="doctor-ai-model-strip" aria-label="Configured model details">
        <div className="doctor-ai-model-intro">
          <span className="doctor-ai-model-icon"><BrainCircuit size={18} aria-hidden="true" /></span>
          <div><span>CONFIGURED MODEL</span><strong>Clinical image analysis</strong></div>
        </div>
        <div className="doctor-ai-model-fact"><span>Architecture</span><strong>EfficientNet-B0</strong></div>
        <div className="doctor-ai-model-fact"><span>Dataset</span><strong>HAM10000</strong></div>
        <div className="doctor-ai-model-fact"><span>Classes</span><strong>7</strong></div>
        <div className="doctor-ai-model-fact doctor-ai-model-explainability"><span>Explainability</span><strong><CheckCircle2 size={14} aria-hidden="true" /> Grad-CAM</strong></div>
      </div>

      {historyLoaded && historyPatientId === patientId.trim() && (
        <div className="doctor-ai-history">
          <LesionTimeline scans={historyScans} />
        </div>
      )}
    </section>
  );
}