import React, { useState, useEffect } from 'react';
import {
  Users, Search, Copy, Check, FileText, BrainCircuit, Calendar,
  Activity, ArrowRight, ShieldCheck, Mail, Phone, Heart, User, Sparkles
} from 'lucide-react';
import { doctorApi } from '@/lib/api';

interface PatientRecord {
  patient_id: string;
  patient_unique_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  blood_group: string | null;
  last_appointment_date: string | null;
  appointment_count: number;
  scan_count: number;
  prescription_count: number;
}

interface DoctorPatientsViewProps {
  onSelectPatientForHistory: (patientId: string) => void;
  onSelectPatientForAI: (patientId: string) => void;
}

function calculateAge(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function DoctorPatientsView({
  onSelectPatientForHistory,
  onSelectPatientForAI,
}: DoctorPatientsViewProps) {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    doctorApi.getPatients()
      .then((res) => {
        if (active) {
          setPatients(res.patients || []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load patients list.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const handleCopy = (idText: string, key: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(key);
    setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const filteredPatients = patients.filter((pat) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      pat.full_name?.toLowerCase().includes(q) ||
      pat.patient_unique_id?.toLowerCase().includes(q) ||
      pat.patient_id?.toLowerCase().includes(q) ||
      pat.email?.toLowerCase().includes(q) ||
      pat.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-emerald-950/20 p-6 backdrop-blur-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold text-white">My Patients Directory</h2>
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                {patients.length} Registered
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Access your clinical patients directly without navigating through appointments. Copy genuine Patient IDs with one click, or jump straight to Medical History and AI Diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name, ID (PRK-...) or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400 text-xs">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mb-2" />
          <p>Loading patient directory...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredPatients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-xs text-slate-400">
          <Users className="h-8 w-8 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-300">No patients found</p>
          <p className="text-slate-500 mt-1">
            {searchQuery
              ? `No patients match "${searchQuery}". Try searching by another keyword.`
              : 'You do not have any patient consultations or appointments yet.'}
          </p>
        </div>
      )}

      {/* Patients Grid */}
      {!loading && !error && filteredPatients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPatients.map((pat) => {
            const age = calculateAge(pat.date_of_birth);
            const isCopiedHealthId = copiedId === `health_${pat.patient_id}`;
            const isCopiedDbId = copiedId === `db_${pat.patient_id}`;

            return (
              <div
                key={pat.patient_id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-emerald-500/30 hover:bg-slate-900/80 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Avatar, Name, and Quick History Click */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      onClick={() => onSelectPatientForHistory(pat.patient_id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-400 font-bold text-base border border-emerald-500/20 group-hover:border-emerald-500/40 transition-colors">
                        {pat.full_name?.charAt(0)?.toUpperCase() || 'P'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {pat.full_name}
                          </h3>
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            Active Patient
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {pat.gender ? `${pat.gender.toUpperCase()}` : ''}
                          {age ? ` • ${age} yrs` : ''}
                          {pat.blood_group ? ` • Blood: ${pat.blood_group}` : ''}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectPatientForHistory(pat.patient_id)}
                      className="text-xs text-slate-400 hover:text-emerald-400 transition-colors p-1"
                      title="View Medical History"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* ID Boxes with 1-Click Copy */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
                    {/* Patient Health ID (PRK-...) */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                        Patient Health ID
                      </span>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="font-mono text-xs font-bold text-emerald-300 truncate">
                          {pat.patient_unique_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(pat.patient_unique_id, `health_${pat.patient_id}`)}
                          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                            isCopiedHealthId
                              ? 'bg-emerald-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                          title="Copy Health ID for AI Analysis"
                        >
                          {isCopiedHealthId ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Database System ID (pat_...) */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                        System Record ID
                      </span>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[110px]" title={pat.patient_id}>
                          {pat.patient_id}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(pat.patient_id, `db_${pat.patient_id}`)}
                          className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all ${
                            isCopiedDbId
                              ? 'bg-teal-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                          }`}
                          title="Copy System ID"
                        >
                          {isCopiedDbId ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Indicators */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2">
                      <p className="text-[10px] text-slate-500">Appointments</p>
                      <p className="font-bold text-white mt-0.5">{pat.appointment_count}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2">
                      <p className="text-[10px] text-slate-500">AI Scans</p>
                      <p className="font-bold text-indigo-300 mt-0.5">{pat.scan_count}</p>
                    </div>
                    <div className="rounded-lg bg-slate-950/40 border border-slate-800/60 p-2">
                      <p className="text-[10px] text-slate-500">Prescriptions</p>
                      <p className="font-bold text-teal-300 mt-0.5">{pat.prescription_count}</p>
                    </div>
                  </div>

                  {/* Contact / Last visit note */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
                    <span className="flex items-center gap-1 truncate max-w-[200px]" title={pat.email}>
                      <Mail className="h-3 w-3 text-slate-600 shrink-0" />
                      {pat.email}
                    </span>
                    <span>
                      Last Visit: <b className="text-slate-400">{pat.last_appointment_date || 'N/A'}</b>
                    </span>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => onSelectPatientForHistory(pat.patient_id)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 px-3 py-2 text-xs font-semibold transition-all"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Medical History</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSelectPatientForAI(pat.patient_id)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_12px_-2px_rgba(99,102,241,0.5)] px-3 py-2 text-xs font-semibold transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Analysis</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
