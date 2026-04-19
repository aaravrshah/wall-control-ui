export default function NumericControl({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.1,
  onChange,
  decimals = 2,
}) {
  return (
    <label className="numeric-control">
      <div className="numeric-head">
        <span>{label}</span>
        <strong>{Number(value).toFixed(decimals)}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
