import { useState, useCallback, useEffect } from 'react';
import { FileDropzone } from './FileDropzone';
import { ImportPreview } from './ImportPreview';
import type { ParsePreview, ColumnMapping, ParsedRow, PerformanceReview, ReviewCycle } from '../../lib/types';
import {
  readFileAsBytes,
  parseFilePreview,
  parseFile,
  getEmployeeByEmail,
  listReviewCycles,
  createReviewCycle,
} from '../../lib/tauri-commands';
import { invoke } from '@tauri-apps/api/core';

// Field labels for display
const REVIEW_FIELD_LABELS: Record<string, string> = {
  employee_email: 'Employee Email',
  strengths: 'Strengths',
  areas_for_improvement: 'Areas for Improvement',
  accomplishments: 'Accomplishments',
  goals_next_period: 'Goals (Next Period)',
  manager_comments: 'Manager Comments',
  self_assessment: 'Self Assessment',
  review_date: 'Review Date',
};

const REQUIRED_FIELDS = ['employee_email'];

// Column mapping for reviews
const REVIEW_COLUMN_MAPPINGS: [string, string[]][] = [
  ['employee_email', ['email', 'employee_email', 'employeeemail', 'employee']],
  ['strengths', ['strengths', 'strength', 'strong_points', 'positives']],
  ['areas_for_improvement', ['areas_for_improvement', 'improvements', 'weaknesses', 'growth_areas', 'development']],
  ['accomplishments', ['accomplishments', 'achievements', 'wins', 'successes']],
  ['goals_next_period', ['goals_next_period', 'goals', 'next_goals', 'objectives']],
  ['manager_comments', ['manager_comments', 'manager_feedback', 'supervisor_comments', 'comments']],
  ['self_assessment', ['self_assessment', 'self_review', 'employee_comments']],
  ['review_date', ['review_date', 'reviewdate', 'date']],
];

type ImportState = 'select-cycle' | 'idle' | 'parsing' | 'preview' | 'importing' | 'complete';

interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface ReviewsImportProps {
  onComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
}

// Input type for creating reviews
interface CreateReviewInput {
  employee_id: string;
  review_cycle_id: string;
  strengths?: string;
  areas_for_improvement?: string;
  accomplishments?: string;
  goals_next_period?: string;
  manager_comments?: string;
  self_assessment?: string;
  review_date?: string;
}

// Create performance review
async function createPerformanceReview(input: CreateReviewInput): Promise<PerformanceReview> {
  return invoke('create_performance_review', { input });
}

