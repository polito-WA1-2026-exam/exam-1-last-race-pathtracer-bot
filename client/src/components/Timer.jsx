function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function Timer({ seconds }) {
  return (
    <div
      className={`countdown ${seconds <= 15 ? "urgent" : ""}`}
      aria-live="polite"
    >
      <span>Time left</span>
      <strong>{formatTime(seconds)}</strong>
    </div>
  );
}

export default Timer;
