import { Link } from "react-router-dom";

function InstructionsPage({ user }) {
  return (
    <section className="hero-page">
      <div className="eyebrow">A metro strategy game</div>
      <h1>Catch the last train.</h1>
      <p className="lead">
        Travel across connected metro stations, react to unexpected events,
        and reach your destination with as many coins as possible.
      </p>

      <div className="rules-grid">
        <article>
          <span>01</span>
          <h2>Choose your route</h2>
          <p>Move only between stations connected by a metro segment.</p>
        </article>
        <article>
          <span>02</span>
          <h2>Manage your coins</h2>
          <p>Every move and random event can change your final score.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Reach the destination</h2>
          <p>Complete the journey and record your result in the rankings.</p>
        </article>
      </div>

      {user ? (
        <Link className="primary-action" to="/setup">
          Continue as {user.username}
        </Link>
      ) : (
        <div className="guest-notice">
          <p>Log in to access the game, metro map, and rankings.</p>
          <Link className="primary-action" to="/login">
            Log in to play
          </Link>
        </div>
      )}
    </section>
  );
}

export default InstructionsPage;
