import { useState } from 'react';
import { useExperiment } from '../context/ExperimentContext';
import EmptyState from './EmptyState';

export default function SaveLoadPanel({ title = 'Save / Load' }) {
  const { savedExperiments, saveCurrentExperiment, loadSavedExperiment, deleteSavedExperiment } = useExperiment();
  const [name, setName] = useState('');

  return (
    <div className="save-load-panel">
      {title ? <h3>{title}</h3> : null}
      <div className="save-row">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Experiment name" />
        <button
          className="secondary"
          onClick={() => {
            saveCurrentExperiment(name.trim());
            setName('');
          }}
        >
          Save Current
        </button>
      </div>
      {savedExperiments.length === 0 ? (
        <EmptyState title="No saved experiments" description="Save your current setup to reuse it later." />
      ) : (
        <ul className="saved-list">
          {savedExperiments.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>{new Date(item.savedAt).toLocaleString()}</small>
              </div>
              <div className="saved-actions">
                <button className="secondary" onClick={() => loadSavedExperiment(item.id)}>Load</button>
                <button className="danger" onClick={() => deleteSavedExperiment(item.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
