/**
 * EmployeeRegistry - The source of truth for all generated test data
 *
 * This registry maintains stable UUIDs and relationships across all generators.
 * Other generators MUST use this registry to look up employee IDs instead of
 * generating their own.
 */

import * as fs from 'fs';
import * as path from 'path';

// Types matching the database schema
export interface GeneratedEmployee {
  id: string;
  email: string;
  full_name: string;
  department: string;
  job_title: string;
  manager_id: string | null;
  hire_date: string;
  work_state: string;
  status: 'active' | 'terminated' | 'leave';
  date_of_birth?: string;
  gender?: string;
  ethnicity?: string;
  termination_date?: string;
  termination_reason?: 'voluntary' | 'involuntary' | 'retirement' | 'other';
}

export interface GeneratedReviewCycle {
  id: string;
  name: string;
  cycle_type: 'annual' | 'semi-annual' | 'quarterly';
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
}

// Special case employees with known emails for stable references
export const SPECIAL_EMPLOYEE_EMAILS = {
  SARAH_CHEN: 'sarah.chen@acmecorp.com',
  MARCUS_JOHNSON: 'marcus.johnson@acmecorp.com',
  ELENA_RODRIGUEZ: 'elena.rodriguez@acmecorp.com',
  JAMES_PARK: 'james.park@acmecorp.com',
  LISA_THOMPSON: 'lisa.thompson@acmecorp.com',
  ROBERT_KIM: 'robert.kim@acmecorp.com',
  AMANDA_FOSTER: 'amanda.foster@acmecorp.com',
  DAVID_NGUYEN: 'david.nguyen@acmecorp.com',
  JENNIFER_WALSH: 'jennifer.walsh@acmecorp.com',
  MICHAEL_BROWN: 'michael.brown@acmecorp.com',
} as const;

// Review cycle IDs (stable across all data)
export const REVIEW_CYCLE_IDS = {
  ANNUAL_2023: 'rc_2023_annual',
  ANNUAL_2024: 'rc_2024_annual',
  Q1_2025: 'rc_2025_q1',
} as const;

/**
 * Generate a deterministic UUID-like ID for employees
 * Format: emp_<8-char-hash> for readability in debugging
 */
function generateEmployeeId(email: string): string {
  // Simple hash based on email for deterministic IDs
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const positiveHash = Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
  return `emp_${positiveHash}`;
}

/**
 * Main registry class - serialize/deserialize for cross-session use
 */
export class EmployeeRegistry {
  private employees: Map<string, GeneratedEmployee> = new Map();
  private emailToId: Map<string, string> = new Map();
  private reviewCycles: Map<string, GeneratedReviewCycle> = new Map();

  /**
   * Register a new employee and get their stable ID
   */
  register(employee: Omit<GeneratedEmployee, 'id'>): GeneratedEmployee {
    const id = generateEmployeeId(employee.email);

    if (this.employees.has(id)) {
      throw new Error(`Duplicate employee ID generated for ${employee.email}`);
    }

    const fullEmployee: GeneratedEmployee = { ...employee, id };
    this.employees.set(id, fullEmployee);
    this.emailToId.set(employee.email, id);

    return fullEmployee;
  }

  /**
   * Register a review cycle
   */
  registerCycle(cycle: GeneratedReviewCycle): void {
    this.reviewCycles.set(cycle.id, cycle);
  }

  /**
   * Get employee by ID
   */
  getById(id: string): GeneratedEmployee | undefined {
    return this.employees.get(id);
  }

  /**
   * Get employee by email
   */
  getByEmail(email: string): GeneratedEmployee | undefined {
    const id = this.emailToId.get(email);
    return id ? this.employees.get(id) : undefined;
  }

  /**
   * Get the manager ID for an employee
   */
  getManagerId(employeeId: string): string | null {
    const employee = this.employees.get(employeeId);
    return employee?.manager_id ?? null;
  }

  /**
   * Get all employees in a department
   */
  getEmployeesByDepartment(department: string): GeneratedEmployee[] {
    return Array.from(this.employees.values())
      .filter(emp => emp.department === department);
  }

  /**
   * Get all employees who were active on a specific date
   * (for eNPS survey filtering)
   */
  getActiveOnDate(date: string): GeneratedEmployee[] {
    return Array.from(this.employees.values()).filter(emp => {
      // Must have been hired before the date
      if (emp.hire_date > date) return false;

      // If terminated, must have been after the date
      if (emp.status === 'terminated' && emp.termination_date && emp.termination_date < date) {
        return false;
      }

      return true;
    });
  }

  /**
   * Get all employees with a specific status
   */
  getByStatus(status: 'active' | 'terminated' | 'leave'): GeneratedEmployee[] {
    return Array.from(this.employees.values())
      .filter(emp => emp.status === status);
  }

  /**
   * Get all employees reporting to a specific manager
   */
  getDirectReports(managerId: string): GeneratedEmployee[] {
    return Array.from(this.employees.values())
      .filter(emp => emp.manager_id === managerId);
  }

  /**
   * Get all employees
   */
  getAllEmployees(): GeneratedEmployee[] {
    return Array.from(this.employees.values());
  }

  /**
   * Get all review cycles
   */
  getAllCycles(): GeneratedReviewCycle[] {
    return Array.from(this.reviewCycles.values());
  }

  /**
   * Get review cycle by ID
   */
  getCycle(id: string): GeneratedReviewCycle | undefined {
    return this.reviewCycles.get(id);
  }

  /**
   * Get total count
   */
  get count(): number {
    return this.employees.size;
  }

  /**
   * Serialize to JSON for persistence
   */
  toJSON(): string {
    return JSON.stringify({
      employees: Array.from(this.employees.entries()),
      emailToId: Array.from(this.emailToId.entries()),
      reviewCycles: Array.from(this.reviewCycles.entries()),
    }, null, 2);
  }

  /**
   * Deserialize from JSON
   */
  static fromJSON(json: string): EmployeeRegistry {
    const data = JSON.parse(json);
    const registry = new EmployeeRegistry();
    registry.employees = new Map(data.employees);
    registry.emailToId = new Map(data.emailToId);
    registry.reviewCycles = new Map(data.reviewCycles || []);
    return registry;
  }

  /**
   * Save to disk
   */
  save(outputDir: string): void {
    const filePath = path.join(outputDir, 'registry.json');
    fs.writeFileSync(filePath, this.toJSON());
  }

  /**
   * Load from disk
   */
  static load(outputDir: string): EmployeeRegistry {
    const filePath = path.join(outputDir, 'registry.json');
    const json = fs.readFileSync(filePath, 'utf-8');
    return EmployeeRegistry.fromJSON(json);
  }
}
