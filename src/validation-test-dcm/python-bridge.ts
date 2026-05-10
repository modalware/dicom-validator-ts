import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access } from 'node:fs/promises';
import type { PyValidationResult } from './types.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Path to the project's .venv/bin/validate_iods script */
const VALIDATE_IODS_PATH = resolve(__dirname, '../../.venv/bin/validate_iods');

/**
 * Check if pydicom/dicom-validator is available on the system.
 * Checks for the validate_iods script in the project's .venv/bin/ directory.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    await access(VALIDATE_IODS_PATH);
    // Verify it actually runs
    await execFileAsync(VALIDATE_IODS_PATH, ['--help'], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse pydicom/dicom-validator (validate_iods) output into findings.
 *
 * The output format is:
 * ```
 * Errors
 * ======
 * Module "ModuleName":
 * Tag (XXXX,XXXX) (TagName) is missing
 * Tag (XXXX,XXXX) (TagName) has invalid value '...' for VR XX
 * ...
 * Warnings
 * ========
 * ...
 * ```
 */
function parseFindings(output: string): { severity: string; message: string }[] {
  const findings: { severity: string; message: string }[] = [];
  const lines = output.split('\n');

  let currentSeverity: string | null = null;
  let currentModule = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect severity sections
    if (line === 'Errors' && lines[i + 1]?.trim().startsWith('======')) {
      currentSeverity = 'Error';
      i++; // skip the === line
      continue;
    }
    if (line === 'Warnings' && lines[i + 1]?.trim().startsWith('======')) {
      currentSeverity = 'Warning';
      i++; // skip the === line
      continue;
    }

    if (!currentSeverity) continue;
    if (!line || line.startsWith('======')) continue;

    // Detect module headers: Module "Name":
    const moduleMatch = line.match(/^Module "(.+)":$/);
    if (moduleMatch) {
      currentModule = moduleMatch[1];
      continue;
    }

    // Parse tag findings
    const tagMatch = line.match(/^Tag \(([0-9A-Fa-f]{4},[0-9A-Fa-f]{4})\)\s+\((.+?)\)\s+(.+)$/);
    if (tagMatch) {
      const tag = tagMatch[1];
      const tagName = tagMatch[2];
      const detail = tagMatch[3];
      const message = currentModule
        ? `[${currentModule}] Tag (${tag}) (${tagName}) ${detail}`
        : `Tag (${tag}) (${tagName}) ${detail}`;
      findings.push({ severity: currentSeverity, message });
      continue;
    }

    // Other lines in a severity section (e.g., "Tag (XXXX,XXXX) is unexpected")
    if (line.startsWith('Tag ')) {
      const message = currentModule ? `[${currentModule}] ${line}` : line;
      findings.push({ severity: currentSeverity, message });
    }
  }

  return findings;
}

/**
 * Validate a single DICOM file using pydicom/dicom-validator via subprocess.
 * Invokes `.venv/bin/validate_iods <filePath>` with a 30-second timeout.
 * Parses the structured output into findings.
 * Returns error details on failures.
 */
export async function validateFile(filePath: string): Promise<PyValidationResult> {
  try {
    await access(VALIDATE_IODS_PATH);
  } catch {
    return {
      filePath,
      findings: [],
      error: { exitCode: -1, rawOutput: 'validate_iods not found in .venv/bin/' },
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      VALIDATE_IODS_PATH,
      [filePath],
      { timeout: 30000 },
    );

    const combinedOutput = stdout + (stderr ? '\n' + stderr : '');
    const findings = parseFindings(combinedOutput);

    return {
      filePath,
      findings,
    };
  } catch (err: unknown) {
    const error = err as {
      code?: string;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    const rawOutput = [error.stdout || '', error.stderr || ''].filter(Boolean).join('\n');
    const exitCode = error.killed ? -1 : (error.status ?? 1);

    // Even on non-zero exit, validate_iods may have produced parseable output
    const findings = parseFindings(rawOutput);

    if (findings.length > 0) {
      return {
        filePath,
        findings,
      };
    }

    return {
      filePath,
      findings: [],
      error: {
        exitCode,
        rawOutput: rawOutput || (error.killed ? 'Process timed out after 30 seconds' : 'Unknown error'),
      },
    };
  }
}
