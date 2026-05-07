import { describe, it, expect } from 'vitest';
import { DicomDataset, DicomElement } from './dataset.js';

describe('DicomDataset', () => {
  function makeElement(tag: string, vr: string, value: DicomElement['value']): DicomElement {
    return { tag, vr, value };
  }

  describe('constructor', () => {
    it('creates an empty dataset when no elements provided', () => {
      const ds = new DicomDataset();
      expect(ds.elements.size).toBe(0);
    });

    it('creates a dataset with provided elements', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0060)', makeElement('(0008,0060)', 'CS', 'CT'));
      const ds = new DicomDataset(elements);
      expect(ds.elements.size).toBe(1);
    });
  });

  describe('getElement', () => {
    it('returns the element for an existing tag', () => {
      const elements = new Map<string, DicomElement>();
      const el = makeElement('(0010,0010)', 'PN', 'Doe^John');
      elements.set('(0010,0010)', el);
      const ds = new DicomDataset(elements);

      expect(ds.getElement('(0010,0010)')).toBe(el);
    });

    it('returns undefined for a non-existing tag', () => {
      const ds = new DicomDataset();
      expect(ds.getElement('(0010,0010)')).toBeUndefined();
    });
  });

  describe('hasTag', () => {
    it('returns true when the tag exists', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0016)', makeElement('(0008,0016)', 'UI', '1.2.840.10008.5.1.4.1.1.2'));
      const ds = new DicomDataset(elements);

      expect(ds.hasTag('(0008,0016)')).toBe(true);
    });

    it('returns false when the tag does not exist', () => {
      const ds = new DicomDataset();
      expect(ds.hasTag('(0008,0016)')).toBe(false);
    });
  });

  describe('getString', () => {
    it('returns the string value for a string element', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0060)', makeElement('(0008,0060)', 'CS', 'CT'));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0008,0060)')).toBe('CT');
    });

    it('returns the string representation of a numeric value', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0028,0010)', makeElement('(0028,0010)', 'US', 512));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0028,0010)')).toBe('512');
    });

    it('returns the first value for a string array', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0008)', makeElement('(0008,0008)', 'CS', ['ORIGINAL', 'PRIMARY']));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0008,0008)')).toBe('ORIGINAL');
    });

    it('returns the first value as string for a number array', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0020,0032)', makeElement('(0020,0032)', 'DS', [1.5, 2.5, 3.5]));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0020,0032)')).toBe('1.5');
    });

    it('returns undefined for a null value', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0060)', makeElement('(0008,0060)', 'CS', null));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0008,0060)')).toBeUndefined();
    });

    it('returns undefined for a Buffer value', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(7FE0,0010)', makeElement('(7FE0,0010)', 'OW', Buffer.from([0x00, 0x01])));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(7FE0,0010)')).toBeUndefined();
    });

    it('returns undefined for a SequenceItem array', () => {
      const elements = new Map<string, DicomElement>();
      const seqItem = { elements: new Map<string, DicomElement>() };
      elements.set('(0008,1115)', makeElement('(0008,1115)', 'SQ', [seqItem]));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0008,1115)')).toBeUndefined();
    });

    it('returns undefined for a non-existing tag', () => {
      const ds = new DicomDataset();
      expect(ds.getString('(9999,9999)')).toBeUndefined();
    });

    it('returns undefined for an empty array', () => {
      const elements = new Map<string, DicomElement>();
      elements.set('(0008,0008)', makeElement('(0008,0008)', 'CS', []));
      const ds = new DicomDataset(elements);

      expect(ds.getString('(0008,0008)')).toBeUndefined();
    });
  });
});
