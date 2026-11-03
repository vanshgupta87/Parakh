import React, { useState, useEffect } from 'react';
import { 
  Pill, FileDown, Plus, Eye, CheckCircle2, Clock, 
  AlertCircle, ShieldCheck, Stethoscope, Trash2
} from 'lucide-react';
import { prescriptionApi } from '@/lib/api';

interface PrescriptionsProps {
  patientId?: string;
  isDoctorView?: boolean;
}

export function DigitalPrescriptionsView({ patientId, isDoctorView = false }: PrescriptionsProps) {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected for Detail Modal
  const [selectedRx, setSelectedRx] = useState<any>(null);
  const [rxDetail, setRxDetail] = useState<{ prescription: any; items: any[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    patient_id: patientId || '',
    diagnosis: '',
    clinical_assessment: '',
    follow_up_date: '',
    general_instructions: '',
    finalize_now: false,
    items: [
      { medicine_name: '', dosage: '', frequency: 'OD', duration: '7 days', instructions: '' }
    ]
  });

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      let res;
      if (patientId) {
        res = await prescriptionApi.listForPatient(patientId);
      } else {
        res = await prescriptionApi.listMy();
      }
      setPrescriptions(res.prescriptions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [patientId]);

  const handleOpenDetail = async (rxId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedRx(rxId);
      const res = await prescriptionApi.getDetail(rxId);
      setRxDetail(res);
    } catch (err: any) {
      alert('Could not fetch prescription details: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadPdf = async (rxId: string, rxNumber: string) => {
    try {
      const url = prescriptionApi.downloadPdfUrl(rxId);
      // Fetch with auth cookies/headers and trigger browser download
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Prescription_${rxNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('Failed to download prescription PDF: ' + err.message);
    }
  };

  const handleAddItem = () => {
    setCreateForm({
      ...createForm,
      items: [
        ...createForm.items,
        { medicine_name: '', dosage: '', frequency: 'OD', duration: '7 days', instructions: '' }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    if (createForm.items.length <= 1) return;
    setCreateForm({
      ...createForm,
      items: createForm.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const updated = [...createForm.items];
    (updated[index] as any)[field] = value;
    setCreateForm({ ...createForm, items: updated });
  };

  const handleCreatePrescription = async (e: React.FormEvent, finalizeNow: boolean) => {
    e.preventDefault();
    if (!createForm.patient_id) {
      alert('Please specify a patient ID.');
      return;
    }
    try {
      await prescriptionApi.create({
        ...createForm,
        finalize_now: finalizeNow
      });
      setShowCreateModal(false);
      setCreateForm({
        patient_id: patientId || '',
        diagnosis: '',
        clinical_assessment: '',
        follow_up_date: '',
        general_instructions: '',
        finalize_now: false,
        items: [{ medicine_name: '', dosage: '', frequency: 'OD', duration: '7 days', instructions: '' }]
      });
      loadPrescriptions();
    } catch (err: any) {
      alert('Failed to create prescription: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Pill className="h-5 w-5 text-emerald-400" />
            <span>Digital Prescriptions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Official digitally-signed prescription records with downloadable branded PDFs.
          </p>
        </div>
        {isDoctorView && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition shadow-lg shadow-emerald-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>Issue New Prescription</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading digital prescriptions...</div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
          No prescriptions issued yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {prescriptions.map((rx) => (
            <div
              key={rx.id}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-emerald-400">{rx.prescription_number}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    rx.status === 'finalized'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {rx.status.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-sm font-semibold text-white mt-2">
                  {rx.diagnosis || 'Prescribed Medications'}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Prescribed by <b>Dr. {rx.doctor_name || 'Clinician'}</b>
                  {rx.doctor_specialization && ` (${rx.doctor_specialization})`}
                </p>

                <div className="mt-3 py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Medicines count:</span>
                    <span className="font-semibold text-white">{rx.item_count || 'Multiple'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{rx.created_at?.slice(0, 10)}</span>
                  </div>
                  {rx.follow_up_date && (
                    <div className="flex justify-between text-teal-400">
                      <span>Follow-up:</span>
                      <span>{rx.follow_up_date}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenDetail(rx.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>View Details</span>
                </button>
                <button
                  onClick={() => handleDownloadPdf(rx.id, rx.prescription_number)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition"
                  title="Download PDF"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: VIEW DETAILS */}
      {selectedRx && rxDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {rxDetail.prescription.prescription_number}
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Prescription Details</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(rxDetail.prescription.id, rxDetail.prescription.prescription_number)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition"
                >
                  <FileDown className="h-4 w-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  onClick={() => setSelectedRx(null)}
                  className="text-slate-400 hover:text-white text-sm px-2 py-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400">Doctor</span>
                  <p className="font-semibold text-white mt-0.5">Dr. {rxDetail.prescription.doctor_name}</p>
                  <p className="text-slate-400 text-[11px]">{rxDetail.prescription.doctor_specialization} (Reg: {rxDetail.prescription.medical_registration_number || 'N/A'})</p>
                </div>
                <div>
                  <span className="text-slate-400">Patient</span>
                  <p className="font-semibold text-white mt-0.5">{rxDetail.prescription.patient_name}</p>
                  <p className="text-slate-400 text-[11px]">{rxDetail.prescription.patient_gender} • DOB: {rxDetail.prescription.date_of_birth}</p>
                </div>
              </div>

              {rxDetail.prescription.diagnosis && (
                <div>
                  <span className="font-semibold text-slate-300">Diagnosis:</span>
                  <p className="text-white mt-1 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    {rxDetail.prescription.diagnosis}
                  </p>
                </div>
              )}

              {rxDetail.prescription.clinical_assessment && (
                <div>
                  <span className="font-semibold text-slate-300">Clinical Assessment:</span>
                  <p className="text-slate-300 mt-1 p-2.5 bg-slate-950/60 rounded-lg border border-slate-800">
                    {rxDetail.prescription.clinical_assessment}
                  </p>
                </div>
              )}

              {/* Medicines Table */}
              <div>
                <span className="font-semibold text-slate-300">Prescribed Medications:</span>
                <div className="mt-2 border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">Medicine Name</th>
                        <th className="p-2.5">Dosage</th>
                        <th className="p-2.5">Frequency</th>
                        <th className="p-2.5">Duration</th>
                        <th className="p-2.5">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                      {rxDetail.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="p-2.5 text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-white">{item.medicine_name}</td>
                          <td className="p-2.5 text-slate-300">{item.dosage}</td>
                          <td className="p-2.5 text-slate-300">{item.frequency}</td>
                          <td className="p-2.5 text-slate-300">{item.duration}</td>
                          <td className="p-2.5 text-slate-400 italic">{item.instructions || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {rxDetail.prescription.general_instructions && (
                <div>
                  <span className="font-semibold text-slate-300">General Advice:</span>
                  <p className="text-slate-400 mt-1 p-2 bg-slate-950/40 rounded border border-slate-800/80">
                    {rxDetail.prescription.general_instructions}
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center text-[11px] text-slate-500 border-t border-slate-800">
                <span>Digitally issued on {rxDetail.prescription.created_at?.slice(0, 10)}</span>
                <span className="text-emerald-400 font-medium">Verified by PARAKH Platform</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PRESCRIPTION */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl my-8">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-emerald-400" />
              <span>Issue New Digital Prescription</span>
            </h3>

            <form className="space-y-4">
              {!patientId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Patient ID *</label>
                  <input
                    type="text"
                    required
                    value={createForm.patient_id}
                    onChange={(e) => setCreateForm({ ...createForm, patient_id: e.target.value })}
                    placeholder="e.g. pat_uuid"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Diagnosis *</label>
                  <input
                    type="text"
                    required
                    value={createForm.diagnosis}
                    onChange={(e) => setCreateForm({ ...createForm, diagnosis: e.target.value })}
                    placeholder="e.g. Acute Eczematous Dermatitis"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Follow-up Date</label>
                  <input
                    type="date"
                    value={createForm.follow_up_date}
                    onChange={(e) => setCreateForm({ ...createForm, follow_up_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Assessment / Findings</label>
                <textarea
                  rows={2}
                  value={createForm.clinical_assessment}
                  onChange={(e) => setCreateForm({ ...createForm, clinical_assessment: e.target.value })}
                  placeholder="Clinical observation, lesion characteristics, severity..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Dynamic Medicine Rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-200">Prescribed Medications</label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Medicine</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {createForm.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">Medicine #{idx + 1}</span>
                        {createForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-500 hover:text-red-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Medicine Name *"
                          value={item.medicine_name}
                          onChange={(e) => handleItemChange(idx, 'medicine_name', e.target.value)}
                          className="col-span-2 sm:col-span-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Dosage (e.g. 10mg) *"
                          value={item.dosage}
                          onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Freq (e.g. BID) *"
                          value={item.frequency}
                          onChange={(e) => handleItemChange(idx, 'frequency', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Duration (14 days) *"
                          value={item.duration}
                          onChange={(e) => handleItemChange(idx, 'duration', e.target.value)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Instructions (e.g. After meals, apply topically at night)"
                        value={item.instructions}
                        onChange={(e) => handleItemChange(idx, 'instructions', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">General Advice / Instructions</label>
                <input
                  type="text"
                  value={createForm.general_instructions}
                  onChange={(e) => setCreateForm({ ...createForm, general_instructions: e.target.value })}
                  placeholder="e.g. Avoid direct sunlight, stay hydrated, return if rash spreads"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreatePrescription(e, false)}
                  className="px-4 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreatePrescription(e, true)}
                  className="px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg"
                >
                  Sign & Finalize
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
