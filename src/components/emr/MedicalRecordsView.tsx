import React, { useState, useEffect } from 'react';
import { 
  Heart, AlertCircle, Pill, Activity, ShieldCheck, 
  Plus, Trash2, Edit2, Check, Clock, User, Phone, FileText
} from 'lucide-react';
import { emrApi } from '@/lib/api';

interface MedicalRecordsProps {
  patientId: string;
  isDoctorView?: boolean;
}

export function MedicalRecordsView({ patientId, isDoctorView = false }: MedicalRecordsProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    blood_group: '',
    height_cm: '',
    weight_kg: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    lifestyle_notes: '',
    family_medical_history: '',
  });

  // Allergy Modal State
  const [showAllergyModal, setShowAllergyModal] = useState(false);
  const [allergyForm, setAllergyForm] = useState({
    allergen: '',
    reaction: '',
    severity: 'mild',
    diagnosed_date: '',
    notes: '',
  });

  // Condition Modal State
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [conditionForm, setConditionForm] = useState({
    condition_name: '',
    status: 'active',
    diagnosed_date: '',
    notes: '',
  });

  // Medication Modal State
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [medicationForm, setMedicationForm] = useState({
    medication_name: '',
    dosage: '',
    frequency: 'OD',
    status: 'active',
    prescribed_by: '',
    notes: '',
  });

  const loadEMR = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await emrApi.getPatientEMR(patientId);
      setData(res);
      const p = res.patient || {};
      setProfileForm({
        blood_group: p.blood_group || '',
        height_cm: p.height_cm ? String(p.height_cm) : '',
        weight_kg: p.weight_kg ? String(p.weight_kg) : '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        lifestyle_notes: p.lifestyle_notes || '',
        family_medical_history: p.family_medical_history || '',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load medical records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) loadEMR();
  }, [patientId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await emrApi.updateProfile(patientId, {
        blood_group: profileForm.blood_group || null,
        height_cm: profileForm.height_cm ? parseFloat(profileForm.height_cm) : null,
        weight_kg: profileForm.weight_kg ? parseFloat(profileForm.weight_kg) : null,
        emergency_contact_name: profileForm.emergency_contact_name || null,
        emergency_contact_phone: profileForm.emergency_contact_phone || null,
        lifestyle_notes: profileForm.lifestyle_notes || null,
        family_medical_history: profileForm.family_medical_history || null,
      });
      setEditingProfile(false);
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    }
  };

  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await emrApi.addAllergy(patientId, allergyForm);
      setShowAllergyModal(false);
      setAllergyForm({ allergen: '', reaction: '', severity: 'mild', diagnosed_date: '', notes: '' });
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to add allergy');
    }
  };

  const handleDeleteAllergy = async (id: string) => {
    if (!confirm('Remove this allergy record?')) return;
    try {
      await emrApi.deleteAllergy(id);
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to remove allergy');
    }
  };

  const handleAddCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await emrApi.addCondition(patientId, conditionForm);
      setShowConditionModal(false);
      setConditionForm({ condition_name: '', status: 'active', diagnosed_date: '', notes: '' });
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to record condition');
    }
  };

  const handleDeleteCondition = async (id: string) => {
    if (!confirm('Remove this medical condition record?')) return;
    try {
      await emrApi.deleteCondition(id);
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to remove condition');
    }
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await emrApi.addMedication(patientId, medicationForm);
      setShowMedicationModal(false);
      setMedicationForm({ medication_name: '', dosage: '', frequency: 'OD', status: 'active', prescribed_by: '', notes: '' });
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to record medication');
    }
  };

  const handleDeleteMedication = async (id: string) => {
    if (!confirm('Remove this medication record?')) return;
    try {
      await emrApi.deleteMedication(id);
      loadEMR();
    } catch (err: any) {
      alert(err.message || 'Failed to remove medication');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Activity className="h-6 w-6 animate-spin text-teal-400 mr-3" />
        <span>Loading Electronic Medical Record...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 flex items-center gap-3">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const p = data?.patient || {};
  const allergies = data?.allergies || [];
  const conditions = data?.conditions || [];
  const medications = data?.medications || [];

  return (
    <div className="space-y-8">
      {/* 1. Core Profile Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{p.full_name} — Clinical Profile</h3>
              <p className="text-xs text-slate-400">DOB: {p.date_of_birth} ({p.gender?.toUpperCase()})</p>
            </div>
          </div>
          <button
            onClick={() => setEditingProfile(!editingProfile)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded-lg transition"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>{editingProfile ? 'Cancel' : 'Edit Profile'}</span>
          </button>
        </div>

        {editingProfile ? (
          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Blood Group</label>
                <select
                  value={profileForm.blood_group}
                  onChange={(e) => setProfileForm({ ...profileForm, blood_group: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={profileForm.height_cm}
                  onChange={(e) => setProfileForm({ ...profileForm, height_cm: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  placeholder="e.g. 175"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={profileForm.weight_kg}
                  onChange={(e) => setProfileForm({ ...profileForm, weight_kg: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  placeholder="e.g. 70"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Contact Name</label>
                <input
                  type="text"
                  value={profileForm.emergency_contact_name}
                  onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Emergency Contact Phone</label>
                <input
                  type="text"
                  value={profileForm.emergency_contact_phone}
                  onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Lifestyle & Sun Exposure Notes</label>
              <textarea
                value={profileForm.lifestyle_notes}
                onChange={(e) => setProfileForm({ ...profileForm, lifestyle_notes: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                placeholder="Outdoor occupational exposure, smoking history, sunscreen routine..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Family Medical / Dermatological History</label>
              <textarea
                value={profileForm.family_medical_history}
                onChange={(e) => setProfileForm({ ...profileForm, family_medical_history: e.target.value })}
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                placeholder="Family history of melanoma, dysplastic nevi, atopic dermatitis..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg transition"
              >
                Save Clinical Profile
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Blood Group</span>
              <p className="text-sm font-semibold text-white mt-0.5">{p.blood_group || 'Not recorded'}</p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Height / Weight</span>
              <p className="text-sm font-semibold text-white mt-0.5">
                {p.height_cm ? `${p.height_cm} cm` : '—'} / {p.weight_kg ? `${p.weight_kg} kg` : '—'}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Emergency Contact</span>
              <p className="text-sm font-semibold text-white mt-0.5">{p.emergency_contact_name || 'None'}</p>
              {p.emergency_contact_phone && <p className="text-slate-400 text-[11px]">{p.emergency_contact_phone}</p>}
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-slate-400">Family History</span>
              <p className="text-xs text-slate-300 mt-0.5 truncate">{p.family_medical_history || 'None noted'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Known Allergies */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Documented Allergies</h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
              {allergies.length}
            </span>
          </div>
          <button
            onClick={() => setShowAllergyModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Allergy</span>
          </button>
        </div>

        {allergies.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No known drug, environmental, or contact allergies recorded.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allergies.map((a: any) => (
              <div key={a.id} className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl relative group">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{a.allergen}</h4>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                      a.severity === 'severe' || a.severity === 'life-threatening'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : a.severity === 'moderate'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {a.severity.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteAllergy(a.id)}
                    className="text-slate-500 hover:text-red-400 transition p-1"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {a.reaction && <p className="text-xs text-slate-300 mt-2"><b>Reaction:</b> {a.reaction}</p>}
                {a.notes && <p className="text-xs text-slate-400 mt-1 italic">{a.notes}</p>}
                <p className="text-[10px] text-slate-500 mt-2">Recorded by {a.author_name || 'Clinician'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Medical Conditions & Medications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conditions */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Chronic & Existing Conditions</h3>
            </div>
            <button
              onClick={() => setShowConditionModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          {conditions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No existing medical conditions logged.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {conditions.map((c: any) => (
                <div key={c.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{c.condition_name}</h4>
                    <p className="text-xs text-slate-400">
                      Status: <span className="text-indigo-300 font-medium">{c.status}</span>
                      {c.diagnosed_date && ` • Since ${c.diagnosed_date}`}
                    </p>
                    {c.notes && <p className="text-[11px] text-slate-400 mt-0.5">{c.notes}</p>}
                  </div>
                  <button onClick={() => handleDeleteCondition(c.id)} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Current Medications */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Current & Past Medications</h3>
            </div>
            <button
              onClick={() => setShowMedicationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </div>

          {medications.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No ongoing medications logged.</p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {medications.map((m: any) => (
                <div key={m.id} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{m.medication_name}</h4>
                    <p className="text-xs text-slate-400">
                      Dosage: <span className="text-emerald-300">{m.dosage}</span> ({m.frequency})
                    </p>
                    {m.notes && <p className="text-[11px] text-slate-400 mt-0.5">{m.notes}</p>}
                  </div>
                  <button onClick={() => handleDeleteMedication(m.id)} className="text-slate-500 hover:text-red-400 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: ADD ALLERGY */}
      {showAllergyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Add Known Allergy</h3>
            <form onSubmit={handleAddAllergy} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Allergen Name *</label>
                <input
                  type="text"
                  required
                  value={allergyForm.allergen}
                  onChange={(e) => setAllergyForm({ ...allergyForm, allergen: e.target.value })}
                  placeholder="e.g. Penicillin, Latex, Nickel"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
                  <select
                    value={allergyForm.severity}
                    onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="life-threatening">Life-threatening</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Diagnosed Date</label>
                  <input
                    type="date"
                    value={allergyForm.diagnosed_date}
                    onChange={(e) => setAllergyForm({ ...allergyForm, diagnosed_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reaction Description</label>
                <input
                  type="text"
                  value={allergyForm.reaction}
                  onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
                  placeholder="e.g. Hives, facial angioedema, anaphylaxis"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowAllergyModal(false)} className="px-4 py-2 text-xs text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg">Save Allergy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CONDITION */}
      {showConditionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Record Medical Condition</h3>
            <form onSubmit={handleAddCondition} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Condition / Diagnosis *</label>
                <input
                  type="text"
                  required
                  value={conditionForm.condition_name}
                  onChange={(e) => setConditionForm({ ...conditionForm, condition_name: e.target.value })}
                  placeholder="e.g. Psoriasis Vulgaris, Atopic Dermatitis"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={conditionForm.status}
                    onChange={(e) => setConditionForm({ ...conditionForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="chronic">Chronic</option>
                    <option value="resolved">Resolved</option>
                    <option value="remission">Remission</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Onset Date</label>
                  <input
                    type="date"
                    value={conditionForm.diagnosed_date}
                    onChange={(e) => setConditionForm({ ...conditionForm, diagnosed_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowConditionModal(false)} className="px-4 py-2 text-xs text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-900 bg-indigo-400 hover:bg-indigo-300 rounded-lg">Save Condition</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD MEDICATION */}
      {showMedicationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Record Medication</h3>
            <form onSubmit={handleAddMedication} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Medication Name *</label>
                <input
                  type="text"
                  required
                  value={medicationForm.medication_name}
                  onChange={(e) => setMedicationForm({ ...medicationForm, medication_name: e.target.value })}
                  placeholder="e.g. Tacrolimus 0.1% Ointment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Dosage *</label>
                  <input
                    type="text"
                    required
                    value={medicationForm.dosage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                    placeholder="e.g. 10mg / Thin layer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Frequency *</label>
                  <input
                    type="text"
                    required
                    value={medicationForm.frequency}
                    onChange={(e) => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                    placeholder="e.g. OD, BID, PRN"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowMedicationModal(false)} className="px-4 py-2 text-xs text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg">Save Medication</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
