import { useCallback, useState } from 'react';
import { RouterProvider, useRouter } from '@/lib/router';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ThemeToggle } from '@/components/ThemeToggle';

// Auth Pages
import { LoginPage } from '@/components/auth/LoginPage';
import { RegisterChoicePage } from '@/components/auth/RegisterChoicePage';
import { DoctorRegisterPage } from '@/components/auth/DoctorRegisterPage';
import { PatientRegisterPage } from '@/components/auth/PatientRegisterPage';
import { ForgotPasswordPage } from '@/components/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/components/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/components/auth/VerifyEmailPage';

// Dashboards
import { DoctorDashboard } from '@/components/dashboard/DoctorDashboard';
import { PatientDashboard } from '@/components/dashboard/PatientDashboard';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';

// Existing Platform Visualizer Components
import { LandingPageRefresh } from '@/components/LandingPageRefresh';
import { ResultsPage } from '@/components/ResultsPage';
import { SAMPLES } from '@/data/samples';
import type { SampleLesion, PatientMetadata } from '@/types';

type View = 'landing' | 'results';

const INITIAL_PATIENT_METADATA: PatientMetadata = {
  age: '',
  gender: '',
  anatomicalSite: '',
  fitzpatrickSkinType: '',
  isElevated: false,
  hasItching: false,
  hasBleeding: false,
  hasChangedRecently: false,
  durationMonths: '',
};

function AppContent() {
  const { path } = useRouter();

  // Preserved State for Public Screening & Demo Mode
  const [view, setView] = useState<View>('landing');
  const [activeSample, setActiveSample] = useState<SampleLesion>(SAMPLES[0]);
  const [scanId, setScanId] = useState('PRK-89214');
  const [patientMeta, setPatientMeta] = useState<PatientMetadata>(INITIAL_PATIENT_METADATA);

  const handleViewDemo = useCallback(() => {
    setActiveSample(SAMPLES[0]);
    setScanId(generateScanId());
    setView('results');
  }, []);

  const handleBackHome = useCallback(() => {
    setView('landing');
  }, []);

  // Public Auth Routes
  if (path === '/login') {
    return <LoginPage />;
  }

  if (path === '/register') {
    return <RegisterChoicePage />;
  }

  if (path === '/register/doctor') {
    return <DoctorRegisterPage />;
  }

  if (path === '/register/patient') {
    return <PatientRegisterPage />;
  }

  if (path === '/forgot-password') {
    return <ForgotPasswordPage />;
  }

  if (path === '/reset-password') {
    return <ResetPasswordPage />;
  }

  if (path === '/verify-email') {
    return <VerifyEmailPage />;
  }

  // Doctor Protected Routes
  if (path.startsWith('/doctor')) {
    return (
      <ProtectedRoute allowedRoles={['doctor']}>
        <DoctorDashboard />
      </ProtectedRoute>
    );
  }

  // Patient Protected Routes
  if (path.startsWith('/patient')) {
    return (
      <ProtectedRoute allowedRoles={['patient']}>
        <PatientDashboard />
      </ProtectedRoute>
    );
  }

  // Admin Protected Routes
  if (path.startsWith('/admin')) {
    return (
      <ProtectedRoute allowedRoles={['admin']}>
        <AdminDashboard />
      </ProtectedRoute>
    );
  }

  // Default: Public Portal & AI Scanner (Preserves original app)
  return (
    <div className="parakh-app min-h-screen">
      {view === 'landing' && (
        <LandingPageRefresh onViewDemo={handleViewDemo} />
      )}

      {view === 'results' && (
        <ResultsPage
          sample={activeSample}
          scanId={scanId}
          patientMeta={patientMeta}
          onUpdatePatientMeta={setPatientMeta}
          onBackHome={handleBackHome}
        />
      )}
    </div>
  );
}

function generateScanId(): string {
  const num = Math.floor(10000 + Math.random() * 89999);
  return `PRK-${num}`;
}

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </RouterProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}
