/** Digit sequences compare as numbers: 1, 2, 10, not 1, 10, 2. */
export function compareModuleNames(left: string, right: string): number {
  return left.localeCompare(right, 'ru', { numeric: true });
}
