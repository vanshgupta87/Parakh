import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Stethoscope, MapPin, Award, Calendar, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { appointmentApi } from '@/lib/api';

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

const SPECIALIZATIONS = [
  'All',
  'Clinical Dermatology',
  'Dermatosurgery',
  'Pediatric Dermatology',
  'Cosmetic Dermatology',
  'Trichology',
  'Dermato-Oncology',
  'Dermatology',
];

interface Props {
  onSelectDoctor: (doctor: Doctor) => void;
}

export function FindDoctorPage({ onSelectDoctor }: Props) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [specFilter, setSpecFilter] = useState('All');

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appointmentApi.listDoctors(
        nameSearch || undefined,
        specFilter !== 'All' ? specFilter : undefined
      );
      setDoctors(res.doctors || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load doctors.');
    } finally {
      setLoading(false);
    }
  }, [nameSearch, specFilter]);

  useEffect(() => {
    const t = setTimeout(fetchDoctors, 300);
    return () => clearTimeout(t);
  }, [fetchDoctors]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 via-slate-900/50 to-teal-950/20 p-6 backdrop-blur-md">
        <span className="text-xs font-semibold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full border border-teal-500/20">
          Verified Dermatologists
        </span>
        <h2 className="text-2xl font-bold text-white mt-2">Find a Doctor</h2>
        <p className="text-xs text-slate-400 mt-1">
          Browse board-certified dermatologists and book a consultation.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by doctor name…"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <select
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {SPECIALIZATIONS.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Specializations' : s}</option>
          ))}
        </select>
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-sm">Loading doctors…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {!loading && !error && doctors.length === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
          <Stethoscope className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No doctors found matching your criteria.</p>
        </div>
      )}

      {/* Doctor Cards */}
      {!loading && !error && doctors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {doctors.map((doc, i) => (
            <motion.div
              key={doc.doctor_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-teal-500/40 hover:bg-slate-900/80 transition-all cursor-pointer group"
              onClick={() => onSelectDoctor(doc)}
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="h-12 w-12 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-lg shrink-0">
                  {doc.full_name.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white truncate">{doc.full_name}</h3>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-teal-400 shrink-0 transition-colors" />
                  </div>

                  <span className="inline-block mt-1 text-[11px] font-medium text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                    {doc.specialization}
                  </span>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Award className="h-3 w-3 text-slate-500 shrink-0" />
                      <span className="truncate">{doc.qualification}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Stethoscope className="h-3 w-3 text-slate-500 shrink-0" />
                      <span>{doc.experience_years} yrs experience</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                      <span className="truncate">{doc.clinic_name}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{doc.clinic_address}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectDoctor(doc); }}
                  className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
                >
                  <Calendar className="h-3 w-3" />
                  Book
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
