// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage            from './pages/AuthPage';
import StudentDashboard    from './pages/StudentDashboard';
import ClientDashboard     from './pages/ClientDashboard';
import CompleteProfilePage from './pages/CompleteProfilePage';
import StudentProfilePage  from './pages/Studentprofilepage';
import LeaderboardPage     from './pages/LeaderboardPage';
import ChatPage            from './pages/ChatPage';
import AdminPanel          from './pages/AdminPanel';
import BillingPage         from './pages/BillingPage';
import CheckoutPage        from './pages/CheckoutPage';

// ── loading screen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #222', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── protected route ───────────────────────────────────────────────────────────
function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/auth" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/dashboard" replace />;
  return children;
}

// ── public route — redirects logged-in users away from /auth ─────────────────
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user)    return <Navigate to="/dashboard" replace />;
  return children;
}

// ── dashboard router — picks correct dashboard by role ────────────────────────
function DashboardRouter() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user)   return <Navigate to="/auth" replace />;

  if (user.role === 'student') return <StudentDashboard />;
  if (user.role === 'client')  return <ClientDashboard />;

  if (user.role === 'admin') return <AdminPanel />;

  return <Navigate to="/auth" replace />;
}

// ── app ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* public — redirect to dashboard if already logged in */}
          <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

          {/* google new user profile completion */}
          <Route path="/complete-profile" element={<CompleteProfilePage />} />

          {/* role-aware dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardRouter /></ProtectedRoute>
          } />

          {/* student profile edit */}
          <Route path="/profile/edit" element={
            <ProtectedRoute allowedRole="student"><StudentProfilePage /></ProtectedRoute>
          } />

          {/* leaderboard — accessible to all logged-in users */}
          <Route path="/leaderboard" element={
            <ProtectedRoute><LeaderboardPage /></ProtectedRoute>
          } />

          <Route path="/messages" element={
            <ProtectedRoute><ChatPage /></ProtectedRoute>
          } />

          <Route path="/billing" element={
            <ProtectedRoute><BillingPage /></ProtectedRoute>
          } />

          <Route path="/payment/checkout/:planId" element={
            <ProtectedRoute><CheckoutPage /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute allowedRole="admin"><AdminPanel /></ProtectedRoute>
          } />

          {/* catch-all → dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
