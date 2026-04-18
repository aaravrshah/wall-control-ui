import { useMemo, useState } from 'react';

const clusters = ['Cluster A', 'Cluster B', 'Cluster C', 'Cluster D'];

export default function DiagnosticsPanel() {
  const [jogValue, setJogValue] = useState(0.5);
  const [selectedNode, setSelectedNode] = useState('R1-C1');

  const mockStats = useMemo(() => ({
    voltage: 24.2,
    current: 7.8,
    updateRate: 120,
    estop: 'Released',
    fault: 'No active faults',
    calibrationOffset: '+0.03 ± 0.01',
  }), []);

  return (
    <section className="panel">
      <p className="warning">Diagnostics shown below are simulated in this frontend prototype.</p>
      <div className="diag-grid">
        {clusters.map((cluster, index) => (
          <article key={cluster} className="status-card neutral">
            <p>{cluster}</p>
            <h3>{index === 2 ? 'Warning' : 'Nominal'}</h3>
          </article>
        ))}
      </div>
      <ul className="readouts">
        <li>Supply Voltage: {mockStats.voltage} V</li>
        <li>Supply Current: {mockStats.current} A</li>
        <li>Update Rate: {mockStats.updateRate} Hz</li>
        <li>Emergency Stop: {mockStats.estop}</li>
        <li>Fault Indicators: {mockStats.fault}</li>
        <li>Calibration Offsets: {mockStats.calibrationOffset}</li>
      </ul>
      <div className="jog-controls">
        <h4>Jog One Actuator (Simulation)</h4>
        <label>
          Node
          <input value={selectedNode} onChange={(event) => setSelectedNode(event.target.value)} />
        </label>
        <label>
          Target Height
          <input type="range" min={0} max={1} step={0.01} value={jogValue} onChange={(event) => setJogValue(Number(event.target.value))} />
        </label>
        <p>
          Simulated command: move <strong>{selectedNode}</strong> to <strong>{jogValue.toFixed(2)}</strong>.
        </p>
      </div>
    </section>
  );
}
