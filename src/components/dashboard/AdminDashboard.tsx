import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Stethoscope, Users, UserCheck, ShieldAlert,
  History, Settings, CheckCircle2, XCircle, Search, Filter,
  Clock, AlertCircle, Eye, Shield, RefreshCw
} from 'lucide-react';
import { DashboardLayout, type NavItem } from './DashboardLayout';
import { adminApi } from '@/lib/api';

const ADMIN_NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'doctors', label: 'Doctor Verification', icon: Stethoscope },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'users', label: 'All Users', icon: UserCheck },
  { id: 'activity-logs', label: 'Audit Trail', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AdminDashboard() {
  const [activeNav, setActiveNav] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters & Search
  const [doctorStatusFilter, setDoctorStatusFilter] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Doctor Detail Modal
  const [detailDoctor, setDetailDoctor] = useState<any>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await adminApi.getStats();
      if (res?.data) setStats(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadDoctors = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getDoctors(doctorStatusFilter || undefined, doctorSearch || undefined);
      if (res?.doctors) setDoctors(res.doctors);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [doctorStatusFilter, doctorSearch]);

  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getPatients(patientSearch || undefined);
      if (res?.patients) setPatients(res.patients);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [patientSearch]);

  const loadAllUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers();
      if (res?.users) setAllUsers(res.users);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadActivityLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getActivityLogs(50);
      if (res?.logs) setActivityLogs(res.logs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeNav === 'overview') loadStats();
    if (activeNav === 'doctors') loadDoctors();
    if (activeNav === 'patients') loadPatients();
    if (activeNav === 'users') loadAllUsers();
    if (activeNav === 'activity-logs') loadActivityLogs();
  }, [activeNav, loadStats, loadDoctors, loadPatients, loadAllUsers, loadActivityLogs]);

  const handleApproveDoctor = async (doctorId: string) => {
    try {
      await adminApi.approveDoctor(doctorId);
      await loadDoctors();
      await loadStats();
    } catch (err: any) {
      alert(err.message || 'Approval failed.');
    }
  };

  const handleOpenRejectModal = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    setRejectionReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    try {
      await adminApi.rejectDoctor(selectedDoctorId, rejectionReason.trim());
      setRejectModalOpen(false);
      await loadDoctors();
      await loadStats();
    } catch (err: any) {
      alert(err.message || 'Rejection failed.');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await adminApi.updateUserStatus(userId, newStatus, 'Admin console toggle');
      if (activeNav === 'doctors') loadDoctors();
      if (activeNav === 'patients') loadPatients();
      if (activeNav === 'users') loadAllUsers();
      loadStats();
    } catch (err: any) {
      alert(err.message || 'Status update failed.');
    }
  };

  // Badge count for pending doctors
  const pendingCount = stats?.pending_doctors || 0;
  const navItemsWithBadge = ADMIN_NAV_ITEMS.map((item) =>
    item.id === 'doctors' && pendingCount > 0 ? { ...item, badge: pendingCount } : item
  );

  return (
    <DashboardLayout
      title="Platform Administration & Verification"
      roleBadgeText="System Administrator"
      roleBadgeColor="indigo"
      navItems={navItemsWithBadge}
      activeNav={activeNav}
      onSelectNav={setActiveNav}
    >
      {/* VIEW: OVERVIEW */}
      {activeNav === 'overview' && (
        <div className="space-y-6">
          {/* Top Banner */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/60 to-indigo-950/30 p-6 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Administrative Central Operations
              </span>
              <h2 className="text-2xl font-bold text-white mt-2">Platform Governance Overview</h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time metrics, medical credentials verification pipeline, and system audit monitoring.
              </p>
            </div>
            <button
              onClick={loadStats}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Stats
            </button>
          </div>

          {/* Real Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Total Registered Users</span>
              <p className="text-3xl font-extrabold text-white mt-1">{stats?.total_users ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">Across all account roles</p>
            </div>

            <div
              onClick={() => setActiveNav('doctors')}
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 cursor-pointer hover:bg-amber-500/15 transition-colors"
            >
              <span className="text-xs text-amber-300 font-semibold">Pending Doctor Reviews</span>
              <p className="text-3xl font-extrabold text-amber-400 mt-1">{stats?.pending_doctors ?? 0}</p>
              <p className="text-[11px] text-amber-300/80 mt-1">Awaiting credentials approval →</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Approved Doctors</span>
              <p className="text-3xl font-extrabold text-emerald-400 mt-1">{stats?.approved_doctors ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">Active verified clinicians</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs text-slate-400">Total Patients</span>
              <p className="text-3xl font-extrabold text-teal-400 mt-1">{stats?.total_patients ?? 0}</p>
              <p className="text-[11px] text-slate-500 mt-1">Registered health accounts</p>
            </div>
          </div>

          {/* Recent Registrations & Activities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Registrations */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Recent Platform Registrations</span>
                <span className="text-xs text-slate-500 font-normal">Latest 5</span>
              </h3>
              <div className="space-y-2.5">
                {(stats?.recent_registrations || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No recent registrations.</p>
                ) : (
                  (stats?.recent_registrations || []).map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                      <div>
                        <p className="font-semibold text-slate-200">{u.full_name}</p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          u.role === 'doctor' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                        }`}>
                          {u.role}
                        </span>
                        <p className="text-[9px] text-slate-500 mt-1">{u.created_at?.split('T')[0]}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Audit Activities */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Security & Admin Audit Stream</span>
                <span className="text-xs text-slate-500 font-normal">Real-time</span>
              </h3>
              <div className="space-y-2.5">
                {(stats?.recent_activities || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No administrative activity recorded.</p>
                ) : (
                  (stats?.recent_activities || []).slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-start justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                      <div className="space-y-0.5">
                        <span className="font-mono text-[11px] font-semibold text-indigo-400">{a.action}</span>
                        <p className="text-[10px] text-slate-400">Actor: {a.actor_name || a.actor_email || 'System'}</p>
                      </div>
                      <span className="text-[9px] text-slate-500 shrink-0">{a.timestamp?.split('.')[0]?.replace('T', ' ')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: DOCTOR VERIFICATION & MANAGEMENT */}
      {activeNav === 'doctors' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDoctorStatusFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  doctorStatusFilter === '' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Statuses
              </button>
              <button
                onClick={() => setDoctorStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  doctorStatusFilter === 'pending' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
                }`}
              >
                Pending Review ({pendingCount})
              </button>
              <button
                onClick={() => setDoctorStatusFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  doctorStatusFilter === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-emerald-400 hover:text-emerald-300 border border-slate-800'
                }`}
              >
                Approved
              </button>
              <button
                onClick={() => setDoctorStatusFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  doctorStatusFilter === 'rejected' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
                }`}
              >
                Rejected
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search name, MCI reg, clinic..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500/60 focus:outline-none"
              />
            </div>
          </div>

          {/* Doctors Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Doctor</th>
                    <th className="px-4 py-3">Medical Reg No.</th>
                    <th className="px-4 py-3">Qualification</th>
                    <th className="px-4 py-3">Clinic & City</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {doctors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No doctors match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    doctors.map((doc) => (
                      <tr key={doc.doctor_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-white">{doc.full_name}</p>
                          <p className="text-[10px] text-slate-500">{doc.email} • {doc.phone || 'No phone'}</p>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                          {doc.medical_registration_number}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <p>{doc.qualification}</p>
                          <p className="text-[10px] text-slate-500">{doc.specialization} ({doc.experience_years} yrs)</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          <p className="truncate max-w-[160px]">{doc.clinic_name}</p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[160px]">{doc.clinic_address}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              doc.verification_status === 'approved'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : doc.verification_status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {doc.verification_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => setDetailDoctor(doc)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                          >
                            View
                          </button>
                          {doc.verification_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApproveDoctor(doc.doctor_id)}
                                className="px-2.5 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-[11px] font-semibold shadow-[0_0_10px_-2px_rgba(16,185,129,0.5)]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenRejectModal(doc.doctor_id)}
                                className="px-2.5 py-1 rounded bg-rose-600/30 text-rose-300 hover:bg-rose-600/50 border border-rose-500/30 text-[11px]"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {doc.verification_status === 'approved' && (
                            <button
                              onClick={() => handleToggleUserStatus(doc.user_id, doc.account_status)}
                              className={`px-2 py-1 rounded text-[11px] ${
                                doc.account_status === 'suspended'
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-amber-600/20 text-amber-300 border border-amber-500/30 hover:bg-amber-600/40'
                              }`}
                            >
                              {doc.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: PATIENTS */}
      {activeNav === 'patients' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Registered Patient Accounts</h3>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search patient name, ID, email..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500/60 focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Patient Unique ID</th>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Email & Contact</th>
                    <th className="px-4 py-3">Date of Birth</th>
                    <th className="px-4 py-3">Account Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {patients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No registered patients found.
                      </td>
                    </tr>
                  ) : (
                    patients.map((pat) => (
                      <tr key={pat.patient_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-teal-400">
                          {pat.patient_unique_id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{pat.full_name}</td>
                        <td className="px-4 py-3 text-slate-300">
                          <p>{pat.email}</p>
                          <p className="text-[10px] text-slate-500">{pat.phone || 'No phone'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{pat.date_of_birth}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              pat.account_status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {pat.account_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(pat.user_id, pat.account_status)}
                            className={`px-2 py-1 rounded text-[11px] ${
                              pat.account_status === 'suspended'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-rose-900/30 text-rose-300 hover:bg-rose-900/50'
                            }`}
                          >
                            {pat.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: ALL USERS */}
      {activeNav === 'users' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Email Verified</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Toggle Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-white">{u.full_name}</p>
                        <p className="text-[10px] text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono uppercase text-[10px] font-bold text-indigo-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.email_verified ? (
                          <span className="text-emerald-400 font-semibold text-[11px]">Verified</span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Unverified</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                          u.account_status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                        }`}>
                          {u.account_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{u.created_at?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => handleToggleUserStatus(u.id, u.account_status)}
                            className="px-2 py-1 rounded bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700"
                          >
                            {u.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: AUDIT LOGS */}
      {activeNav === 'activity-logs' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                  {activityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No audit events recorded.
                      </td>
                    </tr>
                  ) : (
                    activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 text-slate-400">
                          {log.timestamp?.replace('T', ' ')?.split('.')[0]}
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-300">{log.action}</td>
                        <td className="px-4 py-3 text-slate-300">{log.actor_email || log.actor_name || 'System'}</td>
                        <td className="px-4 py-3 text-slate-400">{log.target_email || log.target_name || '-'}</td>
                        <td className="px-4 py-3 text-slate-500">{log.ip_address || 'local'}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{log.metadata || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: SETTINGS */}
      {activeNav === 'settings' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-white">Platform Settings & Security Parameters</h3>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500">Argon2id Hash Parameters:</span>
              <p className="font-mono mt-0.5">m=65536, t=3, p=4 (OWASP Compliant)</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500">Session Cookie Policy:</span>
              <p className="font-mono mt-0.5">HttpOnly, SameSite=Lax, 7-day rolling expiry</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className="text-slate-500">Doctor Verification Policy:</span>
              <p className="font-mono mt-0.5">Strict Admin Sign-off Required before Clinical AI Access</p>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      <AnimatePresence>
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 space-y-4 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-400" /> Reject Doctor Credentials
              </h3>
              <p className="text-xs text-slate-400">
                Please enter a clinical or administrative justification. This reason will be recorded in the audit trail and communicated to the applicant.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Medical registration number could not be validated with state council registry..."
                rows={3}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:border-rose-500/60 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DOCTOR DETAIL MODAL */}
      <AnimatePresence>
        {detailDoctor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{detailDoctor.full_name}</h3>
                    <p className="text-xs text-slate-400">{detailDoctor.email}</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-800 text-slate-300">
                  {detailDoctor.verification_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500">Medical Registration No:</span>
                  <p className="font-mono font-bold text-emerald-400 mt-0.5">{detailDoctor.medical_registration_number}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-500">Qualification & Experience:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{detailDoctor.qualification} ({detailDoctor.experience_years} years)</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                  <span className="text-slate-500">Clinic Name & Location:</span>
                  <p className="font-semibold text-slate-200 mt-0.5">{detailDoctor.clinic_name}</p>
                  <p className="text-slate-400 text-[11px]">{detailDoctor.clinic_address}</p>
                </div>
                {detailDoctor.professional_bio && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                    <span className="text-slate-500">Professional Bio:</span>
                    <p className="text-slate-300 mt-0.5 text-[11px]">{detailDoctor.professional_bio}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setDetailDoctor(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
