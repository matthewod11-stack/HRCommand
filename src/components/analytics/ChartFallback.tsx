/**
 * ChartFallback Component (V2.3.2e)
 *
 * Displays when a chart cannot be generated.
 * Shows the reason and any text response from Claude.
 */

interface ChartFallbackProps {
  reason: string;
  textResponse?: string;
}

export function ChartFallback({ reason, textResponse }: ChartFallbackProps) {
  return (
    <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200/60">
      <div className="flex items-start gap-2">
        <InfoIcon />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-stone-500 mb-1">{reason}</p>
          {textResponse && (
            <p className="text-sm text-stone-700 whitespace-pre-wrap">{textResponse}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoIcon() {
  return (
    <svg
      className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default ChartFallback;
