/**
 * FilterCaption Component (V2.3.2d)
 *
 * Displays the filters that were applied to generate chart data.
 * Provides transparency about what data is included.
 */

interface FilterCaptionProps {
  filters: string;
  total?: number;
}

export function FilterCaption({ filters, total }: FilterCaptionProps) {
  const hasFilters = filters && filters !== 'None';

  return (
    <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
      <div className="flex items-center gap-1">
        {hasFilters && (
          <>
            <FilterIcon />
            <span>Filters: {filters}</span>
          </>
        )}
        {!hasFilters && <span>All employees included</span>}
      </div>

      {total !== undefined && total > 0 && (
        <span className="text-stone-400">Total: {total.toLocaleString()}</span>
      )}
    </div>
  );
}

function FilterIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

export default FilterCaption;
