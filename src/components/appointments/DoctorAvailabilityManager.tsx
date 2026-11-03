import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle, X, Loader2, AlertCircle, CalendarOff, Clock } from 'lucide-react';
import { appointmentApi } from '@/lib/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DURATIONS = [10, 15, 20, 30, 45, 60];

interface AvailWindow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: number;
}

interface UnavailDate {
  id: string;
  date: string;
  reason?: string;
}

export function DoctorAvailabilityManager() {
  const [windows, setWindows] = useState<AvailWindow[]>([]);
  const [unavailable, setUnavailable] = useState<UnavailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add window form
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ day_of_week: 0, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Unavailable date
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appointmentApi.getMyAvailability();
      setWindows(res.availability || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    setSaving(true); setSaveError('');
    try {
      await appointmentApi.createAvailability(form);
      setShowAdd(false);
      setForm({ day_of_week: 0, start_time: '09:00', end_time: '17:00', slot_duration_minutes: 30 });
      load();
    } catch (e: any) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await appointmentApi.deleteAvailability(id); load(); }
    catch (e: any) { setError(e.message); }
  };

  const handleToggleActive = async (w: AvailWindow) => {
    try {
      await appointmentApi.updateAvailability(w.id, { is_active: !w.is_active });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const handleEdit = async (id: string) => {
    setSaving(true); setSaveError('');
    try {
      await appointmentApi.updateAvailability(id, editForm);
      setEditId(null);
      load();
    } catch (e: any) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  const handleBlock = async () => {
    if (!newBlockDate) return;
    setBlockSaving(true); setBlockError('');
    try {
      await appointmentApi.addUnavailableDate({ date: newBlockDate, reason: newBlockReason || undefined });
      setNewBlockDate(''); setNewBlockReason('');
      // Reload unavailable — fetch fresh
      const res = await appointmentApi.getMyAvailability();
      setWindows(res.availability || []);
      setBlockSaving(false);
    } catch (e: any) { setBlockError(e.message); setBlockSaving(false); }
  };

  const grouped = DAYS.map((day, i) => ({
    day,
    dow: i,
    windows: windows.filter((w) => w.day_of_week === i),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Availability Schedule</h2>
          <p className="text-xs text-slate-400 mt-0.5">Configure your weekly consultation windows</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-all"
        >
          <Plus className="h-3.5 w-3.5" /> Add Window
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading schedule…
        </div>
      )}

      {/* Add Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-emerald-300">New Availability Window</h3>
                <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-slate-400 hover:text-white" /></button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Day</label>
                  <select value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: +e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Start Time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">End Time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Slot Duration</label>
                  <select value={form.slot_duration_minutes} onChange={e => setForm(f => ({ ...f, slot_duration_minutes: +e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>
              {saveError && <p className="text-xs text-red-400">{saveError}</p>}
              <button onClick={handleAdd} disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-all">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Save Window
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly Grid */}
      {!loading && (
        <div className="space-y-3">
          {grouped.map(({ day, dow, windows: dayWindows }) => (
            <div key={dow} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/60 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300">{day}</span>
                <span className="text-[11px] text-slate-500">{dayWindows.length} window{dayWindows.length !== 1 ? 's' : ''}</span>
              </div>
              {dayWindows.length === 0 ? (
                <p className="text-[11px] text-slate-600 px-4 py-3">No availability set</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {dayWindows.map((w) => (
                    <div key={w.id} className="px-4 py-3 flex items-center gap-3">
                      {editId === w.id ? (
                        <div className="flex-1 flex items-center gap-2 flex-wrap">
                          <input type="time" value={editForm.start_time ?? w.start_time}
                            onChange={e => setEditForm((f: any) => ({ ...f, start_time: e.target.value }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          <span className="text-slate-500 text-xs">–</span>
                          <input type="time" value={editForm.end_time ?? w.end_time}
                            onChange={e => setEditForm((f: any) => ({ ...f, end_time: e.target.value }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                          <select value={editForm.slot_duration_minutes ?? w.slot_duration_minutes}
                            onChange={e => setEditForm((f: any) => ({ ...f, slot_duration_minutes: +e.target.value }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                            {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                          </select>
                          <button onClick={() => handleEdit(w.id)} disabled={saving}
                            className="flex items-center gap-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1 text-xs hover:bg-emerald-500/30">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />} Save
                          </button>
                          <button onClick={() => setEditId(null)}
                            className="rounded bg-slate-800 text-slate-400 border border-slate-700 px-2 py-1 text-xs hover:text-white"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          <span className="text-xs text-slate-300 flex-1">{w.start_time} – {w.end_time}</span>
                          <span className="text-[11px] text-slate-500">{w.slot_duration_minutes} min slots</span>
                          <button onClick={() => handleToggleActive(w)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors ${w.is_active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-800 text-slate-500'}`}>
                            {w.is_active ? 'Active' : 'Inactive'}
                          </button>
                          <button onClick={() => { setEditId(w.id); setEditForm({}); }}
                            className="p-1 rounded text-slate-500 hover:text-white transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(w.id)}
                            className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unavailable Dates */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <CalendarOff className="h-4 w-4 text-red-400" /> Blocked Dates
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-red-500" />
          <input type="text" placeholder="Reason (optional)" value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-red-500" />
          <button onClick={handleBlock} disabled={!newBlockDate || blockSaving}
            className="flex items-center gap-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-2 text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-all">
            {blockSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Block Date
          </button>
        </div>
        {blockError && <p className="text-xs text-red-400">{blockError}</p>}
        {unavailable.length === 0 && <p className="text-[11px] text-slate-600">No dates blocked.</p>}
        <div className="flex flex-wrap gap-2">
          {unavailable.map((u) => (
            <div key={u.id} className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-400">
              <CalendarOff className="h-3 w-3 text-red-400" />
              <span>{u.date}</span>
              {u.reason && <span className="text-slate-600">· {u.reason}</span>}
              <button onClick={async () => {
                await appointmentApi.removeUnavailableDate(u.id);
                setUnavailable(prev => prev.filter(x => x.id !== u.id));
              }} className="ml-1 text-slate-600 hover:text-red-400"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
