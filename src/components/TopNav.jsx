import { NavLink } from 'react-router-dom';
import ModeToggle from './ModeToggle';
import { useExperiment } from '../context/ExperimentContext';

const simpleLinks = [
  { to: '/', label: 'Home' },
  { to: '/setup', label: 'Experiment Setup' },
  { to: '/run', label: 'Run' },
];

const advancedLinks = [
  { to: '/pattern-editor', label: 'Pattern Editor' },
  { to: '/sequencer', label: 'Sequencer' },
  { to: '/diagnostics', label: 'Diagnostics' },
];

export default function TopNav() {
  const { currentExperiment } = useExperiment();
  const links = currentExperiment.mode === 'advanced' ? [...simpleLinks, ...advancedLinks] : simpleLinks;

  return (
    <header className="top-nav">
      <div>
        <p className="eyebrow">Oscillatory Flume Research Interface</p>
        <h1>Programmable Deformable Wall</h1>
      </div>
      <nav>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <ModeToggle />
    </header>
  );
}
