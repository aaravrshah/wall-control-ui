import WallGrid from './WallGrid';

export default function KeyframeList({ keyframes, selectedId, onSelect, onDelete, onDuplicate, onDurationChange }) {
  return (
    <div className="keyframe-list">
      {keyframes.map((keyframe, index) => (
        <article key={keyframe.id} className={`keyframe-card ${selectedId === keyframe.id ? 'active' : ''}`}>
          <header>
            <h4>{index + 1}. {keyframe.label}</h4>
            <button className="secondary" onClick={() => onSelect(keyframe.id)}>Select</button>
          </header>
          <WallGrid grid={keyframe.grid} compact />
          <label>
            Duration (s)
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={keyframe.duration}
              onChange={(event) => onDurationChange(keyframe.id, Number(event.target.value))}
            />
          </label>
          <div className="saved-actions">
            <button className="secondary" onClick={() => onDuplicate(keyframe.id)}>Duplicate</button>
            <button className="danger" onClick={() => onDelete(keyframe.id)}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}
