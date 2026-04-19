import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cloneExperiment, defaultExperiment, suggestedExperiments } from '../data/presets';

export default function ExperimentManagerModal({
  open,
  currentExperiment,
  savedExperiments,
  onClose,
  onLoadSaved,
  onDeleteSaved,
  onCreateNew,
}) {
  const [newMode, setNewMode] = useState(null);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h3>Experiment Manager</h3>
            <p>Choose the experiment to run, edit a saved one, or create a new experiment.</p>
          </div>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <section className="manager-section">
          <h4>Current Experiment</h4>
          <div className="saved-exp-card">
            <div>
              <strong>{currentExperiment.name}</strong>
              <p>{currentExperiment.id.startsWith('saved-') ? 'Saved experiment currently loaded' : 'Unsaved working experiment'}</p>
            </div>
            <div className="saved-actions">
              <Link to="/actuators" className="secondary-link" onClick={onClose}>Edit</Link>
            </div>
          </div>
        </section>

        <section className="manager-section">
          <div className="manager-row">
            <h4>Saved Experiments</h4>
            <button className="secondary" onClick={() => setNewMode((previous) => (previous ? null : 'chooser'))}>
              New Experiment
            </button>
          </div>

          {newMode === 'chooser' ? (
            <div className="callout subtle">
              <div className="saved-actions">
                <button
                  onClick={() => {
                    onCreateNew(cloneExperiment({ ...defaultExperiment, id: 'current-experiment', name: 'New Experiment' }));
                    setNewMode(null);
                  }}
                >
                  Start from Scratch
                </button>
                <button className="secondary" onClick={() => setNewMode('templates')}>
                  Use Template
                </button>
              </div>
            </div>
          ) : null}

          {newMode === 'templates' ? (
            <div className="template-grid">
              {suggestedExperiments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="pattern-card"
                  onClick={() => {
                    onCreateNew(cloneExperiment({ ...item.experiment, id: 'current-experiment', name: item.name }));
                    setNewMode(null);
                  }}
                >
                  <h3>{item.name}</h3>
                </button>
              ))}
            </div>
          ) : null}

          <div className="saved-experiment-list">
            {savedExperiments.length === 0 ? (
              <p className="muted-copy">No saved experiments yet.</p>
            ) : (
              savedExperiments.map((item) => (
                <article key={item.id} className="saved-exp-card">
                  <div>
                    <strong>{item.name}</strong>
                    <p>{new Date(item.savedAt).toLocaleString()}</p>
                  </div>
                  <div className="saved-actions">
                    <button className="secondary" onClick={() => onLoadSaved(item.id)}>Load</button>
                    <Link to="/actuators" className="secondary-link" onClick={() => onLoadSaved(item.id)}>Edit</Link>
                    <button className="danger" onClick={() => onDeleteSaved(item.id)}>Delete</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
