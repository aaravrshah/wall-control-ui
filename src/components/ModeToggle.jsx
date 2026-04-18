import { useExperiment } from '../context/ExperimentContext';

export default function ModeToggle() {
  const { currentExperiment, setMode } = useExperiment();
  const advanced = currentExperiment.mode === 'advanced';

  return (
    <button className={`mode-toggle ${advanced ? 'advanced' : ''}`} onClick={() => setMode(advanced ? 'simple' : 'advanced')}>
      {advanced ? 'Switch to Simple Mode' : 'Switch to Advanced Mode'}
    </button>
  );
}
