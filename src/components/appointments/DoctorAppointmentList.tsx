import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, ChevronRight, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Loader2, X, User, MessageSquare, Check, Ban,
  UserX, ChevronLeft, Stethoscope
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
  patient_name: string;
  patient_unique_id: string;
  patient_id?: string;
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'rejected', label: 'Rejected' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    confirmed: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    rescheduled: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    no_show: 'bg-slate-700 text-slate-400 border-slate-600',
  };
  return map[status] || 'bg-slate-800 text-slate-400 border-slate-700';
}

type ModalType = 'reject' | 'cancel' | null;

interface Props {
  onOpenConsultation: (appt: Appointment) => void;
}

export function DoctorAppointmentList({ onOpenConsultation }: Props) {
  const [tab, setTab] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [modal, setModal] = useState<ModalType>(null);
  const [modalReason, setModalReason] = useState('');

  // Calendar view
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [calOffset, setCalOffset] = useState(0); // weeks from today

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await appointmentApi.listDoctorAppointments(tab || undefined);
      setAppointments(res.appointments || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action: () => Promise<any>) => {
    setActionLoading('action'); setActionError('');
    try { await action(); setSelected(null); setModal(null); setModalReason(''); await load(); }
    catch (e: any) { setActionError(e.message); }
    finally { setActionLoading(''); }
  };

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  const weekStart = addDays(today, calOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function apptsByDate(dateStr: string) {
    return appointments.filter(a => a.appointment_date === dateStr);
  }

  const todayStr = today.toISOString().split('T')[0];
  const todayAppts = appointments.filter(a => a.appointment_date === todayStr);
  const pendingCount = appointments.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">Appointment Dashboard</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {todayAppts.length} today · {pendingCount} pending review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-800 overflow-hidden text-xs">
            {(['list', 'calendar'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 font-medium transition-colors capitalize ${view === v ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-white'}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${tab === t.key ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:text-white'}`}>
            {t.label}
            {t.key === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center py-14 text-slate-400 text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…</div>}
      {!loading && error && <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

      {/* ── CALENDAR VIEW ── */}
      {!loading && !error && view === 'calendar' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setCalOffset(o => o - 1)} disabled={calOffset === 0}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400">
              {weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
              {weekDates[6].toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={() => setCalOffset(o => o + 1)} className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map(d => {
              const str = d.toISOString().split('T')[0];
              const dayAppts = apptsByDate(str);
              const isToday = str === todayStr;
              return (
                <div key={str} className={`rounded-xl border min-h-[90px] p-2 ${isToday ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/30'}`}>
                  <div className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {d.toLocaleDateString('en-IN', { weekday: 'short' })}<br />
                    <span className={isToday ? 'text-emerald-300' : 'text-slate-400'}>{d.getDate()}</span>
                  </div>
                  {dayAppts.map(a => (
                    <div key={a.id} onClick={() => { setSelected(a); setView('list'); }}
                      className={`text-[9px] truncate rounded px-1 py-0.5 mb-0.5 cursor-pointer border ${statusBadge(a.status)}`}>
                      {a.slot_start} {a.patient_name.split(' ')[0]}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && !error && view === 'list' && appointments.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Calendar className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No appointments in this category.</p>
        </div>
      )}

      {!loading && !error && view === 'list' && appointments.length > 0 && (
        <div className="space-y-2">
          {appointments.map((appt, i) => (
            <motion.div key={appt.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`rounded-xl border p-4 cursor-pointer transition-all hover:bg-slate-900/80 ${selected?.id === appt.id ? 'border-emerald-500/40 bg-slate-900/80' : 'border-slate-800 bg-slate-900/40'}`}
              onClick={() => setSelected(selected?.id === appt.id ? null : appt)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    {appt.patient_name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{appt.patient_name}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{appt.patient_unique_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusBadge(appt.status)}`}>
                    {appt.status.replace('_', ' ')}
                  </span>
                  <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${selected?.id === appt.id ? 'rotate-90' : ''}`} />
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{appt.appointment_date}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{appt.slot_start} – {appt.slot_end}</span>
              </div>

              {/* Expanded */}
              <AnimatePresence>
                {selected?.id === appt.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                      {appt.reason_for_visit && (
                        <div>
                          <span className="text-[11px] text-slate-500">Patient's Reason / Symptoms</span>
                          <p className="text-xs text-slate-300 mt-0.5">{appt.reason_for_visit}</p>
                        </div>
                      )}
                      {appt.rejection_reason && <div><span className="text-[11px] text-rose-400">Rejection Reason</span><p className="text-xs text-rose-300 mt-0.5">{appt.rejection_reason}</p></div>}
                      {appt.cancellation_reason && <div><span className="text-[11px] text-slate-500">Cancellation Reason</span><p className="text-xs text-slate-300 mt-0.5">{appt.cancellation_reason}</p></div>}

                      {actionError && <p className="text-xs text-red-400">{actionError}</p>}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {appt.status === 'pending' && (
                          <>
                            <button onClick={e => { e.stopPropagation(); doAction(() => appointmentApi.confirmAppointment(appt.id)); }}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1 text-xs rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 hover:bg-emerald-500/30 disabled:opacity-50 transition-all">
                              <Check className="h-3.5 w-3.5" /> Confirm
                            </button>
                            <button onClick={e => { e.stopPropagation(); setModal('reject'); }}
                              className="flex items-center gap-1 text-xs rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1.5 hover:bg-rose-500/20 transition-all">
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {appt.status === 'confirmed' && (
                          <>
                            <button onClick={e => { e.stopPropagation(); doAction(() => appointmentApi.completeAppointment(appt.id)); }}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1 text-xs rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30 px-3 py-1.5 hover:bg-teal-500/30 disabled:opacity-50 transition-all">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                            </button>
                            <button onClick={e => { e.stopPropagation(); doAction(() => appointmentApi.markNoShow(appt.id)); }}
                              disabled={!!actionLoading}
                              className="flex items-center gap-1 text-xs rounded-lg bg-slate-800 text-slate-400 border border-slate-700 px-3 py-1.5 hover:text-white disabled:opacity-50 transition-all">
                              <UserX className="h-3.5 w-3.5" /> No Show
                            </button>
                          </>
                        )}
                        {['pending', 'confirmed'].includes(appt.status) && (
                          <button onClick={e => { e.stopPropagation(); setModal('cancel'); }}
                            className="flex items-center gap-1 text-xs rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 hover:bg-red-500/20 transition-all">
                            <Ban className="h-3.5 w-3.5" /> Cancel
                          </button>
                        )}
                        {appt.status === 'completed' && (
                          <button onClick={e => { e.stopPropagation(); onOpenConsultation(appt); }}
                            className="flex items-center gap-1 text-xs rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 hover:bg-indigo-500/30 transition-all">
                            <Stethoscope className="h-3.5 w-3.5" /> Consultation Record
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

      {/* Reject / Cancel Modal */}
      <AnimatePresence>
        {modal && selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
            onClick={e => { if (e.target === e.currentTarget) { setModal(null); setModalReason(''); } }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0d1117] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white capitalize">{modal} Appointment</h3>
                <button onClick={() => { setModal(null); setModalReason(''); }}><X className="h-4 w-4 text-slate-400 hover:text-white" /></button>
              </div>
              <p className="text-xs text-slate-400">Patient: <strong className="text-white">{selected.patient_name}</strong> · {selected.appointment_date} at {selected.slot_start}</p>
              <textarea value={modalReason} onChange={e => setModalReason(e.target.value)}
                placeholder={`Reason for ${modal} (recommended)…`} rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none" />
              {actionError && <p className="text-xs text-red-400">{actionError}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setModal(null); setModalReason(''); }}
                  className="flex-1 rounded-lg border border-slate-800 py-2 text-sm text-slate-400 hover:text-white transition-all">Keep</button>
                <button disabled={!!actionLoading}
                  onClick={() => doAction(() =>
                    modal === 'reject'
                      ? appointmentApi.rejectAppointment(selected.id, modalReason || undefined)
                      : appointmentApi.doctorCancelAppointment(selected.id, modalReason || undefined)
                  )}
                  className="flex-1 rounded-lg bg-red-500/80 py-2 text-sm font-semibold text-white hover:bg-red-500 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Confirm {modal}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
