/**
 * Core Dataset type definitions for DICOM data representation.
 *
 * These types wrap parsed DICOM data into a typed structure suitable
 * for validation operations.
 */

/** A single DICOM data element */
export interface DicomElement {
  /** Tag in "(GGGG,EEEE)" format */
  tag: string;
  /** Value Representation (e.g., "DA", "UI", "PN") */
  vr: string;
  /** Parsed value(s) */
  value: DicomValue;
  /** Original string representation for VR validation */
  rawValue?: string;
}

/** Possible value types for a DICOM element */
export type DicomValue =
  | string
  | number
  | string[]
  | number[]
  | SequenceItem[]
  | Buffer
  | null;

/** A single item within a DICOM Sequence (SQ) element */
export interface SequenceItem {
  elements: Map<string, DicomElement>;
}

/** Interface for accessing DICOM dataset elements */
export interface IDicomDataset {
  /** All elements indexed by tag string "(GGGG,EEEE)" */
  elements: Map<string, DicomElement>;

  /** Get an element by tag */
  getElement(tag: string): DicomElement | undefined;

  /** Check if a tag exists in the dataset */
  hasTag(tag: string): boolean;

  /** Get the string value of a tag (first value if multi-valued) */
  getString(tag: string): string | undefined;
}

/** Concrete implementation of the DICOM Dataset */
export class DicomDataset implements IDicomDataset {
  readonly elements: Map<string, DicomElement>;

  constructor(elements?: Map<string, DicomElement>) {
    this.elements = elements ?? new Map<string, DicomElement>();
  }

  /** Get an element by its tag string "(GGGG,EEEE)" */
  getElement(tag: string): DicomElement | undefined {
    return this.elements.get(tag);
  }

  /** Check if a tag exists in the dataset */
  hasTag(tag: string): boolean {
    return this.elements.has(tag);
  }

  /**
   * Get the string value of a tag.
   * For multi-valued elements (string[]), returns the first value.
   * For numeric values, returns the string representation.
   * For null, Buffer, or SequenceItem[] values, returns undefined.
   */
  getString(tag: string): string | undefined {
    const element = this.elements.get(tag);
    if (!element) {
      return undefined;
    }

    const { value } = element;

    if (value === null) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return undefined;
      }
      const first = value[0];
      if (typeof first === 'string') {
        return first;
      }
      if (typeof first === 'number') {
        return String(first);
      }
      // SequenceItem[] — no string representation
      return undefined;
    }

    // Buffer — no string representation
    if (Buffer.isBuffer(value)) {
      return undefined;
    }

    return undefined;
  }
}
