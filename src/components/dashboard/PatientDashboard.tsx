import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, User, Calendar, FileText, Pill,
  Settings, ShieldCheck, ArrowRight, FolderOpen, Clock, Mail, Phone,
  Heart, AlertCircle, Activity, ClipboardList, Stethoscope, Sun, Droplet,
  Ruler, Weight, Users, CheckCircle2, CircleHelp
} from 'lucide-react';
import { DashboardLayout, type NavItem } from './DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { emrApi, patientApi } from '@/lib/api';
import { FindDoctorPage } from '@/components/appointments/FindDoctorPage';
import { BookingFlow } from '@/components/appointments/BookingFlow';
import { PatientAppointments } from '@/components/appointments/PatientAppointments';
import { MedicalRecordsView } from '@/components/emr/MedicalRecordsView';
import { DigitalPrescriptionsView } from '@/components/emr/DigitalPrescriptionsView';
import { MedicalDocumentsView } from '@/components/emr/MedicalDocumentsView';
import { ClinicalTimelineView } from '@/components/emr/ClinicalTimelineView';
import { AccountSettings } from './AccountSettings';

const PATIENT_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'profile', label: 'My Profile', icon: User },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'medical-records', label: 'Medical Records', icon: FileText },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'documents', label: 'Medical Documents', icon: FolderOpen },
  { id: 'timeline', label: 'Clinical Timeline', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

type ApptView = 'list' | 'find' | 'book';

function formatProfileDate(value?: string) {
  if (!value) return 'Not recorded';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function calculateAge(value?: string) {
  if (!value) return null;
  const birthDate = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) age -= 1;
  return age >= 0 ? age : null;
}

function ProfileSection({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ProfileField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ElementType;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-teal-500/80" />}
        <span>{label}</span>
      </div>
      <p className="mt-2 break-words text-sm font-semibold text-slate-200">{value || 'Not recorded'}</p>
    </div>
  );
}

export function PatientDashboard() {
  const { user } = useAuth();
  const [activeNav, setActiveNav] = useState('overview');
  const [profileData, setProfileData] = useState<any>(null);
  const [emrData, setEmrData] = useState<any>(null);
  const [skinReports, setSkinReports] = useState<any[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [overviewData, setOverviewData] = useState<any>(null);

  // Appointment sub-views
  const [apptView, setApptView] = useState<ApptView>('list');
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);

  const patientUniqueId = user?.patient_profile?.patient_unique_id || 'PRK-PATIENT';

  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileLoading(true);
    setProfileError('');

    Promise.allSettled([
      patientApi.getProfile(),
      user.patient_profile?.patient_id
        ? emrApi.getPatientEMR(user.patient_profile.patient_id)
        : Promise.resolve(null),
      patientApi.listMyAIReports(),
      patientApi.getDashboardSummary(),
    ]).then(([profileResult, emrResult, reportsResult, overviewResult]) => {
      if (!active) return;
      const failures: string[] = [];

      if (profileResult.status === 'fulfilled') {
        setProfileData(profileResult.value?.profile || null);
      } else {
        failures.push('Basic profile details could not be loaded.');
      }

      if (emrResult.status === 'fulfilled') {
        setEmrData(emrResult.value);
      } else {
        failures.push('Medical history could not be loaded.');
      }

      if (reportsResult.status === 'fulfilled') {
        setSkinReports(reportsResult.value?.reports || []);
      } else {
        failures.push('Skin screening history could not be loaded.');
      }

      if (overviewResult.status === 'fulfilled') {
        setOverviewData(overviewResult.value || null);
      }

      setProfileError(failures.join(' '));
    }).finally(() => {
      if (active) setProfileLoading(false);
    });

    return () => { active = false; };
  }, [user]);

  // When nav changes away from appointments, reset sub-view
  const handleSelectNav = (id: string) => {
    setActiveNav(id);
    if (id !== 'appointments') {
      setApptView('list');
      setSelectedDoctor(null);
    }
  };

  const handleSelectDoctor = (doc: any) => {
    setSelectedDoctor(doc);
    setApptView('book');
  };

  const handleBackFromBook = () => {
    setSelectedDoctor(null);
    setApptView('list');
  };

  return (
    <DashboardLayout
      title="Patient Health Portal"
      roleBadgeText="Patient Account"
      roleBadgeColor="teal"
      navItems={PATIENT_NAV_ITEMS}
      activeNav={activeNav}
      onSelectNav={handleSelectNav}
    >
      {/* ── OVERVIEW ── */}
      {activeNav === 'overview' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-teal-950/20 p-6 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
                  Personal Dermatology Portal
                </span>
                <h2 className="text-2xl font-bold text-white mt-2">Welcome, {user?.full_name}</h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  Patient Health ID: <span className="text-teal-300 font-semibold">{patientUniqueId}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-slate-900/80 border border-slate-800 px-3.5 py-2 text-xs text-slate-300">
                <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
                <span>Protected Health Privacy</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Upcoming Appointments</span>
              <p className="text-2xl font-bold text-white mt-2">
                {overviewData != null ? (overviewData.upcoming_appointments_count ?? 0) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                <button onClick={() => handleSelectNav('appointments')} className="text-teal-400 hover:underline">View appointments</button>
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Skin Lesion Scans</span>
              <p className="text-2xl font-bold text-white mt-2">
                {overviewData != null ? (overviewData.skin_scan_count ?? 0) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Images in longitudinal timeline</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Active Prescriptions</span>
              <p className="text-2xl font-bold text-white mt-2">
                {overviewData != null ? (overviewData.active_prescriptions_count ?? 0) : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                <button onClick={() => handleSelectNav('prescriptions')} className="text-teal-400 hover:underline">View prescriptions</button>
              </p>
            </div>
          </div>

          {/* Detail lists */}
          {overviewData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upcoming Appointments */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-teal-400" /> Upcoming Appointments
                  </span>
                  <button onClick={() => handleSelectNav('appointments')} className="text-[11px] text-teal-400 hover:underline">View All</button>
                </div>
                {(overviewData.upcoming_appointments?.length ?? 0) === 0 ? (
                  <p className="text-xs text-slate-500">No upcoming appointments</p>
                ) : (
                  overviewData.upcoming_appointments.map((a: any) => (
                    <div key={a.id} className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
                      <p className="text-xs font-semibold text-white">{a.doctor_name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{a.specialization} · {a.clinic_name}</p>
                      <p className="text-[11px] text-teal-300 mt-1">{a.appointment_date} · {a.slot_start}–{a.slot_end}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Recent Scans + Prescriptions */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-teal-400" /> Recent Scans
                    </span>
                  </div>
                  {(overviewData.recent_scans?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-500">No scans recorded</p>
                  ) : (
                    overviewData.recent_scans.map((s: any) => (
                      <div key={s.id} className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
                        <p className="text-xs font-semibold text-white">{s.prediction}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Risk: {s.risk_level} · {Math.round((s.confidence ?? 0) * 100)}%</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                      <Pill className="h-3.5 w-3.5 text-teal-400" /> Recent Prescriptions
                    </span>
                    <button onClick={() => handleSelectNav('prescriptions')} className="text-[11px] text-teal-400 hover:underline">View All</button>
                  </div>
                  {(overviewData.recent_prescriptions?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-500">No prescriptions yet</p>
                  ) : (
                    overviewData.recent_prescriptions.map((rx: any) => (
                      <div key={rx.id} className="rounded-lg bg-slate-950/50 border border-slate-800 p-3">
                        <p className="text-xs font-semibold text-white">{rx.prescription_number}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Dr. {rx.doctor_name}</p>
                        <p className="text-[11px] text-teal-300 mt-0.5 capitalize">{rx.status} · {new Date(rx.created_at).toLocaleDateString()}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Need a verified clinical evaluation?</h3>
              <p className="text-xs text-slate-400 max-w-lg">
                Connect with our network of board-certified dermatologists for clinical consultations, biopsy recommendations, and prescription treatment.
              </p>
            </div>
            <button
              onClick={() => { handleSelectNav('appointments'); setApptView('find'); }}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-all shrink-0"
            >
              <span>Schedule Consultation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── PROFILE ── */}
      {activeNav === 'profile' && (
        <div className="w-full space-y-6">
          {profileError && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{profileError} Some profile sections may be incomplete.</span>
            </div>
          )}

          <section className="relative overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/50 p-6 shadow-xl sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-400/15 text-2xl font-bold text-teal-300 ring-1 ring-teal-300/30 sm:h-20 sm:w-20 sm:text-3xl">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-300">Patient health profile</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{user?.full_name || 'Patient'}</h2>
                  <p className="mt-2 font-mono text-xs text-slate-400">Patient ID · <span className="font-semibold text-slate-200">{patientUniqueId}</span></p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {profileData?.email_verified ? 'Email verified' : 'Patient account'}
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectNav('medical-records')}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-teal-300"
                >
                  <ClipboardList className="h-4 w-4" />
                  Manage health records
                </button>
              </div>
            </div>
            {profileLoading && (
              <p className="relative mt-5 flex items-center gap-2 text-xs text-slate-400">
                <Activity className="h-4 w-4 animate-pulse text-teal-400" />
                Loading your health information…
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: 'Age', value: calculateAge(profileData?.date_of_birth || user?.patient_profile?.date_of_birth), suffix: 'years', icon: User },
              { label: 'Skin screenings', value: skinReports?.length, suffix: 'saved', icon: Activity },
              { label: 'Recorded conditions', value: emrData?.conditions?.length, suffix: 'on file', icon: Heart },
              { label: 'Known allergies', value: emrData?.allergies?.length, suffix: 'on file', icon: AlertCircle },
            ].map(({ label, value, suffix, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">{label}</span>
                  <Icon className="h-4 w-4 text-teal-400" />
                </div>
                <p className="mt-3 text-2xl font-bold text-white">{value ?? '—'}</p>
                <p className="mt-1 text-[11px] text-slate-500">{value == null ? 'Not available' : suffix}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <ProfileSection title="Personal & contact details" subtitle="Information linked to your patient account" icon={User}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ProfileField label="Email address" value={profileData?.email || user?.email} icon={Mail} />
                  <ProfileField label="Phone number" value={profileData?.phone || user?.phone} icon={Phone} />
                  <ProfileField
                    label="Date of birth"
                    value={formatProfileDate(profileData?.date_of_birth || user?.patient_profile?.date_of_birth)}
                    icon={Calendar}
                  />
                  <ProfileField label="Gender" value={profileData?.gender || user?.patient_profile?.gender} icon={User} />
                </div>
              </ProfileSection>

              <ProfileSection
                title="Skin & medical context"
                subtitle="Clinical background and skin-health information on record"
                icon={Stethoscope}
                action={
                  <button type="button" onClick={() => handleSelectNav('medical-records')} className="text-xs font-semibold text-teal-400 hover:text-teal-300">
                    Update records
                  </button>
                }
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ProfileField label="Blood group" value={emrData ? emrData.patient?.blood_group : 'Unavailable'} icon={Droplet} />
                  <ProfileField label="Height" value={emrData ? (emrData.patient?.height_cm ? `${emrData.patient.height_cm} cm` : null) : 'Unavailable'} icon={Ruler} />
                  <ProfileField label="Weight" value={emrData ? (emrData.patient?.weight_kg ? `${emrData.patient.weight_kg} kg` : null) : 'Unavailable'} icon={Weight} />
                  <ProfileField label="Emergency contact" value={emrData ? emrData.patient?.emergency_contact_name : 'Unavailable'} icon={Phone} />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Sun className="h-3.5 w-3.5 text-teal-500/80" /> Lifestyle & sun exposure
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{emrData ? (emrData.patient?.lifestyle_notes || 'No lifestyle or sun-exposure notes recorded.') : 'Lifestyle information is unavailable.'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Users className="h-3.5 w-3.5 text-teal-500/80" /> Family medical history
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{emrData ? (emrData.patient?.family_medical_history || 'No family medical or dermatological history recorded.') : 'Family history is unavailable.'}</p>
                  </div>
                </div>
              </ProfileSection>

              <ProfileSection title="Skin screening history" subtitle="Saved AI screening reports for your clinician to review" icon={Activity}>
                {skinReports?.length ? (
                  <div className="space-y-3">
                    {skinReports.slice(0, 3).map((report) => (
                      <div key={report.id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-100">{report.prediction || 'Screening report'}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatProfileDate(report.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {report.risk_level && <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium capitalize text-amber-200">{report.risk_level} risk</span>}
                          {typeof report.confidence === 'number' && <span className="text-xs text-slate-400">{(report.confidence * 100).toFixed(1)}% confidence</span>}
                        </div>
                      </div>
                    ))}
                    <p className="flex items-start gap-2 pt-1 text-[11px] leading-5 text-slate-500">
                      <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      AI screening information is for clinical review and is not a diagnosis.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 p-4 text-sm text-slate-400">
                    {profileLoading ? 'Checking for saved screenings…' : skinReports === null ? 'Screening history could not be loaded.' : 'No saved skin screening reports yet.'}
                  </p>
                )}
              </ProfileSection>
            </div>

            <div className="space-y-5">
              <ProfileSection title="Allergies" subtitle="Important sensitivities visible to your care team" icon={AlertCircle}>
                {emrData?.allergies?.length ? (
                  <div className="space-y-3">
                    {emrData.allergies.slice(0, 4).map((allergy: any) => (
                      <div key={allergy.id} className="rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold text-slate-100">{allergy.allergen}</p>
                          {allergy.severity && <span className="shrink-0 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-medium capitalize text-rose-300">{allergy.severity}</span>}
                        </div>
                        {allergy.reaction && <p className="mt-1 text-xs text-slate-400">Reaction: {allergy.reaction}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{emrData ? 'No allergies recorded.' : 'Allergy information is not available.'}</p>
                )}
              </ProfileSection>

              <ProfileSection title="Medical conditions" subtitle="Conditions currently documented in your record" icon={Heart}>
                {emrData?.conditions?.length ? (
                  <div className="space-y-3">
                    {emrData.conditions.slice(0, 5).map((condition: any) => (
                      <div key={condition.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <div>
                          <p className="font-semibold text-slate-100">{condition.condition_name}</p>
                          {condition.notes && <p className="mt-1 text-xs leading-5 text-slate-400">{condition.notes}</p>}
                        </div>
                        {condition.status && <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] capitalize text-slate-300">{condition.status}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{emrData ? 'No medical conditions recorded.' : 'Condition information is not available.'}</p>
                )}
              </ProfileSection>

              <ProfileSection title="Current medications" subtitle="Medication records available to your care team" icon={Pill}>
                {emrData?.medications?.length ? (
                  <div className="space-y-3">
                    {emrData.medications.slice(0, 4).map((medication: any) => (
                      <div key={medication.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="font-semibold text-slate-100">{medication.medication_name}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {[medication.dosage, medication.frequency].filter(Boolean).join(' · ') || 'Dosage not recorded'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{emrData ? 'No medications recorded.' : 'Medication information is not available.'}</p>
                )}
              </ProfileSection>

              <ProfileSection title="Recent consultations" subtitle="Your latest documented clinician visits" icon={Stethoscope}>
                {emrData?.consultations?.length ? (
                  <div className="space-y-3">
                    {emrData.consultations.slice(0, 3).map((consultation: any) => (
                      <div key={consultation.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <p className="font-semibold text-slate-100">{consultation.chief_complaint || consultation.diagnosis || 'Clinical consultation'}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {consultation.doctor_name ? `Dr. ${consultation.doctor_name}` : 'Clinician'}
                          {consultation.appointment_date ? ` · ${formatProfileDate(consultation.appointment_date)}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{emrData ? 'No completed consultations recorded.' : 'Consultation information is not available.'}</p>
                )}
              </ProfileSection>
            </div>
          </div>
        </div>
      )}

      {/* ── APPOINTMENTS ── */}
      {activeNav === 'appointments' && (
        <>
          {/* Sub-nav tabs */}
          {apptView === 'list' && (
            <PatientAppointments onBookNew={() => setApptView('find')} />
          )}
          {apptView === 'find' && !selectedDoctor && (
            <div className="space-y-4">
              <button
                onClick={() => setApptView('list')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                ← Back to appointments
              </button>
              <FindDoctorPage onSelectDoctor={handleSelectDoctor} />
            </div>
          )}
          {apptView === 'book' && selectedDoctor && (
            <BookingFlow doctor={selectedDoctor} onBack={handleBackFromBook} />
          )}
        </>
      )}

      {/* ── EMR MODULES ── */}
      {activeNav === 'medical-records' && user?.patient_profile?.patient_id && (
        <MedicalRecordsView patientId={user.patient_profile.patient_id} />
      )}

      {activeNav === 'prescriptions' && user?.patient_profile?.patient_id && (
        <DigitalPrescriptionsView patientId={user.patient_profile.patient_id} />
      )}

      {activeNav === 'documents' && user?.patient_profile?.patient_id && (
        <MedicalDocumentsView patientId={user.patient_profile.patient_id} />
      )}

      {activeNav === 'timeline' && user?.patient_profile?.patient_id && (
        <ClinicalTimelineView patientId={user.patient_profile.patient_id} />
      )}

      {/* ── SETTINGS ── */}
      {activeNav === 'settings' && (
        <AccountSettings />
      )}
    </DashboardLayout>
  );
}
