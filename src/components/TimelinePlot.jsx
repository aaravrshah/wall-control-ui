function buildSegmentPath(start, end, mode) {
  if (mode === 'sine') {
    const dx = end.x - start.x;
    return `M ${start.x} ${start.y} C ${start.x + dx * 0.35} ${start.y}, ${start.x + dx * 0.65} ${end.y}, ${end.x} ${end.y}`;
  }
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

export default function TimelinePlot({
  points,
  selectedId,
  onSelect,
  onPointDrag,
  onAddPoint,
  onToggleSegment,
  width = 560,
  height = 240,
  maxTime = 20,
  maxDisplacement = 7,
  readOnly = false,
  showPointHandles = true,
}) {
  const pad = { top: 16, right: 16, bottom: 32, left: 42 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;

  const xForTime = (time) => pad.left + (time / Math.max(0.001, maxTime)) * innerWidth;
  const yForDisp = (disp) => pad.top + innerHeight - (disp / Math.max(0.001, maxDisplacement)) * innerHeight;
  const timeForX = (x) => ((x - pad.left) / Math.max(0.001, innerWidth)) * maxTime;
  const dispForY = (y) => ((pad.top + innerHeight - y) / Math.max(0.001, innerHeight)) * maxDisplacement;

  const sorted = [...points].sort((a, b) => a.timeSec - b.timeSec);
  const plotted = sorted.map((point) => ({
    ...point,
    x: xForTime(point.timeSec),
    y: yForDisp(point.displacement),
  }));

  const handleSvgDoubleClick = (event) => {
    if (readOnly) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width;
    const svgY = ((event.clientY - bounds.top) / bounds.height) * height;
    const timeSec = Math.max(0, Math.min(maxTime, Number(timeForX(svgX).toFixed(2))));
    const displacement = Math.max(0, Math.min(maxDisplacement, Number(dispForY(svgY).toFixed(2))));
    onAddPoint?.(timeSec, displacement);
  };

  const startDrag = (pointId, event) => {
    if (readOnly) return;
    event.preventDefault();
    const svg = event.currentTarget.ownerSVGElement;
    const bounds = svg.getBoundingClientRect();

    const move = (moveEvent) => {
      const svgX = ((moveEvent.clientX - bounds.left) / bounds.width) * width;
      const svgY = ((moveEvent.clientY - bounds.top) / bounds.height) * height;
      const timeSec = Math.max(0, Math.min(maxTime, Number(timeForX(svgX).toFixed(2))));
      const displacement = Math.max(0, Math.min(maxDisplacement, Number(dispForY(svgY).toFixed(2))));
      onPointDrag?.(pointId, timeSec, displacement);
    };

    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  return (
    <svg
      className="timeline-plot"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Interactive time versus displacement plot"
      onDoubleClick={handleSvgDoubleClick}
    >
      <rect x="0" y="0" width={width} height={height} rx="18" className="timeline-bg" />
      {[0, 1, 2, 3, 4].map((step) => {
        const y = pad.top + (innerHeight / 4) * step;
        return <line key={`y-${step}`} x1={pad.left} y1={y} x2={width - pad.right} y2={y} className="timeline-grid-line" />;
      })}
      {[0, 1, 2, 3, 4].map((step) => {
        const x = pad.left + (innerWidth / 4) * step;
        return <line key={`x-${step}`} x1={x} y1={pad.top} x2={x} y2={height - pad.bottom} className="timeline-grid-line" />;
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={height - pad.bottom} className="timeline-axis" />
      <line x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} className="timeline-axis" />

      {plotted.slice(0, -1).map((point, index) => {
        const next = plotted[index + 1];
        const mode = point.interpolationToNext ?? 'linear';
        return (
          <path
            key={`${point.id}-${next.id}`}
            d={buildSegmentPath(point, next, mode)}
            className={`timeline-line ${mode}`}
            onClick={() => !readOnly && onToggleSegment?.(point.id)}
          />
        );
      })}

      {showPointHandles ? plotted.map((point) => (
        <g key={point.id}>
          <circle
            cx={point.x}
            cy={point.y}
            r={selectedId === point.id ? 7 : 5}
            className={`timeline-point ${selectedId === point.id ? 'active' : ''}`}
            onPointerDown={(event) => startDrag(point.id, event)}
            onClick={() => !readOnly && onSelect(point.id)}
          />
        </g>
      )) : null}

      <text x={12} y={18} className="timeline-label">mm</text>
      <text x={width - 22} y={height - 10} className="timeline-label">s</text>
    </svg>
  );
}
