import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LoginPage from './views/LoginPage';
import DashboardPage from './views/DashboardPage';
import LeaguesPage from './views/LeaguesPage';
import LeagueDetailPage from './views/LeagueDetailPage';
import StandingsPage from './views/StandingsPage';
import PredictionsPage from './views/PredictionsPage';
import AdminPage from './views/AdminPage';
import SuperAdminPage from './views/SuperAdminPage';
import ProfilePage from './views/ProfilePage';
import LeagueManagePage from './views/LeagueManagePage';
import ClaimGuestPage from './views/ClaimGuestPage';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
      />
      <Route 
        path="/register" 
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage initialMode="register" />} 
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leagues"
        element={
          <ProtectedRoute>
            <LeaguesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leagues/:leagueId"
        element={
          <ProtectedRoute>
            <LeagueDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leagues/:leagueId/standings"
        element={
          <ProtectedRoute>
            <StandingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leagues/:leagueId/manage"
        element={
          <ProtectedRoute>
            <LeagueManagePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leagues/:leagueId/matchdays/:matchdayId"
        element={
          <ProtectedRoute>
            <PredictionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute requireSuperAdmin>
            <SuperAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claim-guest"
        element={
          <ProtectedRoute>
            <ClaimGuestPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
