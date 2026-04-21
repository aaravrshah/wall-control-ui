import { GRID_COLS, GRID_ROWS, createEmptyGrid, cloneGrid } from '../utils/grid';

function createCenterBumpGrid(fill = 3.5, maxValue = 6) {
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

function clonePoints(points = []) {
  return points.map((point) => ({
    ...point,
    interpolationToNext: point.interpolationToNext ?? 'linear',
  }));
}

function cloneTrack(track) {
  return {
    ...track,
    targetCellKeys: [...track.targetCellKeys],
    points: clonePoints(track.points),
  };
}

const neutralGrid = createEmptyGrid(3.5);
const centerBumpGrid = createCenterBumpGrid();
const leftRampGrid = createRampGrid();
const checkerGrid = createCheckerGrid();

export const defaultCalibration = {
  offsetGrid: createEmptyGrid(0),
};

export const defaultExperiment = {
  id: 'current-experiment',
  name: 'Baseline Flat',
  grid: cloneGrid(neutralGrid),
  motionTracks: [],
  notes: '',
  maxDisplacementMm: 7,
  servoMaxDegrees: 20,
};

export const seedSavedExperiments = [
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
    id: 'suggested-flat',
    name: 'Flat Hold',
    experiment: {
      ...defaultExperiment,
      name: 'Flat Hold',
      grid: cloneGrid(neutralGrid),
    },
  },
  {
    id: 'suggested-bump',
    name: 'Center Bump Hold',
    experiment: {
      ...defaultExperiment,
      name: 'Center Bump Hold',
      grid: cloneGrid(centerBumpGrid),
    },
  },
  {
    id: 'suggested-wave',
    name: 'Traveling Bump',
    experiment: {
      ...defaultExperiment,
      name: 'Traveling Bump',
      grid: cloneGrid(neutralGrid),
      motionTracks: [
        cloneTrack({
          id: 'track-1',
          name: 'Center Cells',
          targetCellKeys: ['1-7', '1-8', '2-7', '2-8'],
          points: [
            { id: 'pt-1', timeSec: 0, displacement: 3.5, interpolationToNext: 'sine' },
            { id: 'pt-2', timeSec: 3, displacement: 6.2, interpolationToNext: 'sine' },
            { id: 'pt-3', timeSec: 6, displacement: 3.5, interpolationToNext: 'linear' },
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
