import { Navigate, useLocation, useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm.jsx";

function LoginPage({ user, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (user) {
    return <Navigate to="/setup" replace />;
  }

  async function handleLogin(credentials) {
    await onLogin(credentials);
    navigate(location.state?.from ?? "/setup", { replace: true });
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div>
          <div className="eyebrow">Registered players</div>
          <h1>Welcome back.</h1>
          <p>Sign in to continue your journey through the metro network.</p>
        </div>

        <LoginForm onSubmit={handleLogin} />

        <p className="demo-credentials">
          Demo: <strong>alice</strong> / <strong>AliceRace!1</strong>
        </p>
      </div>
    </section>
  );
}

export default LoginPage;
