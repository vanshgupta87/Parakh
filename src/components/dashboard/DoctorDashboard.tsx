import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, BrainCircuit, Users, Calendar, FileText, Pill,
  Share2, Bell, Settings, Clock, AlertTriangle, CheckCircle2, ShieldCheck,
  Stethoscope, Sparkles, Building, Award, Upload, FolderOpen,
  FileDown, Printer, Eye, X, Activity, History
} from 'lucide-react';
import { DashboardLayout, type NavItem } from './DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { doctorApi } from '@/lib/api';
import { UploadModal } from '@/components/UploadModal';
import { ScanningOverlay } from '@/components/ScanningOverlay';
import { ResultsPage } from '@/components/ResultsPage';
import { DoctorAiAnalysisCenter } from './DoctorAiAnalysisCenter';
import { DoctorAppointmentList } from '@/components/appointments/DoctorAppointmentList';
import { DoctorAvailabilityManager } from '@/components/appointments/DoctorAvailabilityManager';
import { ConsultationWorkspace } from '@/components/appointments/ConsultationWorkspace';
import { DoctorPatientsView } from './DoctorPatientsView';
import { MedicalRecordsView } from '@/components/emr/MedicalRecordsView';
import { DigitalPrescriptionsView } from '@/components/emr/DigitalPrescriptionsView';
import { MedicalDocumentsView } from '@/components/emr/MedicalDocumentsView';
import { ClinicalTimelineView } from '@/components/emr/ClinicalTimelineView';
import { AccountSettings } from './AccountSettings';
import { SAMPLES } from '@/data/samples';
import type { HistoricalScan, SampleLesion, PatientMetadata, RiskTier } from '@/types';

