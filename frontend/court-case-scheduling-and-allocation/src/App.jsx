import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './viewpages/LoginPage';
import RegisterPage from './viewpages/RegisterPage';
import TwoFactorPage from './viewpages/TwoFactorPage';
import LitigantDashboard from './viewpages/Lit,Adv';
import LitAdvCases from './viewpages/LitAdvCases';
import LitAdvSchedule from './viewpages/LitAdvSchedule';
import LitAdvDocument from './viewpages/LitAdvDocument';
import JudgeDashboard from './viewpages/Judge';
import JudgeCaseTab from './viewpages/JudgeCaseTab';
import JudgeSchedule from './viewpages/JudgeSchedule';
import JudgeDocument from './viewpages/JudgeDocument';
import CourtAdminDashboard from './viewpages/Courtadmin';
import CourtadminCases from './viewpages/CourtadminCases';
import CourtadminSchedule from './viewpages/CourtadminSchedule';
import CourtadminDocuments from './viewpages/CourtadminDocuments';
import GlobalFooter from './components/GlobalFooter';
import { getDashboardPathForRole, getStoredAuthToken, getStoredAuthUser } from './utils/auth';

function RequireAuth({ children }) {
  const token = getStoredAuthToken();
  return token ? children : <Navigate to="/login" replace />;
}

function DashboardRedirect() {
  const user = getStoredAuthUser();
  return <Navigate to={getDashboardPathForRole(user?.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/2fa" element={<TwoFactorPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route
            path="/dashboard/litigant"
            element={(
              <RequireAuth>
                <LitigantDashboard />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/litigant/documents"
            element={(
              <RequireAuth>
                <LitAdvDocument />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/litigant/cases"
            element={(
              <RequireAuth>
                <LitAdvCases />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/litigant/schedule"
            element={(
              <RequireAuth>
                <LitAdvSchedule />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/judge"
            element={(
              <RequireAuth>
                <JudgeDashboard />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/judge/cases"
            element={(
              <RequireAuth>
                <JudgeCaseTab />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/judge/schedule"
            element={(
              <RequireAuth>
                <JudgeSchedule />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/judge/documents"
            element={(
              <RequireAuth>
                <JudgeDocument />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/admin"
            element={(
              <RequireAuth>
                <CourtAdminDashboard />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/admin/cases"
            element={(
              <RequireAuth>
                <CourtadminCases />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/admin/schedule"
            element={(
              <RequireAuth>
                <CourtadminSchedule />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard/admin/documents"
            element={(
              <RequireAuth>
                <CourtadminDocuments />
              </RequireAuth>
            )}
          />
        </Routes>
        </main>
        <GlobalFooter />
      </div>
    </BrowserRouter>
  );
}