/**
 * Employee Generator
 *
 * Generates 100 Acme Corp employees with proper manager hierarchy.
 * Generation order: CEO → Executives → Managers → Individual Contributors
 *
 * Distribution (from plan):
 * - Status: 82 active, 12 terminated, 6 on leave
 * - Departments: Engineering (28), Sales (18), Marketing (12), Operations (14),
 *   HR (6), Finance (8), Customer Success (10), Executive (4)
 */

import {
  EmployeeRegistry,
  GeneratedEmployee,
  SPECIAL_EMPLOYEE_EMAILS,
} from './registry.js';
import {
  generateFullName,
  generateEmail,
  generateDateOfBirth,
  generateHireDateInRange,
  generateGender,
  generateEthnicity,
  generateWorkState,
  setSeed,
} from './names.js';

// Track used emails to prevent duplicates
const usedEmails = new Set<string>();

// Department definitions with hierarchy
interface DepartmentConfig {
  name: string;
  headTitle: string;
  headLevel: 'VP' | 'Director' | 'Manager';
  managerCount: number;
  icCount: number;
}

const DEPARTMENTS: DepartmentConfig[] = [
  { name: 'Engineering', headTitle: 'VP of Engineering', headLevel: 'VP', managerCount: 3, icCount: 24 },
  { name: 'Sales', headTitle: 'VP of Sales', headLevel: 'VP', managerCount: 2, icCount: 15 },
  { name: 'Marketing', headTitle: 'Director of Marketing', headLevel: 'Director', managerCount: 0, icCount: 11 },
  { name: 'Operations', headTitle: 'Director of Operations', headLevel: 'Director', managerCount: 1, icCount: 12 },
  { name: 'HR', headTitle: 'Director of HR', headLevel: 'Director', managerCount: 0, icCount: 5 },
  { name: 'Finance', headTitle: 'Director of Finance', headLevel: 'Director', managerCount: 0, icCount: 7 },
  { name: 'Customer Success', headTitle: 'Customer Success Manager', headLevel: 'Manager', managerCount: 0, icCount: 9 },
];

// Tenure ranges for hire dates
const TENURE_RANGES = [
  { weight: 15, start: '2025-01-01', end: '2025-12-16' },  // < 1 year
  { weight: 22, start: '2023-01-01', end: '2024-12-31' },  // 1-2 years
  { weight: 35, start: '2020-01-01', end: '2022-12-31' },  // 2-5 years
  { weight: 20, start: '2015-01-01', end: '2019-12-31' },  // 5-10 years
  { weight: 8, start: '2010-01-01', end: '2014-12-31' },   // 10+ years
];

