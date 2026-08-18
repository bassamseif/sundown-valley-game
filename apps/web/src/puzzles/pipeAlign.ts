// A pipeline laid out on a grid, not just a straight row: some cells
// are straight pipes, some are 90-degree elbows. Each cell has a fixed
// required pair of connection sides (determined by the fixed path
// shape below) and starts at a random rotation; tapping cycles its
// rotation. Solved when every cell's current rotation matches its
// required connection sides, forming one continuous channel from the
// spring to the pool.

export type Dir = "N" | "E" | "S" | "W";
export type CellKind = "straight" | "elbow";

interface GridPos {
  x: number;
  z: number;
}

interface Cell {
  kind: CellKind;
  pos: GridPos;
  sides: [Dir, Dir];
}

// The fixed pipeline shape: East, East, then a turn South, then South,
// South. One elbow, deliberately simple for a first non-straight
// layout. Grid convention: +x = East, +z = South.
const SPRING_POS: GridPos = { x: -1, z: 0 };
const POOL_POS: GridPos = { x: 2, z: 3 };

const CELLS: Cell[] = [
  { kind: "straight", pos: { x: 0, z: 0 }, sides: ["W", "E"] },
  { kind: "straight", pos: { x: 1, z: 0 }, sides: ["W", "E"] },
  { kind: "elbow", pos: { x: 2, z: 0 }, sides: ["W", "S"] },
  { kind: "straight", pos: { x: 2, z: 1 }, sides: ["N", "S"] },
  { kind: "straight", pos: { x: 2, z: 2 }, sides: ["N", "S"] },
];

export const SEGMENT_COUNT = CELLS.length;
export const GRID_POSITIONS: GridPos[] = CELLS.map((c) => c.pos);
export const SPRING_GRID_POS = SPRING_POS;
export const POOL_GRID_POS = POOL_POS;

// The four rotations an elbow can be tapped through, in order — each
// step advances the connected pair one compass step clockwise (viewed
// from above): N+E -> E+S -> S+W -> W+N -> back to N+E.
const ELBOW_ROTATIONS: [Dir, Dir][] = [
  ["N", "E"],
  ["E", "S"],
  ["S", "W"],
  ["W", "N"],
];

function sameSides(a: [Dir, Dir], b: [Dir, Dir]): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

export function requiredRotation(i: number): number {
  const cell = CELLS[i];
  if (cell.kind === "straight") {
    return cell.sides.includes("E") ? 0 : 1; // 0 = East-West axis, 1 = North-South axis
  }
  return ELBOW_ROTATIONS.findIndex((r) => sameSides(r, cell.sides));
}

export function cellKind(i: number): CellKind {
  return CELLS[i].kind;
}

// Straight pipes only have two meaningfully different rotations (an
// axis, not a direction); elbows have four.
export function orientationCount(i: number): number {
  return CELLS[i].kind === "straight" ? 2 : 4;
}

export function initialOrientations(): number[] {
  return CELLS.map((_, i) => Math.floor(Math.random() * orientationCount(i)));
}

export function nextOrientation(i: number, current: number): number {
  return (current + 1) % orientationCount(i);
}

export function isCorrect(i: number, orientation: number): boolean {
  return orientation === requiredRotation(i);
}

export function isSolved(orientations: number[]): boolean {
  return orientations.every((o, i) => isCorrect(i, o));
}
