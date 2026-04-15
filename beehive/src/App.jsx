import { Routes, Route, Navigate } from "react-router-dom";
import HiveDashboard from "./pages/HiveDashboard";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import HiveOverview from "./pages/HiveOverview";
import AdminOverview from "./pages/AdminOverview";
import AlertsPage from "./pages/AlertsPage";
import DatabasePage from "./pages/DatabasePage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/login" element={<Login />} />

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