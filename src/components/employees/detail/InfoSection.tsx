/**
 * Info Section Components
 *
 * Reusable components for displaying employee details in a structured format.
 */

import type { Employee } from '../../../lib/types';
import { formatDate } from '../../ui';

// =============================================================================
// Primitives
// =============================================================================

interface InfoRowProps {
  label: string;
  value?: string | null;
}

/**
 * Single row displaying a label-value pair.
 */
export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between gap-2 py-1.5">
      <span className="text-stone-500 text-sm flex-shrink-0">{label}</span>
      <span
        className="text-stone-700 text-sm font-medium min-w-0 truncate text-right"
        title={value || undefined}
      >
        {value || '—'}
      </span>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  count?: number;
}

/**
 * Section header with optional count badge.
 */
export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wider">
        {title}
      </h4>
      {count !== undefined && (
        <span className="text-xs text-stone-500">({count})</span>
      )}
    </div>
  );
}

// =============================================================================
// Section Components
// =============================================================================

interface DetailsSectionProps {
  employee: Employee;
  managerName?: string;
}

/**
 * Basic employee details section (email, hire date, location, manager).
 */
export function DetailsSection({ employee, managerName }: DetailsSectionProps) {
  return (
    <section>
      <SectionHeader title="Details" />
      <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
        <InfoRow label="Email" value={employee.email} />
        <InfoRow label="Hire Date" value={formatDate(employee.hire_date)} />
        <InfoRow label="Location" value={employee.work_state} />
        {employee.manager_id && (
          <InfoRow
            label="Manager"
            value={managerName || `ID: ${employee.manager_id}`}
          />
        )}
      </div>
    </section>
  );
}

interface DemographicsSectionProps {
  employee: Employee;
}

/**
 * Demographics section (DOB, gender, ethnicity).
 * Only renders if demographic data exists.
 */
export function DemographicsSection({ employee }: DemographicsSectionProps) {
  const hasDemographics =
    employee.date_of_birth || employee.gender || employee.ethnicity;

  if (!hasDemographics) return null;

  return (
    <section>
      <SectionHeader title="Demographics" />
      <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
        {employee.date_of_birth && (
          <InfoRow
            label="Date of Birth"
            value={formatDate(employee.date_of_birth)}
          />
        )}
        {employee.gender && <InfoRow label="Gender" value={employee.gender} />}
        {employee.ethnicity && (
          <InfoRow label="Ethnicity" value={employee.ethnicity} />
        )}
      </div>
    </section>
  );
}

interface TerminationSectionProps {
  employee: Employee;
}

/**
 * Termination details section.
 * Only renders if employee is terminated.
 */
export function TerminationSection({ employee }: TerminationSectionProps) {
  if (employee.status !== 'terminated' || !employee.termination_date) {
    return null;
  }

  return (
    <section>
      <SectionHeader title="Termination" />
      <div className="bg-white/40 rounded-lg p-3 border border-stone-200/40">
        <InfoRow label="Date" value={formatDate(employee.termination_date)} />
        {employee.termination_reason && (
          <InfoRow label="Reason" value={employee.termination_reason} />
        )}
      </div>
    </section>
  );
}
