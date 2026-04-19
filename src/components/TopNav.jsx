import { NavLink } from 'react-router-dom';
import { useExperiment } from '../context/ExperimentContext';

const links = [
  { to: '/', label: 'Main Control' },
  { to: '/actuators', label: 'Actuator Editor' },
];

export default function TopNav() {
  const { currentExperiment } = useExperiment();

  return (
    <header className="top-nav">
      <div className="brand-block">
        <p className="eyebrow">Oscillatory Flume Control</p>
        <h1>Programmable Deformable Wall</h1>
        <p className="brand-copy">4 x 16 actuator control for displacement, oscillation, and timeline runs</p>
      </div>
      <nav>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="nav-status">
        <span className="status-pill neutral">{currentExperiment.name}</span>
      </div>
    </header>
  );
}
