// A row of straight pipe segments. Each starts at a random orientation
// (0 = blocked / north-south, 1 = open / east-west). Tapping a segment
// cycles it to the next orientation. Solved when every segment is open,
// forming a continuous channel from the spring to the pool.

export const SEGMENT_COUNT = 5;

export function initialOrientations(): number[] {
  return Array.from({ length: SEGMENT_COUNT }, () => (Math.random() < 0.5 ? 0 : 1));
}

export function nextOrientation(current: number): number {
  return (current + 1) % 2;
}

export function isOpen(orientation: number): boolean {
  return orientation === 1;
}

export function isSolved(orientations: number[]): boolean {
  return orientations.every(isOpen);
}
