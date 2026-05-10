/**
 * Tests for DicomFileBuilder utility.
 *
 * Verifies that the builder produces valid DICOM Part 10 files with correct
 * preamble, "DICM" prefix, File Meta Information, and dataset elements.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'node:path';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { DicomFileBuilder, CT_IMAGE_STORAGE_UID, EXPLICIT_VR_LITTLE_ENDIAN_UID } from './dicom-file-builder.js';
import dcmjs from 'dcmjs';

const { DicomMessage } = dcmjs.data;

const TEST_OUTPUT_DIR = join(__dirname, '../tests/fixtures/dcm/.test-output');

beforeAll(async () => {
  await mkdir(TEST_OUTPUT_DIR, { recursive: true });
});

afterAll(async () => {
  await rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
});

describe('DicomFileBuilder', () => {
  describe('setBaseSopClass', () => {
    it('should create a builder with all minimum required attributes', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);

      const outputPath = join(TEST_OUTPUT_DIR, 'base-sop-class.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });

      // Verify File Meta Information
      expect(dicomDict.meta['00020010']?.Value?.[0]).toBe(EXPLICIT_VR_LITTLE_ENDIAN_UID);
      expect(dicomDict.meta['00020002']?.Value?.[0]).toBe(CT_IMAGE_STORAGE_UID);

      // Verify dataset elements
      expect(dicomDict.dict['00080016']?.Value?.[0]).toBe(CT_IMAGE_STORAGE_UID); // SOP Class UID
      expect(dicomDict.dict['00080018']?.Value?.[0]).toBeDefined(); // SOP Instance UID
      expect(dicomDict.dict['00080020']?.Value?.[0]).toBe('20240101'); // Study Date
      expect(dicomDict.dict['00080030']?.Value?.[0]).toBe('120000'); // Study Time
      expect(dicomDict.dict['00080060']?.Value?.[0]).toBe('CT'); // Modality
      expect(dicomDict.dict['00080090']).toBeDefined(); // Referring Physician
      expect(dicomDict.dict['00100010']).toBeDefined(); // Patient Name
      expect(dicomDict.dict['00100020']?.Value?.[0]).toBe('TESTPAT001'); // Patient ID
      expect(dicomDict.dict['0020000D']?.Value?.[0]).toBeDefined(); // Study Instance UID
      expect(dicomDict.dict['0020000E']?.Value?.[0]).toBeDefined(); // Series Instance UID
      expect(dicomDict.dict['00200013']?.Value?.[0]).toBeDefined(); // Instance Number
    });
  });

  describe('writeFile', () => {
    it('should produce a file with correct 128-byte preamble and DICM prefix', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);

      const outputPath = join(TEST_OUTPUT_DIR, 'preamble-check.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);

      // First 128 bytes should be zeros (preamble)
      const preamble = buffer.subarray(0, 128);
      expect(preamble.every((b) => b === 0)).toBe(true);

      // Next 4 bytes should be "DICM"
      const magic = buffer.subarray(128, 132).toString('ascii');
      expect(magic).toBe('DICM');
    });

    it('should create output directory if it does not exist', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);

      const nestedPath = join(TEST_OUTPUT_DIR, 'nested', 'dir', 'test.dcm');
      await builder.writeFile(nestedPath);

      const buffer = await readFile(nestedPath);
      expect(buffer.length).toBeGreaterThan(132); // At least preamble + DICM
    });
  });

  describe('addElement', () => {
    it('should add a string element to the dataset', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
      builder.addElement('(0008,1030)', 'LO', 'Test Study');

      const outputPath = join(TEST_OUTPUT_DIR, 'add-element.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });

      expect(dicomDict.dict['00081030']?.Value?.[0]).toBe('Test Study');
    });

    it('should add a multi-valued element to the dataset', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
      builder.addElement('(0020,0037)', 'DS', ['1', '0', '0', '0', '1', '0']);

      const outputPath = join(TEST_OUTPUT_DIR, 'add-multi-value.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });

      expect(dicomDict.dict['00200037']?.Value).toHaveLength(6);
    });
  });

  describe('removeElement', () => {
    it('should remove an element from the dataset', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
      builder.removeElement('(0010,0010)'); // Remove Patient Name

      const outputPath = join(TEST_OUTPUT_DIR, 'remove-element.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });

      expect(dicomDict.dict['00100010']).toBeUndefined();
    });
  });

  describe('setEmpty', () => {
    it('should set an element to an empty value', async () => {
      const builder = new DicomFileBuilder();
      builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
      builder.setEmpty('(0010,0010)', 'PN'); // Empty Patient Name

      const outputPath = join(TEST_OUTPUT_DIR, 'set-empty.dcm');
      await builder.writeFile(outputPath);

      const buffer = await readFile(outputPath);
      const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const dicomDict = DicomMessage.readFile(arrayBuffer, { ignoreErrors: false });

      // Element should exist but have empty value
      const element = dicomDict.dict['00100010'];
      expect(element).toBeDefined();
      expect(element?.Value).toEqual([]);
    });
  });
});
