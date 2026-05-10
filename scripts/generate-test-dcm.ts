/**
 * Generate Test DCM Files
 *
 * Generates synthetic DICOM Part 10 files designed to trigger specific
 * validation rules in dicom-validator-ts. Each file contains exactly one
 * intentional violation while remaining otherwise valid.
 *
 * Usage: npx tsx scripts/generate-test-dcm.ts
 */

import { resolve, dirname } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DicomFileBuilder, CT_IMAGE_STORAGE_UID } from './dicom-file-builder.js';
import { allTestFileSpecs } from '../src/validation-test-dcm/test-file-specs.js';
import type { TestFileManifest } from '../src/validation-test-dcm/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_DIR = resolve(__dirname, '../tests/fixtures/dcm/');

/**
 * Generate all VR format test files.
 * Each file triggers exactly one vr-format-* rule.
 */
export async function generateVrTestFiles(outputDir: string): Promise<void> {
  // vr-format-AE: AE value exceeds maximum 16 characters
  // Tag (0008,0054) Retrieve AE Title - not part of base SOP, so just add it raw
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0008,0054)', 'AE', 'THIS_VALUE_EXCEEDS_16_CHARS');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-AE.dcm'));
  }

  // vr-format-AS: AS value does not match NNN[DWMY] format
  // Tag (0010,1010) Patient's Age - not part of base SOP
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0010,1010)', 'AS', 'XXYY');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-AS.dcm'));
  }

  // vr-format-CS: CS value contains invalid characters
  // Modality (0008,0060) is CS and Type 1 required - overwrite with invalid value
  // Lowercase chars violate CS (only uppercase, digits, space, underscore allowed)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    // Remove the valid Modality, then add it as raw with invalid value
    builder.removeElement('(0008,0060)');
    builder.addRawStringElement('(0008,0060)', 'CS', 'invalid_lower');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-CS.dcm'));
  }

  // vr-format-DA: DA value does not match YYYYMMDD format
  // Study Date (0008,0020) is DA and required - overwrite with invalid format
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0020)');
    builder.addRawStringElement('(0008,0020)', 'DA', '2024-01-01');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-DA.dcm'));
  }

  // vr-format-DS: DS value is not a valid decimal string
  // Tag (0018,0050) Slice Thickness - not part of base SOP
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0018,0050)', 'DS', 'not_a_number');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-DS.dcm'));
  }

  // vr-format-IS: IS value is not a valid integer string
  // Instance Number (0020,0013) is IS and required - overwrite with invalid value
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0020,0013)');
    builder.addRawStringElement('(0020,0013)', 'IS', 'abc');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-IS.dcm'));
  }

  // vr-format-LO: LO value exceeds maximum 64 characters
  // Tag (0008,1030) Study Description - not part of base SOP
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    const longValue = 'A'.repeat(65);
    builder.addRawStringElement('(0008,1030)', 'LO', longValue);
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-LO.dcm'));
  }

  // vr-format-LT: LT value exceeds maximum 10240 characters
  // Tag (0010,21B0) Additional Patient History - not part of base SOP
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    const longValue = 'B'.repeat(10241);
    builder.addRawStringElement('(0010,21B0)', 'LT', longValue);
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-LT.dcm'));
  }

  // vr-format-PN: PN value has too many component groups
  // Patient Name (0010,0010) is PN and required - overwrite with invalid value
  // Since dcmjs parses '=' as component group separators and our parser only
  // extracts the Alphabetic part, we use a component group exceeding 64 characters
  // which the PN validator will detect.
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0010,0010)');
    // A component group exceeding 64 characters triggers vr-format-PN
    const longName = 'A'.repeat(65);
    builder.addRawStringElement('(0010,0010)', 'PN', longName);
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-PN.dcm'));
  }

  // vr-format-SH: SH value exceeds maximum 16 characters
  // Patient ID (0010,0020) is required - overwrite with too-long value
  // Note: Patient ID is LO in the dictionary but we write it as SH to trigger SH validation
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0010,0020)');
    builder.addRawStringElement('(0010,0020)', 'SH', 'THIS_EXCEEDS_16CH');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-SH.dcm'));
  }

  // vr-format-ST: ST value exceeds maximum 1024 characters
  // Tag (0008,0081) Institution Address - IS in the tag dictionary with VR=ST
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    const longValue = 'C'.repeat(1025);
    builder.addRawStringElement('(0008,0081)', 'ST', longValue);
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-ST.dcm'));
  }

  // vr-format-TM: TM value does not match valid time format
  // Study Time (0008,0030) is TM and required - overwrite with invalid value
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0030)');
    builder.addRawStringElement('(0008,0030)', 'TM', '25:61:99');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-TM.dcm'));
  }

  // vr-format-UI: UI value contains invalid characters
  // Study Instance UID (0020,000D) is UI and required - overwrite with invalid value
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0020,000D)');
    builder.addRawStringElement('(0020,000D)', 'UI', '1.2.3.abc.4.5');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-UI.dcm'));
  }

  // vr-format-UR: UR value contains trailing spaces
  // Tag (0008,0120) URL of Long Code Value - not part of base SOP
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0008,0120)', 'UR', 'https://example.com   ');
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-UR.dcm'));
  }

  // vr-format-UT: UT value exceeds maximum length
  // Tag (0008,0119) Long Code Value - not part of base SOP
  // Note: UT max is 2^32-2 characters which is impractical to exceed in a test file.
  // We create a file with a long UT value. The actual validation trigger for this rule
  // requires a value > 4,294,967,294 characters which cannot be practically generated.
  // This file serves as a placeholder for the test infrastructure.
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    const longValue = 'D'.repeat(1024);
    builder.addRawStringElement('(0008,0119)', 'UT', longValue);
    await builder.writeFile(resolve(outputDir, 'vr/vr-format-UT.dcm'));
  }
}

