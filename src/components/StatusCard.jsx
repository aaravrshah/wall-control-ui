export default function StatusCard({ label, value, tone = 'neutral' }) {
  return (
    <article className={`status-card ${tone}`}>
      <p>{label}</p>
      <h3>{value}</h3>
    </article>
  );
}
