/**
 * Review Cycle Generator
 *
 * Creates the 3 review cycles that all performance data references.
 * These must be generated FIRST before any employees.
 */

import { EmployeeRegistry, GeneratedReviewCycle, REVIEW_CYCLE_IDS } from './registry.js';

/**
 * Generate all review cycles and register them
 */
export function generateReviewCycles(registry: EmployeeRegistry): GeneratedReviewCycle[] {
  const cycles: GeneratedReviewCycle[] = [
    {
      id: REVIEW_CYCLE_IDS.ANNUAL_2023,
      name: '2023 Annual Review',
      cycle_type: 'annual',
      start_date: '2023-01-01',
      end_date: '2023-12-31',
      status: 'closed',
    },
    {
      id: REVIEW_CYCLE_IDS.ANNUAL_2024,
      name: '2024 Annual Review',
      cycle_type: 'annual',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      status: 'closed',
    },
    {
      id: REVIEW_CYCLE_IDS.Q1_2025,
      name: 'Q1 2025 Check-in',
      cycle_type: 'quarterly',
      start_date: '2025-01-01',
      end_date: '2025-03-31',
      status: 'active',
    },
  ];

  // Register all cycles
  for (const cycle of cycles) {
    registry.registerCycle(cycle);
  }

  return cycles;
}
