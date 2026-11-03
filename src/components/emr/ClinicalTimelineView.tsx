import React, { useState, useEffect } from 'react';
import { 
  Calendar, Stethoscope, Pill, FileText, Sparkles, 
  Clock, ShieldCheck, AlertCircle, ChevronDown, Filter
} from 'lucide-react';
import { timelineApi } from '@/lib/api';

interface ClinicalTimelineProps {
  patientId?: string;
}

const EVENT_FILTERS = [
  { id: 'all', label: 'All Timeline Events' },
  { id: 'consultation', label: 'Doctor Consultations' },
  { id: 'prescription', label: 'Prescriptions' },
  { id: 'ai_analysis', label: 'AI Lesion Scans' },
  { id: 'document', label: 'Documents' },
  { id: 'appointment', label: 'Appointments' },
];

export function ClinicalTimelineView({ patientId }: ClinicalTimelineProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadTimeline = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (activeFilter !== 'all') params.event_type = activeFilter;

      let res;
      if (patientId) {
        res = await timelineApi.getPatientTimeline(patientId, params);
      } else {
        res = await timelineApi.getMyTimeline(params);
      }
      setEvents(res.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [patientId, activeFilter]);

  const getEventIcon = (event: any) => {
    if (event.is_ai_prediction) {
      return <Sparkles className="h-4 w-4 text-cyan-400" />;
    }
    switch (event.event_type) {
      case 'consultation':
        return <Stethoscope className="h-4 w-4 text-emerald-400" />;
      case 'prescription':
        return <Pill className="h-4 w-4 text-teal-400" />;
      case 'document':
        return <FileText className="h-4 w-4 text-purple-400" />;
      default:
        return <Calendar className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-400" />
            <span>Longitudinal Clinical Timeline</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Complete chronological record of appointments, physician assessments, prescriptions, documents, and AI pre-screenings.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {EVENT_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              activeFilter === f.id
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading clinical timeline...</div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
          No clinical timeline records found.
        </div>
      ) : (
        <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {events.map((evt) => {
            const dateStr = evt.timestamp ? new Date(evt.timestamp).toLocaleDateString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Recent';

            return (
              <div key={evt.id} className="relative group">
                {/* Node Dot */}
                <div className={`absolute -left-6 top-1.5 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-slate-950 ${
                  evt.is_ai_prediction
                    ? 'border-cyan-400 text-cyan-400'
                    : evt.event_type === 'consultation'
                    ? 'border-emerald-400 text-emerald-400'
                    : evt.event_type === 'prescription'
                    ? 'border-teal-400 text-teal-400'
                    : 'border-slate-600 text-slate-400'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                </div>

                {/* Event Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 hover:border-slate-700 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-md bg-slate-800/80">
                        {getEventIcon(evt)}
                      </div>
                      <h3 className="text-sm font-bold text-white">{evt.title}</h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Critical Distinction Badge: AI vs Doctor */}
                      {evt.is_ai_prediction ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                          <Sparkles className="h-3 w-3 shrink-0" />
                          <span>AI PRE-SCREENING</span>
                        </span>
                      ) : evt.is_doctor_confirmed ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          <span>PHYSICIAN CONFIRMED</span>
                        </span>
                      ) : null}

                      <span className="text-[11px] text-slate-400 font-mono">{dateStr}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                    {evt.description}
                  </p>

                  {/* Metadata Specific Highlights */}
                  {evt.is_ai_prediction && evt.metadata?.disclaimer && (
                    <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-cyan-300/90 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400" />
                      <span>{evt.metadata.disclaimer}</span>
                    </div>
                  )}

                  {evt.metadata?.diagnosis && (
                    <div className="mt-2 text-xs text-slate-400">
                      <b>Clinical Diagnosis:</b> <span className="text-emerald-400">{evt.metadata.diagnosis}</span>
                    </div>
                  )}

                  {evt.metadata?.clinical_notes && (
                    <p className="mt-1 text-xs text-slate-400 italic">
                      "{evt.metadata.clinical_notes}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
