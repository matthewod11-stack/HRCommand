import { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { ImportPreview } from './ImportPreview';
import type { ParsePreview, ColumnMapping, ParsedRow } from '../../lib/types';
import type { CreateEmployeeInput, ImportResult } from '../../lib/tauri-commands';
import {
  readFileAsBytes,
  parseFilePreview,
  parseFile,
  mapEmployeeColumns,
  importEmployees,
} from '../../lib/tauri-commands';

// Standard field labels for display
const EMPLOYEE_FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  first_name: 'First Name',
  last_name: 'Last Name',
  department: 'Department',
  title: 'Job Title',
  hire_date: 'Hire Date',
  work_state: 'Work State',
  manager_email: 'Manager Email',
  status: 'Status',
  date_of_birth: 'Date of Birth',
  gender: 'Gender',
  ethnicity: 'Ethnicity',
};

// Required fields for employee import
const REQUIRED_FIELDS = ['email'];

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete';

interface EmployeeImportProps {
  /** Callback when import completes successfully */
  onComplete?: (result: ImportResult) => void;
  /** Callback when user cancels */
  onCancel?: () => void;
}

export function EmployeeImport({ onComplete, onCancel }: EmployeeImportProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setState('parsing');
    setError(null);
    setSelectedFile(file);

    try {
      // Read file and get preview
      const bytes = await readFileAsBytes(file);
      const previewData = await parseFilePreview(bytes, file.name, 5);

      // Auto-map columns based on headers
      const mapping = await mapEmployeeColumns(previewData.headers);

      setPreview(previewData);
      setColumnMapping(mapping);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setState('idle');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !preview) return;

    setState('importing');
    setError(null);

    try {
      // Parse full file (not just preview)
      const bytes = await readFileAsBytes(selectedFile);
      const fullData = await parseFile(bytes, selectedFile.name);

      // Transform rows to CreateEmployeeInput
      const employees = fullData.rows
        .map((row) => transformRowToEmployee(row, columnMapping))
        .filter((emp): emp is CreateEmployeeInput => emp !== null);

      if (employees.length === 0) {
        throw new Error('No valid employee records found in file');
      }

      // Call backend import
      const importResult = await importEmployees(employees);

      setResult(importResult);
      setState('complete');
      onComplete?.(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('preview');
    }
  }, [selectedFile, preview, columnMapping, onComplete]);

  const handleCancel = useCallback(() => {
    setState('idle');
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setResult(null);
    setError(null);
    onCancel?.();
  }, [onCancel]);

  const handleReset = useCallback(() => {
    setState('idle');
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setResult(null);
    setError(null);
  }, []);

  // Render based on current state
  if (state === 'complete' && result) {
    return (
      <ImportResultView
        result={result}
        onDone={handleReset}
      />
    );
  }

  if ((state === 'preview' || state === 'importing') && preview) {
    return (
      <div className="space-y-4">
        {error && <ErrorBanner message={error} />}
        <ImportPreview
          preview={preview}
          columnMapping={columnMapping}
          requiredFields={REQUIRED_FIELDS}
          fieldLabels={EMPLOYEE_FIELD_LABELS}
          onImport={handleImport}
          onCancel={handleCancel}
          isImporting={state === 'importing'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <FileDropzone
        onFileSelect={handleFileSelect}
        isLoading={state === 'parsing'}
      />
      <ImportInstructions />
    </div>
  );
}

// =============================================================================
// Data Transformation
// =============================================================================

/**
 * Transform a parsed row into a CreateEmployeeInput.
 *
 * This is where you can customize the mapping logic:
 * - Combine first_name + last_name into full_name
 * - Normalize status values
 * - Parse date formats
 * - Handle missing optional fields
 */
function transformRowToEmployee(
  row: ParsedRow,
  mapping: ColumnMapping
): CreateEmployeeInput | null {
  // Helper to get value from row using the mapping
  const getValue = (field: string): string | undefined => {
    const header = mapping[field];
    return header ? row[header]?.trim() : undefined;
  };

  // Email is required
  const email = getValue('email');
  if (!email) {
    return null;
  }

  // Build full_name from first + last, or use as-is if full_name column exists
  const firstName = getValue('first_name') || '';
  const lastName = getValue('last_name') || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

  // Normalize status: accept various formats
  const rawStatus = getValue('status')?.toLowerCase();
  let status: 'active' | 'terminated' | 'leave' | undefined;
  if (rawStatus) {
    if (['active', 'a', 'employed', 'current'].includes(rawStatus)) {
      status = 'active';
    } else if (['terminated', 't', 'term', 'inactive', 'former'].includes(rawStatus)) {
      status = 'terminated';
    } else if (['leave', 'l', 'loa', 'on leave'].includes(rawStatus)) {
      status = 'leave';
    }
  }

  // Normalize termination reason if present
  const rawTermReason = getValue('termination_reason')?.toLowerCase();
  let terminationReason: string | undefined;
  if (rawTermReason) {
    if (['voluntary', 'vol', 'resigned', 'quit'].includes(rawTermReason)) {
      terminationReason = 'voluntary';
    } else if (['involuntary', 'invol', 'fired', 'laid off', 'layoff'].includes(rawTermReason)) {
      terminationReason = 'involuntary';
    } else if (['retirement', 'retired'].includes(rawTermReason)) {
      terminationReason = 'retirement';
    } else {
      terminationReason = 'other';
    }
  }

  return {
    email,
    full_name: fullName,
    department: getValue('department'),
    job_title: getValue('title'),
    hire_date: getValue('hire_date'),
    work_state: getValue('work_state'),
    status,
    date_of_birth: getValue('date_of_birth'),
    gender: getValue('gender'),
    ethnicity: getValue('ethnicity'),
    termination_date: getValue('termination_date'),
    termination_reason: terminationReason,
  };
}

// =============================================================================
// Sub-components
// =============================================================================

function ImportResultView({
  result,
  onDone,
}: {
  result: ImportResult;
  onDone: () => void;
}) {
  const hasErrors = result.errors.length > 0;
  const total = result.created + result.updated;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div
          className={`
            w-16 h-16 mx-auto mb-4
            flex items-center justify-center
            rounded-full
            ${hasErrors ? 'bg-warning/10' : 'bg-primary-50'}
          `}
        >
          {hasErrors ? (
            <svg className="w-8 h-8 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
        </div>

        <h3 className="text-xl font-semibold text-stone-900">
          {hasErrors ? 'Import Completed with Warnings' : 'Import Successful'}
        </h3>

        <p className="mt-2 text-stone-600">
          {total} employee{total !== 1 ? 's' : ''} processed
        </p>

        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{result.created}</div>
            <div className="text-stone-500">Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-600">{result.updated}</div>
            <div className="text-stone-500">Updated</div>
          </div>
          {hasErrors && (
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{result.errors.length}</div>
              <div className="text-stone-500">Errors</div>
            </div>
          )}
        </div>

        {hasErrors && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg text-left">
            <h4 className="text-sm font-medium text-amber-800 mb-2">Errors:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              {result.errors.slice(0, 5).map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
              {result.errors.length > 5 && (
                <li className="text-amber-600">
                  ...and {result.errors.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
        <button
          onClick={onDone}
          className="w-full py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-fade-in">
      <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-red-800">Import Error</h4>
        <p className="mt-1 text-sm text-red-700">{message}</p>
      </div>
    </div>
  );
}

function ImportInstructions() {
  return (
    <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
      <h4 className="text-sm font-medium text-stone-700 mb-2">Expected Columns</h4>
      <p className="text-sm text-stone-600 mb-3">
        Your file should include an <strong>email</strong> column (required). Other columns are optional:
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(EMPLOYEE_FIELD_LABELS).map(([field, label]) => (
          <span
            key={field}
            className={`
              inline-block px-2 py-1 text-xs rounded
              ${field === 'email'
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-stone-200 text-stone-600'}
            `}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Existing employees (matched by email) will be updated. New emails will create new records.
      </p>
    </div>
  );
}

export default EmployeeImport;
