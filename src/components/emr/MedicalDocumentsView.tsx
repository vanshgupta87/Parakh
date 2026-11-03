import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Download, Eye, Trash2, Search, 
  Filter, AlertCircle, CheckCircle2, FileCheck, Image as ImageIcon
} from 'lucide-react';
import { medicalDocumentApi } from '@/lib/api';

interface MedicalDocumentsProps {
  patientId?: string;
  isDoctorView?: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All Documents' },
  { id: 'laboratory_report', label: 'Lab Reports' },
  { id: 'dermatology_report', label: 'Dermatology Reports' },
  { id: 'medical_image', label: 'Medical Images' },
  { id: 'previous_prescription', label: 'Prescriptions' },
  { id: 'medical_certificate', label: 'Certificates' },
  { id: 'other', label: 'Other Documents' },
];

export function MedicalDocumentsView({ patientId, isDoctorView = false }: MedicalDocumentsProps) {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('laboratory_report');
  const [uploadNotes, setUploadNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetPatientId, setTargetPatientId] = useState(patientId || '');

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (search) params.search = search;
      if (selectedCategory !== 'all') params.category = selectedCategory;

      let res;
      if (patientId) {
        res = await medicalDocumentApi.listForPatient(patientId, params);
      } else {
        res = await medicalDocumentApi.listMy(params);
      }
      setDocuments(res.documents || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [patientId, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadDocuments();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        alert('File size exceeds 15 MB limit.');
        return;
      }
      setSelectedFile(file);
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select a file to upload.');
      return;
    }
    const pid = patientId || targetPatientId;
    if (!pid) {
      alert('Patient ID is required.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('patient_id', pid);
      formData.append('title', uploadTitle);
      formData.append('category', uploadCategory);
      if (uploadNotes) formData.append('notes', uploadNotes);
      formData.append('file', selectedFile);

      await medicalDocumentApi.upload(formData);
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadTitle('');
      setUploadNotes('');
      loadDocuments();
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await medicalDocumentApi.delete(docId);
      loadDocuments();
    } catch (err: any) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  const handleView = async (docId: string, mimeType: string) => {
    const url = medicalDocumentApi.getViewUrl(docId);
    window.open(url, '_blank');
  };

  const handleDownload = async (docId: string, fileName: string) => {
    const url = medicalDocumentApi.getDownloadUrl(docId);
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      alert('Failed to download document');
      return;
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Header & Upload Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-400" />
            <span>Medical Documents & Reports</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Store and retrieve lab reports, dermatology scans, biopsy charts, and previous medical documents securely.
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-xl transition shadow-lg shadow-teal-500/10"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative min-w-[220px]">
          <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </form>
      </div>

      {/* Documents List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs">Loading secure medical documents...</div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-500 text-xs">
          No medical documents found matching your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isPdf = doc.mime_type?.includes('pdf') || doc.file_name?.endsWith('.pdf');
            const categoryLabel = doc.category?.replace('_', ' ').toUpperCase();

            return (
              <div
                key={doc.id}
                className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-teal-400">
                      {isPdf ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      {categoryLabel}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mt-3 truncate" title={doc.title}>
                    {doc.title}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate" title={doc.file_name}>
                    {doc.file_name}
                  </p>

                  {doc.notes && (
                    <p className="text-xs text-slate-300 mt-2 p-2 bg-slate-950/40 rounded border border-slate-800/60 line-clamp-2">
                      {doc.notes}
                    </p>
                  )}

                  <div className="mt-3 text-[11px] text-slate-500 flex justify-between">
                    <span>{formatFileSize(doc.file_size_bytes)}</span>
                    <span>{doc.created_at?.slice(0, 10)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      onClick={() => handleView(doc.id, doc.mime_type)}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => handleDownload(doc.id, doc.file_name)}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 rounded-lg transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: UPLOAD DOCUMENT */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-teal-400" />
              <span>Upload Medical Document</span>
            </h3>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {!patientId && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Patient ID *</label>
                  <input
                    type="text"
                    required
                    value={targetPatientId}
                    onChange={(e) => setTargetPatientId(e.target.value)}
                    placeholder="e.g. pat_uuid"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Serum CBC Panel, Lesion Biopsy Report"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="laboratory_report">Laboratory Report</option>
                  <option value="dermatology_report">Dermatology Report</option>
                  <option value="medical_image">Medical Image (Dermatoscope / Photo)</option>
                  <option value="previous_prescription">Previous Prescription</option>
                  <option value="medical_certificate">Medical Certificate</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              {/* File Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">File (PDF, JPG, PNG up to 15 MB) *</label>
                <div className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 rounded-xl p-4 text-center cursor-pointer bg-slate-950/40">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileCheck className="h-6 w-6 text-teal-400 mx-auto mb-1" />
                    <span className="text-xs text-slate-300 font-medium">
                      {selectedFile ? selectedFile.name : 'Click to select file'}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">PDF, JPG, JPEG, PNG (Max 15 MB)</p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="Summary of findings, interpreting physician, reference labs..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 text-xs font-semibold text-slate-900 bg-teal-400 hover:bg-teal-300 rounded-lg transition disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Save & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
