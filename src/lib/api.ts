export const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:8000"
  : "http://127.0.0.1:8000";

export interface ApiUser {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'doctor' | 'patient';
  email_verified: boolean;
  account_status: 'active' | 'pending_verification' | 'suspended' | 'rejected';
  created_at: string;
  last_login?: string;
  doctor_profile?: {
    doctor_id: string;
    medical_registration_number: string;
    qualification: string;
    specialization: string;
    experience_years: number;
    clinic_name: string;
    clinic_address: string;
    profile_image?: string;
    professional_bio?: string;
    verification_status: 'pending' | 'approved' | 'rejected' | 'suspended';
    verified_by?: string;
    verified_at?: string;
    rejection_reason?: string;
  };
  patient_profile?: {
    patient_id: string;
    date_of_birth: string;
    gender?: string;
    patient_unique_id: string;
  };
}

const SESSION_TOKEN_KEY = "parakh_session_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Send Bearer token from localStorage alongside the HttpOnly cookie.
  // The backend accepts either; this ensures auth works even when the
  // SameSite cookie is blocked by the browser in cross-origin dev setups.
  const storedToken = getStoredToken();
  if (storedToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${storedToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // also attempt HttpOnly session cookie
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// Authentication API methods
export const authApi = {
  getMe: () => apiRequest<{ status: string; user: ApiUser }>("/api/v1/auth/me"),
  login: async (payload: { email: string; password: string; remember_me?: boolean }) => {
    const res = await apiRequest<{ status: string; user: ApiUser; session_token: string }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // Persist token so Bearer auth survives page refreshes
    if (res?.session_token) {
      storeToken(res.session_token);
    }
    return res;
  },
  logout: async () => {
    clearStoredToken();
    return apiRequest<{ status: string; message: string }>("/api/v1/auth/logout", {
      method: "POST",
    });
  },
  registerPatient: (payload: any) =>
    apiRequest("/api/v1/auth/register/patient", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  registerDoctor: (payload: any) =>
    apiRequest("/api/v1/auth/register/doctor", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyEmail: (token: string) =>
    apiRequest("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  forgotPassword: (email: string) =>
    apiRequest("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (payload: { token: string; new_password: string; confirm_password: string }) =>
    apiRequest("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: { current_password: string; new_password: string; confirm_password: string }) =>
    apiRequest("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// Admin API methods
export const adminApi = {
  getStats: () => apiRequest("/api/v1/admin/stats"),
  getDoctors: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiRequest(`/api/v1/admin/doctors${query}`);
  },
  getDoctorDetail: (id: string) => apiRequest(`/api/v1/admin/doctors/${id}`),
  approveDoctor: (id: string) =>
    apiRequest(`/api/v1/admin/doctors/${id}/approve`, { method: "POST" }),
  rejectDoctor: (id: string, rejection_reason: string) =>
    apiRequest(`/api/v1/admin/doctors/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejection_reason }),
    }),
  getPatients: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiRequest(`/api/v1/admin/patients${q}`);
  },
  getUsers: (params?: { role?: string; status?: string; search?: string }) => {
    const sp = new URLSearchParams();
    if (params?.role) sp.set("role", params.role);
    if (params?.status) sp.set("status", params.status);
    if (params?.search) sp.set("search", params.search);
    const q = sp.toString() ? `?${sp.toString()}` : "";
    return apiRequest(`/api/v1/admin/users${q}`);
  },
  updateUserStatus: (userId: string, account_status: string, reason?: string) =>
    apiRequest(`/api/v1/admin/users/${userId}/status`, {
      method: "POST",
      body: JSON.stringify({ account_status, reason }),
    }),
  getActivityLogs: (limit = 50) => apiRequest(`/api/v1/admin/activity-logs?limit=${limit}`),
};

// Doctor API methods
export const doctorApi = {
  getProfile: () => apiRequest("/api/v1/doctor/profile"),
  updateProfile: (data: any) =>
    apiRequest("/api/v1/doctor/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getDashboardSummary: () => apiRequest("/api/v1/doctor/dashboard-summary"),
  savePatientAIReport: (patientId: string, payload: {
    prediction: string;
    confidence: number;
    risk_score: number;
    risk_level: string;
    recommendation: string;
    image_data: string;
    heatmap_data?: string;
    probabilities?: Record<string, number>;
    clinical_metadata?: Record<string, unknown>;
  }) => apiRequest<{ status: string; report_id: string; created_at: string }>(
    `/api/v1/doctor/patients/${encodeURIComponent(patientId)}/ai-reports`,
    { method: "POST", body: JSON.stringify(payload) },
  ),
  listPatientAIReports: (patientId: string) => apiRequest<{
    status: string;
    reports: Array<{
      id: string;
      patient_id: string;
      image_data: string;
      prediction: string;
      confidence: number;
      risk_score: number;
      risk_level: string;
      recommendation: string | null;
      heatmap_data: string | null;
      probabilities: Record<string, number> | null;
      clinical_metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
  }>(`/api/v1/doctor/patients/${encodeURIComponent(patientId)}/ai-reports`),
  getPatients: () => apiRequest<{
    status: string;
    total: number;
    patients: Array<{
      patient_id: string;
      patient_unique_id: string;
      full_name: string;
      email: string;
      phone: string | null;
      gender: string | null;
      date_of_birth: string | null;
      blood_group: string | null;
      last_appointment_date: string | null;
      appointment_count: number;
      scan_count: number;
      prescription_count: number;
    }>;
  }>('/api/v1/doctor/patients'),
};

// Patient API methods
export const patientApi = {
  getProfile: () => apiRequest("/api/v1/patient/profile"),
  updateProfile: (data: any) =>
    apiRequest("/api/v1/patient/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getDashboardSummary: () => apiRequest("/api/v1/patient/dashboard-summary"),
  saveAIReport: (payload: any) =>
    apiRequest("/api/v1/patient/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listMyAIReports: () => apiRequest("/api/v1/patient/reports"),
  getAIReportDetail: (id: string) => apiRequest(`/api/v1/patient/reports/${id}`),
};

// Appointment API methods
export const appointmentApi = {
  // Doctor discovery
  listDoctors: (name?: string, specialization?: string) => {
    const p = new URLSearchParams();
    if (name) p.set("name", name);
    if (specialization) p.set("specialization", specialization);
    const q = p.toString() ? `?${p.toString()}` : "";
    return apiRequest(`/api/v1/appointments/doctors${q}`);
  },
  getDoctorProfile: (doctorId: string) =>
    apiRequest(`/api/v1/appointments/doctors/${doctorId}`),
  getSlots: (doctorId: string, date: string) =>
    apiRequest(`/api/v1/appointments/doctors/${doctorId}/slots?date=${date}`),

  // Patient appointments
  book: (payload: {
    doctor_id: string;
    appointment_date: string;
    slot_start: string;
    reason_for_visit?: string;
    attached_report_id?: string;
  }) =>
    apiRequest("/api/v1/appointments/book", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listMyAppointments: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiRequest(`/api/v1/appointments/my${q}`);
  },
  getMyAppointment: (id: string) =>
    apiRequest(`/api/v1/appointments/my/${id}`),
  cancelAppointment: (id: string, reason?: string) =>
    apiRequest(`/api/v1/appointments/my/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  requestReschedule: (
    id: string,
    payload: { new_date: string; new_slot_start: string; reason?: string }
  ) =>
    apiRequest(`/api/v1/appointments/my/${id}/reschedule`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Doctor availability management
  createAvailability: (payload: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
  }) =>
    apiRequest("/api/v1/appointments/availability", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getMyAvailability: () => apiRequest("/api/v1/appointments/availability/my"),
  updateAvailability: (id: string, payload: any) =>
    apiRequest(`/api/v1/appointments/availability/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteAvailability: (id: string) =>
    apiRequest(`/api/v1/appointments/availability/${id}`, { method: "DELETE" }),
  addUnavailableDate: (payload: { date: string; reason?: string }) =>
    apiRequest("/api/v1/appointments/availability/unavailable-dates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeUnavailableDate: (id: string) =>
    apiRequest(`/api/v1/appointments/availability/unavailable-dates/${id}`, {
      method: "DELETE",
    }),

  // Doctor appointment management
  listDoctorAppointments: (status?: string) => {
    const q = status ? `?status=${status}` : "";
    return apiRequest(`/api/v1/appointments/doctor${q}`);
  },
  getDoctorAppointment: (id: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}`),
  confirmAppointment: (id: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}/confirm`, { method: "POST" }),
  rejectAppointment: (id: string, reason?: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  completeAppointment: (id: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}/complete`, { method: "POST" }),
  doctorCancelAppointment: (id: string, reason?: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  markNoShow: (id: string) =>
    apiRequest(`/api/v1/appointments/doctor/${id}/no-show`, { method: "POST" }),
  saveConsultation: (apptId: string, payload: {
    chief_complaint?: string;
    clinical_notes?: string;
    diagnosis?: string;
    follow_up_date?: string;
  }) =>
    apiRequest(`/api/v1/appointments/doctor/${apptId}/consultation`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // AI Reports on Appointments
  attachReport: (apptId: string, payload: { report_id: string; notes?: string }) =>
    apiRequest(`/api/v1/appointments/${apptId}/attach-report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getAttachedReports: (apptId: string) =>
    apiRequest(`/api/v1/appointments/${apptId}/reports`),

  // Additional Rescheduling Flows
  doctorProposeReschedule: (
    apptId: string,
    payload: { new_date: string; new_slot_start: string; reason?: string }
  ) =>
    apiRequest(`/api/v1/appointments/doctor/${apptId}/reschedule`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patientAcceptReschedule: (requestId: string) =>
    apiRequest(`/api/v1/appointments/my/reschedule/${requestId}/accept`, {
      method: "POST",
    }),
  patientRejectReschedule: (requestId: string) =>
    apiRequest(`/api/v1/appointments/my/reschedule/${requestId}/reject`, {
      method: "POST",
    }),
};

// Notification API methods
export const notificationApi = {
  getNotifications: () =>
    apiRequest<{
      status: string;
      unread_count: number;
      notifications: Array<{
        id: string;
        title: string;
        message: string;
        type: string;
        link?: string;
        is_read: number;
        created_at: string;
      }>;
    }>("/api/v1/notifications"),
  markRead: (id: string) =>
    apiRequest(`/api/v1/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () =>
    apiRequest("/api/v1/notifications/read-all", { method: "POST" }),
};

// EMR API methods
export const emrApi = {
  getPatientEMR: (patientId: string) =>
    apiRequest<{
      status: string;
      patient: any;
      allergies: any[];
      conditions: any[];
      medications: any[];
      consultations: any[];
    }>(`/api/v1/emr/patient/${patientId}`),
  getMyEMR: () =>
    apiRequest<{
      status: string;
      patient: any;
      allergies: any[];
      conditions: any[];
      medications: any[];
      consultations: any[];
    }>("/api/v1/emr/my"),
  updateProfile: (patientId: string, data: any) =>
    apiRequest(`/api/v1/emr/patient/${patientId}/profile`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addAllergy: (patientId: string, data: any) =>
    apiRequest(`/api/v1/emr/patient/${patientId}/allergies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAllergy: (allergyId: string) =>
    apiRequest(`/api/v1/emr/allergies/${allergyId}`, { method: "DELETE" }),
  addCondition: (patientId: string, data: any) =>
    apiRequest(`/api/v1/emr/patient/${patientId}/conditions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCondition: (conditionId: string) =>
    apiRequest(`/api/v1/emr/conditions/${conditionId}`, { method: "DELETE" }),
  addMedication: (patientId: string, data: any) =>
    apiRequest(`/api/v1/emr/patient/${patientId}/medications`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMedication: (medicationId: string) =>
    apiRequest(`/api/v1/emr/medications/${medicationId}`, { method: "DELETE" }),
  getAuditLogs: (patientId: string) =>
    apiRequest<{ status: string; audit_logs: any[] }>(`/api/v1/emr/patient/${patientId}/audit-logs`),
};

// Prescription API methods
export const prescriptionApi = {
  create: (data: any) =>
    apiRequest<{
      status: string;
      prescription_id: string;
      prescription_number: string;
      prescription_status: string;
    }>("/api/v1/prescriptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDetail: (prescriptionId: string) =>
    apiRequest<{
      status: string;
      prescription: any;
      items: any[];
    }>(`/api/v1/prescriptions/${prescriptionId}`),
  update: (prescriptionId: string, data: any) =>
    apiRequest(`/api/v1/prescriptions/${prescriptionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  finalize: (prescriptionId: string) =>
    apiRequest(`/api/v1/prescriptions/${prescriptionId}/finalize`, {
      method: "POST",
    }),
  listForPatient: (patientId: string) =>
    apiRequest<{ status: string; prescriptions: any[] }>(`/api/v1/prescriptions/patient/${patientId}`),
  listMy: () =>
    apiRequest<{ status: string; prescriptions: any[] }>("/api/v1/prescriptions/my/list"),
  downloadPdfUrl: (prescriptionId: string) => {
    const token = getStoredToken();
    return `${API_BASE_URL}/api/v1/prescriptions/${prescriptionId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
};

// Medical Document API methods
export const medicalDocumentApi = {
  upload: async (formData: FormData) => {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/v1/medical-documents/upload`, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    return data;
  },
  listForPatient: (patientId: string, params?: { search?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{ status: string; documents: any[] }>(
      `/api/v1/medical-documents/patient/${patientId}${query ? `?${query}` : ""}`
    );
  },
  listMy: (params?: { search?: string; category?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{ status: string; documents: any[] }>(
      `/api/v1/medical-documents/my${query ? `?${query}` : ""}`
    );
  },
  getDownloadUrl: (docId: string) => {
    const token = getStoredToken();
    return `${API_BASE_URL}/api/v1/medical-documents/${docId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  getViewUrl: (docId: string) => {
    const token = getStoredToken();
    return `${API_BASE_URL}/api/v1/medical-documents/${docId}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },
  delete: (docId: string) =>
    apiRequest(`/api/v1/medical-documents/${docId}`, { method: "DELETE" }),
};

// Clinical Timeline API methods
export const timelineApi = {
  getPatientTimeline: (patientId: string, params?: { limit?: number; offset?: number; event_type?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{
      status: string;
      total_count: number;
      events: any[];
    }>(`/api/v1/timeline/patient/${patientId}${query ? `?${query}` : ""}`);
  },
  getMyTimeline: (params?: { limit?: number; offset?: number; event_type?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return apiRequest<{
      status: string;
      total_count: number;
      events: any[];
    }>(`/api/v1/timeline/my${query ? `?${query}` : ""}`);
  },
};
