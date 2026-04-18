import { Link, useNavigate } from 'react-router-dom';
import SectionHeader from '../components/SectionHeader';
import StatusCard from '../components/StatusCard';
import { useExperiment } from '../context/ExperimentContext';

export default function Home() {
  const navigate = useNavigate();
  const { savedExperiments, loadSavedExperiment, currentExperiment } = useExperiment();

  return (
    <div className="page-stack">
      <SectionHeader
        title="Instrument Overview"
        subtitle="Prototype operator console for a 4 × 16 programmable deformable wall in an oscillatory flume."
      />

      <section className="status-grid">
        <StatusCard label="Controller Link" value="Connected (Mock)" tone="ok" />
        <StatusCard label="Actuator Power" value="Enabled (Mock)" tone="ok" />
        <StatusCard label="Experiment Ready" value="Ready" tone="ok" />
        <StatusCard label="Fault Status" value="No Faults" tone="neutral" />
      </section>

      <section className="panel action-row">
        <Link to="/setup" className="primary-link">Go to Experiment Setup</Link>
        <button className="secondary" onClick={() => navigate('/run')}>Run Last Experiment</button>
        <p className="muted">Current mode: <strong>{currentExperiment.mode}</strong></p>
      </section>

      <section className="panel">
        <h3>Recent Saved Experiments</h3>
        <ul className="saved-list">
          {savedExperiments.slice(0, 5).map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>{item.selectedPreset} · {new Date(item.savedAt).toLocaleString()}</small>
              </div>
              <button className="secondary" onClick={() => loadSavedExperiment(item.id)}>Load</button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
