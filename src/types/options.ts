/**
 * Validation options for configuring validation behavior.
 */

export interface ValidateOptions {
  /** Enable/disable specific validation categories */
  checks?: {
    /** VR format validation (default: true) */
    vr?: boolean;
    /** VM constraint validation (default: true) */
    vm?: boolean;
    /** IOD structure validation (default: true) */
    iod?: boolean;
  };
  /** Override SOP Class UID (skip auto-detection) */
  sopClassUID?: string;
  /** Verbosity level for filtering findings */
  verbosity?: 'errors-only' | 'normal' | 'verbose';
}
