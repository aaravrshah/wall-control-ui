export const GRID_ROWS = 4;
export const GRID_COLS = 16;

export function createEmptyGrid(fillValue = 0) {
  return Array.from({ length: GRID_ROWS }, () => Array.from({ length: GRID_COLS }, () => fillValue));
}

export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function applyRegionToGrid(grid, region, updater) {
  const next = cloneGrid(grid);
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      const inRegion =
        region === 'full' ||
        (region?.type === 'row' && region.index === row) ||
        (region?.type === 'column' && region.index === col) ||
        (region?.type === 'rect' && row >= region.startRow && row <= region.endRow && col >= region.startCol && col <= region.endCol);
      if (inRegion) {
        next[row][col] = clamp(updater(next[row][col], row, col));
      }
    }
  }
  return next;
}

export function mirrorGridHorizontal(grid) {
  return grid.map((row) => [...row].reverse());
}

export function smoothGrid(grid) {
  const next = createEmptyGrid();
  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLS; col += 1) {
      let sum = 0;
      let count = 0;
      for (let r = Math.max(0, row - 1); r <= Math.min(GRID_ROWS - 1, row + 1); r += 1) {
        for (let c = Math.max(0, col - 1); c <= Math.min(GRID_COLS - 1, col + 1); c += 1) {
          sum += grid[r][c];
          count += 1;
        }
      }
      next[row][col] = clamp(sum / count);
    }
  }
  return next;
}

export function gridToFlat(grid) {
  return grid.flat();
}
