import WallGrid from './WallGrid';

export default function ExperimentPreview({ title = 'Wall Preview', grid, footer }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <WallGrid grid={grid} compact />
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}
