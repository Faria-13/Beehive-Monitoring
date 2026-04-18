import { Routes, Route, Navigate } from "react-router-dom";
import HiveDashboard from "./pages/HiveDashboard";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import HiveOverview from "./pages/HiveOverview";
import AdminOverview from "./pages/AdminOverview";
import AlertsPage from "./pages/AlertsPage";
import DatabasePage from "./pages/DatabasePage";
import SettingsPage from "./pages/SettingsPage";
import RequestAccess from "./pages/RequestAccess";
import SignupSubmitted from "./pages/SignupSubmitted";
import AccountPending from "./pages/AccountPending";
import AccountReady from "./pages/AccountReady";
import AdminPendingRequests from "./pages/AdminPendingRequests";
import AdminRequestReview from "./pages/AdminRequestReview";
import AdminDatabasePage from "./pages/AdminDatabasePage";
import AdminAlertsPage from "./pages/AdminAlertsPage";
import AdminHiveDashboard from "./pages/AdminHiveDashboard";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/request-access" element={<RequestAccess />} />
        <Route path="/signup-submitted" element={<SignupSubmitted />} />
        <Route path="/account-pending" element={<AccountPending />} />
        <Route path="/account-ready" element={<AccountReady />} />

        <Route
          path="/hives"
          element={
            <ProtectedRoute>
              <HiveOverview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminOverview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/requests"
          element={
            <ProtectedRoute>
              <AdminPendingRequests />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/requests/:requestId"
          element={
            <ProtectedRoute>
              <AdminRequestReview />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/database"
          element={
            <ProtectedRoute>
              <AdminDatabasePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute>
              <AdminAlertsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/hives/:hiveId"
          element={
            <ProtectedRoute>
              <AdminHiveDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/hives/:hiveId"
          element={
            <ProtectedRoute>
              <HiveDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <AlertsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/database"
          element={
            <ProtectedRoute>
              <DatabasePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/hives" replace />} />
      </Routes>
    </div>
  );
}

export default App;
