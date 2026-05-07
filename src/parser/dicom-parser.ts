/**
 * DICOM file/buffer parser using dcmjs.
 *
 * Wraps dcmjs to parse DICOM data and convert it into our typed
 * DicomDataset structure for validation.
 */

import { readFile } from 'node:fs/promises';
import dcmjs from 'dcmjs';
import {
  DicomDataset,
  DicomElement,
  DicomValue,
  SequenceItem,
} from '../types/dataset.js';
import {
  EmptyInputError,
  FileNotFoundError,
  FileNotReadableError,
  InvalidDicomError,
  TruncatedFileError,
} from '../errors.js';

const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

/** Options for parsing DICOM data */
export interface ParseOptions {
  /** If true, include private tags in the dataset (default: true) */
  includePrivateTags?: boolean;
}

/** Result of parsing a DICOM file or buffer */
export interface ParseResult {
  dataset: DicomDataset;
  transferSyntaxUID?: string;
}

/**
 * Parser for DICOM files and buffers.
 *
 * Uses dcmjs as the underlying DICOM parsing engine and converts
 * its output into our typed DicomDataset structure.
 */
export class DicomParser {
  /**
   * Parse a DICOM file from disk.
   * Reads the file asynchronously, then delegates to parseBuffer.
   *
   * @throws FileNotFoundError if the file does not exist
   * @throws FileNotReadableError if the file cannot be read (permissions)
   * @throws EmptyInputError if the file is empty
   * @throws InvalidDicomError if the file is not valid DICOM
   * @throws TruncatedFileError if the file appears truncated
   */
  async parseFile(filePath: string, options?: ParseOptions): Promise<ParseResult> {
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          throw new FileNotFoundError(filePath);
        }
        if (nodeErr.code === 'EACCES' || nodeErr.code === 'EPERM') {
          throw new FileNotReadableError(filePath);
        }
      }
      throw err;
    }

    return this.parseBuffer(buffer, options);
  }

  /**
   * Parse DICOM data from a Buffer or ArrayBuffer.
   *
   * @throws EmptyInputError if the input is empty
   * @throws InvalidDicomError if the data is not valid DICOM
   * @throws TruncatedFileError if the data appears truncated
   */
  parseBuffer(buffer: Buffer | ArrayBuffer, options?: ParseOptions): ParseResult {
    const arrayBuffer = this.toArrayBuffer(buffer);

    if (arrayBuffer.byteLength === 0) {
      throw new EmptyInputError();
    }

    let dicomDict: { meta: Record<string, DcmjsElement>; dict: Record<string, DcmjsElement> };
    try {
      dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);

      // Detect truncated file errors from dcmjs
      if (this.isTruncationError(message)) {
        throw new TruncatedFileError(arrayBuffer.byteLength, 'unknown');
      }

      throw new InvalidDicomError(message);
    }

    const includePrivateTags = options?.includePrivateTags ?? true;

    // Extract transfer syntax UID from meta header
    const transferSyntaxUID = this.extractTransferSyntax(dicomDict.meta);

    // Convert both meta and dict elements into our DicomDataset
    const elements = new Map<string, DicomElement>();

    // Process meta header elements
    this.convertElements(dicomDict.meta, elements, includePrivateTags);

    // Process main dataset elements
    this.convertElements(dicomDict.dict, elements, includePrivateTags);

    const dataset = new DicomDataset(elements);

    return { dataset, transferSyntaxUID };
  }

  /**
   * Convert a Buffer to an ArrayBuffer.
   */
  private toArrayBuffer(buffer: Buffer | ArrayBuffer): ArrayBuffer {
    if (buffer instanceof ArrayBuffer) {
      return buffer;
    }
    // Buffer is a Uint8Array subclass; copy into a fresh ArrayBuffer
    // to avoid SharedArrayBuffer type issues
    const ab = new ArrayBuffer(buffer.byteLength);
    const view = new Uint8Array(ab);
    view.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    return ab;
  }

  /**
   * Extract the Transfer Syntax UID from the meta header.
   */
  private extractTransferSyntax(meta: Record<string, DcmjsElement>): string | undefined {
    // Transfer Syntax UID is tag (0002,0010), stored as "00020010" in dcmjs
    const tsElement = meta['00020010'];
    if (tsElement?.Value && tsElement.Value.length > 0) {
      return String(tsElement.Value[0]);
    }
    return undefined;
  }

  /**
   * Convert dcmjs raw element objects into our DicomElement format
   * and add them to the elements map.
   */
  private convertElements(
    dcmjsElements: Record<string, DcmjsElement>,
    elements: Map<string, DicomElement>,
    includePrivateTags: boolean
  ): void {
    for (const [unpunctuatedTag, element] of Object.entries(dcmjsElements)) {
      const tag = DicomMetaDictionary.punctuateTag(unpunctuatedTag);

      // Skip private tags if not requested
      if (!includePrivateTags && this.isPrivateTag(tag)) {
        continue;
      }

      const vr = element.vr || this.lookupVR(tag);
      const value = this.convertValue(element, vr);

      const dicomElement: DicomElement = {
        tag,
        vr,
        value,
      };

      elements.set(tag, dicomElement);
    }
  }

  /**
   * Convert a dcmjs element value to our DicomValue type.
   */
  private convertValue(element: DcmjsElement, vr: string): DicomValue {
    // No value present (Type 2 empty)
    if (element.Value === undefined || element.Value === null) {
      return null;
    }

    // Sequence (SQ) — recursively convert items
    if (vr === 'SQ') {
      return this.convertSequence(element.Value as Record<string, DcmjsElement>[]);
    }

    const values = element.Value;

    // Binary VRs — return as Buffer if it's an ArrayBuffer
    if (this.isBinaryVR(vr)) {
      if (values.length === 1 && values[0] instanceof ArrayBuffer) {
        return Buffer.from(values[0] as ArrayBuffer);
      }
      if (values.length === 1 && ArrayBuffer.isView(values[0])) {
        const view = values[0] as ArrayBufferView;
        return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      }
    }

    // Single value — unwrap from array
    if (values.length === 1) {
      const val = values[0];
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return val;
      if (val instanceof ArrayBuffer) return Buffer.from(val);
      if (ArrayBuffer.isView(val)) {
        const view = val as ArrayBufferView;
        return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
      }
      // Object (e.g., PersonName) — convert to string representation
      if (val !== null && typeof val === 'object') {
        return this.objectToString(val);
      }
      return String(val);
    }

    // Multiple values — return as typed array
    if (values.length > 0) {
      if (values.every((v: unknown) => typeof v === 'number')) {
        return values as number[];
      }
      if (values.every((v: unknown) => typeof v === 'string')) {
        return values as string[];
      }
      // Mixed or object values — convert to strings
      return values.map((v: unknown) => {
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return String(v);
        if (v !== null && typeof v === 'object') return this.objectToString(v);
        return String(v);
      }) as string[];
    }

    return null;
  }

  /**
   * Convert a sequence (SQ) value to SequenceItem array.
   */
  private convertSequence(items: Record<string, DcmjsElement>[]): SequenceItem[] {
    return items.map((item) => {
      const itemElements = new Map<string, DicomElement>();
      this.convertElements(item, itemElements, true);
      return { elements: itemElements };
    });
  }

  /**
   * Convert a dcmjs object value (like PersonName) to a string.
   */
  private objectToString(obj: unknown): string {
    if (obj === null || obj === undefined) return '';
    // PersonName objects have an Alphabetic property
    if (typeof obj === 'object' && 'Alphabetic' in (obj as Record<string, unknown>)) {
      return String((obj as Record<string, unknown>).Alphabetic);
    }
    return JSON.stringify(obj);
  }

  /**
   * Look up the VR for a tag from the dcmjs dictionary.
   */
  private lookupVR(tag: string): string {
    const entry = DicomMetaDictionary.dictionary[tag];
    if (entry) {
      return entry.vr.toUpperCase();
    }
    return 'UN'; // Unknown
  }

  /**
   * Check if a tag is a private tag (odd group number).
   */
  private isPrivateTag(tag: string): boolean {
    // Tag format: "(GGGG,EEEE)"
    const groupHex = tag.slice(1, 5);
    const groupNum = parseInt(groupHex, 16);
    return groupNum % 2 !== 0;
  }

  /**
   * Check if a VR is a binary type.
   */
  private isBinaryVR(vr: string): boolean {
    return ['OB', 'OW', 'OF', 'OD', 'OL', 'OV', 'UN'].includes(vr);
  }

  /**
   * Detect if an error message indicates a truncated file.
   */
  private isTruncationError(message: string): boolean {
    const truncationPatterns = [
      /beyond end of buffer/i,
      /unexpected end/i,
      /truncat/i,
      /not enough data/i,
      /buffer overread/i,
      /read past end/i,
    ];
    return truncationPatterns.some((pattern) => pattern.test(message));
  }
}

/** Internal type representing a dcmjs element structure */
interface DcmjsElement {
  vr?: string;
  Value?: unknown[];
  InlineBinary?: string;
  BulkDataURI?: string;
}
