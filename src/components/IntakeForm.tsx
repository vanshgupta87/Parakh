import React from 'react';
import { User, MapPin, Sun, Activity, Clock } from 'lucide-react';
import type { PatientMetadata, FitzpatrickSkinType, AnatomicalSite } from '@/types';

interface IntakeFormProps {
  metadata: PatientMetadata;
  onChange: (updated: PatientMetadata) => void;
}

const FITZPATRICK_TYPES: { type: FitzpatrickSkinType; label: string; desc: string; color: string }[] = [
  { type: 'Type I', label: 'I', desc: 'Always burns, never tans (Pale white)', color: '#f8fafc' },
  { type: 'Type II', label: 'II', desc: 'Burns easily, tans minimally (White)', color: '#fde68a' },
  { type: 'Type III', label: 'III', desc: 'Burns moderately, tans gradually (Medium white)', color: '#f59e0b' },
  { type: 'Type IV', label: 'IV', desc: 'Burns minimally, tans easily (Olive/Brown)', color: '#b45309' },
  { type: 'Type V', label: 'V', desc: 'Rarely burns, tans profusely (Dark brown)', color: '#78350f' },
  { type: 'Type VI', label: 'VI', desc: 'Never burns, deeply pigmented (Black)', color: '#3b0764' },
];

const ANATOMICAL_SITES: AnatomicalSite[] = [
  'Head / Neck',
  'Torso (Front)',
  'Torso (Back)',
  'Upper Extremity (Arm/Hand)',
  'Lower Extremity (Leg/Foot)',
  'Acral (Palms/Soles)',
  'Genital / Mucosal',
];

export function IntakeForm({ metadata, onChange }: IntakeFormProps) {
  const handleChange = <K extends keyof PatientMetadata>(key: K, value: PatientMetadata[K]) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="dp-glass space-y-5 p-5">
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
        <User className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-100">Patient Metadata & Clinical Context</h3>
      </div>

      {/* Basic Demographics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Patient Age</label>
          <input
            type="number"
            min={0}
            max={120}
            placeholder="e.g. 45"
            value={metadata.age}
            onChange={(e) => handleChange('age', e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400">Biological Sex</label>
          <select
            value={metadata.gender}
            onChange={(e) => handleChange('gender', e.target.value as PatientMetadata['gender'])}
            className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other / Not Specified</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-500" />
            Lesion Duration
          </label>
          <select
            value={metadata.durationMonths}
            onChange={(e) => handleChange('durationMonths', e.target.value)}
            className="w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="">Select duration...</option>
            <option value="< 1 month">Less than 1 month</option>
            <option value="1-6 months">1 to 6 months</option>
            <option value="6-12 months">6 to 12 months</option>
            <option value="> 1 year">More than 1 year</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* Anatomical Site */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-slate-400 flex items-center gap-1">
          <MapPin className="h-3 w-3 text-slate-500" />
          Anatomical Location
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANATOMICAL_SITES.map((site) => (
            <button
              key={site}
              type="button"
              onClick={() => handleChange('anatomicalSite', site)}
              className={`rounded-md border px-2.5 py-1.5 text-left text-[11px] font-medium transition-all ${
                metadata.anatomicalSite === site
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {site}
            </button>
          ))}
        </div>
      </div>

      {/* Fitzpatrick Skin Type */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-slate-400 flex items-center gap-1">
          <Sun className="h-3 w-3 text-slate-500" />
          Fitzpatrick Skin Phototype
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {FITZPATRICK_TYPES.map((f) => (
            <button
              key={f.type}
              type="button"
              onClick={() => handleChange('fitzpatrickSkinType', f.type)}
              className={`flex flex-col items-start rounded-md border p-2 transition-all ${
                metadata.fitzpatrickSkinType === f.type
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-slate-700"
                  style={{ backgroundColor: f.color }}
                />
                <span className="text-[11px] font-bold">{f.label}</span>
              </div>
              <span className="mt-1 text-[9px] leading-tight text-slate-500 line-clamp-2">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Symptom Checkboxes */}
      <div>
        <label className="mb-2 block text-[11px] font-medium text-slate-400 flex items-center gap-1">
          <Activity className="h-3 w-3 text-slate-500" />
          Observed Clinical Symptoms
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'isElevated', label: 'Raised / Elevated' },
            { key: 'hasItching', label: 'Pruritic (Itching)' },
            { key: 'hasBleeding', label: 'Bleeding / Ulcerated' },
            { key: 'hasChangedRecently', label: 'Recent Growth / Change' },
          ].map((item) => {
            const isChecked = Boolean(metadata[item.key as keyof PatientMetadata]);
            return (
              <label
                key={item.key}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition-all ${
                  isChecked
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => handleChange(item.key as keyof PatientMetadata, e.target.checked as any)}
                  className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-xs font-medium">{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}