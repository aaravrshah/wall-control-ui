import { PRESET_KEYS, generatePatternGrid } from '../utils/patterns';

export const presetPatterns = [
  { key: PRESET_KEYS.FLAT, name: 'Flat Wall', description: 'All nodes held at neutral baseline.' },
  { key: PRESET_KEYS.GLOBAL_SINE, name: 'Global Sine', description: 'Uniform sinusoidal oscillation across entire wall.' },
  { key: PRESET_KEYS.TRAVEL_DOWN, name: 'Traveling Wave Downstream', description: 'Phase-shifted wave propagating downstream.' },
  { key: PRESET_KEYS.TRAVEL_UP, name: 'Traveling Wave Upstream', description: 'Phase-shifted wave propagating upstream.' },
  { key: PRESET_KEYS.STANDING, name: 'Standing Wave', description: 'Interference pattern with alternating nodes/antinodes.' },
  { key: PRESET_KEYS.PULSE, name: 'Single Pulse / Bump', description: 'Local pulse moving across wall extent.' },
  { key: PRESET_KEYS.BANDS, name: 'Alternating Bands', description: 'Alternating high/low rows for roughness surrogate.' },
  { key: PRESET_KEYS.ROUGHNESS, name: 'Random Roughness Snapshot', description: 'Pseudo-randomized roughness state for baseline testing.' },
  { key: PRESET_KEYS.CUSTOM, name: 'Saved Custom Pattern', description: 'Apply a previously saved custom grid state.' },
];

export const defaultExperiment = {
  id: 'current-experiment',
  name: 'Baseline Global Sine',
  mode: 'simple',
  selectedPreset: PRESET_KEYS.GLOBAL_SINE,
  amplitude: 0.6,
  frequency: 0.8,
  duration: 20,
  direction: 'downstream',
  repeatCount: 2,
  activeRegion: 'full',
  grid: generatePatternGrid(PRESET_KEYS.GLOBAL_SINE, { amplitude: 0.6, frequency: 0.8 }, 0),
  sequence: [
    { id: 'kf-1', label: 'Neutral', duration: 3, grid: generatePatternGrid(PRESET_KEYS.FLAT, {}, 0) },
    { id: 'kf-2', label: 'Oscillation', duration: 4, grid: generatePatternGrid(PRESET_KEYS.GLOBAL_SINE, { amplitude: 0.8, frequency: 1.0 }, 0.2) },
  ],
  loopSequence: true,
  sequenceRepeats: 3,
};

export const seedSavedExperiments = [
  {
    id: 'saved-1',
    name: 'Sediment Mobilization Sweep',
    savedAt: '2026-04-12T09:15:00.000Z',
    selectedPreset: PRESET_KEYS.TRAVEL_DOWN,
    amplitude: 0.7,
    frequency: 1.1,
    duration: 30,
    direction: 'downstream',
    repeatCount: 3,
    activeRegion: 'full',
    grid: generatePatternGrid(PRESET_KEYS.TRAVEL_DOWN, { amplitude: 0.7, frequency: 1.1 }, 0),
    sequence: [],
  },
  {
    id: 'saved-2',
    name: 'Calibration Flat Hold',
    savedAt: '2026-04-14T13:45:00.000Z',
    selectedPreset: PRESET_KEYS.FLAT,
    amplitude: 0.1,
    frequency: 0.2,
    duration: 15,
    direction: 'none',
    repeatCount: 1,
    activeRegion: 'full',
    grid: generatePatternGrid(PRESET_KEYS.FLAT, {}, 0),
    sequence: [],
  },
];
