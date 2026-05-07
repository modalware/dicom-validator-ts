import { describe, it, expect } from 'vitest';
import { parseVMConstraint, satisfiesVM, VMConstraint } from './vm-constraint';

describe('parseVMConstraint', () => {
  it('parses fixed number "1"', () => {
    expect(parseVMConstraint('1')).toEqual({ min: 1, max: 1, step: 1 });
  });

  it('parses fixed number "3"', () => {
    expect(parseVMConstraint('3')).toEqual({ min: 3, max: 3, step: 1 });
  });

  it('parses range "1-3"', () => {
    expect(parseVMConstraint('1-3')).toEqual({ min: 1, max: 3, step: 1 });
  });

  it('parses range "1-99"', () => {
    expect(parseVMConstraint('1-99')).toEqual({ min: 1, max: 99, step: 1 });
  });

  it('parses unbounded "1-n"', () => {
    expect(parseVMConstraint('1-n')).toEqual({ min: 1, max: null, step: 1 });
  });

  it('parses unbounded "3-n"', () => {
    expect(parseVMConstraint('3-n')).toEqual({ min: 3, max: null, step: 1 });
  });

  it('parses multiplier "2-2n"', () => {
    expect(parseVMConstraint('2-2n')).toEqual({ min: 2, max: null, step: 2 });
  });

  it('parses multiplier "3-3n"', () => {
    expect(parseVMConstraint('3-3n')).toEqual({ min: 3, max: null, step: 3 });
  });

  it('handles whitespace in input', () => {
    expect(parseVMConstraint(' 1-3 ')).toEqual({ min: 1, max: 3, step: 1 });
  });
});

describe('satisfiesVM', () => {
  describe('fixed number constraint', () => {
    const constraint: VMConstraint = { min: 3, max: 3, step: 1 };

    it('returns true when count equals the fixed number', () => {
      expect(satisfiesVM(3, constraint)).toBe(true);
    });

    it('returns false when count is less than the fixed number', () => {
      expect(satisfiesVM(2, constraint)).toBe(false);
    });

    it('returns false when count is greater than the fixed number', () => {
      expect(satisfiesVM(4, constraint)).toBe(false);
    });
  });

  describe('range constraint', () => {
    const constraint: VMConstraint = { min: 1, max: 3, step: 1 };

    it('returns true for count at minimum', () => {
      expect(satisfiesVM(1, constraint)).toBe(true);
    });

    it('returns true for count at maximum', () => {
      expect(satisfiesVM(3, constraint)).toBe(true);
    });

    it('returns true for count within range', () => {
      expect(satisfiesVM(2, constraint)).toBe(true);
    });

    it('returns false for count below minimum', () => {
      expect(satisfiesVM(0, constraint)).toBe(false);
    });

    it('returns false for count above maximum', () => {
      expect(satisfiesVM(4, constraint)).toBe(false);
    });
  });

  describe('unbounded constraint', () => {
    const constraint: VMConstraint = { min: 1, max: null, step: 1 };

    it('returns true for count at minimum', () => {
      expect(satisfiesVM(1, constraint)).toBe(true);
    });

    it('returns true for large count', () => {
      expect(satisfiesVM(1000, constraint)).toBe(true);
    });

    it('returns false for count of 0', () => {
      expect(satisfiesVM(0, constraint)).toBe(false);
    });
  });

  describe('multiplier constraint', () => {
    const constraint: VMConstraint = { min: 2, max: null, step: 2 };

    it('returns true for count equal to min (which is a valid multiple)', () => {
      expect(satisfiesVM(2, constraint)).toBe(true);
    });

    it('returns true for count that is a valid multiple above min', () => {
      expect(satisfiesVM(4, constraint)).toBe(true);
      expect(satisfiesVM(6, constraint)).toBe(true);
    });

    it('returns false for count that is not a multiple of step', () => {
      expect(satisfiesVM(3, constraint)).toBe(false);
      expect(satisfiesVM(5, constraint)).toBe(false);
    });

    it('returns false for count below minimum', () => {
      expect(satisfiesVM(1, constraint)).toBe(false);
    });
  });

  describe('zero count', () => {
    it('is never valid regardless of constraint', () => {
      expect(satisfiesVM(0, { min: 1, max: 1, step: 1 })).toBe(false);
      expect(satisfiesVM(0, { min: 1, max: null, step: 1 })).toBe(false);
      expect(satisfiesVM(0, { min: 2, max: null, step: 2 })).toBe(false);
    });
  });

  describe('negative count', () => {
    it('is never valid', () => {
      expect(satisfiesVM(-1, { min: 1, max: 1, step: 1 })).toBe(false);
    });
  });
});
