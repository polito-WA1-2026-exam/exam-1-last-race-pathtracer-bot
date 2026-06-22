import { useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import { getCurrentUser, login, logout } from "./api.js";
import NavigationBar from "./components/NavigationBar.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ExecutionPage from "./pages/ExecutionPage.jsx";
import InstructionsPage from "./pages/InstructionsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PlanningPage from "./pages/PlanningPage.jsx";
import RankingPage from "./pages/RankingPage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import SetupPage from "./pages/SetupPage.jsx";
import "./App.css";

function Layout({ user, onLogout }) {
  return (
    <div className="app-shell">
      <NavigationBar user={user} onLogout={onLogout} />
      <main>
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(credentials) {
    const authenticatedUser = await login(credentials);
    setUser(authenticatedUser);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  if (loading) {
    return <div className="loading-page">Loading Last Race...</div>;
  }

  return (
    <Routes>
      <Route element={<Layout user={user} onLogout={handleLogout} />}>
        <Route index element={<InstructionsPage user={user} />} />
        <Route
          path="login"
          element={<LoginPage user={user} onLogin={handleLogin} />}
        />
        <Route
          path="setup"
          element={
            <ProtectedRoute user={user}>
              <SetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="game/:gameId/planning"
          element={
            <ProtectedRoute user={user}>
              <PlanningPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="game/:gameId/execution"
          element={
            <ProtectedRoute user={user}>
              <ExecutionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="game/:gameId/result"
          element={
            <ProtectedRoute user={user}>
              <ResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="ranking"
          element={
            <ProtectedRoute user={user}>
              <RankingPage />
            </ProtectedRoute>
          }
        />
        <Route path="game" element={<Navigate to="/setup" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
