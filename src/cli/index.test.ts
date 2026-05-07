import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const execFileAsync = promisify(execFile);

const CLI_PATH = path.resolve(__dirname, '../../dist/cli/index.mjs');
const FIXTURE_PATH = path.resolve(__dirname, '../../tests/fixtures/minimal-ct.dcm');
const PKG_PATH = path.resolve(__dirname, '../../package.json');

/**
 * Helper to run the CLI and return stdout, stderr, and exit code.
 * Does not throw on non-zero exit codes.
 */
async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args]);
    return { stdout, stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
      exitCode: execError.code ?? 1,
    };
  }
}

describe('CLI', () => {
  beforeAll(() => {
    // Verify the built CLI exists
    expect(() => readFileSync(CLI_PATH)).not.toThrow();
  });

  describe('exit codes', () => {
    it('should exit with code 2 when no files are provided', async () => {
      const result = await runCli([]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('Error');
    });

    it('should exit with code 1 when file has validation errors', async () => {
      const result = await runCli([FIXTURE_PATH]);
      expect(result.exitCode).toBe(1);
    });

    it('should exit with code 0 for --version', async () => {
      const result = await runCli(['--version']);
      expect(result.exitCode).toBe(0);
    });

    it('should exit with code 0 for --help', async () => {
      const result = await runCli(['--help']);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('--version', () => {
    it('should print the package version', async () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      const result = await runCli(['--version']);
      expect(result.stdout.trim()).toBe(pkg.version);
    });
  });

  describe('--help', () => {
    it('should print usage information with available options', async () => {
      const result = await runCli(['--help']);
      expect(result.stdout).toContain('files');
      expect(result.stdout).toContain('--format');
      expect(result.stdout).toContain('--quiet');
      expect(result.stdout).toContain('--sop-class');
      expect(result.stdout).toContain('--version');
      expect(result.stdout).toContain('--help');
    });
  });

  describe('--format json', () => {
    it('should produce valid JSON output', async () => {
      const result = await runCli(['--format', 'json', FIXTURE_PATH]);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('file');
      expect(parsed).toHaveProperty('findings');
      expect(parsed).toHaveProperty('summary');
      expect(Array.isArray(parsed.findings)).toBe(true);
    });

    it('should include findings with severity, tag, module, message, and rule', async () => {
      const result = await runCli(['--format', 'json', FIXTURE_PATH]);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.findings.length).toBeGreaterThan(0);
      const finding = parsed.findings[0];
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('tag');
      expect(finding).toHaveProperty('module');
      expect(finding).toHaveProperty('message');
      expect(finding).toHaveProperty('rule');
    });
  });

  describe('--quiet', () => {
    it('should suppress non-error output in text mode', async () => {
      const result = await runCli(['--quiet', FIXTURE_PATH]);
      // Should only show ERROR-level findings, not WARNINGs
      expect(result.stdout).toContain('ERROR');
      expect(result.stdout).not.toContain('WARNING');
    });
  });

  describe('--sop-class', () => {
    it('should override SOP Class UID for validation', async () => {
      // Use CT Image Storage SOP Class UID explicitly
      const result = await runCli(['--sop-class', '1.2.840.10008.5.1.4.1.1.2', '--format', 'json', FIXTURE_PATH]);
      const parsed = JSON.parse(result.stdout);
      // Should validate against CT Image IOD
      expect(parsed).toHaveProperty('findings');
      expect(parsed).toHaveProperty('summary');
    });
  });

  describe('file arguments', () => {
    it('should accept a file path and validate it', async () => {
      const result = await runCli([FIXTURE_PATH]);
      expect(result.stdout).toContain('File:');
      expect(result.stdout).toContain(FIXTURE_PATH);
    });

    it('should report error for missing file and continue with remaining files', async () => {
      const missingFile = '/nonexistent/path/missing.dcm';
      const result = await runCli([missingFile, FIXTURE_PATH]);
      // Should report error for missing file on stderr
      expect(result.stderr).toContain(missingFile);
      expect(result.stderr).toContain('ERROR');
      // Should still validate the existing file on stdout
      expect(result.stdout).toContain(FIXTURE_PATH);
      // Exit code should be 1 (errors found)
      expect(result.exitCode).toBe(1);
    });
  });

  describe('no files provided', () => {
    it('should print usage message to stderr', async () => {
      const result = await runCli([]);
      expect(result.stderr).toContain('No file paths or glob patterns provided');
    });
  });
});
