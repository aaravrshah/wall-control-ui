import { Navigate } from 'react-router-dom';
import DiagnosticsPanel from '../components/DiagnosticsPanel';
import SectionHeader from '../components/SectionHeader';
import { useExperiment } from '../context/ExperimentContext';

export default function Diagnostics() {
  const { currentExperiment } = useExperiment();

  if (currentExperiment.mode !== 'advanced') return <Navigate to="/" replace />;

  return (
    <div className="page-stack">
      <SectionHeader
        title="Diagnostics"
        subtitle="Advanced monitoring and actuator-level checks. All values are simulated in this prototype build."
      />
      <DiagnosticsPanel />
    </div>
  );
}
