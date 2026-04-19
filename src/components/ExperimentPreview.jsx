import WallGrid from './WallGrid';

export default function ExperimentPreview({ title = 'Wall Preview', grid, footer, maxValue = 7 }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <WallGrid grid={grid} compact maxValue={maxValue} formatValue={(value) => `${value.toFixed(1)}`} />
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}
