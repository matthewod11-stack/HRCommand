import { useState, useRef, useCallback } from 'react';
import { SUPPORTED_EXTENSIONS } from '../../lib/types';

interface FileDropzoneProps {
  /** Callback when a valid file is selected or dropped */
  onFileSelect: (file: File) => void;
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Custom accepted extensions (defaults to all supported) */
  acceptedExtensions?: string[];
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_EXTENSIONS = [...SUPPORTED_EXTENSIONS];

export function FileDropzone({
  onFileSelect,
  isLoading = false,
  acceptedExtensions = DEFAULT_EXTENSIONS,
  className = '',
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build accept string for file input (e.g., ".csv,.xlsx,.xls,.tsv")
  const acceptString = acceptedExtensions.map((ext) => `.${ext}`).join(',');

  const validateFile = useCallback(
    (file: File): boolean => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!acceptedExtensions.includes(ext)) {
        setError(`Unsupported format: .${ext}. Accepted: ${acceptedExtensions.map((e) => `.${e}`).join(', ')}`);
        return false;
      }
      // Max file size: 10MB
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File too large. Maximum size is 10MB.');
        return false;
      }
      setError(null);
      return true;
    },
    [acceptedExtensions]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        onFileSelect(file);
      }
    },
    [validateFile, onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!isLoading) {
      inputRef.current?.click();
    }
  }, [isLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={isLoading ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Drop file here or click to browse"
        className={`
          relative
          flex flex-col items-center justify-center
          w-full
          min-h-[200px]
          p-8
          border-2 border-dashed
          rounded-xl
          transition-all duration-200
          cursor-pointer
          ${isLoading ? 'cursor-wait opacity-60' : ''}
          ${
            isDragOver
              ? 'border-primary-500 bg-primary-50'
              : error
                ? 'border-error bg-red-50'
                : 'border-stone-300 bg-stone-50 hover:border-primary-400 hover:bg-stone-100'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {isLoading ? (
          <LoadingState />
        ) : (
          <>
            <UploadIcon isDragOver={isDragOver} hasError={!!error} />
            <p className="mt-4 text-base font-medium text-stone-700">
              {isDragOver ? 'Drop file here' : 'Drag and drop a file'}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              or <span className="text-primary-600 hover:underline">browse</span> to choose
            </p>
            <p className="mt-3 text-xs text-stone-500">
              Supported: {acceptedExtensions.map((e) => `.${e.toUpperCase()}`).join(', ')}
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-error animate-fade-in">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function UploadIcon({ isDragOver, hasError }: { isDragOver: boolean; hasError: boolean }) {
  const colorClass = hasError
    ? 'text-error'
    : isDragOver
      ? 'text-primary-500'
      : 'text-stone-500';

  return (
    <div
      className={`
        w-14 h-14
        flex items-center justify-center
        rounded-full
        transition-all duration-200
        ${isDragOver ? 'bg-primary-100 scale-110' : hasError ? 'bg-red-100' : 'bg-stone-200'}
      `}
    >
      <svg
        className={`w-7 h-7 ${colorClass} transition-colors duration-200`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center">
      <div className="w-14 h-14 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-primary-500 animate-spin-slow"
          fill="none"
          viewBox="0 0 24 24"
        >
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
      </div>
      <p className="mt-4 text-base font-medium text-stone-700">Processing file...</p>
      <p className="mt-1 text-sm text-stone-500">This may take a moment</p>
    </div>
  );
}

export default FileDropzone;
