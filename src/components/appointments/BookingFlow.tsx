import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Calendar, Clock, Stethoscope, MapPin, Award,
  CheckCircle, Loader2, AlertCircle, User, MessageSquare,
  ChevronLeft, ChevronRight, BrainCircuit
} from 'lucide-react';
import { appointmentApi, patientApi } from '@/lib/api';

interface Doctor {
  doctor_id: string;
  full_name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  clinic_name: string;
  clinic_address: string;
  professional_bio?: string;
}

interface Slot {
  slot_start: string;
  slot_end: string;
  available: boolean;
}

type Step = 'profile' | 'date' | 'slot' | 'details' | 'review' | 'success';

const CONSULTATION_TYPES = ['In-Person', 'Video Consultation', 'Follow-Up'];

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  doctor: Doctor;
  onBack: () => void;
}

export function BookingFlow({ doctor, onBack }: Props) {
  const [step, setStep] = useState<Step>('profile');
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [consultationType, setConsultationType] = useState('In-Person');
  const [reason, setReason] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [appointmentId, setAppointmentId] = useState('');

  // Attached AI report
  const [myReports, setMyReports] = useState<any[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');

  useEffect(() => {
    patientApi.listMyAIReports().then((res) => {
      setMyReports(res.reports || []);
    }).catch(() => {});
  }, []);

  // Build week dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = addDays(today, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSlotsError('');
    setSelectedSlot(null);
    appointmentApi.getSlots(doctor.doctor_id, selectedDate)
      .then((res) => setSlots(res.slots || []))
      .catch((e) => setSlotsError(e.message || 'Failed to load slots.'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, doctor.doctor_id]);

  const availableSlots = slots.filter((s) => s.available);

  const handleConfirmBook = async () => {
    setBooking(true);
    setBookingError('');
    try {
      const combinedReason = [
        reason && `Reason: ${reason}`,
        symptoms && `Symptoms: ${symptoms}`,
        `Type: ${consultationType}`,
      ].filter(Boolean).join(' | ');

      const res = await appointmentApi.book({
        doctor_id: doctor.doctor_id,
        appointment_date: selectedDate,
        slot_start: selectedSlot!.slot_start,
        reason_for_visit: combinedReason,
        attached_report_id: selectedReportId || undefined,
      });
      setAppointmentId(res.appointment_id);
      setStep('success');
    } catch (e: any) {
      setBookingError(e.message || 'Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  // ─── SUCCESS ───────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-teal-500/30 bg-teal-500/5 p-10 text-center space-y-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="mx-auto h-16 w-16 rounded-full bg-teal-500/20 flex items-center justify-center"
        >
          <CheckCircle className="h-8 w-8 text-teal-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-white">Appointment Requested!</h2>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">
          Your appointment with <strong className="text-white">{doctor.full_name}</strong> on{' '}
          <strong className="text-white">{selectedDate}</strong> at{' '}
          <strong className="text-white">{selectedSlot?.slot_start}</strong> has been submitted for confirmation.
        </p>
        <div className="inline-block rounded-lg bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-mono text-teal-300">
          Appointment ID: {appointmentId}
        </div>
        <p className="text-xs text-slate-500">
          Status: <span className="text-amber-400 font-semibold">Pending</span> — the doctor will confirm shortly.
        </p>
        <button
          onClick={onBack}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-all"
        >
          Back to Appointments
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to doctors
      </button>

      {/* Doctor header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xl shrink-0">
          {doctor.full_name.charAt(0)}
        </div>
        <div>
          <h2 className="text-base font-bold text-white">{doctor.full_name}</h2>
          <span className="text-xs text-teal-300">{doctor.specialization}</span>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><Award className="h-3 w-3" />{doctor.qualification}</span>
            <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" />{doctor.experience_years} yrs</span>
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{doctor.clinic_name}</span>
          </div>
          {doctor.professional_bio && (
            <p className="text-[11px] text-slate-500 mt-2 max-w-lg">{doctor.professional_bio}</p>
          )}
        </div>
      </div>

      {/* Step progress */}
      {step !== 'profile' && (
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          {['date', 'slot', 'details', 'review'].map((s, i) => (
            <React.Fragment key={s}>
              <span className={['date', 'slot', 'details', 'review'].indexOf(step) >= i ? 'text-teal-400 font-semibold' : ''}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
              {i < 3 && <ChevronRight className="h-3 w-3" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* ── STEP: profile → show bio + CTA ── */}
      {step === 'profile' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">About the Doctor</h3>
            <p className="text-xs text-slate-400">{doctor.professional_bio || 'No biography provided.'}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                <span className="text-slate-500">Clinic</span>
                <p className="font-semibold text-slate-200 mt-0.5">{doctor.clinic_name}</p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                <span className="text-slate-500">Address</span>
                <p className="font-semibold text-slate-200 mt-0.5">{doctor.clinic_address}</p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                <span className="text-slate-500">Experience</span>
                <p className="font-semibold text-slate-200 mt-0.5">{doctor.experience_years} years</p>
              </div>
              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3">
                <span className="text-slate-500">Qualification</span>
                <p className="font-semibold text-slate-200 mt-0.5">{doctor.qualification}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setStep('date')}
            className="w-full rounded-lg bg-teal-500 py-3 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-all flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4" /> Book an Appointment
          </button>
        </div>
      )}

      {/* ── STEP: date ── */}
      {step === 'date' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Select a Date</h3>
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-slate-400">
              {formatDateLabel(weekStart)} – {formatDateLabel(weekDates[6])}
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((d) => {
              const str = formatDate(d);
              const isPast = d < today;
              const isSelected = str === selectedDate;
              return (
                <button
                  key={str}
                  disabled={isPast}
                  onClick={() => { setSelectedDate(str); setStep('slot'); }}
                  className={`flex flex-col items-center py-2.5 rounded-lg border text-xs transition-all ${
                    isPast
                      ? 'opacity-30 cursor-not-allowed border-slate-800 bg-slate-900/30'
                      : isSelected
                      ? 'border-teal-500 bg-teal-500/20 text-teal-300 font-semibold'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-teal-500/40 hover:text-white'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wide">
                    {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </span>
                  <span className="text-base font-bold mt-0.5">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── STEP: slot ── */}
      {step === 'slot' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Available Slots — <span className="text-teal-400">{selectedDate}</span>
            </h3>
            <button onClick={() => setStep('date')} className="text-xs text-slate-400 hover:text-white">Change date</button>
          </div>

          {slotsLoading && (
            <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading slots…
            </div>
          )}
          {!slotsLoading && slotsError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle className="h-4 w-4 shrink-0" /> {slotsError}
            </div>
          )}
          {!slotsLoading && !slotsError && availableSlots.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
              <Clock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No slots available on this date. Try another day.</p>
              <button onClick={() => setStep('date')} className="mt-3 text-xs text-teal-400 hover:text-teal-300">← Pick another date</button>
            </div>
          )}
          {!slotsLoading && !slotsError && availableSlots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableSlots.map((slot) => (
                <button
                  key={slot.slot_start}
                  onClick={() => { setSelectedSlot(slot); setStep('details'); }}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-teal-500/50 hover:text-teal-300 hover:bg-teal-500/5 transition-all"
                >
                  {slot.slot_start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── STEP: details ── */}
      {step === 'details' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Appointment Details</h3>
            <span className="text-xs text-teal-400">{selectedDate} · {selectedSlot?.slot_start}</span>
          </div>

          {/* Consultation type */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Consultation Type</label>
            <div className="flex flex-wrap gap-2">
              {CONSULTATION_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setConsultationType(t)}
                  className={`text-xs rounded-full px-3 py-1.5 border transition-all font-medium ${
                    consultationType === t
                      ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">
              <span className="flex items-center gap-1"><User className="h-3 w-3" /> Reason for Visit</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Skin rash evaluation"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Symptoms */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Symptoms (optional)</span>
            </label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={3}
              placeholder="Describe your symptoms…"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Attach AI Screening Report */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-teal-300 font-semibold">
                <BrainCircuit className="h-3.5 w-3.5 text-teal-400" />
                Attach Existing AI Screening Report (Optional)
              </span>
              <span className="text-[10px] text-slate-500">{myReports.length} report(s) available</span>
            </label>

            {myReports.length === 0 ? (
              <p className="text-[11px] text-slate-500 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                No saved AI scans on record. You can still proceed with your booking.
              </p>
            ) : (
              <select
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="">Do not attach any report</option>
                {myReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.prediction} ({Math.round(r.confidence * 100)}% conf • {r.risk_level} Risk) — {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            onClick={() => setStep('review')}
            disabled={!reason.trim()}
            className="w-full rounded-lg bg-teal-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Review Booking →
          </button>
        </div>
      )}

      {/* ── STEP: review ── */}
      {step === 'review' && (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-white">Review & Confirm</h3>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 divide-y divide-slate-800 text-sm">
            {[
              ['Doctor', doctor.full_name],
              ['Specialization', doctor.specialization],
              ['Clinic', doctor.clinic_name],
              ['Date', selectedDate],
              ['Time', `${selectedSlot?.slot_start} – ${selectedSlot?.slot_end}`],
              ['Consultation Type', consultationType],
              ['Reason for Visit', reason],
              ['Symptoms', symptoms || '—'],
              [
                'Attached AI Report',
                selectedReportId
                  ? (myReports.find((r) => r.id === selectedReportId)?.prediction || 'Attached')
                  : 'None',
              ],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between px-4 py-3 gap-4">
                <span className="text-slate-500 text-xs shrink-0">{label}</span>
                <span className="text-slate-200 text-xs text-right">{val}</span>
              </div>
            ))}
          </div>

          {bookingError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle className="h-4 w-4 shrink-0" /> {bookingError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('details')}
              disabled={booking}
              className="flex-1 rounded-lg border border-slate-800 py-2.5 text-sm text-slate-400 hover:text-white hover:border-slate-700 transition-all"
            >
              ← Edit
            </button>
            <button
              onClick={handleConfirmBook}
              disabled={booking}
              className="flex-1 rounded-lg bg-teal-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-teal-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {booking ? <><Loader2 className="h-4 w-4 animate-spin" /> Booking…</> : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
