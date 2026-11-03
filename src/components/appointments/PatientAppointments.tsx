import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Stethoscope, CheckCircle, XCircle, AlertCircle,
  Loader2, RefreshCw, ChevronRight, X, MapPin, FileText, BrainCircuit
} from 'lucide-react';
import { appointmentApi } from '@/lib/api';

interface Appointment {
  id: string;
  appointment_date: string;
  slot_start: string;
  slot_end: string;
  status: string;
  reason_for_visit?: string;
  notes?: string;
  rejection_reason?: string;
  cancellation_reason?: string;
  created_at: string;
  doctor_name: string;
  specialization: string;
  clinic_name: string;
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    confirmed: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
    rescheduled: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    no_show: 'bg-slate-700 text-slate-400 border-slate-600',
  };
  return map[status] || 'bg-slate-800 text-slate-400 border-slate-700';
}

interface Props {
  onBookNew: () => void;
}

export function PatientAppointments({ onBookNew }: Props) {
  const [tab, setTab] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [attachedReports, setAttachedReports] = useState<any[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appointmentApi.listMyAppointments(tab || undefined);
      setAppointments(res.appointments || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSelectAppointment = (appt: Appointment) => {
    if (selected?.id === appt.id) {
      setSelected(null);
      setAttachedReports([]);
    } else {
      setSelected(appt);
      appointmentApi.getAttachedReports(appt.id)
        .then((res) => setAttachedReports(res.reports || []))
        .catch(() => setAttachedReports([]));
    }
  };

  const handleCancel = async () => {
    if (!selected) return;
    setCancelling(true);
    setCancelError('');
    try {
      await appointmentApi.cancelAppointment(selected.id, cancelReason || undefined);
      setShowCancelDialog(false);
      setCancelReason('');
      setSelected(null);
      await fetch();
    } catch (e: any) {
      setCancelError(e.message || 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  // Refresh selected from latest data
  const selectedFresh = selected
    ? appointments.find((a) => a.id === selected.id) ?? selected
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">My Appointments</h2>
          <p className="text-xs text-slate-400 mt-0.5">All your consultation bookings</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetch}
            className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={onBookNew}
            className="flex items-center gap-1.5 rounded-lg bg-teal-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-all"
          >
            <Calendar className="h-3.5 w-3.5" /> Book Appointment
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelected(null); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${
              tab === t.key
                ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading appointments…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && appointments.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400">No appointments found.</p>
          <button
            onClick={onBookNew}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-all"
          >
            Book your first appointment
          </button>
        </div>
      )}

      {/* Appointment list */}
      {!loading && !error && appointments.length > 0 && (
        <div className="space-y-2">
          {appointments.map((appt, i) => (
            <motion.div
              key={appt.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-xl border p-4 cursor-pointer transition-all hover:bg-slate-900/80 ${
                selected?.id === appt.id
                  ? 'border-teal-500/40 bg-slate-900/80'
                  : 'border-slate-800 bg-slate-900/40'
              }`}
              onClick={() => handleSelectAppointment(appt)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {appt.doctor_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{appt.doctor_name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{appt.specialization} · {appt.clinic_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge(appt.status)}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${selected?.id === appt.id ? 'rotate-90' : ''}`} />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{appt.appointment_date}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{appt.slot_start} – {appt.slot_end}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{appt.clinic_name}</span>
              </div>

              {/* Expanded detail */}
              <AnimatePresence>
                {selected?.id === appt.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                      {attachedReports.length > 0 && (
                        <div className="rounded-lg bg-teal-500/10 border border-teal-500/25 p-3 space-y-2">
                          <span className="text-[11px] font-semibold text-teal-300 flex items-center gap-1.5">
                            <BrainCircuit className="h-3.5 w-3.5" /> Attached AI Lesion Screening Report
                          </span>
                          {attachedReports.map((r) => (
                            <div key={r.report_id} className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-white">{r.prediction}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-500/20 text-teal-300">
                                  {Math.round(r.confidence * 100)}% conf • {r.risk_level} Risk
                                </span>
                              </div>
                              {r.recommendation && (
                                <p className="text-[11px] text-slate-400">{r.recommendation}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {appt.reason_for_visit && (
                        <div>
                          <span className="text-[11px] text-slate-500">Reason for Visit</span>
                          <p className="text-xs text-slate-300 mt-0.5">{appt.reason_for_visit}</p>
                        </div>
                      )}
                      {appt.notes && (
                        <div>
                          <span className="text-[11px] text-slate-500">Doctor Notes</span>
                          <p className="text-xs text-slate-300 mt-0.5">{appt.notes}</p>
                        </div>
                      )}
                      {appt.rejection_reason && (
                        <div>
                          <span className="text-[11px] text-red-400">Rejection Reason</span>
                          <p className="text-xs text-red-300 mt-0.5">{appt.rejection_reason}</p>
                        </div>
                      )}
                      {appt.cancellation_reason && (
                        <div>
                          <span className="text-[11px] text-slate-500">Cancellation Reason</span>
                          <p className="text-xs text-slate-300 mt-0.5">{appt.cancellation_reason}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-600">ID: {appt.id}</span>
                        {['pending', 'confirmed'].includes(appt.status) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowCancelDialog(true); }}
                            className="ml-auto flex items-center gap-1 text-xs text-red-400 hover:text-red-300 border border-red-500/20 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Cancel Dialog */}
      <AnimatePresence>
        {showCancelDialog && selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowCancelDialog(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1117] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Cancel Appointment</h3>
                <button onClick={() => setShowCancelDialog(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Cancelling appointment with <strong className="text-white">{selected.doctor_name}</strong> on{' '}
                <strong className="text-white">{selected.appointment_date}</strong>.
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation (optional)…"
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              />
              {cancelError && (
                <p className="text-xs text-red-400">{cancelError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelDialog(false)}
                  className="flex-1 rounded-lg border border-slate-800 py-2 text-sm text-slate-400 hover:text-white transition-all"
                >
                  Keep Appointment
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-lg bg-red-500/80 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Cancel Appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
