import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import Diagnostics from './pages/Diagnostics';
import ExperimentSetup from './pages/ExperimentSetup';
import Home from './pages/Home';
import PatternEditor from './pages/PatternEditor';
import Run from './pages/Run';
import Sequencer from './pages/Sequencer';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<ExperimentSetup />} />
        <Route path="/run" element={<Run />} />
        <Route path="/pattern-editor" element={<PatternEditor />} />
        <Route path="/sequencer" element={<Sequencer />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