export function ReviewsImport({ onComplete, onCancel }: ReviewsImportProps) {
  const [state, setState] = useState<ImportState>('select-cycle');
  const [reviewCycles, setReviewCycles] = useState<ReviewCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<ReviewCycle | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCycleName, setNewCycleName] = useState('');

  useEffect(() => {
    loadReviewCycles();
  }, []);

  const loadReviewCycles = async () => {
    try {
      const cycles = await listReviewCycles();
      setReviewCycles(cycles);
    } catch (err) {
      setError('Failed to load review cycles');
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycleName.trim()) return;
    try {
      const today = new Date();
      const yearStart = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const yearEnd = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];

      const cycle = await createReviewCycle({
        name: newCycleName.trim(),
        cycle_type: 'annual',
        start_date: yearStart,
        end_date: yearEnd,
        status: 'active',
      });
      setSelectedCycle(cycle);
      setReviewCycles((prev) => [cycle, ...prev]);
      setState('idle');
      setNewCycleName('');
    } catch (err) {
      setError('Failed to create review cycle');
    }
  };

  const handleSelectCycle = (cycle: ReviewCycle) => {
    setSelectedCycle(cycle);
    setState('idle');
  };

  // Map headers to review fields
  const mapReviewColumns = (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    for (const [standardField, alternatives] of REVIEW_COLUMN_MAPPINGS) {
      for (const header of headers) {
        const normalized = header.toLowerCase().replace(/[\s-]/g, '_').replace(/[^a-z0-9_]/g, '');
        if (alternatives.includes(normalized)) {
          mapping[standardField] = header;
          break;
        }
      }
    }
    return mapping;
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setState('parsing');
    setError(null);
    setSelectedFile(file);

    try {
      const bytes = await readFileAsBytes(file);
      const previewData = await parseFilePreview(bytes, file.name, 5);
      const mapping = mapReviewColumns(previewData.headers);

      setPreview(previewData);
      setColumnMapping(mapping);
      setState('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setState('idle');
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!selectedFile || !preview || !selectedCycle) return;

    setState('importing');
    setError(null);

    try {
      const bytes = await readFileAsBytes(selectedFile);
      const fullData = await parseFile(bytes, selectedFile.name);

      const importResult: ImportResult = { created: 0, skipped: 0, errors: [] };

      for (const row of fullData.rows) {
        try {
          const review = await transformRowToReview(row, columnMapping, selectedCycle.id);
          if (review) {
            await createPerformanceReview(review);
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
  }, [selectedFile, preview, columnMapping, selectedCycle, onComplete]);

  const handleCancel = useCallback(() => {
    setState('select-cycle');
    setSelectedCycle(null);
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setResult(null);
    setError(null);
    onCancel?.();
  }, [onCancel]);

  const handleReset = useCallback(() => {
    setState('select-cycle');
    setSelectedCycle(null);
    setPreview(null);
    setColumnMapping({});
    setSelectedFile(null);
    setResult(null);
    setError(null);
  }, []);

  if (state === 'complete' && result) {
    return <ImportResultView result={result} onDone={handleReset} entityName="Reviews" />;
  }

  if (state === 'select-cycle') {
    return (
      <CycleSelector
        cycles={reviewCycles}
        newCycleName={newCycleName}
        onNewCycleNameChange={setNewCycleName}
        onCreateCycle={handleCreateCycle}
        onSelectCycle={handleSelectCycle}
        onCancel={onCancel}
        error={error}
      />
    );
  }

  if ((state === 'preview' || state === 'importing') && preview) {
    return (
      <div className="space-y-4">
        <CycleHeader cycle={selectedCycle!} onChangeCycle={() => setState('select-cycle')} />
        {error && <ErrorBanner message={error} />}
        <ImportPreview
          preview={preview}
          columnMapping={columnMapping}
          requiredFields={REQUIRED_FIELDS}
          fieldLabels={REVIEW_FIELD_LABELS}
          onImport={handleImport}
          onCancel={handleCancel}
          isImporting={state === 'importing'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CycleHeader cycle={selectedCycle!} onChangeCycle={() => setState('select-cycle')} />
      {error && <ErrorBanner message={error} />}
      <FileDropzone onFileSelect={handleFileSelect} isLoading={state === 'parsing'} />
      <ImportInstructions fieldLabels={REVIEW_FIELD_LABELS} requiredFields={REQUIRED_FIELDS} />
    </div>
  );
}

async function transformRowToReview(
  row: ParsedRow,
  mapping: ColumnMapping,
  reviewCycleId: string
): Promise<CreateReviewInput | null> {
  const getValue = (field: string): string | undefined => {
    const header = mapping[field];
    return header ? row[header]?.trim() : undefined;
  };

  const email = getValue('employee_email');
  if (!email) return null;

  const employee = await getEmployeeByEmail(email);
  if (!employee) {
    throw new Error(`Employee not found: ${email}`);
  }

  return {
    employee_id: employee.id,
    review_cycle_id: reviewCycleId,
    strengths: getValue('strengths'),
    areas_for_improvement: getValue('areas_for_improvement'),
    accomplishments: getValue('accomplishments'),
    goals_next_period: getValue('goals_next_period'),
    manager_comments: getValue('manager_comments'),
    self_assessment: getValue('self_assessment'),
    review_date: getValue('review_date'),
  };
}

// Reusable sub-components (simplified versions)
function CycleSelector({ cycles, newCycleName, onNewCycleNameChange, onCreateCycle, onSelectCycle, onCancel, error }: {
  cycles: ReviewCycle[]; newCycleName: string; onNewCycleNameChange: (n: string) => void;
  onCreateCycle: () => void; onSelectCycle: (c: ReviewCycle) => void; onCancel?: () => void; error: string | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
        <h3 className="text-lg font-medium text-stone-900">Select Review Cycle</h3>
        <p className="mt-1 text-sm text-stone-500">Choose which cycle these reviews belong to</p>
      </div>
      {error && <div className="px-6 py-3 bg-red-50 border-b border-red-200"><p className="text-sm text-red-700">{error}</p></div>}
      <div className="p-6 space-y-4">
        {cycles.length > 0 && (
          <div className="space-y-2">
            {cycles.map((cycle) => (
              <button key={cycle.id} onClick={() => onSelectCycle(cycle)}
                className="w-full p-3 text-left border border-stone-200 rounded-lg hover:border-primary-300 hover:bg-primary-50">
                <div className="font-medium text-stone-900">{cycle.name}</div>
                <div className="text-sm text-stone-500">{cycle.cycle_type} • {cycle.status}</div>
              </button>
            ))}
          </div>
        )}
        <div className="pt-4 border-t border-stone-200 flex gap-2">
          <input type="text" value={newCycleName} onChange={(e) => onNewCycleNameChange(e.target.value)}
            placeholder="New cycle name" className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-primary-200" />
          <button onClick={onCreateCycle} disabled={!newCycleName.trim()}
            className={`px-4 py-2 rounded-lg font-medium ${newCycleName.trim() ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-stone-200 text-stone-400'}`}>
            Create
          </button>
        </div>
      </div>
      {onCancel && (
        <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50">Cancel</button>
        </div>
      )}
    </div>
  );
}

function CycleHeader({ cycle, onChangeCycle }: { cycle: ReviewCycle; onChangeCycle: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-primary-50 border border-primary-200 rounded-lg">
      <div>
        <div className="text-sm text-primary-600 font-medium">Review Cycle</div>
        <div className="text-lg font-semibold text-primary-900">{cycle.name}</div>
      </div>
      <button onClick={onChangeCycle} className="text-sm text-primary-600 hover:underline">Change</button>
    </div>
  );
}

function ImportResultView({ result, onDone, entityName }: { result: ImportResult; onDone: () => void; entityName: string }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-8 text-center">
        <div className={`w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full ${hasErrors ? 'bg-warning/10' : 'bg-primary-50'}`}>
          <svg className={`w-8 h-8 ${hasErrors ? 'text-warning' : 'text-primary-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={hasErrors ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-stone-900">{hasErrors ? 'Import Completed with Warnings' : 'Import Successful'}</h3>
        <div className="mt-6 flex justify-center gap-8 text-sm">
          <div><div className="text-2xl font-bold text-primary-600">{result.created}</div><div className="text-stone-500">{entityName} Created</div></div>
          <div><div className="text-2xl font-bold text-stone-400">{result.skipped}</div><div className="text-stone-500">Skipped</div></div>
          {hasErrors && <div><div className="text-2xl font-bold text-warning">{result.errors.length}</div><div className="text-stone-500">Errors</div></div>}
        </div>
        {hasErrors && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg text-left max-h-40 overflow-y-auto">
            <ul className="text-sm text-amber-700 space-y-1">
              {result.errors.slice(0, 10).map((err, idx) => <li key={idx}>• {err}</li>)}
            </ul>
          </div>
        )}
      </div>
      <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
        <button onClick={onDone} className="w-full py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg">Done</button>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function ImportInstructions({ fieldLabels, requiredFields }: { fieldLabels: Record<string, string>; requiredFields: string[] }) {
  return (
    <div className="p-4 bg-stone-50 rounded-lg border border-stone-200">
      <h4 className="text-sm font-medium text-stone-700 mb-2">Expected Columns</h4>
      <div className="flex flex-wrap gap-2">
        {Object.entries(fieldLabels).map(([field, label]) => (
          <span key={field} className={`inline-block px-2 py-1 text-xs rounded ${requiredFields.includes(field) ? 'bg-primary-100 text-primary-700 font-medium' : 'bg-stone-200 text-stone-600'}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ReviewsImport;
