import { NavLink } from 'react-router-dom';
import { useExperiment } from '../context/ExperimentContext';
import { createEmptyGrid } from '../utils/grid';

const links = [
  { to: '/', label: 'Main Control' },
  { to: '/actuators', label: 'Actuator Editor' },
];

export default function TopNav() {
  const {
    currentExperiment,
    hardwareState,
    connectHardware,
    disconnectHardware,
    sendGridToHardware,
    sendPatternCommand,
  } = useExperiment();
  const connected = hardwareState.status === 'connected';

  const pulseRow = async (rowIndex) => {
    if (!connected) return;
    const grid = createEmptyGrid(0);
    for (let col = 0; col < 16; col += 1) {
      grid[rowIndex][col] = currentExperiment.maxDisplacementMm;
    }

    await sendGridToHardware(grid);
    window.setTimeout(() => sendPatternCommand('flat'), 450);
  };

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
        <span className={`status-pill ${connected ? 'online' : 'neutral'}`}>
          {connected ? 'Arduino Connected' : 'Arduino Offline'}
        </span>
        <details className="arduino-menu">
          <summary className="status-pill neutral">Arduino</summary>
          <div className="arduino-menu-card">
            {!hardwareState.supported ? (
              <p className="warning">Web Serial requires Chrome/Edge on localhost or HTTPS.</p>
            ) : null}
            {hardwareState.error ? <p className="warning">{hardwareState.error}</p> : null}

            <div className="saved-actions">
              <button
                onClick={connectHardware}
                disabled={!hardwareState.supported || hardwareState.status === 'connecting' || connected}
              >
                {hardwareState.status === 'connecting' ? 'Connecting...' : 'Connect'}
              </button>
              <button className="secondary" onClick={disconnectHardware} disabled={!connected}>
                Disconnect
              </button>
            </div>

            <div className="saved-actions">
              <button className="secondary" onClick={() => sendPatternCommand('flat')} disabled={!connected}>Flat</button>
              <button className="secondary" onClick={() => sendPatternCommand('sine')} disabled={!connected}>Sine</button>
              <button className="secondary" onClick={() => sendPatternCommand('diag')} disabled={!connected}>Diagonal</button>
              <button className="secondary" onClick={() => sendPatternCommand('uiuc')} disabled={!connected}>UIUC</button>
            </div>

            <div className="saved-actions">
              <button className="secondary" onClick={() => pulseRow(0)} disabled={!connected}>Test Row 1</button>
              <button className="secondary" onClick={() => pulseRow(1)} disabled={!connected}>Test Row 2</button>
              <button className="secondary" onClick={() => pulseRow(2)} disabled={!connected}>Test Row 3</button>
              <button className="secondary" onClick={() => pulseRow(3)} disabled={!connected}>Test Row 4</button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
