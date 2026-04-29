import { clamp, cloneGrid } from './grid';

function interpolateValue(start, end, t, mode = 'linear') {
  if (mode === 'sine') {
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
    return start + (end - start) * eased;
  }
  return start + (end - start) * t;
}

export function getMotionForwardDuration(tracks) {
  return Math.max(
    1,
    ...(tracks ?? []).map((track) =>
      Math.max(0, ...(track.points ?? []).map((point) => point.timeSec)),
    ),
  );
}

export function getPingPongPlaybackTime(elapsedTime, forwardDuration) {
  const safeForwardDuration = Math.max(1, Number(forwardDuration) || 1);
  const fullLoopDuration = safeForwardDuration * 2;
  const loopElapsed = (Number(elapsedTime) || 0) % fullLoopDuration;

  return loopElapsed <= safeForwardDuration
    ? loopElapsed
    : fullLoopDuration - loopElapsed;
}

export function sampleTrackDisplacement(track, timeSec, maxDisplacementMm) {
  const points = [...(track.points ?? [])].sort((a, b) => a.timeSec - b.timeSec);
  if (points.length === 0) {
    return null;
  }
  if (timeSec <= points[0].timeSec) {
    return clamp(points[0].displacement, 0, maxDisplacementMm);
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (timeSec <= next.timeSec) {
      const span = Math.max(0.001, next.timeSec - current.timeSec);
      const t = (timeSec - current.timeSec) / span;
      return clamp(
        interpolateValue(current.displacement, next.displacement, t, current.interpolationToNext),
        0,
        maxDisplacementMm,
      );
    }
  }
  return clamp(points[points.length - 1].displacement, 0, maxDisplacementMm);
}

export function applyMotionTracks(baseGrid, tracks, timeSec, maxDisplacementMm) {
  const next = cloneGrid(baseGrid);
  (tracks ?? []).forEach((track) => {
    const displacement = sampleTrackDisplacement(track, timeSec, maxDisplacementMm);
    if (displacement === null) {
      return;
    }
    (track.targetCellKeys ?? []).forEach((key) => {
      const [row, col] = key.split('-').map(Number);
      if (Number.isInteger(row) && Number.isInteger(col) && next[row]?.[col] !== undefined) {
        next[row][col] = clamp(displacement, 0, maxDisplacementMm);
      }
    });
  });
  return next;
}
