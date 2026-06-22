import { Link, useNavigate } from "react-router-dom";

function NavigationBar({ user, onLogout }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await onLogout();
    navigate("/");
  }

  return (
    <header className="topbar">
      <Link className="brand" to="/">
        Last Race
      </Link>
      <nav aria-label="Main navigation">
        <Link to="/">How to play</Link>
        {user ? (
          <>
            <Link to="/setup">Network</Link>
            <Link to="/ranking">Ranking</Link>
            <button className="link-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <Link className="login-link" to="/login">
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}

export default NavigationBar;
