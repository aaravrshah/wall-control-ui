import { clamp, cloneGrid } from './grid';

export const DEFAULT_WAVE_SETTINGS = {
  baselineMm: 0,
  amplitudeMm: 4,
  frequencyHz: 0.5,
  phaseLagDegrees: 0,
  cycles: 0,
};

function interpolateValue(start, end, t, mode = 'linear') {
  if (mode === 'sine') {
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
    return start + (end - start) * eased;
  }
  return start + (end - start) * t;
}

function numberOrDefault(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveWave(radians) {
  return 0.5 * (Math.sin(radians) + 1);
}

export function getTrackMode(track) {
  return track?.mode === 'wave' ? 'wave' : 'points';
}

export function normalizeWaveSettings(wave = {}, maxDisplacementMm = 7) {
  const safeMax = Math.max(0.1, numberOrDefault(maxDisplacementMm, 7));
  const frequencyHz = clamp(numberOrDefault(wave.frequencyHz, DEFAULT_WAVE_SETTINGS.frequencyHz), 0.01, 10);
  return {
    baselineMm: clamp(numberOrDefault(wave.baselineMm, DEFAULT_WAVE_SETTINGS.baselineMm), 0, safeMax),
    amplitudeMm: clamp(numberOrDefault(wave.amplitudeMm, DEFAULT_WAVE_SETTINGS.amplitudeMm), 0, safeMax),
    frequencyHz,
    phaseLagDegrees: clamp(numberOrDefault(wave.phaseLagDegrees, DEFAULT_WAVE_SETTINGS.phaseLagDegrees), 0, 360),
    cycles: clamp(numberOrDefault(wave.cycles, DEFAULT_WAVE_SETTINGS.cycles), 0, 1000),
  };
}

export function createWaveTrack(selectionKeys, selectedDisplacement, maxDisplacementMm = 7) {
  const safeDisplacement = clamp(numberOrDefault(selectedDisplacement, 0), 0, maxDisplacementMm);
  return {
    id: `track-${Date.now()}`,
    name: 'Wave',
    mode: 'wave',
    targetCellKeys: [...selectionKeys],
    points: [],
    wave: normalizeWaveSettings({
      ...DEFAULT_WAVE_SETTINGS,
      amplitudeMm: Math.max(1, safeDisplacement || DEFAULT_WAVE_SETTINGS.amplitudeMm),
    }, maxDisplacementMm),
  };
}

export function getMotionForwardDuration(tracks) {
  return Math.max(
    1,
    ...(tracks ?? []).map((track) => getTrackDuration(track)),
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

export function getTrackDuration(track) {
  if (getTrackMode(track) === 'wave') {
    const wave = normalizeWaveSettings(track.wave);
    return wave.cycles > 0 ? wave.cycles / wave.frequencyHz : 12;
  }

  return Math.max(0, ...(track?.points ?? []).map((point) => numberOrDefault(point.timeSec, 0)));
}

export function getExperimentMotionDuration(experiment) {
  return Math.max(1, getTrackDuration({ points: [{ timeSec: 1 }] }), ...(experiment?.motionTracks ?? []).map(getTrackDuration));
}

export function sampleWaveTrackDisplacement(track, timeSec, maxDisplacementMm) {
  const wave = normalizeWaveSettings(track.wave, maxDisplacementMm);
  const durationSec = wave.cycles > 0 ? wave.cycles / wave.frequencyHz : Infinity;
  const safeTime = Math.max(0, Number(timeSec) || 0);

  if (safeTime > durationSec) {
    return wave.baselineMm;
  }

  const phaseOffsetDegrees = wave.phaseLagDegrees;
  const phaseRadians = (2 * Math.PI * wave.frequencyHz * safeTime) + (phaseOffsetDegrees * Math.PI / 180);
  return clamp(wave.baselineMm + (wave.amplitudeMm * positiveWave(phaseRadians)), 0, maxDisplacementMm);
}

export function sampleTrackDisplacement(track, timeSec, maxDisplacementMm) {
  if (getTrackMode(track) === 'wave') {
    return sampleWaveTrackDisplacement(track, timeSec, maxDisplacementMm);
  }

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
    (track.targetCellKeys ?? []).forEach((key) => {
      const [row, col] = key.split('-').map(Number);
      if (Number.isInteger(row) && Number.isInteger(col) && next[row]?.[col] !== undefined) {
        const displacement = sampleTrackDisplacement(track, timeSec, maxDisplacementMm);
        if (displacement === null) {
          return;
        }
        next[row][col] = clamp(displacement, 0, maxDisplacementMm);
      }
    });
  });
  return next;
}

export function buildTrackPreviewPoints(track, maxDisplacementMm, sampleCount = 72) {
  if (getTrackMode(track) !== 'wave') {
    return [...(track?.points ?? [])].sort((a, b) => a.timeSec - b.timeSec);
  }

  const durationSec = getTrackDuration(track);
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const timeSec = Number(((durationSec * index) / sampleCount).toFixed(2));
    return {
      id: `wave-${index}`,
      timeSec,
      displacement: Number(sampleTrackDisplacement(track, timeSec, maxDisplacementMm).toFixed(2)),
      interpolationToNext: 'sine',
    };
  });
}
