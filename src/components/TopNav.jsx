import { NavLink } from 'react-router-dom';
import { useExperiment } from '../context/ExperimentContext';
import { getPhysicalServoIndex } from '../utils/hardware';

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
    sendServoCommand,
    updateHardwareConfig,
  } = useExperiment();
  const connected = hardwareState.status === 'connected';

  const pulseRow = async (rowIndex, highAngle = 120, lowAngle = 90) => {
    if (!connected) return;
    const baseChannel = hardwareState.config.channelStart ?? 0;

    for (let col = 0; col < 16; col += 1) {
      const channel = baseChannel + getPhysicalServoIndex(rowIndex, col);
      // eslint-disable-next-line no-await-in-loop
      await sendServoCommand(channel, highAngle);
    }

    window.setTimeout(async () => {
      for (let col = 0; col < 16; col += 1) {
        const channel = baseChannel + getPhysicalServoIndex(rowIndex, col);
        // eslint-disable-next-line no-await-in-loop
        await sendServoCommand(channel, lowAngle);
      }
    }, 450);
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

            <label>
              Channel Start
              <input
                type="number"
                min={0}
                max={63}
                step={1}
                value={hardwareState.config.channelStart}
                onChange={(event) =>
                  updateHardwareConfig({ channelStart: Math.max(0, Math.min(63, Number(event.target.value) || 0)) })
                }
                disabled={!hardwareState.supported}
              />
            </label>

            <div className="saved-actions">
              <button className="secondary" onClick={() => pulseRow(0)} disabled={!connected}>Test Row 1</button>
              <button className="secondary" onClick={() => pulseRow(1)} disabled={!connected}>Test Row 2</button>
              <button className="secondary" onClick={() => pulseRow(2)} disabled={!connected}>Test Row 3</button>
              <button className="secondary" onClick={() => pulseRow(3)} disabled={!connected}>Test Row 4</button>
            </div>

            <div className="saved-actions">
              <button
                className="secondary"
                onClick={() => Promise.all(Array.from({ length: 64 }, (_, channel) => sendServoCommand((hardwareState.config.channelStart ?? 0) + channel, 90)))}
                disabled={!connected}
              >
                Send All to 90
              </button>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
