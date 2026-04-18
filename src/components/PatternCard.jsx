export default function PatternCard({ pattern, active, onSelect }) {
  return (
    <button className={`pattern-card ${active ? 'active' : ''}`} onClick={() => onSelect(pattern.key)}>
      <h3>{pattern.name}</h3>
      <p>{pattern.description}</p>
    </button>
  );
}