/**
 * Generate module validation test files.
 *
 * Creates:
 * - type1-missing.dcm: Omits Modality (0008,0060), a Type 1 attribute in the General Series module
 * - type1-empty.dcm: Sets Modality (0008,0060) to a zero-length value
 * - type2-missing.dcm: Omits Referring Physician's Name (0008,0090), a Type 2 attribute in General Study module
 * - type1-missing-manufacturer.dcm: Omits Manufacturer (0008,0070), a Type 1 attribute in General Equipment module
 * - type1-missing-pixel-rows.dcm: Omits Rows (0028,0010), a Type 1 attribute in Image Pixel module
 * - type2-missing-content-date.dcm: Omits Content Date (0008,0023), a Type 2 attribute in General Image module
 * - type1-missing-pixel-spacing.dcm: Omits Pixel Spacing (0028,0030), a Type 1 attribute in Image Plane module
 * - type1-missing-frame-of-ref-uid.dcm: Omits Frame of Reference UID (0020,0052), a Type 1 attribute in Frame of Reference module
 *
 * @param outputDir - Directory where module test files will be written
 */
export async function generateModuleTestFiles(outputDir: string): Promise<void> {
  const moduleDir = resolve(outputDir, 'module');

  // type1-missing.dcm — omit Modality (Type 1 in General Series module)
  const type1Missing = new DicomFileBuilder();
  type1Missing.setBaseSopClass(CT_IMAGE_STORAGE_UID);
  type1Missing.removeElement('(0008,0060)');
  await type1Missing.writeFile(resolve(moduleDir, 'type1-missing.dcm'));

  // type1-empty.dcm — Modality present but with zero-length value
  const type1Empty = new DicomFileBuilder();
  type1Empty.setBaseSopClass(CT_IMAGE_STORAGE_UID);
  type1Empty.setEmpty('(0008,0060)', 'CS');
  await type1Empty.writeFile(resolve(moduleDir, 'type1-empty.dcm'));

  // type2-missing.dcm — omit Referring Physician's Name (Type 2 in General Study module)
  const type2Missing = new DicomFileBuilder();
  type2Missing.setBaseSopClass(CT_IMAGE_STORAGE_UID);
  type2Missing.removeElement('(0008,0090)');
  await type2Missing.writeFile(resolve(moduleDir, 'type2-missing.dcm'));

  // type1-missing-manufacturer.dcm — omit Manufacturer (Type 1 in General Equipment module)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0070)');
    await builder.writeFile(resolve(moduleDir, 'type1-missing-manufacturer.dcm'));
  }

  // type1-missing-pixel-rows.dcm — omit Rows (Type 1 in Image Pixel module)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0028,0010)');
    await builder.writeFile(resolve(moduleDir, 'type1-missing-pixel-rows.dcm'));
  }

  // type2-missing-content-date.dcm — omit Content Date (Type 2 in General Image module)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0023)');
    await builder.writeFile(resolve(moduleDir, 'type2-missing-content-date.dcm'));
  }

  // type1-missing-pixel-spacing.dcm — omit Pixel Spacing (Type 1 in Image Plane module)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0028,0030)');
    await builder.writeFile(resolve(moduleDir, 'type1-missing-pixel-spacing.dcm'));
  }

  // type1-missing-frame-of-ref-uid.dcm — omit Frame of Reference UID (Type 1 in Frame of Reference module)
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0020,0052)');
    await builder.writeFile(resolve(moduleDir, 'type1-missing-frame-of-ref-uid.dcm'));
  }
}