const DOCTOR_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'My Patients', icon: Users },
  { id: 'ai-analysis', label: 'AI Analysis Centre', icon: BrainCircuit },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'availability', label: 'Availability', icon: Clock },
  { id: 'medical-records', label: 'Patient Medical History', icon: FileText },
  { id: 'prescriptions', label: 'Digital Prescriptions', icon: Pill },
  { id: 'documents', label: 'Medical Documents', icon: FolderOpen },
  { id: 'timeline', label: 'Clinical Timeline', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type StoredDoctorAIReport = Awaited<ReturnType<typeof doctorApi.listPatientAIReports>>['reports'][number];

function mapReportToHistoricalScan(report: StoredDoctorAIReport): HistoricalScan | null {
  const imageUrl = typeof report.image_data === 'string' ? report.image_data.trim() : '';
  const confidence = Number(report.confidence);
  const createdAt = report.created_at;
  const parsedDate = new Date(createdAt);
  const normalizedTier = report.risk_level.trim().toLowerCase();
  const validTiers: RiskTier[] = ['low', 'moderate', 'high', 'critical', 'urgent'];

  if (
    !imageUrl ||
    !report.id ||
    !report.prediction?.trim() ||
    !Number.isFinite(confidence) ||
    confidence < 0 || confidence > 1 ||
    Number.isNaN(parsedDate.getTime()) ||
    !validTiers.includes(normalizedTier as RiskTier)
  ) {
    return null;
  }

  return {
    id: report.id,
    date: parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAt,
    imageUrl,
    heatmapUrl: report.heatmap_data || undefined,
    primaryPrediction: report.prediction,
    confidence,
    riskTier: normalizedTier as RiskTier,
  };
}

function mapUploadToHistoricalScan(
  sample: SampleLesion,
  reportId: string,
  createdAt: string,
): HistoricalScan {
  const parsedDate = new Date(createdAt);
  return {
    id: reportId,
    date: parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAt,
    imageUrl: sample.imageData || sample.imageUrl,
    heatmapUrl: sample.heatmapUrl.startsWith('data:') ? sample.heatmapUrl : undefined,
    primaryPrediction: sample.primaryPrediction,
    confidence: sample.confidence,
    riskTier: sample.riskTier,
  };
}

export function DoctorDashboard() {
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [profileData, setProfileData] = useState<any>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [doctorPatients, setDoctorPatients] = useState<any[]>([]);
  const [copiedPatientId, setCopiedPatientId] = useState<string | null>(null);

  const handleCopyId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedPatientId(idText);
    setTimeout(() => {
      setCopiedPatientId((prev) => (prev === idText ? null : prev));
    }, 2000);
  };

  const handleSelectPatientForHistory = (patientId: string) => {
    setTargetPatientId(patientId);
    setActiveNav('medical-records');
  };

  const handleSelectPatientForAI = (patientId: string) => {
    setTargetPatientId(patientId);
    setActivePatientId(patientId);
    setActiveNav('ai-analysis');
    setHistoryLoading(true);
    setHistoryError('');
    doctorApi.listPatientAIReports(patientId)
      .then((res) => {
        const scans = res.reports
          .map(mapReportToHistoricalScan)
          .filter((scan): scan is HistoricalScan => scan !== null);
        setHistoryScans(scans);
        setHistoryPatientId(patientId);
        setHistoryLoaded(true);
      })
      .catch((err) => {
        setHistoryScans([]);
        setHistoryPatientId(patientId);
        setHistoryLoaded(false);
        setHistoryError(err instanceof Error ? err.message : 'Unable to load scan history.');
      })
      .finally(() => {
        setHistoryLoading(false);
      });
  };

  // Active appointment consultation session
  const [activeConsultation, setActiveConsultation] = useState<any>(null);

  // Integrated AI Diagnosis State (preserves original working functionality)
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeSample, setActiveSample] = useState<SampleLesion>(SAMPLES[2]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [targetPatientId, setTargetPatientId] = useState<string>('');
  const [activePatientId, setActivePatientId] = useState<string>('');
  const [historyScans, setHistoryScans] = useState<HistoricalScan[]>([]);
  const [historyPatientId, setHistoryPatientId] = useState<string>('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [reportPersistenceMessage, setReportPersistenceMessage] = useState('');
  const [viewingResults, setViewingResults] = useState(false);
  const [selectedReportForPrint, setSelectedReportForPrint] = useState<any | null>(null);
  const [patientMeta, setPatientMeta] = useState<PatientMetadata>({
    age: '',
    gender: '',
    anatomicalSite: '',
    fitzpatrickSkinType: '',
    isElevated: false,
    hasItching: false,
    hasBleeding: false,
    hasChangedRecently: false,
    durationMonths: '',
  });

  const docProfile = user?.doctor_profile;
  const verificationStatus = docProfile?.verification_status || 'pending';

  const handlePatientIdChange = (patientId: string) => {
    setTargetPatientId(patientId);
    if (patientId.trim() !== historyPatientId) {
      setHistoryLoaded(false);
      setHistoryError('');
    }
  };

  const loadPatientHistory = async () => {
    const patientId = targetPatientId.trim();
    if (!patientId) {
      setHistoryError('Enter an authorized Patient ID to load scan history.');
      setHistoryLoaded(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await doctorApi.listPatientAIReports(patientId);
      const scans = response.reports
        .map(mapReportToHistoricalScan)
        .filter((scan): scan is HistoricalScan => scan !== null);
      setHistoryScans(scans);
      setHistoryPatientId(patientId);
      setHistoryLoaded(true);
    } catch (error) {
      setHistoryScans([]);
      setHistoryPatientId(patientId);
      setHistoryLoaded(false);
      setHistoryError(error instanceof Error ? error.message : 'Unable to load scan history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    doctorApi.getProfile().then((res) => setProfileData(res?.profile)).catch(() => {});
    if (verificationStatus === 'approved') {
      doctorApi.getDashboardSummary().then((res) => setSummaryData(res)).catch(() => {});
      doctorApi.getPatients().then((res) => setDoctorPatients(res?.patients || [])).catch(() => {});
    }
  }, [verificationStatus, activeNav]);

  const handleStartAnalysis = (sample: SampleLesion) => {
    setActiveSample(sample);
    setActivePatientId(targetPatientId.trim());
    setScanId(null);
    setReportPersistenceMessage('');
    setUploadOpen(false);
    setScanning(true);
  };

  const handleScanComplete = async () => {
    setScanning(false);
    setViewingResults(true);

    if (!activePatientId || !activeSample.imageData) {
      setScanId(null);
      setReportPersistenceMessage(
        'This result was not archived because a patient and an original uploaded image are required for longitudinal tracking.',
      );
      return;
    }

    setReportPersistenceMessage('Saving this scan to the selected patient history…');
    try {
      const saved = await doctorApi.savePatientAIReport(activePatientId, {
        prediction: activeSample.primaryPrediction,
        confidence: activeSample.confidence,
        risk_score: activeSample.riskScore,
        risk_level: activeSample.riskTier,
        recommendation: activeSample.action,
        image_data: activeSample.imageData,
        heatmap_data: activeSample.heatmapUrl.startsWith('data:')
          ? activeSample.heatmapUrl
          : undefined,
        probabilities: Object.fromEntries(
          activeSample.probabilities.map((probability) => [probability.label, probability.probability / 100]),
        ),
        clinical_metadata: { ...patientMeta },
      });
      setScanId(saved.report_id);
      setReportPersistenceMessage('Scan saved to the selected patient history.');

      const savedScan = mapUploadToHistoricalScan(activeSample, saved.report_id, saved.created_at);
      setHistoryScans((current) => {
        const existing = historyPatientId === activePatientId ? current : [];
        return [...existing.filter((scan) => scan.id !== savedScan.id), savedScan]
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
      });
      setHistoryPatientId(activePatientId);
      setHistoryLoaded(true);

      try {
        const response = await doctorApi.listPatientAIReports(activePatientId);
        const scans = response.reports
          .map(mapReportToHistoricalScan)
          .filter((scan): scan is HistoricalScan => scan !== null);
        setHistoryScans(scans);
      } catch {
        setHistoryError('The scan was saved, but the complete history could not be refreshed.');
      }
    } catch (error) {
      setScanId(null);
      setReportPersistenceMessage(
        `The analysis completed, but this scan was not saved to patient history: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  };

  return (
    <DashboardLayout
      title="Doctor Clinical Workspace"
      roleBadgeText={`Dermatologist (${verificationStatus.toUpperCase()})`}
      roleBadgeColor={verificationStatus === 'approved' ? 'emerald' : 'amber'}
      navItems={DOCTOR_NAV_ITEMS}
      activeNav={activeNav}
      onSelectNav={(id) => {
        setActiveNav(id);
        setViewingResults(false);
        if (id !== 'appointments') {
          setActiveConsultation(null);
        }
      }}
    >
      {/* 1. VERIFICATION STATUS BANNER (if not approved) */}
      {verificationStatus !== 'approved' && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-amber-300">
                {verificationStatus === 'pending'
                  ? 'Doctor Credentials Under Administrative Review'
                  : `Doctor Account Status: ${verificationStatus.toUpperCase()}`}
              </h2>
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Your medical registration number (<b>{docProfile?.medical_registration_number || 'N/A'}</b>) is being reviewed by a platform administrator. In accordance with healthcare regulations, clinical patient diagnostics will be unlocked once your credentials are confirmed.
              </p>
              {docProfile?.rejection_reason && (
                <div className="mt-2 rounded-lg bg-slate-900/60 p-2.5 text-xs text-rose-300 border border-rose-500/30">
                  <b>Rejection Reason:</b> {docProfile.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: OVERVIEW */}
      {activeNav === 'overview' && (
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-emerald-950/20 p-6 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  Dermatology Clinic Portal
                </span>
                <h2 className="text-2xl font-bold text-white mt-2">
                  Welcome, Dr. {user?.full_name?.replace(/^(?:Dr\.\s*)+/i, '')}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {docProfile?.qualification} • {docProfile?.specialization} • {docProfile?.clinic_name}
                </p>
              </div>

              {verificationStatus === 'approved' ? (
                <button
                  onClick={() => setActiveNav('ai-analysis')}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_18px_-2px_rgba(16,185,129,0.5)] hover:bg-emerald-400 transition-all"
                >
                  <BrainCircuit className="h-4 w-4" />
                  <span>Launch AI Diagnostic Centre</span>
                </button>
              ) : (
                <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
                  Verification Pending
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => setActiveNav('patients')}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-emerald-500/40 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 group-hover:text-emerald-400 transition-colors">Total Patients</span>
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{summaryData?.total_patients ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {summaryData?.total_patients ? `${summaryData.total_patients} registered • Click to manage` : 'Direct patient consultations'}
              </p>
            </div>

            <div
              onClick={() => setActiveNav('appointments')}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-teal-500/40 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 group-hover:text-teal-400 transition-colors">Today's Appointments</span>
                <Calendar className="h-4 w-4 text-teal-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{summaryData?.today_appointments ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {summaryData?.pending_appointments
                  ? `${summaryData.pending_appointments} pending request(s) awaiting approval`
                  : (summaryData?.today_appointments ? `${summaryData.today_appointments} scheduled today` : 'No appointments scheduled today')}
              </p>
            </div>

            <div
              onClick={() => {
                const el = document.getElementById('recent-scans-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 hover:border-indigo-500/40 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">AI Analyses Performed</span>
                <BrainCircuit className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-white mt-2">{summaryData?.total_ai_scans ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {summaryData?.today_ai_scans
                  ? `${summaryData.today_ai_scans} scan(s) today • Click to view history`
                  : (summaryData?.total_ai_scans ? `${summaryData.total_ai_scans} total recorded • Click to view` : '7-class lesion inferences')}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Credential Status</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-emerald-400 mt-2 uppercase">{verificationStatus}</p>
              <p className="text-[11px] text-slate-500 mt-1">Reg: {docProfile?.medical_registration_number || 'Pending'}</p>
            </div>
          </div>

          {/* Clinical Profile Summary */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-emerald-400" /> Medical Registration & Practice Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-500">Medical Registration No.</span>
                <p className="font-semibold text-slate-200 mt-0.5">{docProfile?.medical_registration_number || 'N/A'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-500">Qualifications & Experience</span>
                <p className="font-semibold text-slate-200 mt-0.5">{docProfile?.qualification} ({docProfile?.experience_years} years)</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-500">Practice Location</span>
                <p className="font-semibold text-slate-200 mt-0.5">{docProfile?.clinic_name}</p>
                <p className="text-[11px] text-slate-400">{docProfile?.clinic_address}</p>
              </div>
            </div>
          </div>

          {/* Recent AI Diagnostic Scans & History */}
          <div id="recent-scans-section" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-white">Recent AI Diagnostic Scans</h3>
                  <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/20">
                    {summaryData?.recent_ai_analyses?.length || 0} recorded
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Chronological history of 7-class lesion inferences, Grad-CAM analyses, and downloadable clinical PDF reports.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('ai-analysis')}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition shadow-[0_0_12px_-2px_rgba(99,102,241,0.5)] shrink-0 self-start sm:self-auto"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>New AI Scan</span>
              </button>
            </div>

            {(!summaryData?.recent_ai_analyses || summaryData.recent_ai_analyses.length === 0) ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                <BrainCircuit className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                No scans recorded yet. Select an appointment or upload a lesion to run a scan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-medium">Scan Image</th>
                      <th className="pb-3 font-medium">Patient</th>
                      <th className="pb-3 font-medium">AI Classification</th>
                      <th className="pb-3 font-medium">Confidence</th>
                      <th className="pb-3 font-medium">Risk Level</th>
                      <th className="pb-3 font-medium">Date & Time</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {summaryData.recent_ai_analyses.map((scan: any) => {
                      const riskTier = (scan.risk_level || 'moderate').toLowerCase();
                      const tierClass =
                        riskTier === 'critical' || riskTier === 'urgent'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : riskTier === 'high'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                          : riskTier === 'moderate'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                      return (
                        <tr key={scan.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3">
                            {scan.image_data ? (
                              <img
                                src={scan.image_data}
                                alt="Lesion"
                                className="h-10 w-10 rounded-lg object-cover border border-slate-700"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                                <BrainCircuit className="h-4 w-4 text-slate-500" />
                              </div>
                            )}
                          </td>
                          <td className="py-3 font-medium text-white">
                            <div>{scan.patient_name || 'Patient'}</div>
                            <div className="text-[10px] font-mono text-slate-500">{scan.patient_unique_id || scan.patient_id}</div>
                          </td>
                          <td className="py-3 font-semibold text-slate-200">
                            {scan.prediction}
                          </td>
                          <td className="py-3 font-mono">
                            {Math.round((scan.confidence || 0) * 100)}%
                          </td>
                          <td className="py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase ${tierClass}`}>
                              {scan.risk_level || 'Moderate'}
                            </span>
                          </td>
                          <td className="py-3 text-[11px] text-slate-400">
                            {scan.created_at ? new Date(scan.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedReportForPrint(scan)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-teal-300 hover:bg-teal-500/20 transition-colors shadow-sm"
                              title="Generate PDF / Print Diagnostic Report"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              <span>PDF Report</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: AI ANALYSIS CENTRE */}
      {activeNav === 'ai-analysis' && (
        <div className="space-y-6">
          {verificationStatus !== 'approved' ? (
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-8 text-center space-y-4">
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Diagnostic AI Locked</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                AI diagnostic inference and Grad-CAM explainability are protected clinical operations. They will activate immediately once an administrator approves your medical license.
              </p>
            </div>
          ) : viewingResults ? (
            <ResultsPage
              sample={activeSample}
              scanId={scanId}
              historicalScans={historyPatientId === activePatientId ? historyScans : []}
              persistenceMessage={reportPersistenceMessage}
              patientMeta={patientMeta}
              onUpdatePatientMeta={setPatientMeta}
              onScanAnother={() => {
                setViewingResults(false);
                setReportPersistenceMessage('');
                setUploadOpen(true);
              }}
              onBackHome={() => setViewingResults(false)}
            />
          ) : (
            <DoctorAiAnalysisCenter
              onUpload={() => setUploadOpen(true)}
              patientId={targetPatientId}
              onPatientIdChange={handlePatientIdChange}
              onLoadHistory={loadPatientHistory}
              historyPatientId={historyPatientId}
              historyScans={historyScans}
              historyLoaded={historyLoaded}
              historyLoading={historyLoading}
              historyError={historyError}
              patients={doctorPatients}
            />
          )}
        </div>
      )}

      {/* VIEW: APPOINTMENTS */}
      {activeNav === 'appointments' && (
        <div className="space-y-6">
          {verificationStatus !== 'approved' ? (
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-8 text-center space-y-4">
              <Clock className="h-10 w-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Clinical Appointments Locked</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Patient appointment coordination is restricted to verified medical practitioners. Your appointments module will unlock once administrative verification is complete.
              </p>
            </div>
          ) : activeConsultation ? (
            <ConsultationWorkspace
              appointment={activeConsultation}
              onBack={() => setActiveConsultation(null)}
              onScanImageWithAI={(sample) => {
                if (activeConsultation.patient_id) {
                  setTargetPatientId(activeConsultation.patient_id);
                  setActivePatientId(activeConsultation.patient_id);
                }
                setActiveConsultation(null);
                setActiveNav('ai-analysis');
                handleStartAnalysis(sample);
              }}
            />
          ) : (
            <DoctorAppointmentList
              onOpenConsultation={(appt) => {
                setActiveConsultation(appt);
                if (appt.patient_id) setTargetPatientId(appt.patient_id);
              }}
            />
          )}
        </div>
      )}

      {/* VIEW: AVAILABILITY */}
      {activeNav === 'availability' && (
        <div className="space-y-6">
          {verificationStatus !== 'approved' ? (
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/60 p-8 text-center space-y-4">
              <Clock className="h-10 w-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Availability Management Locked</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                You can configure public booking slots after your medical license has been approved by the administration.
              </p>
            </div>
          ) : (
            <DoctorAvailabilityManager />
          )}
        </div>
      )}

      {/* VIEW: MY PATIENTS */}
      {activeNav === 'patients' && (
        <DoctorPatientsView
          onSelectPatientForHistory={handleSelectPatientForHistory}
          onSelectPatientForAI={handleSelectPatientForAI}
        />
      )}

      {/* VIEW: MEDICAL RECORDS (PATIENT HISTORY) */}
      {activeNav === 'medical-records' && (() => {
        const activePatient = doctorPatients.find(
          (p) => p.patient_id === targetPatientId || p.patient_unique_id === targetPatientId
        );

        return (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Patient Medical Record Access</h3>
                  {activePatient && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {activePatient.full_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a patient from your registered directory or enter any authorized Patient ID.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {doctorPatients.length > 0 && (
                  <select
                    value={activePatient ? activePatient.patient_id : ''}
                    onChange={(e) => setTargetPatientId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 max-w-xs"
                  >
                    <option value="">-- Choose Patient ({doctorPatients.length}) --</option>
                    {doctorPatients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.full_name} ({p.patient_unique_id})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  placeholder="ID (PRK-... or pat_...)"
                  value={targetPatientId}
                  onChange={(e) => setTargetPatientId(e.target.value.trim())}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 w-36 sm:w-44"
                />
              </div>
            </div>

            {/* Quick Action Ribbon if Patient Selected */}
            {activePatient && (
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 to-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300 font-bold text-xs border border-emerald-500/20">
                    {activePatient.full_name?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <span className="font-semibold text-white">{activePatient.full_name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[11px] text-emerald-300 font-bold">
                        {activePatient.patient_unique_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(activePatient.patient_unique_id)}
                        className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded transition-all flex items-center gap-1"
                        title="Copy Patient Health ID for AI Analysis"
                      >
                        {copiedPatientId === activePatient.patient_unique_id ? (
                          <span className="text-emerald-400 font-semibold">Copied ✓</span>
                        ) : (
                          <span>Copy ID</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPatientForAI(activePatient.patient_id)}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold shadow-[0_0_10px_-2px_rgba(99,102,241,0.5)] transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Run AI Scan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav('patients')}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 text-xs transition-all"
                  >
                    <Users className="h-3 w-3" />
                    <span>All Patients</span>
                  </button>
                </div>
              </div>
            )}

            {targetPatientId ? (
              <MedicalRecordsView patientId={targetPatientId} isDoctorView={true} />
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-400 space-y-3">
                <Users className="h-8 w-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-300">No Patient Selected</p>
                <p className="text-slate-500 max-w-md mx-auto">
                  Select a patient from the dropdown above, or browse your patient directory to view their complete medical records.
                </p>
                {doctorPatients.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('patients')}
                    className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-teal-400 transition-all"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Open My Patients Directory ({doctorPatients.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* VIEW: DIGITAL PRESCRIPTIONS */}
      {activeNav === 'prescriptions' && (
        <div className="space-y-6">
          <DigitalPrescriptionsView isDoctorView={true} patientId={targetPatientId || undefined} />
        </div>
      )}

      {/* VIEW: MEDICAL DOCUMENTS */}
      {activeNav === 'documents' && (
        <div className="space-y-6">
          <MedicalDocumentsView isDoctorView={true} patientId={targetPatientId || undefined} />
        </div>
      )}

      {/* VIEW: CLINICAL TIMELINE */}
      {activeNav === 'timeline' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white">Patient Clinical Timeline</h3>
              <p className="text-xs text-slate-400">Inspect the longitudinal medical timeline for any authorized patient.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Enter Patient ID (e.g. pat_...)"
                value={targetPatientId}
                onChange={(e) => setTargetPatientId(e.target.value.trim())}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500 w-full sm:w-64"
              />
            </div>
          </div>

          {targetPatientId ? (
            <ClinicalTimelineView patientId={targetPatientId} />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-500 text-xs">
              Please enter an authorized Patient ID above to render their clinical timeline.
            </div>
          )}
        </div>
      )}

      {/* VIEW: SETTINGS */}
      {activeNav === 'settings' && (
        <AccountSettings />
      )}

      {/* AI Upload & Scanning Modals */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onAnalyze={handleStartAnalysis}
      />

      <ScanningOverlay
        open={scanning}
        sample={activeSample}
        onComplete={handleScanComplete}
      />

      {/* PDF / Diagnostic Report Printable Modal */}
      {selectedReportForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl text-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400">Official Clinical Report</span>
                <h3 className="text-base font-bold text-white mt-0.5">PARAKH AI Diagnostic Lesion Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReportForPrint(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Meta details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div>
                <span className="text-[10px] text-slate-500 block">Patient Name</span>
                <span className="font-semibold text-white">{selectedReportForPrint.patient_name || 'Patient'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Patient ID</span>
                <span className="font-mono text-slate-300">{selectedReportForPrint.patient_unique_id || selectedReportForPrint.patient_id}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Attending Doctor</span>
                <span className="font-semibold text-white">{user?.full_name ? `Dr. ${user.full_name}` : 'Attending Dermatologist'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Date of Scan</span>
                <span className="text-slate-300">{selectedReportForPrint.created_at ? new Date(selectedReportForPrint.created_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            {/* Images: Raw Lesion & Grad-CAM */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">Dermoscopic Source Lesion</span>
                {selectedReportForPrint.image_data ? (
                  <img
                    src={selectedReportForPrint.image_data}
                    alt="Source Lesion"
                    className="h-44 w-full rounded-xl object-cover border border-slate-800"
                  />
                ) : (
                  <div className="h-44 w-full rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    No image recorded
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Grad-CAM Explainability Layer
                </span>
                {selectedReportForPrint.heatmap_data ? (
                  <img
                    src={selectedReportForPrint.heatmap_data}
                    alt="Heatmap"
                    className="h-44 w-full rounded-xl object-cover border border-teal-500/30"
                  />
                ) : (
                  <div className="h-44 w-full rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    Standard AI inference (No heatmap stored)
                  </div>
                )}
              </div>
            </div>

            {/* Diagnosis & Findings */}
            <div className="rounded-xl bg-slate-950/70 p-4 border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Primary Model Prediction</span>
                  <p className="text-base font-bold text-white mt-0.5">{selectedReportForPrint.prediction}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase">Model Confidence</span>
                  <p className="text-base font-bold text-teal-300 font-mono">
                    {Math.round((selectedReportForPrint.confidence || 0) * 100)}%
                  </p>
                </div>
              </div>
              {selectedReportForPrint.recommendation && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Clinical Recommendation</span>
                  <p className="text-slate-300 leading-relaxed text-[11px]">{selectedReportForPrint.recommendation}</p>
                </div>
              )}
            </div>

            {/* Print / Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-mono">
                Report Reference: #{selectedReportForPrint.id}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReportForPrint(null)}
                  className="px-3.5 py-2 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 transition text-slate-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition shadow-[0_0_15px_-2px_rgba(20,184,166,0.5)]"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
