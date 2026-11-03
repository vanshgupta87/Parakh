import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Calendar, Clock, FileText, CheckCircle,
  AlertCircle, Loader2, Sparkles, Stethoscope, Save, BrainCircuit,
  Eye, ShieldAlert, Activity, FolderOpen
} from 'lucide-react';
import { appointmentApi, medicalDocumentApi, API_BASE_URL } from '@/lib/api';
import { SAMPLES } from '@/data/samples';
import type { SampleLesion } from '@/types';

interface Appointment {
  id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  status: string;
  reason_for_visit?: string;
  notes?: string;
  patient_name: string;
  patient_unique_id: string;
  patient_id?: string;
}

interface AttachedReport {
  report_id: string;
  prediction: string;
  confidence: number;
  risk_score: number;
  risk_level: string;
  recommendation?: string;
  yolo_detection?: string;
  image_data?: string;
  heatmap_data?: string;
  probabilities?: Record<string, number>;
  clinical_metadata?: Record<string, any>;
  created_at: string;
  attachment_notes?: string;
  attached_at: string;
}

interface Props {
  appointment: Appointment;
  onBack: () => void;
  onScanImageWithAI?: (sample: SampleLesion) => void;
}

export function ConsultationWorkspace({ appointment, onBack, onScanImageWithAI }: Props) {
  const [chiefComplaint, setChiefComplaint] = useState(appointment.reason_for_visit || '');
  const [clinicalNotes, setClinicalNotes] = useState(appointment.notes || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  
  const [attachedReports, setAttachedReports] = useState<AttachedReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const [patientDocs, setPatientDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSendToAIAnalysis = async (doc: any) => {
    if (!onScanImageWithAI) return;
    setAnalyzingDocId(doc.id);

    try {
      const viewUrl = medicalDocumentApi.getViewUrl(doc.id);
      const res = await fetch(viewUrl);
      if (!res.ok) throw new Error('Failed to fetch patient image file');
      const blob = await res.blob();

      // Read as base64 Data URL for display & persistence
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Read failed'));
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(blob);
      });

      // Prepare form data for FastAPI /diagnose
      const file = new File([blob], doc.file_name || 'patient_lesion.jpg', { type: doc.mime_type || 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', file);

      const diagRes = await fetch(`${API_BASE_URL}/api/v1/diagnose`, {
        method: 'POST',
        body: formData,
      });

      if (!diagRes.ok) {
        throw new Error(`AI Model error: ${diagRes.status}`);
      }

      const data = await diagRes.json();

      const backendSample: SampleLesion = {
        id: 'patient-doc-' + doc.id,
        name: doc.title || doc.file_name || 'Patient Skin Lesion',
        subtitle: `Patient Scan (${appointment.patient_name})`,
        imageUrl: imageData,
        imageData: imageData,
        heatmapUrl: data.heatmap_base64 || imageData,
        primaryPrediction: data.prediction,
        confidence: data.confidence,
        riskScore: data.risk_score,
        riskTier: (data.risk_level || 'moderate').toLowerCase() as any,
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
        abcde: (SAMPLES[2]?.abcde || []).map((a) => ({ ...a, flag: data.risk_score > 50 })),
        action: data.recommendation,
        quality: { lighting: 'Good', resolution: '224×224', focus: '95%' },
      };

      onScanImageWithAI(backendSample);
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch'
        ? 'Backend AI server is not responding at port 8000. Please ensure python uvicorn backend is running.'
        : (err.message || 'Unable to scan image');
      alert(`AI Analysis error: ${msg}`);
    } finally {
      setAnalyzingDocId(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    appointmentApi.getAttachedReports(appointment.id)
      .then((res) => {
        if (mounted && res && res.reports) {
          setAttachedReports(res.reports);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setReportsLoading(false);
      });
    return () => { mounted = false; };
  }, [appointment.id]);

  // Fetch patient-uploaded medical documents if we have the internal patient_id
  useEffect(() => {
    if (!appointment.patient_id) return;
    let mounted = true;
    setDocsLoading(true);
    medicalDocumentApi.listForPatient(appointment.patient_id, {})
      .then((res) => {
        if (mounted && res && res.documents) {
          setPatientDocs(res.documents);
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setDocsLoading(false); });
    return () => { mounted = false; };
  }, [appointment.patient_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      await appointmentApi.saveConsultation(appointment.id, {
        chief_complaint: chiefComplaint,
        clinical_notes: clinicalNotes,
        diagnosis: diagnosis,
        follow_up_date: followUpDate || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to save consultation record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Appointments
        </button>
        <span className="text-xs font-mono text-slate-500">
          Record ID: {appointment.id}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-indigo-950/20 p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
              Clinical Consultation Workspace
            </span>
            <h2 className="text-xl font-bold text-white mt-2">
              Patient: {appointment.patient_name}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Patient ID: <span className="text-indigo-300 font-semibold">{appointment.patient_unique_id}</span> • Date: {appointment.appointment_date} ({appointment.slot_start} - {appointment.slot_end})
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 text-xs text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span className="capitalize">{appointment.status}</span>
          </div>
        </div>
      </div>

      {/* Patient Submitted Symptoms & Context */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" /> Patient Submitted Intake & Reason
        </h3>
        <p className="text-sm text-slate-200 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
          {appointment.reason_for_visit || 'No intake notes provided by patient.'}
        </p>
      </div>

      {/* Attached AI Screening Reports */}
      {reportsLoading ? (
        <div className="flex items-center justify-center p-6 text-slate-500 text-xs">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading attached AI reports...
        </div>
      ) : attachedReports.length > 0 ? (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-teal-300 flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-teal-400" />
              Attached Patient AI Lesion Screening Report
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
              Verified Patient Record
            </span>
          </div>

          <div className="space-y-4">
            {attachedReports.map((report) => (
              <div
                key={report.report_id}
                className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Analysis ID: {report.report_id}
                    </span>
                    <h4 className="text-base font-bold text-white mt-0.5">
                      {report.prediction}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 font-semibold text-slate-300 border border-slate-700">
                      Confidence: {Math.round(report.confidence * 100)}%
                    </span>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                        report.risk_level === 'Critical'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : report.risk_level === 'Moderate'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      Risk: {report.risk_level} ({report.risk_score}/100)
                    </span>
                  </div>
                </div>

                {/* Imagery & Heatmaps */}
                {(report.image_data || report.heatmap_data) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.image_data && (
                      <div>
                        <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">Original Lesion Image</span>
                        <img
                          src={report.image_data}
                          alt="Dermoscopic view"
                          className="h-44 w-full rounded-lg object-cover border border-slate-800"
                        />
                      </div>
                    )}
                    {report.heatmap_data && (
                      <div>
                        <span className="text-[11px] text-teal-400 block mb-1.5 font-medium flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" /> Grad-CAM Explainability Layer
                        </span>
                        <img
                          src={report.heatmap_data}
                          alt="Grad-CAM activation"
                          className="h-44 w-full rounded-lg object-cover border border-teal-500/30"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Recommendation & YOLO */}
                <div className="space-y-2 text-xs">
                  {report.recommendation && (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-500 font-semibold block mb-0.5">Automated Recommendation:</span>
                      <p className="text-slate-300 leading-relaxed">{report.recommendation}</p>
                    </div>
                  )}
                  {report.yolo_detection && (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
                      <span className="text-slate-500 font-semibold block mb-0.5">YOLO Object Detection:</span>
                      <p className="text-slate-300 font-mono text-[11px]">{report.yolo_detection}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span>Analyzed: {new Date(report.created_at).toLocaleString()}</span>
                    <span>Attached: {new Date(report.attached_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Patient Uploaded Medical Documents */}
      {appointment.patient_id && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-violet-300 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-violet-400" />
              Patient Uploaded Medical Documents
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Secure Patient Files
            </span>
          </div>

          {docsLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading patient documents…
            </div>
          ) : patientDocs.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No documents uploaded by this patient yet.</p>
          ) : (
            <div className="space-y-3">
              {patientDocs.map((doc: any) => {
                const isImage = doc.mime_type && doc.mime_type.startsWith('image/');
                const viewUrl = medicalDocumentApi.getViewUrl(doc.id);
                const downloadUrl = medicalDocumentApi.getDownloadUrl(doc.id);
                return (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  {/* Image preview if available */}
                  {isImage ? (
                    <img
                      src={viewUrl}
                      alt={doc.file_name || 'Patient document'}
                      className="h-24 w-24 rounded-lg object-cover border border-slate-700 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">
                      {doc.title || doc.file_name || 'Document'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Category: <span className="text-slate-400">{doc.category || '—'}</span>
                      {doc.notes && <> · {doc.notes}</>}
                    </p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleString() : '—'}
                      {doc.file_name && <span className="ml-2 font-mono text-slate-600">{doc.file_name}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isImage && onScanImageWithAI && (
                      <button
                        type="button"
                        onClick={() => handleSendToAIAnalysis(doc)}
                        disabled={analyzingDocId === doc.id}
                        className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-[0_0_12px_-2px_rgba(16,185,129,0.3)] disabled:opacity-50"
                        title="Send this image directly to AI Analysis Center for diagnostic scanning"
                      >
                        {analyzingDocId === doc.id ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                            <span>Scanning AI…</span>
                          </>
                        ) : (
                          <>
                            <BrainCircuit className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Scan with AI</span>
                          </>
                        )}
                      </button>
                    )}
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </a>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* AI Assistance Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3 text-xs text-amber-200/90">
        <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-300">Decision Support Policy: </span>
          AI lesion classifications and Grad-CAM insights serve strictly as assistive guidance. All formal clinical assessments, diagnoses, and treatment paths must be independently evaluated and confirmed by the attending licensed dermatologist below.
        </div>
      </div>

      {/* Consultation Record Form */}
      <form onSubmit={handleSave} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-5 backdrop-blur-md">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-indigo-400" />
            Doctor Clinical Assessment & Findings
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Document patient examination, differential diagnosis, and management plan.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <CheckCircle className="h-4 w-4 shrink-0" /> Consultation record saved successfully.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Chief Complaint & Clinical Presentation
            </label>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Erythematous scaly plaque on left forearm"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Clinical Notes & Dermoscopic Examination Findings
            </label>
            <textarea
              rows={4}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Record lesion characteristics: asymmetry, border irregularities, pigment network, vascular patterns..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Confirmed / Working Diagnosis
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Actinic Keratosis / Benign Seborrheic Keratosis"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Recommended Follow-Up Date (Optional)
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-semibold text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[0_0_15px_-2px_rgba(99,102,241,0.5)]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Clinical Record
          </button>
        </div>
      </form>
    </div>
  );
}