/**
 * Generate VM constraint test files.
 *
 * Creates:
 * - vm-constraint-too-many.dcm: Image Orientation Patient (0020,0037) with 7 values (VM=6, max exceeded)
 * - vm-constraint-too-few.dcm: Image Orientation Patient (0020,0037) with 3 values (VM=6, below minimum)
 *
 * @param outputDir - Directory where VM test files will be written
 */
export async function generateVmTestFiles(outputDir: string): Promise<void> {
  const vmDir = resolve(outputDir, 'vm');

  // vm-constraint-too-many.dcm — Image Orientation Patient (0020,0037) has VM=6, provide 7 DS values
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0020,0037)', 'DS', '1.0\\0.0\\0.0\\0.0\\1.0\\0.0\\0.5');
    await builder.writeFile(resolve(vmDir, 'vm-constraint-too-many.dcm'));
  }

  // vm-constraint-too-few.dcm — Image Orientation Patient (0020,0037) has VM=6, provide only 3 DS values
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0020,0037)', 'DS', '1.0\\0.0\\0.0');
    await builder.writeFile(resolve(vmDir, 'vm-constraint-too-few.dcm'));
  }
}

/**
 * Generate IOD validation test files.
 *
 * Creates:
 * - iod-sop-class-missing.dcm: SOP Class UID (0008,0016) removed from dataset
 * - iod-sop-class-unknown.dcm: SOP Class UID set to unrecognized value "9.9.9.9.9"
 *
 * @param outputDir - Directory where IOD test files will be written
 */
export async function generateIodTestFiles(outputDir: string): Promise<void> {
  const iodDir = resolve(outputDir, 'iod');

  // iod-sop-class-missing.dcm — remove SOP Class UID from dataset
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0016)');
    await builder.writeFile(resolve(iodDir, 'iod-sop-class-missing.dcm'));
  }

  // iod-sop-class-unknown.dcm — set SOP Class UID to unrecognized value
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.removeElement('(0008,0016)');
    builder.addElement('(0008,0016)', 'UI', '9.9.9.9.9');
    await builder.writeFile(resolve(iodDir, 'iod-sop-class-unknown.dcm'));
  }
}

/**
 * Generate tag validation test files.
 *
 * Creates:
 * - vr-unknown.dcm: Tag (0008,1030) Study Description written with VR "DT" (DateTime).
 *   DT is a valid DICOM VR that dcmjs preserves, but it has no validator registered
 *   in dicom-validator-ts, triggering the vr-unknown warning.
 * - vr-undetermined.dcm: Tag (0008,9999) written with VR "UN". This tag is in our
 *   dictionary with empty VR, and since it's not in dcmjs's dictionary, the parser
 *   stores empty VR. The validator cannot determine the VR from either the element
 *   or the dictionary, triggering the vr-undetermined warning.
 *
 * @param outputDir - Directory where tag test files will be written
 */
