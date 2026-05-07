/**
 * VM (Value Multiplicity) constraint representation and evaluation.
 *
 * DICOM VM strings define how many values a tag may hold.
 * Formats: fixed ("3"), range ("1-3"), unbounded ("1-n"), multiplier ("2-2n")
 */

export interface VMConstraint {
  min: number;
  max: number | null; // null = unbounded (n)
  step: number; // For multiplier notation (e.g., "2-2n" → step=2)
}

/**
 * Parse a VM string from the DICOM standard into a VMConstraint.
 *
 * Examples:
 *   "1"   → { min: 1, max: 1, step: 1 }
 *   "1-3" → { min: 1, max: 3, step: 1 }
 *   "1-n" → { min: 1, max: null, step: 1 }
 *   "2-2n" → { min: 2, max: null, step: 2 }
 *   "3-3n" → { min: 3, max: null, step: 3 }
 */
export function parseVMConstraint(vm: string): VMConstraint {
  const trimmed = vm.trim();

  // Multiplier notation: "2-2n", "3-3n", etc.
  const multiplierMatch = trimmed.match(/^(\d+)-(\d+)n$/);
  if (multiplierMatch) {
    const min = parseInt(multiplierMatch[1], 10);
    const step = parseInt(multiplierMatch[2], 10);
    return { min, max: null, step };
  }

  // Unbounded range: "1-n"
  const unboundedMatch = trimmed.match(/^(\d+)-n$/);
  if (unboundedMatch) {
    const min = parseInt(unboundedMatch[1], 10);
    return { min, max: null, step: 1 };
  }

  // Fixed range: "1-3"
  const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return { min, max, step: 1 };
  }

  // Fixed number: "3"
  const fixedMatch = trimmed.match(/^(\d+)$/);
  if (fixedMatch) {
    const value = parseInt(fixedMatch[1], 10);
    return { min: value, max: value, step: 1 };
  }

  // Fallback for unrecognized formats — treat as "1-n"
  return { min: 1, max: null, step: 1 };
}

/**
 * Check if a value count satisfies a VM constraint.
 *
 * Rules:
 * - count must be >= constraint.min
 * - If constraint.max is not null, count must be <= constraint.max
 * - If constraint.step > 1, count must be a multiple of constraint.step
 * - count of 0 is never valid (empty values are handled separately before VM check)
 */
export function satisfiesVM(count: number, constraint: VMConstraint): boolean {
  // count of 0 is never valid
  if (count <= 0) {
    return false;
  }

  // Must meet minimum
  if (count < constraint.min) {
    return false;
  }

  // Must not exceed maximum (if bounded)
  if (constraint.max !== null && count > constraint.max) {
    return false;
  }

  // Must be a multiple of step (for multiplier notation)
  if (constraint.step > 1 && count % constraint.step !== 0) {
    return false;
  }

  return true;
}
