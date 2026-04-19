import { useEffect, useMemo, useRef, useState } from 'react';
import SectionHeader from '../components/SectionHeader';
import TimelinePlot from '../components/TimelinePlot';
import WallGrid from '../components/WallGrid';
import { useExperiment } from '../context/ExperimentContext';
import { cloneGrid, createEmptyGrid, smoothGrid } from '../utils/grid';

function buildRectSelection(start, end) {
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startCol = Math.min(start.col, end.col);
  const endCol = Math.max(start.col, end.col);
  const keys = new Set();
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      keys.add(`${row}-${col}`);
    }
  }
  return keys;
}

function clampToMax(value, maxDisplacementMm) {
  return Math.max(0, Math.min(maxDisplacementMm, Number(value)));
}

function updateSelectedCells(grid, selectedCells, displacement, maxDisplacementMm) {
  const next = cloneGrid(grid);
  selectedCells.forEach((key) => {
    const [row, col] = key.split('-').map(Number);
    next[row][col] = clampToMax(displacement, maxDisplacementMm);
  });
  return next;
}

function averageSelectedDisplacement(grid, selectedCells) {
  if (selectedCells.size === 0) {
    return 0;
  }
  let total = 0;
  selectedCells.forEach((key) => {
    const [row, col] = key.split('-').map(Number);
    total += grid[row][col];
  });
  return Number((total / selectedCells.size).toFixed(2));
}

function sortPoints(points) {
  return [...points].sort((a, b) => a.timeSec - b.timeSec);
}

function createDefaultHoldTrack(selectionKeys, displacement) {
  return {
    id: `track-${Date.now()}`,
    name: 'Hold',
    targetCellKeys: [...selectionKeys],
    points: [
      { id: `pt-${Date.now()}-1`, timeSec: 0, displacement, interpolationToNext: 'linear' },
      { id: `pt-${Date.now()}-2`, timeSec: 4, displacement, interpolationToNext: 'linear' },
    ],
  };
}

function resolveTrackForSelection(tracks, selectedCells, selectedDisplacement) {
  if (selectedCells.size === 0) {
    return { mode: 'none', track: null };
  }

  const selectionSet = new Set(selectedCells);
  const exactTrack = tracks.find((track) => {
    const trackSet = new Set(track.targetCellKeys);
    if (trackSet.size !== selectionSet.size) return false;
    for (const key of selectionSet) {
      if (!trackSet.has(key)) return false;
    }
    return true;
  });

  if (exactTrack) {
    return { mode: 'single', track: exactTrack };
  }

  return {
    mode: 'default',
    track: createDefaultHoldTrack(selectionSet, selectedDisplacement),
  };
}

