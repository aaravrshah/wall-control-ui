import { GRID_COLS, GRID_ROWS, createEmptyGrid, cloneGrid } from '../utils/grid';

function createCenterBumpGrid(fill = 0, maxValue = 6) {
  const grid = createEmptyGrid(fill);
  for (let row = 1; row <= 2; row += 1) {
    for (let col = 5; col <= 10; col += 1) {
      grid[row][col] = col === 7 || col === 8 ? maxValue : 4.8;
    }
  }
  return grid;
}

function createRampGrid() {
  return Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, (_, col) => Number(((col / (GRID_COLS - 1)) * 7).toFixed(2))),
  );
}

function createCheckerGrid() {
  return Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) => ((row + col) % 2 === 0 ? 2 : 5)),
  );
}

function createUiucGrid(maxValue = 6) {
  const grid = createEmptyGrid(0);
  const rows = [
    [0, 2, 4, 5, 6, 8, 10, 12, 13, 14],
    [0, 2, 5, 8, 10, 12],
    [0, 2, 5, 8, 10, 12],
    [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14],
  ];

  rows.forEach((cols, row) => {
    cols.forEach((col) => {
      grid[row][col] = maxValue;
    });
  });

  return grid;
}

function getActiveKeysByColumn(grid) {
  const groups = [];
  for (let col = 0; col < GRID_COLS; col += 1) {
    const keys = [];
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (Number(grid[row][col]) > 0.01) {
        keys.push(`${row}-${col}`);
      }
    }
    if (keys.length > 0) {
      groups.push({ col, keys });
    }
  }
  return groups;
}

const UIUC_COLUMN_PHASE_LAGS = {
  0: 0,
  1: 10,
  2: 20,
  4: 40,
  5: 50,
  6: 60,
  8: 80,
  9: 90,
  10: 100,
  12: 120,
  13: 130,
  14: 140,
};

function clonePoints(points = []) {
  return points.map((point) => ({
    ...point,
    interpolationToNext: point.interpolationToNext ?? 'linear',
  }));
}

function cloneTrack(track) {
  return {
    ...track,
    mode: track.mode ?? 'points',
    targetCellKeys: [...track.targetCellKeys],
    points: clonePoints(track.points),
    wave: track.wave ? { ...track.wave } : undefined,
  };
}

const neutralGrid = createEmptyGrid(0);
const centerBumpGrid = createCenterBumpGrid();
const leftRampGrid = createRampGrid();
const checkerGrid = createCheckerGrid();
const uiucWaveGrid = createUiucGrid();
const uiucWaveMotionTracks = getActiveKeysByColumn(uiucWaveGrid).map(({ col, keys }) =>
  cloneTrack({
    id: `track-uiuc-wave-col-${col}`,
    name: `UIUC Column ${col + 1}`,
    mode: 'wave',
    targetCellKeys: keys,
    points: [],
    wave: {
      baselineMm: 0,
      amplitudeMm: 6,
      frequencyHz: 0.45,
      phaseLagDegrees: UIUC_COLUMN_PHASE_LAGS[col] ?? 0,
      cycles: 0,
    },
  }),
);

export const defaultCalibration = {
  offsetGrid: createEmptyGrid(0),
};

export const blankExperiment = {
  id: 'current-experiment',
  name: 'Baseline Flat',
  grid: cloneGrid(neutralGrid),
  motionTracks: [],
  notes: '',
  maxDisplacementMm: 7,
  servoMaxDegrees: 20,
};

export const defaultExperiment = {
  id: 'current-experiment',
  name: 'UIUC Wave',
  grid: cloneGrid(uiucWaveGrid),
  motionTracks: uiucWaveMotionTracks.map(cloneTrack),
  notes: 'Sine-wave track over active nodes spelling UIUC.',
  maxDisplacementMm: 7,
  servoMaxDegrees: 20,
};

export const seedSavedExperiments = [
  {
    id: 'saved-uiuc-wave',
    name: 'UIUC Wave',
    savedAt: '2026-05-04T00:00:00.000Z',
    grid: cloneGrid(uiucWaveGrid),
    motionTracks: uiucWaveMotionTracks.map(cloneTrack),
    notes: 'Sine-wave track over active nodes spelling UIUC.',
    maxDisplacementMm: 7,
    servoMaxDegrees: 20,
  },
  {
    id: 'saved-1',
    name: 'Center Bump',
    savedAt: '2026-04-12T09:15:00.000Z',
    grid: cloneGrid(centerBumpGrid),
    motionTracks: [],
    notes: '',
    maxDisplacementMm: 7,
    servoMaxDegrees: 20,
  },
];

export const starterShapes = [
  { id: 'flat', name: 'Flat', grid: cloneGrid(neutralGrid) },
  { id: 'center-bump', name: 'Center Bump', grid: cloneGrid(centerBumpGrid) },
  { id: 'left-ramp', name: 'Left to Right Ramp', grid: cloneGrid(leftRampGrid) },
  { id: 'checker', name: 'Alternating Pattern', grid: cloneGrid(checkerGrid) },
];

export const suggestedExperiments = [
  {
    id: 'suggested-uiuc-wave',
    name: 'UIUC Wave',
    experiment: {
      ...defaultExperiment,
      name: 'UIUC Wave',
      grid: cloneGrid(uiucWaveGrid),
      motionTracks: uiucWaveMotionTracks.map(cloneTrack),
    },
  },
  {
    id: 'suggested-flat',
    name: 'Flat Hold',
    experiment: {
      ...blankExperiment,
      name: 'Flat Hold',
      grid: cloneGrid(neutralGrid),
    },
  },
  {
    id: 'suggested-bump',
    name: 'Center Bump Hold',
    experiment: {
      ...blankExperiment,
      name: 'Center Bump Hold',
      grid: cloneGrid(centerBumpGrid),
    },
  },
  {
    id: 'suggested-wave',
    name: 'Traveling Bump',
    experiment: {
      ...blankExperiment,
      name: 'Traveling Bump',
      grid: cloneGrid(neutralGrid),
      motionTracks: [
        cloneTrack({
          id: 'track-1',
          name: 'Center Cells',
          targetCellKeys: ['1-7', '1-8', '2-7', '2-8'],
          points: [
            { id: 'pt-1', timeSec: 0, displacement: 0, interpolationToNext: 'sine' },
            { id: 'pt-2', timeSec: 3, displacement: 6.2, interpolationToNext: 'sine' },
            { id: 'pt-3', timeSec: 6, displacement: 0, interpolationToNext: 'linear' },
          ],
        }),
      ],
    },
  },
];

export function cloneExperiment(experiment) {
  return {
    ...experiment,
    grid: cloneGrid(experiment.grid),
    motionTracks: (experiment.motionTracks ?? []).map(cloneTrack),
  };
}

export function cloneCalibration(calibration) {
  return {
    ...calibration,
    offsetGrid: cloneGrid(calibration.offsetGrid),
  };
}
