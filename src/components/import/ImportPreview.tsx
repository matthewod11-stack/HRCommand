import type { ParsePreview, ColumnMapping, ParsedRow } from '../../lib/types';

interface ImportPreviewProps {
  /** Preview data from the parser */
  preview: ParsePreview;
  /** Column mapping (standard field -> parsed header) */
  columnMapping: ColumnMapping;
  /** Required fields that must be mapped */
  requiredFields: string[];
  /** Labels for standard fields */
  fieldLabels: Record<string, string>;
  /** Callback when user wants to proceed with import */
  onImport: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Whether import is in progress */
  isImporting?: boolean;
}

export function ImportPreview({
  preview,
  columnMapping,
  requiredFields,
  fieldLabels,
  onImport,
  onCancel,
  isImporting = false,
}: ImportPreviewProps) {
  // Check if all required fields are mapped
  const missingFields = requiredFields.filter((field) => !columnMapping[field]);
  const canImport = missingFields.length === 0;

  // Get mapped columns for display
  const mappedFields = Object.keys(columnMapping);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-stone-900">Import Preview</h3>
            <p className="mt-1 text-sm text-stone-500">
              {preview.total_rows.toLocaleString()} row{preview.total_rows !== 1 ? 's' : ''} found
              <span className="mx-2 text-stone-300">|</span>
              Format: {preview.file_format}
            </p>
          </div>
          <FileFormatBadge format={preview.file_format} />
        </div>
      </div>

      {/* Column Mapping Summary */}
      <div className="px-6 py-4 border-b border-stone-200">
        <h4 className="text-sm font-medium text-stone-700 mb-3">Column Mapping</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(fieldLabels).map(([field, label]) => {
            const isMapped = columnMapping[field];
            const isRequired = requiredFields.includes(field);

            return (
              <div
                key={field}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                  ${
                    isMapped
                      ? 'bg-primary-50 text-primary-700 border border-primary-200'
                      : isRequired
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-stone-100 text-stone-500 border border-stone-200'
                  }
                `}
              >
                {isMapped ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : isRequired ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : null}
                <span>{label}</span>
                {isMapped && (
                  <span className="text-xs opacity-70">({columnMapping[field]})</span>
                )}
              </div>
            );
          })}
        </div>
        {missingFields.length > 0 && (
          <p className="mt-3 text-sm text-red-600">
            Missing required column{missingFields.length > 1 ? 's' : ''}:{' '}
            {missingFields.map((f) => fieldLabels[f] || f).join(', ')}
          </p>
        )}
      </div>

      {/* Data Preview Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              {mappedFields.map((field) => (
                <th
                  key={field}
                  className="px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider"
                >
                  {fieldLabels[field] || field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {preview.preview_rows.map((row, idx) => (
              <PreviewRow
                key={idx}
                row={row}
                mappedFields={mappedFields}
                columnMapping={columnMapping}
                isEven={idx % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      {preview.total_rows > preview.preview_rows.length && (
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-200">
          <p className="text-sm text-stone-500 text-center">
            Showing {preview.preview_rows.length} of {preview.total_rows.toLocaleString()} rows
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t border-stone-200 bg-white flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isImporting}
          className={`
            px-4 py-2
            text-sm font-medium
            text-stone-700
            bg-white
            border border-stone-300
            rounded-lg
            hover:bg-stone-50
            transition-colors duration-200
            ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={!canImport || isImporting}
          className={`
            px-4 py-2
            text-sm font-medium
            text-white
            rounded-lg
            transition-all duration-200
            flex items-center gap-2
            ${
              canImport && !isImporting
                ? 'bg-primary-500 hover:bg-primary-600'
                : 'bg-stone-300 cursor-not-allowed'
            }
          `}
        >
          {isImporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Importing...
            </>
          ) : (
            <>
              Import {preview.total_rows.toLocaleString()} Row{preview.total_rows !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function PreviewRow({
  row,
  mappedFields,
  columnMapping,
  isEven,
}: {
  row: ParsedRow;
  mappedFields: string[];
  columnMapping: ColumnMapping;
  isEven: boolean;
}) {
  return (
    <tr className={isEven ? 'bg-white' : 'bg-stone-50/50'}>
      {mappedFields.map((field) => {
        const header = columnMapping[field];
        const value = header ? row[header] : '';

        return (
          <td key={field} className="px-4 py-3 text-sm text-stone-700">
            {value ? (
              <span className="truncate block max-w-[200px]" title={value}>
                {value}
              </span>
            ) : (
              <span className="text-stone-400 italic">—</span>
            )}
          </td>
        );
      })}
    </tr>
  );
}

function FileFormatBadge({ format }: { format: string }) {
  const colors: Record<string, string> = {
    CSV: 'bg-blue-100 text-blue-700 border-blue-200',
    TSV: 'bg-purple-100 text-purple-700 border-purple-200',
    XLSX: 'bg-green-100 text-green-700 border-green-200',
    XLS: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-1
        text-xs font-medium
        rounded-md border
        ${colors[format] || 'bg-stone-100 text-stone-700 border-stone-200'}
      `}
    >
      {format}
    </span>
  );
}

export default ImportPreview;
