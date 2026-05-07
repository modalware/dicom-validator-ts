/**
 * Validation result types and class for collecting and reporting validation findings.
 */

/** Severity levels for validation findings */
export type Severity = 'error' | 'warning' | 'info';

/** A single validation finding produced during validation */
export interface ValidationFinding {
  /** Severity level of the finding */
  severity: Severity;
  /** Tag identifier in "(GGGG,EEEE)" format, or empty string if not tag-specific */
  tag: string;
  /** Module name, or empty string if not module-specific */
  module: string;
  /** Human-readable description (1-500 chars) */
  message: string;
  /** Validation rule identifier that was violated */
  rule: string;
}

/** Summary counts of findings by severity */
export interface ValidationSummary {
  errors: number;
  warnings: number;
  infos: number;
}

/**
 * Collects validation findings and provides summary/query capabilities.
 * Findings are preserved in insertion order.
 */
export class ValidationResult {
  private readonly _findings: ValidationFinding[] = [];

  /** All findings in insertion order */
  get findings(): readonly ValidationFinding[] {
    return this._findings;
  }

  /** Summary counts of findings by severity */
  get summary(): ValidationSummary {
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const finding of this._findings) {
      switch (finding.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'info':
          infos++;
          break;
      }
    }

    return { errors, warnings, infos };
  }

  /** Returns true if there are zero errors */
  get passed(): boolean {
    return this._findings.every(f => f.severity !== 'error');
  }

  /** Add a finding to the result */
  addFinding(finding: ValidationFinding): void {
    this._findings.push(finding);
  }

  /** Get findings filtered by severity */
  getFindings(severity: Severity): ValidationFinding[] {
    return this._findings.filter(f => f.severity === severity);
  }

  /** Serialize to JSON-compatible object */
  toJSON(): { findings: ValidationFinding[]; summary: ValidationSummary } {
    return {
      findings: [...this._findings],
      summary: this.summary,
    };
  }
}
