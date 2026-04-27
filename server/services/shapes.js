// All grids are plain squares.
// Black square placement is handled by generateAmericanMask in puzzleBuilder.js.
export function getShapeMask(size) {
  return Array.from({ length: size }, () => Array(size).fill(true));
}