// IC job titles by department
const JOB_TITLES: Record<string, string[]> = {
  Engineering: ['Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'QA Engineer', 'DevOps Engineer'],
  Sales: ['Account Executive', 'Sales Representative', 'Business Development Rep', 'Sales Engineer'],
  Marketing: ['Marketing Specialist', 'Content Manager', 'Product Marketing Manager', 'Brand Manager', 'Digital Marketing Specialist'],
  Operations: ['Operations Analyst', 'Project Coordinator', 'Business Analyst', 'Operations Specialist'],
  HR: ['HR Specialist', 'Recruiter', 'HR Coordinator', 'Benefits Administrator'],
  Finance: ['Financial Analyst', 'Accountant', 'Senior Accountant', 'Payroll Specialist'],
  'Customer Success': ['Customer Success Rep', 'Support Specialist', 'Account Manager', 'Implementation Specialist'],
};

/**
 * Pick hire date based on tenure distribution
 */
function pickHireDate(): string {
  let random = Math.random() * 100;

  for (const range of TENURE_RANGES) {
    random -= range.weight;
    if (random <= 0) {
      return generateHireDateInRange(range.start, range.end);
    }
  }

  return generateHireDateInRange('2020-01-01', '2024-12-31');
}

/**
 * Pick a job title for a department
 */
function pickJobTitle(department: string, index: number): string {
  const titles = JOB_TITLES[department] || ['Specialist'];
  return titles[index % titles.length];
}

/**
 * Create a generic employee (not special case)
 */
function createGenericEmployee(
  department: string,
  jobTitle: string,
  managerId: string | null,
  registry: EmployeeRegistry,
  overrides: Partial<GeneratedEmployee> = {}
): GeneratedEmployee {
  const gender = generateGender();
  const fullName = generateFullName(gender);
  const email = generateEmail(fullName, usedEmails);

  const employee: Omit<GeneratedEmployee, 'id'> = {
    email,
    full_name: fullName,
    department,
    job_title: jobTitle,
    manager_id: managerId,
    hire_date: pickHireDate(),
    work_state: generateWorkState(),
    status: 'active',
    date_of_birth: generateDateOfBirth(),
    gender,
    ethnicity: generateEthnicity(),
    ...overrides,
  };

  return registry.register(employee);
}

// =============================================================================
// SPECIAL CASE EMPLOYEES (10 specific employees from plan)
// =============================================================================

interface SpecialEmployeeConfig {
  emailKey: keyof typeof SPECIAL_EMPLOYEE_EMAILS;
  full_name: string;
  department: string;
  job_title: string;
  hire_date: string;
  status: 'active' | 'terminated' | 'leave';
  gender: string;
  work_state: string;
  termination_date?: string;
  termination_reason?: 'voluntary' | 'involuntary' | 'retirement' | 'other';
  // Manager will be determined dynamically based on department
}

// The 10 special case employees from the plan
const SPECIAL_EMPLOYEES: SpecialEmployeeConfig[] = [
  {
    // #1 Sarah Chen - High performer, declining eNPS (flight risk)
    emailKey: 'SARAH_CHEN',
    full_name: 'Sarah Chen',
    department: 'Marketing',
    job_title: 'Marketing Manager',
    hire_date: '2021-03-15',
    status: 'active',
    gender: 'Female',
    work_state: 'California',
  },
  {
    // #2 Marcus Johnson - Two cycles < 2.5 rating (underperformer)
    emailKey: 'MARCUS_JOHNSON',
    full_name: 'Marcus Johnson',
    department: 'Sales',
    job_title: 'Sales Representative',
    hire_date: '2022-06-01',
    status: 'active',
    gender: 'Male',
    work_state: 'Texas',
  },
  {
    // #3 Elena Rodriguez - 4.5+ ratings, 6 years (promotion ready)
    emailKey: 'ELENA_RODRIGUEZ',
    full_name: 'Elena Rodriguez',
    department: 'Engineering',
    job_title: 'Senior Software Engineer',
    hire_date: '2019-04-15',
    status: 'active',
    gender: 'Female',
    work_state: 'California',
  },
  {
    // #4 James Park - New hire (3 months), 2.8 rating (struggling)
    emailKey: 'JAMES_PARK',
    full_name: 'James Park',
    department: 'Engineering',
    job_title: 'Junior Software Engineer',
    hire_date: '2024-09-15',
    status: 'active',
    gender: 'Male',
    work_state: 'Washington',
  },
  {
    // #5 Lisa Thompson - Work anniversary Dec 20, 2020
    emailKey: 'LISA_THOMPSON',
    full_name: 'Lisa Thompson',
    department: 'Operations',
    job_title: 'Operations Analyst',
    hire_date: '2020-12-20',
    status: 'active',
    gender: 'Female',
    work_state: 'Colorado',
  },
  {
    // #6 Robert Kim - 12 years tenure, steady 3.5 (longest tenure)
    emailKey: 'ROBERT_KIM',
    full_name: 'Robert Kim',
    department: 'Finance',
    job_title: 'Senior Accountant',
    hire_date: '2013-02-10',
    status: 'active',
    gender: 'Male',
    work_state: 'California',
  },
  {
    // #7 Amanda Foster - Terminated last month (voluntary)
    emailKey: 'AMANDA_FOSTER',
    full_name: 'Amanda Foster',
    department: 'Sales',
    job_title: 'Account Executive',
    hire_date: '2021-08-15',
    status: 'terminated',
    gender: 'Female',
    work_state: 'New York',
    termination_date: '2024-11-15',
    termination_reason: 'voluntary',
  },
  {
    // #8 David Nguyen - On parental leave since Nov
    emailKey: 'DAVID_NGUYEN',
    full_name: 'David Nguyen',
    department: 'Engineering',
    job_title: 'Staff Engineer',
    hire_date: '2018-03-01',
    status: 'leave',
    gender: 'Male',
    work_state: 'California',
  },
  {
    // #9 Jennifer Walsh - Eng Manager with low team eNPS (avg 5.2)
    emailKey: 'JENNIFER_WALSH',
    full_name: 'Jennifer Walsh',
    department: 'Engineering',
    job_title: 'Engineering Manager',
    hire_date: '2019-01-15',
    status: 'active',
    gender: 'Female',
    work_state: 'California',
  },
  {
    // #10 Michael Brown - Remote CA employee, company in NY
    emailKey: 'MICHAEL_BROWN',
    full_name: 'Michael Brown',
    department: 'Engineering',
    job_title: 'Software Engineer',
    hire_date: '2022-05-01',
    status: 'active',
    gender: 'Male',
    work_state: 'California',
  },
];

/**
 * Generate all 100 employees in proper hierarchy order
 */
export function generateEmployees(registry: EmployeeRegistry): GeneratedEmployee[] {
  setSeed(42); // Deterministic generation

  const allEmployees: GeneratedEmployee[] = [];

  // Track department heads and managers for hierarchy building
  const departmentHeads: Map<string, string> = new Map();
  const departmentManagers: Map<string, string[]> = new Map();

  // ==========================================================================
  // STEP 1: Generate CEO
  // ==========================================================================
  console.log('Generating CEO...');
  const ceo = registry.register({
    email: 'margaret.chen@acmecorp.com',
    full_name: 'Margaret Chen',
    department: 'Executive',
    job_title: 'Chief Executive Officer',
    manager_id: null,
    hire_date: '2012-03-01',
    work_state: 'California',
    status: 'active',
    date_of_birth: '1968-07-15',
    gender: 'Female',
    ethnicity: 'Asian',
  });
  usedEmails.add(ceo.email);
  allEmployees.push(ceo);

  // ==========================================================================
  // STEP 2: Generate Department Heads (report to CEO)
  // ==========================================================================
  console.log('Generating department heads...');

  for (const dept of DEPARTMENTS) {
    const gender = generateGender();
    const fullName = generateFullName(gender);
    const email = generateEmail(fullName, usedEmails);

    const head = registry.register({
      email,
      full_name: fullName,
      department: dept.name,
      job_title: dept.headTitle,
      manager_id: ceo.id,
      hire_date: generateHireDateInRange('2015-01-01', '2021-12-31'),
      work_state: generateWorkState(),
      status: 'active',
      date_of_birth: generateDateOfBirth(),
      gender,
      ethnicity: generateEthnicity(),
    });

    departmentHeads.set(dept.name, head.id);
    allEmployees.push(head);
  }

  // ==========================================================================
  // STEP 3: Generate Department Managers (report to dept heads)
  // ==========================================================================
  console.log('Generating department managers...');

  // Jennifer Walsh is a special case - she's an Engineering Manager
  const vpEngineering = departmentHeads.get('Engineering')!;

  // First, add Jennifer Walsh as one of the Engineering Managers
  const jenniferConfig = SPECIAL_EMPLOYEES.find(e => e.emailKey === 'JENNIFER_WALSH')!;
  const jennifer = registry.register({
    email: SPECIAL_EMPLOYEE_EMAILS.JENNIFER_WALSH,
    full_name: jenniferConfig.full_name,
    department: jenniferConfig.department,
    job_title: jenniferConfig.job_title,
    manager_id: vpEngineering,
    hire_date: jenniferConfig.hire_date,
    work_state: jenniferConfig.work_state,
    status: jenniferConfig.status,
    date_of_birth: '1985-04-22',
    gender: jenniferConfig.gender,
    ethnicity: 'White',
  });
  usedEmails.add(jennifer.email);
  allEmployees.push(jennifer);

  // Track managers per department
  departmentManagers.set('Engineering', [jennifer.id]);

  // Generate remaining managers for departments that need them
  for (const dept of DEPARTMENTS) {
    const headId = departmentHeads.get(dept.name)!;
    const managers = departmentManagers.get(dept.name) || [];

    // Engineering already has Jennifer, so only add 2 more
    const managersNeeded = dept.name === 'Engineering'
      ? dept.managerCount - 1
      : dept.managerCount;

    for (let i = 0; i < managersNeeded; i++) {
      const managerTitle = dept.name === 'Engineering'
        ? 'Engineering Manager'
        : dept.name === 'Sales'
          ? 'Sales Manager'
          : dept.name === 'Operations'
            ? 'Operations Manager'
            : 'Team Lead';

      const manager = createGenericEmployee(dept.name, managerTitle, headId, registry);
      managers.push(manager.id);
      allEmployees.push(manager);
    }

    departmentManagers.set(dept.name, managers);
  }

  // ==========================================================================
  // STEP 4: Generate Special Case Employees (as ICs)
  // ==========================================================================
  console.log('Generating special case employees...');

  for (const config of SPECIAL_EMPLOYEES) {
    // Skip Jennifer Walsh - already added as manager
    if (config.emailKey === 'JENNIFER_WALSH') continue;

    // Determine manager for this employee
    let managerId: string;

    if (config.job_title.includes('Manager')) {
      // They report to department head
      managerId = departmentHeads.get(config.department)!;
    } else {
      // They report to a manager in their department
      const managers = departmentManagers.get(config.department) || [];
      if (managers.length > 0) {
        managerId = managers[Math.floor(Math.random() * managers.length)];
      } else {
        // No managers, report to department head
        managerId = departmentHeads.get(config.department)!;
      }
    }

    const employee = registry.register({
      email: SPECIAL_EMPLOYEE_EMAILS[config.emailKey],
      full_name: config.full_name,
      department: config.department,
      job_title: config.job_title,
      manager_id: managerId,
      hire_date: config.hire_date,
      work_state: config.work_state,
      status: config.status,
      date_of_birth: generateDateOfBirth(),
      gender: config.gender,
      ethnicity: generateEthnicity(),
      termination_date: config.termination_date,
      termination_reason: config.termination_reason,
    });

    usedEmails.add(employee.email);
    allEmployees.push(employee);
  }

  // ==========================================================================
  // STEP 5: Generate Remaining ICs to reach department targets
  // ==========================================================================
  console.log('Generating individual contributors...');

  // Count current employees per department (excluding executives)
  const currentCounts: Map<string, number> = new Map();
  for (const emp of allEmployees) {
    if (emp.department !== 'Executive') {
      const count = currentCounts.get(emp.department) || 0;
      currentCounts.set(emp.department, count + 1);
    }
  }

  // Calculate how many more ICs we need per department
  // Department totals from plan:
  // Engineering: 28, Sales: 18, Marketing: 12, Operations: 14, HR: 6, Finance: 8, CS: 10
  const DEPT_TARGETS: Record<string, number> = {
    Engineering: 28,
    Sales: 18,
    Marketing: 12,
    Operations: 14,
    HR: 6,
    Finance: 8,
    'Customer Success': 10,
  };

  // Status tracking - we need 12 terminated total, 6 on leave total
  // Special cases already have: 1 terminated (Amanda), 1 on leave (David)
  let terminatedCount = 1;
  let leaveCount = 1;
  const TERMINATED_TARGET = 12;
  const LEAVE_TARGET = 6;

  // Calculate total ICs needed to distribute statuses evenly
  let totalICsNeeded = 0;
  for (const dept of DEPARTMENTS) {
    const current = currentCounts.get(dept.name) || 0;
    const target = DEPT_TARGETS[dept.name] || 0;
    totalICsNeeded += Math.max(0, target - current);
  }

  // Calculate intervals for distributing terminations and leaves
  const terminatedNeeded = TERMINATED_TARGET - terminatedCount;
  const leaveNeeded = LEAVE_TARGET - leaveCount;
  const terminatedInterval = Math.floor(totalICsNeeded / (terminatedNeeded + 1));
  const leaveInterval = Math.floor(totalICsNeeded / (leaveNeeded + 1));

  let icIndex = 0;
  let nextTerminatedAt = terminatedInterval;
  let nextLeaveAt = Math.floor(leaveInterval * 0.5); // Offset to avoid collision

  for (const dept of DEPARTMENTS) {
    const current = currentCounts.get(dept.name) || 0;
    const target = DEPT_TARGETS[dept.name] || 0;
    const needed = target - current;

    const managers = departmentManagers.get(dept.name) || [];
    const headId = departmentHeads.get(dept.name)!;

    for (let i = 0; i < needed; i++) {
      // Round-robin assignment to managers (or head if no managers)
      const managerId = managers.length > 0
        ? managers[i % managers.length]
        : headId;

      const jobTitle = pickJobTitle(dept.name, icIndex);

      // Determine status (spread terminations and leaves across departments)
      let status: 'active' | 'terminated' | 'leave' = 'active';
      let terminationDate: string | undefined;
      let terminationReason: 'voluntary' | 'involuntary' | undefined;

      // Add terminated employees at calculated intervals
      if (terminatedCount < TERMINATED_TARGET && icIndex >= nextTerminatedAt) {
        status = 'terminated';
        terminationDate = generateHireDateInRange('2024-06-01', '2024-11-30');
        terminationReason = terminatedCount % 3 === 0 ? 'involuntary' : 'voluntary';
        terminatedCount++;
        nextTerminatedAt = icIndex + terminatedInterval;
      }
      // Add on-leave employees at calculated intervals (but not same as terminated)
      else if (leaveCount < LEAVE_TARGET && icIndex >= nextLeaveAt) {
        status = 'leave';
        leaveCount++;
        nextLeaveAt = icIndex + leaveInterval;
      }

      const employee = createGenericEmployee(
        dept.name,
        jobTitle,
        managerId,
        registry,
        {
          status,
          termination_date: terminationDate,
          termination_reason: terminationReason,
        }
      );

      allEmployees.push(employee);
      icIndex++;
    }
  }

  // ==========================================================================
  // STEP 6: Fill remaining spots to reach 100
  // ==========================================================================
  const remaining = 100 - allEmployees.length;
  console.log(`Filling ${remaining} remaining spots...`);

  // Distribute remaining across departments proportionally
  const deptList = Object.keys(DEPT_TARGETS);
  for (let i = 0; i < remaining; i++) {
    const dept = deptList[i % deptList.length];
    const managers = departmentManagers.get(dept) || [];
    const headId = departmentHeads.get(dept)!;
    const managerId = managers.length > 0 ? managers[i % managers.length] : headId;

    const employee = createGenericEmployee(
      dept,
      pickJobTitle(dept, i),
      managerId,
      registry
    );

    allEmployees.push(employee);
  }

  console.log(`Generated ${allEmployees.length} employees`);

  // Log status distribution
  const statusCounts = {
    active: allEmployees.filter(e => e.status === 'active').length,
    terminated: allEmployees.filter(e => e.status === 'terminated').length,
    leave: allEmployees.filter(e => e.status === 'leave').length,
  };
  console.log('Status distribution:', statusCounts);

  // Log department distribution
  const deptCounts: Record<string, number> = {};
  for (const emp of allEmployees) {
    deptCounts[emp.department] = (deptCounts[emp.department] || 0) + 1;
  }
  console.log('Department distribution:', deptCounts);

  return allEmployees;
}

/**
 * Get special employee IDs for downstream generators
 */
export function getSpecialEmployeeIds(registry: EmployeeRegistry): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, email] of Object.entries(SPECIAL_EMPLOYEE_EMAILS)) {
    const employee = registry.getByEmail(email);
    if (employee) {
      result[key] = employee.id;
    }
  }

  return result;
}