export async function generateTagTestFiles(outputDir: string): Promise<void> {
  const tagDir = resolve(outputDir, 'tag');

  // vr-unknown.dcm — standard tag with unregistered VR "DT"
  // DT (DateTime) is a valid DICOM VR that dcmjs recognizes and preserves,
  // but our validator registry does not have a validator for it.
  // Tag (0008,1030) Study Description is in our dictionary with VR=LO.
  // Writing it with VR "DT" causes the validator to attempt validation with
  // VR "DT", find no registered validator, and emit vr-unknown warning.
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0008,1030)', 'DT', '20240101120000.000000');
    await builder.writeFile(resolve(tagDir, 'vr-unknown.dcm'));
  }

  // vr-undetermined.dcm — tag with undetermined VR
  // Tag (0008,9999) is in our dictionary with vr="" (context-dependent VR).
  // It is NOT in dcmjs's dictionary, so dcmjs treats VR "UN" as a fallback.
  // The parser detects this and stores empty VR on the element.
  // The validator finds both element.vr and tagDef.vr are empty,
  // triggering the vr-undetermined warning.
  {
    const builder = new DicomFileBuilder();
    builder.setBaseSopClass(CT_IMAGE_STORAGE_UID);
    builder.addRawStringElement('(0008,9999)', 'UN', 'test');
    await builder.writeFile(resolve(tagDir, 'vr-undetermined.dcm'));
  }
}

/**
 * Generate manifest.json and README.md for the test fixtures directory.
 *
 * - manifest.json contains all TestFileSpec entries with a generation timestamp
 * - README.md contains a markdown table listing each file with its rule, severity, and description
 *
 * @param outputDir - The root output directory (tests/fixtures/dcm/)
 */
export async function generateManifestAndReadme(outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  // Write manifest.json
  const manifest: TestFileManifest = {
    generatedAt: new Date().toISOString(),
    generatorVersion: '1.0.0',
    files: allTestFileSpecs,
  };
  await writeFile(
    resolve(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8',
  );

  // Write README.md
  const tableRows = allTestFileSpecs.map(
    (spec) => `| ${spec.relativePath} | ${spec.targetRule} | ${spec.expectedSeverity} | ${spec.description} |`,
  );

  const readme = [
    '# Test DCM Fixtures',
    '',
    'Generated synthetic DICOM files for validation testing.',
    '',
    '| File | Rule | Severity | Description |',
    '|------|------|----------|-------------|',
    ...tableRows,
    '',
  ].join('\n');

  await writeFile(resolve(outputDir, 'README.md'), readme, 'utf-8');
}

/**
 * Main entry point. Calls all generator functions and writes files to the output directory.
 */
async function main(): Promise<void> {
  console.log(`Generating test DCM files in: ${OUTPUT_DIR}`);
  console.log('');

  console.log('Generating VR format test files...');
  await generateVrTestFiles(OUTPUT_DIR);
  console.log('  ✓ 15 VR format test files generated');

  console.log('Generating module validation test files...');
  await generateModuleTestFiles(OUTPUT_DIR);
  console.log('  ✓ 8 module validation test files generated');

  console.log('Generating VM constraint test files...');
  await generateVmTestFiles(OUTPUT_DIR);
  console.log('  ✓ 2 VM constraint test files generated');

  console.log('Generating IOD validation test files...');
  await generateIodTestFiles(OUTPUT_DIR);
  console.log('  ✓ 2 IOD validation test files generated');

  console.log('Generating tag validation test files...');
  await generateTagTestFiles(OUTPUT_DIR);
  console.log('  ✓ 2 tag validation test files generated');

  console.log('Generating manifest and README...');
  await generateManifestAndReadme(OUTPUT_DIR);
  console.log('  ✓ manifest.json and README.md generated');

  console.log('');
  console.log('Done! All test DCM files generated successfully.');
}

main().catch((err) => {
  console.error('Error generating test DCM files:', err);
  process.exit(1);
});
