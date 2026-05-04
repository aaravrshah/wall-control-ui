import { Link } from 'react-router-dom';
import { blankExperiment, cloneExperiment, suggestedExperiments } from '../data/presets';

export default function ExperimentManagerModal({
  open,
  currentExperiment,
  onClose,
  onCreateNew,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row">
          <div>
            <h3>New Experiment</h3>
            <p>Start from scratch or load a template.</p>
          </div>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <section className="manager-section">
          <h4>Current Experiment</h4>
          <div className="saved-exp-card">
            <div>
              <strong>{currentExperiment.name}</strong>
              <p>Current working experiment</p>
            </div>
            <div className="saved-actions">
              <Link to="/actuators" className="secondary-link" onClick={onClose}>Edit</Link>
            </div>
          </div>
        </section>

        <section className="manager-section">
          <div className="manager-row">
            <h4>Templates</h4>
            <button
              onClick={() => {
                onCreateNew(cloneExperiment({ ...blankExperiment, id: 'current-experiment', name: 'New Experiment' }));
              }}
            >
              Start from Scratch
            </button>
          </div>

          <div className="template-grid">
            {suggestedExperiments.map((item) => (
              <button
                key={item.id}
                type="button"
                className="pattern-card"
                onClick={() => {
                  onCreateNew(cloneExperiment({ ...item.experiment, id: 'current-experiment', name: item.name }));
                }}
              >
                <h3>{item.name}</h3>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
