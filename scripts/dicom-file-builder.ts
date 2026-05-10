/**
 * DicomFileBuilder — Utility for constructing minimal DICOM Part 10 files.
 *
 * Uses dcmjs to build valid DICOM files with correct preamble, "DICM" prefix,
 * and File Meta Information header. Designed for generating test fixture files
 * that trigger specific validation rules.
 */

import { writeFile as fsWriteFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import dcmjs from 'dcmjs';

const { DicomMetaDictionary } = dcmjs.data;

/**
 * Represents a raw string override that bypasses dcmjs validation.
 * Used to inject invalid values into DICOM files for testing.
 */
interface RawOverride {
  tag: string; // unpunctuated tag e.g. "00080054"
  vr: string;
  value: string;
}

/** CT Image Storage SOP Class UID */
export const CT_IMAGE_STORAGE_UID = '1.2.840.10008.5.1.4.1.1.2';

/** Explicit VR Little Endian Transfer Syntax UID */
export const EXPLICIT_VR_LITTLE_ENDIAN_UID = '1.2.840.10008.1.2.1';

/**
 * Convert a punctuated tag like "(0008,0016)" to unpunctuated form "00080016".
 */
function toUnpunctuated(tag: string): string {
  return tag.replace(/[(),]/g, '');
}

/**
 * DicomFileBuilder constructs minimal DICOM Part 10 files programmatically.
 *
 * Usage:
 *   const builder = new DicomFileBuilder();
 *   builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
 *   builder.addElement('(0018,0050)', 'DS', 'invalid');
 *   await builder.writeFile('/path/to/output.dcm');
 */
export class DicomFileBuilder {
  private dataset: Record<string, { vr: string; Value: unknown[] }> = {};
  private sopClassUID: string | null = null;
  private sopInstanceUID: string | null = null;
  private rawOverrides: RawOverride[] = [];

  /**
   * Set the SOP Class UID and add all minimum required attributes
   * for a valid CT Image Storage DICOM file.
   *
   * Adds: Patient Name, Patient ID, Study/Series/SOP Instance UIDs,
   * Modality, Study Date, Study Time, Referring Physician, Instance Number.
   */
  setBaseSopClass(sopClassUID: string): void {
    this.sopClassUID = sopClassUID;
    this.sopInstanceUID = '1.2.826.0.1.3680043.8.1055.1.20240101120000.1';

    // SOP Class UID (0008,0016) - UI
    this.dataset['00080016'] = { vr: 'UI', Value: [sopClassUID] };

    // SOP Instance UID (0008,0018) - UI
    this.dataset['00080018'] = { vr: 'UI', Value: [this.sopInstanceUID] };

    // Study Date (0008,0020) - DA
    this.dataset['00080020'] = { vr: 'DA', Value: ['20240101'] };

    // Study Time (0008,0030) - TM
    this.dataset['00080030'] = { vr: 'TM', Value: ['120000'] };

    // Modality (0008,0060) - CS
    this.dataset['00080060'] = { vr: 'CS', Value: ['CT'] };

    // Referring Physician's Name (0008,0090) - PN
    this.dataset['00080090'] = { vr: 'PN', Value: [{ Alphabetic: 'Doe^John' }] };

    // Patient's Name (0010,0010) - PN
    this.dataset['00100010'] = { vr: 'PN', Value: [{ Alphabetic: 'Test^Patient' }] };

    // Patient ID (0010,0020) - LO
    this.dataset['00100020'] = { vr: 'LO', Value: ['TESTPAT001'] };

    // Study Instance UID (0020,000D) - UI
    this.dataset['0020000D'] = { vr: 'UI', Value: ['1.2.826.0.1.3680043.8.1055.1.20240101120000.2'] };

    // Series Instance UID (0020,000E) - UI
    this.dataset['0020000E'] = { vr: 'UI', Value: ['1.2.826.0.1.3680043.8.1055.1.20240101120000.3'] };

    // Instance Number (0020,0013) - IS
    this.dataset['00200013'] = { vr: 'IS', Value: ['1'] };

    // Image Type (0008,0008) - CS (required Type 1 for CT Image Storage)
    this.dataset['00080008'] = { vr: 'CS', Value: ['ORIGINAL', 'PRIMARY', 'AXIAL'] };
  }

  /**
   * Add a DICOM element to the dataset.
   *
   * @param tag - Punctuated tag string, e.g. "(0008,0060)"
   * @param vr - Value Representation, e.g. "CS", "DA", "PN"
   * @param value - The value to set. Can be a string, number, array, or object.
   *               For PN values, pass an object with { Alphabetic: "..." }.
   *               For multi-valued elements, pass an array.
   */
  addElement(tag: string, vr: string, value: unknown): void {
    const unpunctuated = toUnpunctuated(tag);
    const wrappedValue = Array.isArray(value) ? value : [value];
    this.dataset[unpunctuated] = { vr, Value: wrappedValue };
  }

  /**
   * Remove a DICOM element from the dataset.
   *
   * @param tag - Punctuated tag string, e.g. "(0008,0016)"
   */
  removeElement(tag: string): void {
    const unpunctuated = toUnpunctuated(tag);
    delete this.dataset[unpunctuated];
  }

  /**
   * Set an element to an empty (zero-length) value.
   *
   * @param tag - Punctuated tag string, e.g. "(0010,0010)"
   * @param vr - Value Representation for the element
   */
  setEmpty(tag: string, vr: string): void {
    const unpunctuated = toUnpunctuated(tag);
    this.dataset[unpunctuated] = { vr, Value: [] };
  }

  /**
   * Add a raw string element that bypasses dcmjs validation.
   * The value is written directly as bytes after the initial file is generated.
   * This is used for creating intentionally invalid DICOM values for testing.
   *
   * @param tag - Punctuated tag string, e.g. "(0008,0054)"
   * @param vr - Value Representation, e.g. "AE", "CS"
   * @param value - The raw string value to write (may be invalid for the VR)
   */
  addRawStringElement(tag: string, vr: string, value: string): void {
    const unpunctuated = toUnpunctuated(tag);
    // Remove from normal dataset if present (we'll write it raw)
    delete this.dataset[unpunctuated];
    this.rawOverrides.push({ tag: unpunctuated, vr, value });
  }

  /**
   * Write the DICOM Part 10 file to disk.
   *
   * Produces a file with:
   * - 128-byte preamble (zeros)
   * - "DICM" magic number (4 bytes)
   * - File Meta Information header (Group 0002)
   * - Dataset with all configured elements
   *
   * If raw overrides are present, they are appended as additional DICOM elements
   * after the main dataset, bypassing dcmjs validation.
   *
   * @param outputPath - Absolute path where the file will be written
   */
  async writeFile(outputPath: string): Promise<void> {
    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Build the DicomDict with Transfer Syntax in meta header
    const { DicomDict } = dcmjs.data;

    const dicomDict = new DicomDict({
      TransferSyntaxUID: EXPLICIT_VR_LITTLE_ENDIAN_UID,
    });

    // Manually add File Meta Information Version (0002,0001)
    dicomDict.meta['00020001'] = {
      vr: 'OB',
      Value: [new Uint8Array([0x00, 0x01]).buffer],
    };

    // Add Media Storage SOP Class UID (0002,0002)
    if (this.sopClassUID) {
      dicomDict.meta['00020002'] = { vr: 'UI', Value: [this.sopClassUID] };
    }

    // Add Media Storage SOP Instance UID (0002,0003)
    if (this.sopInstanceUID) {
      dicomDict.meta['00020003'] = { vr: 'UI', Value: [this.sopInstanceUID] };
    }

    // Set the dataset directly (already in dcmjs internal format)
    dicomDict.dict = this.dataset;

    // Write to ArrayBuffer (includes 128-byte preamble + "DICM" + meta + dataset)
    const arrayBuffer: ArrayBuffer = dicomDict.write();

    if (this.rawOverrides.length === 0) {
      // No raw overrides — write directly
      await fsWriteFile(outputPath, Buffer.from(arrayBuffer));
    } else {
      // Append raw DICOM elements after the dcmjs-generated content
      const baseBuffer = Buffer.from(arrayBuffer);
      const rawBuffers = this.rawOverrides.map((override) =>
        encodeExplicitVRElement(override.tag, override.vr, override.value)
      );
      const totalLength = baseBuffer.length + rawBuffers.reduce((sum, b) => sum + b.length, 0);
      const finalBuffer = Buffer.concat([baseBuffer, ...rawBuffers], totalLength);
      await fsWriteFile(outputPath, finalBuffer);
    }
  }
}

/**
 * Encode a DICOM element in Explicit VR Little Endian format.
 * This writes raw bytes without any VR-specific validation.
 *
 * For VRs with 2-byte length (AE, AS, CS, DA, DS, DT, FL, FD, IS, LO, PN, SH, SL, SS, ST, TM, UI, UL, US):
 *   [group 2B][element 2B][VR 2B][length 2B][value]
 *
 * For VRs with 4-byte length (OB, OD, OF, OL, OW, SQ, UC, UN, UR, UT):
 *   [group 2B][element 2B][VR 2B][0000 2B][length 4B][value]
 */
function encodeExplicitVRElement(tag: string, vr: string, value: string): Buffer {
  const group = parseInt(tag.substring(0, 4), 16);
  const element = parseInt(tag.substring(4, 8), 16);
  const valueBytes = Buffer.from(value, 'utf-8');

  // Pad to even length if needed (DICOM requires even-length values)
  let paddedValue: Buffer;
  if (valueBytes.length % 2 !== 0) {
    // UI is padded with null, others with space
    const padChar = vr === 'UI' ? 0x00 : 0x20;
    paddedValue = Buffer.concat([valueBytes, Buffer.from([padChar])]);
  } else {
    paddedValue = valueBytes;
  }

  const vrsWith4ByteLength = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT']);

  if (vrsWith4ByteLength.has(vr)) {
    // 12-byte header: group(2) + element(2) + VR(2) + reserved(2) + length(4)
    const header = Buffer.alloc(12);
    header.writeUInt16LE(group, 0);
    header.writeUInt16LE(element, 2);
    header.write(vr, 4, 2, 'ascii');
    header.writeUInt16LE(0, 6); // reserved
    header.writeUInt32LE(paddedValue.length, 8);
    return Buffer.concat([header, paddedValue]);
  } else {
    // 8-byte header: group(2) + element(2) + VR(2) + length(2)
    const header = Buffer.alloc(8);
    header.writeUInt16LE(group, 0);
    header.writeUInt16LE(element, 2);
    header.write(vr, 4, 2, 'ascii');
    header.writeUInt16LE(paddedValue.length, 6);
    return Buffer.concat([header, paddedValue]);
  }
}
