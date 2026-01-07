import { useState, useCallback } from 'react';
import { FileDropzone } from './FileDropzone';
import { ImportPreview } from './ImportPreview';
import type { ParsePreview, ColumnMapping, ParsedRow, EnpsResponse } from '../../lib/types';
import {
  readFileAsBytes,
  parseFilePreview,
  parseFile,
  mapEnpsColumns,
  getEmployeeByEmail,
} from '../../lib/tauri-commands';
import { invoke } from '@tauri-apps/api/core';

// Field labels for display
const ENPS_FIELD_LABELS: Record<string, string> = {
  employee_email: 'Employee Email',
  score: 'Score (0-10)',
  survey_name: 'Survey Name',
  responded_at: 'Response Date',
  comment: 'Comment',
};

const REQUIRED_FIELDS = ['employee_email', 'score'];

type ImportState = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete';

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface EnpsImportProps {
  onComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
}

// Input type for creating eNPS response
interface CreateEnpsInput {
  employee_id: string;
  score: number;
  survey_date: string;
  survey_name?: string;
  feedback_text?: string;
}

// Create eNPS response
async function createEnpsResponse(input: CreateEnpsInput): Promise<EnpsResponse> {
  return invoke('create_enps_response', { input });
}

export function EnpsImport({ onComplete, onCancel }: EnpsImportProps) {
  const [state, setState] = useState<ImportState>('idle');
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [surveyName, setSurveyName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    setState('parsing');
    setError(null);
    setSelectedFile(file);

    try {
      const bytes = await readFileAsBytes(file);
      const previewData = await parseFilePreview(bytes, file.name, 5);
      const mapping = await mapEnpsColumns(previewData.headers);

      setPreview(previewData);
      setColumnMapping(mapping);
      setState('preview');

      // Default survey name from file name
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      if (!surveyName) {
        setSurveyName(baseName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setState('idle');
    }
  }, [surveyName]);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !preview) return;

    setState('importing');
    setError(null);

    try {
      const bytes = await readFileAsBytes(selectedFile);
      const fullData = await parseFile(bytes, selectedFile.name);

      const importResult: ImportResult = { created: 0, skipped: 0, errors: [] };
      const today = new Date().toISOString().split('T')[0];

      for (const row of fullData.rows) {
        try {
          const enps = await transformRowToEnps(row, columnMapping, surveyName || 'Survey', today);
          if (enps) {
            await createEnpsResponse(enps);
            importResult.created++;
          } else {
            importResult.skipped++;
          }
        } catch (err) {
          const email = row[columnMapping.employee_email] || 'unknown';
          importResult.errors.push(`${email}: ${err instanceof Error ? err.message : 'Failed'}`);
        }
      }

      setResult(importResult);
      setState('complete');
      onComplete?.(importResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('preview');
    }
  }, [selectedFile, preview, columnMapping, surveyName, onComplete]);

  const handleCancel = useCallback(() => {
    setState('idle');
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setSurveyName('');
    setResult(null);
    setError(null);
    onCancel?.();
  }, [onCancel]);

  const handleReset = useCallback(() => {
    setState('idle');
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setSurveyName('');
    setResult(null);
    setError(null);
  }, []);

  if (state === 'complete' && result) {
    return <ImportResultView result={result} onDone={handleReset} />;
  }

  if ((state === 'preview' || state === 'importing') && preview) {
    return (
      <div className="space-y-4">
        <SurveyNameInput value={surveyName} onChange={setSurveyName} />
        {error && <ErrorBanner message={error} />}
        <ImportPreview
          preview={preview}
          columnMapping={columnMapping}
          requiredFields={REQUIRED_FIELDS}
          fieldLabels={ENPS_FIELD_LABELS}
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
      <FileDropzone onFileSelect={handleFileSelect} isLoading={state === 'parsing'} />
      <ImportInstructions />
    </div>
  );
}

async function transformRowToEnps(
  row: ParsedRow,
  mapping: ColumnMapping,
  defaultSurveyName: string,
  defaultDate: string
): Promise<CreateEnpsInput | null> {
  const getValue = (field: string): string | undefined => {
    const header = mapping[field];
    return header ? row[header]?.trim() : undefined;
  };

  const email = getValue('employee_email');
  const scoreStr = getValue('score');

  if (!email || !scoreStr) return null;

  const employee = await getEmployeeByEmail(email);
  if (!employee) {
    throw new Error(`Employee not found: ${email}`);
  }

  // Parse score (0-10)
  const score = parseInt(scoreStr, 10);
  if (isNaN(score) || score < 0 || score > 10) {
    throw new Error(`Invalid eNPS score: ${scoreStr} (must be 0-10)`);
  }

  return {
    employee_id: employee.id,
    score,
    survey_date: getValue('responded_at') || defaultDate,
    survey_name: getValue('survey_name') || defaultSurveyName,
    feedback_text: getValue('comment'),
  };
}

function SurveyNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
      <label className="block text-sm font-medium text-primary-700 mb-2">Survey Name</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., Q4 2024 eNPS Survey"
        className="w-full px-3 py-2 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 bg-white"
      />
      <p className="mt-2 text-xs text-primary-600">
        This name will be used to group responses for eNPS score calculation
      </p>
    </div>
  );
}

function ImportResultView({ result, onDone }: { result: ImportResult; onDone: () => void }) {
  const hasErrors = result.errors.length > 0;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div
          className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full ${
            hasErrors ? 'bg-warning/10' : 'bg-primary-50'
          }`}
        >
          <svg
            className={`w-8 h-8 ${hasErrors ? 'text-warning' : 'text-primary-500'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                hasErrors
                  ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              }
            />
          </svg>
        </div>

        <h3 className="text-xl font-semibold text-stone-900">
          {hasErrors ? 'Import Completed with Warnings' : 'Import Successful'}
        </h3>

        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">{result.created}</div>
            <div className="text-stone-500">Responses Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-500">{result.skipped}</div>
            <div className="text-stone-500">Skipped</div>
          </div>
          {hasErrors && (
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{result.errors.length}</div>
              <div className="text-stone-500">Errors</div>
            </div>
          )}
        </div>

        {hasErrors && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg text-left max-h-40 overflow-y-auto">
            <ul className="text-sm text-amber-700 space-y-1">
              {result.errors.slice(0, 10).map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
              {result.errors.length > 10 && (
                <li className="text-amber-600">...and {result.errors.length - 10} more</li>
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
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function ImportInstructions() {
  return (
    <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
      <h4 className="text-sm font-medium text-stone-700 mb-2">Expected Columns</h4>
      <p className="text-sm text-stone-600 mb-3">
        Your file should include <strong>employee email</strong> and <strong>score</strong> (0-10 scale).
      </p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ENPS_FIELD_LABELS).map(([field, label]) => (
          <span
            key={field}
            className={`inline-block px-2 py-1 text-xs rounded ${
              REQUIRED_FIELDS.includes(field)
                ? 'bg-primary-100 text-primary-700 font-medium'
                : 'bg-stone-200 text-stone-600'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="mt-4 p-3 bg-stone-100 rounded text-xs text-stone-600">
        <strong>eNPS Scale:</strong> 0-6 = Detractor, 7-8 = Passive, 9-10 = Promoter
      </div>
    </div>
  );
}

export default EnpsImport;
