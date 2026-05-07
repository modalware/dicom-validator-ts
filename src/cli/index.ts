#!/usr/bin/env node
/**
 * CLI entry point for dicom-validator-ts.
 *
 * Validates DICOM files from the command line with support for
 * multiple files, glob patterns, and configurable output formats.
 */

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../validator.js';
import { DicomValidatorError } from '../errors.js';
import type { ValidateOptions } from '../types/options.js';
import type { ValidationResult } from '../result/validation-result.js';

/** Output format options */
type OutputFormat = 'text' | 'json';

/** Per-file result for JSON output */
interface FileResult {
  file: string;
  error?: string;
  findings?: ReturnType<ValidationResult['toJSON']>['findings'];
  summary?: ReturnType<ValidationResult['toJSON']>['summary'];
  passed?: boolean;
}

/**
 * Read the package version from package.json.
 */
function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Walk up to find package.json (handles both src/ and dist/ locations)
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'dicom-validator-ts') {
          return pkg.version;
        }
      } catch {
        // continue searching
      }
      dir = dirname(dir);
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Simple glob pattern matching for a single path segment.
 * Supports * (any chars) and ? (single char).
 */
function matchesPattern(filename: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(filename);
}

/**
 * Expand glob patterns in file arguments.
 * Shell expansion typically handles globs, but we also support
 * explicit glob patterns passed as quoted strings.
 */
function expandGlobs(patterns: string[]): string[] {
  const files: string[] = [];

  for (const pattern of patterns) {
    if (pattern.includes('*') || pattern.includes('?')) {
      // Simple glob: split into directory and file pattern
      const dir = dirname(resolve(pattern));
      const filePattern = basename(pattern);

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (matchesPattern(entry, filePattern)) {
            const fullPath = join(dir, entry);
            if (statSync(fullPath).isFile()) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read — skip
      }
    } else {
      files.push(resolve(pattern));
    }
  }

  return files;
}

/**
 * Format a single file's validation result as text.
 */
function formatTextResult(filePath: string, result: ValidationResult, quiet: boolean): string {
  const lines: string[] = [];
  lines.push(`File: ${filePath}`);

  const findings = result.findings;

  if (findings.length === 0) {
    if (!quiet) {
      lines.push('  No issues found.');
    }
  } else {
    for (const finding of findings) {
      const severity = finding.severity.toUpperCase();
      const tag = finding.tag ? ` ${finding.tag}` : '';
      const module = finding.module ? ` [${finding.module}]` : '';
      lines.push(`  ${severity}:${tag}${module} ${finding.message}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format a file error as text.
 */
function formatTextError(filePath: string, errorMessage: string): string {
  return `File: ${filePath}\n  ERROR: ${errorMessage}`;
}

/**
 * Main CLI execution.
 */
async function main(): Promise<void> {
  const argv = await yargs(hideBin(process.argv))
    .command('$0 [files..]', 'Validate DICOM files against the DICOM standard', (yargs) => {
      return yargs.positional('files', {
        describe: 'DICOM file paths or glob patterns to validate',
        type: 'string',
        array: true,
        default: [] as string[],
      });
    })
    .option('format', {
      alias: 'f',
      describe: 'Output format',
      choices: ['text', 'json'] as const,
      default: 'text' as OutputFormat,
    })
    .option('quiet', {
      alias: 'q',
      describe: 'Suppress all output except error-level findings',
      type: 'boolean',
      default: false,
    })
    .option('sop-class', {
      alias: 's',
      describe: 'Override SOP Class UID for validation',
      type: 'string',
    })
    .version(getVersion())
    .help()
    .strict()
    .fail((msg, err, yargs) => {
      if (err) throw err;
      process.stderr.write(yargs.getHelp() + '\n');
      if (msg) {
        process.stderr.write(`\n${msg}\n`);
      }
      process.exit(2);
    })
    .parse();

  const filePatterns = (argv.files as string[]) || [];

  // Exit with code 2 if no files provided
  if (filePatterns.length === 0) {
    process.stderr.write('Error: No file paths or glob patterns provided.\n\n');
    const yargsInstance = yargs(hideBin(process.argv))
      .command('$0 [files..]', 'Validate DICOM files against the DICOM standard')
      .option('format', { choices: ['text', 'json'] as const, default: 'text' })
      .option('quiet', { type: 'boolean', default: false })
      .option('sop-class', { type: 'string' })
      .help();
    process.stderr.write(await yargsInstance.getHelp() + '\n');
    process.exit(2);
  }

  // Expand glob patterns
  const files = expandGlobs(filePatterns);

  if (files.length === 0) {
    process.stderr.write('Error: No files matched the provided patterns.\n');
    process.exit(2);
  }

  const format = argv.format as OutputFormat;
  const quiet = argv.quiet as boolean;
  const sopClass = argv['sop-class'] as string | undefined;

  // Build validation options
  const validateOptions: ValidateOptions = {};
  if (quiet) {
    validateOptions.verbosity = 'errors-only';
  }
  if (sopClass) {
    validateOptions.sopClassUID = sopClass;
  }

  let hasErrors = false;
  const jsonResults: FileResult[] = [];

  for (const filePath of files) {
    try {
      const result = await validate(filePath, validateOptions);

      if (!result.passed) {
        hasErrors = true;
      }

      if (format === 'json') {
        const json = result.toJSON();
        jsonResults.push({
          file: filePath,
          findings: json.findings,
          summary: json.summary,
          passed: result.passed,
        });
      } else {
        const output = formatTextResult(filePath, result, quiet);
        if (!quiet || !result.passed) {
          process.stdout.write(output + '\n');
          if (files.length > 1) {
            process.stdout.write('\n');
          }
        }
      }
    } catch (error) {
      hasErrors = true;

      const errorMessage =
        error instanceof DicomValidatorError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      if (format === 'json') {
        jsonResults.push({
          file: filePath,
          error: errorMessage,
        });
      } else {
        process.stderr.write(formatTextError(filePath, errorMessage) + '\n');
        if (files.length > 1) {
          process.stderr.write('\n');
        }
      }
    }
  }

  // Output JSON results
  if (format === 'json') {
    const output = files.length === 1 ? jsonResults[0] : jsonResults;
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }

  process.exit(hasErrors ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
});