export default function ExperimentSetup() {
  const {
    currentExperiment,
    setGrid,
    updateExperiment,
    replaceExperiment,
    saveCurrentExperiment,
    canUndo,
    canRedo,
    undoExperiment,
    redoExperiment,
    recordHistorySnapshot,
  } = useExperiment();
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set(['0-0']));
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [sliderValue, setSliderValue] = useState(null);
  const [saveName, setSaveName] = useState('');
  const dragSnapshotRef = useRef(null);

  const grid = useMemo(() => cloneGrid(currentExperiment.grid), [currentExperiment.grid]);
  const selectedDisplacement = averageSelectedDisplacement(grid, selectedCells);
  const displayedDisplacement = sliderValue ?? selectedDisplacement;
  const selectionTrackState = useMemo(
    () => resolveTrackForSelection(currentExperiment.motionTracks, selectedCells, selectedDisplacement),
    [currentExperiment.motionTracks, selectedCells, selectedDisplacement],
  );
  const activeTrack = selectionTrackState.track;
  const selectedPoint = activeTrack?.points.find((point) => point.id === selectedPointId) ?? null;

  useEffect(() => {
    if (activeTrack) {
      setSelectedPointId((previous) =>
        activeTrack.points.some((point) => point.id === previous) ? previous : sortPoints(activeTrack.points)[0]?.id ?? null,
      );
    } else {
      setSelectedPointId(null);
    }
  }, [activeTrack]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
        return;
      }
      const meta = event.ctrlKey || event.metaKey;
      if (!meta) return;
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoExperiment();
      }
      if ((event.key.toLowerCase() === 'y') || (event.key.toLowerCase() === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoExperiment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoExperiment, redoExperiment]);

  const handleCellPointer = (row, col, isStart, event) => {
    const key = `${row}-${col}`;
    const additive = event?.ctrlKey || event?.metaKey;

    if (isStart) {
      setSelectionStart(additive ? null : { row, col });
      setSelectedCells((previous) => {
        if (additive) {
          const next = new Set(previous);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        }
        return new Set([key]);
      });
      return;
    }

    if (selectionStart) {
      setSelectedCells(buildRectSelection(selectionStart, { row, col }));
    }
  };

  const replaceTrackForSelection = (replacementTrack) => {
    const selectionSet = new Set(replacementTrack.targetCellKeys);
    const trimmed = currentExperiment.motionTracks
      .map((track) => ({
        ...track,
        targetCellKeys: track.targetCellKeys.filter((key) => !selectionSet.has(key)),
      }))
      .filter((track) => track.targetCellKeys.length > 0);

    updateExperiment({ motionTracks: [...trimmed, replacementTrack] });
  };

  return (
    <div className="page-stack">
      <SectionHeader
        title="Actuator Editor"
        subtitle="Refine actuator displacements and edit motion for the current selection."
      />

      {currentExperiment.id.startsWith('saved-') ? (
        <div className="callout subtle">
          Editing saved experiment: <strong>{currentExperiment.name}</strong>
        </div>
      ) : null}

      <section className="editor-split wide">
        <section className="panel workspace-panel">
          <div className="editor-toolbar">
            <div>
              <strong>{selectedCells.size}</strong> actuator{selectedCells.size === 1 ? '' : 's'} selected
            </div>
            <div className="saved-actions">
              <button className="secondary" onClick={undoExperiment} disabled={!canUndo}>Undo</button>
              <button className="secondary" onClick={redoExperiment} disabled={!canRedo}>Redo</button>
              <button className="secondary" onClick={() => setSelectedCells(new Set(grid.flatMap((row, rowIndex) => row.map((_, colIndex) => `${rowIndex}-${colIndex}`))))}>Select All</button>
              <button className="secondary" onClick={() => setSelectedCells(new Set())}>Clear Selection</button>
            </div>
          </div>

          <WallGrid
            grid={grid}
            interactive
            selectedCells={selectedCells}
            onCellPointer={handleCellPointer}
            onPointerUp={() => setSelectionStart(null)}
            maxValue={currentExperiment.maxDisplacementMm}
          />

          <div className="heat-legend">
            <span>0 mm</span>
            <span>{currentExperiment.maxDisplacementMm.toFixed(1)} mm</span>
          </div>

          <div className="top-gap control-grid">
            <label>
              Displacement (mm)
              <input
                type="range"
                min={0}
                max={currentExperiment.maxDisplacementMm}
                step={0.1}
                value={displayedDisplacement}
                onPointerDown={() => {
                  if (!dragSnapshotRef.current) {
                    dragSnapshotRef.current = true;
                    recordHistorySnapshot(currentExperiment);
                  }
                }}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setSliderValue(nextValue);
                  replaceExperiment({
                    grid: updateSelectedCells(grid, selectedCells, nextValue, currentExperiment.maxDisplacementMm),
                  });
                }}
                onPointerUp={() => {
                  setSliderValue(null);
                  dragSnapshotRef.current = null;
                }}
              />
              <input
                type="number"
                min={0}
                max={currentExperiment.maxDisplacementMm}
                step={0.1}
                value={displayedDisplacement}
                onChange={(event) =>
                  setGrid(updateSelectedCells(grid, selectedCells, Number(event.target.value), currentExperiment.maxDisplacementMm))
                }
                onBlur={() => setSliderValue(null)}
              />
            </label>

            <div className="saved-actions">
              <button className="secondary" onClick={() => setGrid(createEmptyGrid(currentExperiment.maxDisplacementMm / 2))}>Reset All to Midpoint</button>
              <button className="secondary" onClick={() => setGrid(createEmptyGrid(0))}>Reset All to 0 mm</button>
              <button className="secondary" onClick={() => setGrid(smoothGrid(grid, currentExperiment.maxDisplacementMm).map((row) => row.map((value) => Number(value.toFixed(2)))))}>
                Smooth
              </button>
            </div>
            <div className="save-row">
              <input
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Save experiment name"
              />
              <button
                onClick={() => {
                  saveCurrentExperiment(saveName.trim());
                  setSaveName('');
                }}
              >
                Save Experiment
              </button>
            </div>
          </div>
        </section>

        <aside className="page-stack">
          <section className="panel control-grid timeline-panel">
            <SectionHeader
              title="Selection Timeline"
              subtitle="A default hold timeline is always shown for the current selection."
            />

            {selectionTrackState.mode === 'none' ? (
              <div className="callout subtle">Select one or more actuators to edit a timeline.</div>
            ) : null}

            {activeTrack ? (
              <>
                <div className="two-input-grid">
                  <label>
                    Track Name
                    <input
                      value={activeTrack.name}
                      onChange={(event) => {
                        if (selectionTrackState.mode !== 'single') return;
                        updateExperiment({
                          motionTracks: currentExperiment.motionTracks.map((track) =>
                            track.id === activeTrack.id ? { ...track, name: event.target.value } : track,
                          ),
                        });
                      }}
                      readOnly={selectionTrackState.mode !== 'single'}
                    />
                  </label>
                  <label>
                    Target Cells
                    <input value={activeTrack.targetCellKeys.join(', ')} readOnly />
                  </label>
                </div>

                <TimelinePlot
                  points={sortPoints(activeTrack.points)}
                  selectedId={selectedPointId}
                  onSelect={setSelectedPointId}
                  onPointDrag={(pointId, timeSec, displacement) => {
                    const updatedTrack = {
                      ...activeTrack,
                      points: activeTrack.points.map((point) =>
                        point.id === pointId
                          ? { ...point, timeSec, displacement: clampToMax(displacement, currentExperiment.maxDisplacementMm) }
                          : point,
                      ),
                    };
                    replaceTrackForSelection(updatedTrack);
                  }}
                  onAddPoint={(timeSec, displacement) => {
                    const updatedTrack = {
                      ...activeTrack,
                      points: [
                        ...activeTrack.points,
                        {
                          id: `pt-${Date.now()}`,
                          timeSec,
                          displacement: clampToMax(displacement, currentExperiment.maxDisplacementMm),
                          interpolationToNext: 'linear',
                        },
                      ],
                    };
                    replaceTrackForSelection(updatedTrack);
                  }}
                  onToggleSegment={(pointId) => {
                    const updatedTrack = {
                      ...activeTrack,
                      points: activeTrack.points.map((point) =>
                        point.id === pointId
                          ? { ...point, interpolationToNext: point.interpolationToNext === 'sine' ? 'linear' : 'sine' }
                          : point,
                      ),
                    };
                    replaceTrackForSelection(updatedTrack);
                  }}
                  maxTime={12}
                  maxDisplacement={currentExperiment.maxDisplacementMm}
                />

                {selectedPoint ? (
                  <div className="two-input-grid">
                    <label>
                      Point Time (s)
                      <input
                        type="number"
                        min={0}
                        max={60}
                        step={0.1}
                        value={selectedPoint.timeSec}
                        onChange={(event) => {
                          const updatedTrack = {
                            ...activeTrack,
                            points: activeTrack.points.map((point) =>
                              point.id === selectedPoint.id ? { ...point, timeSec: Number(event.target.value) } : point,
                            ),
                          };
                          replaceTrackForSelection(updatedTrack);
                        }}
                      />
                    </label>
                    <label>
                      Point Displacement (mm)
                      <input
                        type="number"
                        min={0}
                        max={currentExperiment.maxDisplacementMm}
                        step={0.1}
                        value={selectedPoint.displacement}
                        onChange={(event) => {
                          const updatedTrack = {
                            ...activeTrack,
                            points: activeTrack.points.map((point) =>
                              point.id === selectedPoint.id
                                ? { ...point, displacement: clampToMax(event.target.value, currentExperiment.maxDisplacementMm) }
                                : point,
                            ),
                          };
                          replaceTrackForSelection(updatedTrack);
                        }}
                      />
                    </label>
                  </div>
                ) : null}

                <div className="saved-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      const updatedTrack = {
                        ...activeTrack,
                        points: [
                          ...activeTrack.points,
                          {
                            id: `pt-${Date.now()}`,
                            timeSec: (sortPoints(activeTrack.points).at(-1)?.timeSec ?? 0) + 1,
                            displacement: selectedDisplacement,
                            interpolationToNext: 'linear',
                          },
                        ],
                      };
                      replaceTrackForSelection(updatedTrack);
                    }}
                  >
                    Add Point
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      updateExperiment({
                        motionTracks: currentExperiment.motionTracks.filter((track) => track.id !== activeTrack.id),
                      })
                    }
                    disabled={selectionTrackState.mode !== 'single'}
                  >
                    Delete Track
                  </button>
                </div>
              </>
            ) : null}
          </section>
        </aside>
      </section>
    </div>
  );
}
