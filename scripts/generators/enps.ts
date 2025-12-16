/**
 * eNPS Survey Generator - Task 2.1.21
 *
 * Generates ~246 eNPS survey responses (3 surveys × active employees).
 * Uses the EmployeeRegistry from Session 1 to ensure proper foreign key relationships.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  EmployeeRegistry,
  GeneratedEmployee,
  SPECIAL_EMPLOYEE_EMAILS,
} from './registry.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load feedback templates
const feedbackPath = path.join(__dirname, '..', 'data', 'enps-feedback.json');
const FEEDBACK = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'));

// Types for generated data
export interface GeneratedEnpsResponse {
  id: string;
  employee_id: string;
  survey_date: string;
  survey_name: string;
  score: number;
  feedback_text: string | null;
  submitted_at: string;
}

// Survey definitions
export const SURVEYS = [
  { name: 'Q2 2024 Pulse', date: '2024-06-15' },
  { name: 'Q4 2024 Pulse', date: '2024-12-15' },
  { name: 'Q1 2025 Pulse', date: '2025-03-15' },
] as const;

// Score distribution targets
const SCORE_DISTRIBUTION = {
  promoter: 0.35,    // 9-10 = 35%
  passive: 0.40,     // 7-8 = 40%
  detractor: 0.25,   // 0-6 = 25%
};

// Target eNPS: +10 (35% - 25%)

// Seeded random for reproducible results
let seed = 54321; // Different seed from performance.ts
function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(seededRandom() * array.length)];
}

/**
 * Generate a unique response ID
 */
function generateResponseId(employeeId: string, surveyDate: string): string {
  const hash = `enps_${employeeId}_${surveyDate}`.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `enps_${Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)}`;
}

/**
 * Employee score patterns - stored per employee for consistency across surveys
 */
const employeePatterns: Map<string, 'stable_high' | 'stable_mid' | 'stable_low' | 'declining' | 'improving' | 'manager_issue'> = new Map();

/**
 * Get or assign a pattern for an employee
 */
function getEmployeePattern(employee: GeneratedEmployee, registry: EmployeeRegistry): string {
  const email = employee.email;

  // Check if already assigned
  if (employeePatterns.has(email)) {
    return employeePatterns.get(email)!;
  }

  // Special case: Sarah Chen - declining (flight risk)
  if (email === SPECIAL_EMPLOYEE_EMAILS.SARAH_CHEN) {
    employeePatterns.set(email, 'declining');
    return 'declining';
  }

  // Special case: Jennifer Walsh's direct reports - manager issue
  const jenniferWalsh = registry.getByEmail(SPECIAL_EMPLOYEE_EMAILS.JENNIFER_WALSH);
  if (jenniferWalsh && employee.manager_id === jenniferWalsh.id) {
    employeePatterns.set(email, 'manager_issue');
    return 'manager_issue';
  }

  // Assign patterns based on distribution
  const roll = seededRandom();
  let pattern: string;

  if (roll < 0.30) {
    pattern = 'stable_high';    // 30% happy employees (9-10)
  } else if (roll < 0.55) {
    pattern = 'stable_mid';     // 25% passive (7-8)
  } else if (roll < 0.70) {
    pattern = 'stable_low';     // 15% disengaged (4-6)
  } else if (roll < 0.80) {
    pattern = 'declining';      // 10% declining
  } else if (roll < 0.90) {
    pattern = 'improving';      // 10% improving
  } else {
    pattern = 'manager_issue';  // 10% manager concerns
  }

  employeePatterns.set(email, pattern as any);
  return pattern;
}

/**
 * Generate score based on employee pattern and survey index
 */
function generateScore(employee: GeneratedEmployee, surveyIndex: number, registry: EmployeeRegistry): number {
  const pattern = getEmployeePattern(employee, registry);
  const email = employee.email;

  // Special case: Sarah Chen - exact sequence 9 → 7 → 6
  if (email === SPECIAL_EMPLOYEE_EMAILS.SARAH_CHEN) {
    return [9, 7, 6][surveyIndex];
  }

  // Pattern-based score generation
  switch (pattern) {
    case 'stable_high':
      // Promoters: 9-10, stable
      return 9 + Math.floor(seededRandom() * 2);

    case 'stable_mid':
      // Passive: 7-8, stable
      return 7 + Math.floor(seededRandom() * 2);

    case 'stable_low':
      // Detractors: 4-6, stable low
      return 4 + Math.floor(seededRandom() * 3);

    case 'declining':
      // Start at 8-9, decline by 1-2 each survey
      const startDecline = 8 + Math.floor(seededRandom() * 2);
      return Math.max(4, startDecline - surveyIndex * (1 + Math.floor(seededRandom() * 2)));

    case 'improving':
      // Start at 5-6, improve by 1-2 each survey
      const startImprove = 5 + Math.floor(seededRandom() * 2);
      return Math.min(10, startImprove + surveyIndex * (1 + Math.floor(seededRandom() * 2)));

    case 'manager_issue':
      // Jennifer's team: average around 5.2
      // Range 3-7 with mode around 5
      const roll = seededRandom();
      if (roll < 0.15) return 3;
      if (roll < 0.35) return 4;
      if (roll < 0.65) return 5;
      if (roll < 0.85) return 6;
      return 7;

    default:
      // Fallback to passive
      return 7 + Math.floor(seededRandom() * 2);
  }
}

/**
 * Get feedback text based on score
 */
function getFeedbackText(score: number, pattern: string): string | null {
  // 70% of employees leave feedback
  if (seededRandom() > 0.7) {
    return null;
  }

  // Select appropriate feedback category
  if (score >= 9) {
    return randomChoice(FEEDBACK.promoter);
  } else if (score >= 7) {
    return randomChoice(FEEDBACK.passive);
  } else if (pattern === 'manager_issue') {
    return randomChoice(FEEDBACK.managerIssue);
  } else if (pattern === 'declining') {
    return randomChoice(FEEDBACK.declining);
  } else {
    return randomChoice(FEEDBACK.detractor);
  }
}

/**
 * Check if employee should respond to a survey
 */
function shouldRespondToSurvey(employee: GeneratedEmployee, surveyDate: string): boolean {
  // Must have been hired before survey date
  if (employee.hire_date > surveyDate) {
    return false;
  }

  // If terminated, must have been after the survey date
  if (employee.status === 'terminated' && employee.termination_date) {
    if (employee.termination_date < surveyDate) {
      return false;
    }
  }

  // Skip CEO (no meaningful eNPS for CEO in this model)
  if (!employee.manager_id) {
    return false;
  }

  // Special employees always respond (for consistent test data)
  const specialEmails = Object.values(SPECIAL_EMPLOYEE_EMAILS);
  if (specialEmails.includes(employee.email as any)) {
    return true;
  }

  // 95% response rate for others
  return seededRandom() < 0.95;
}

/**
 * Main generation function
 * Returns eNPS responses array
 */
export function generateEnpsData(registry: EmployeeRegistry): GeneratedEnpsResponse[] {
  const responses: GeneratedEnpsResponse[] = [];

  for (let surveyIndex = 0; surveyIndex < SURVEYS.length; surveyIndex++) {
    const survey = SURVEYS[surveyIndex];

    for (const employee of registry.getAllEmployees()) {
      // Check if employee should respond
      if (!shouldRespondToSurvey(employee, survey.date)) {
        continue;
      }

      const score = generateScore(employee, surveyIndex, registry);
      const pattern = getEmployeePattern(employee, registry);
      const feedbackText = getFeedbackText(score, pattern);

      // Submitted within a few days of survey date
      const surveyDate = new Date(survey.date);
      const submitOffset = Math.floor(seededRandom() * 5); // Within 5 days
      surveyDate.setDate(surveyDate.getDate() + submitOffset);

      responses.push({
        id: generateResponseId(employee.id, survey.date),
        employee_id: employee.id,
        survey_date: survey.date,
        survey_name: survey.name,
        score,
        feedback_text: feedbackText,
        submitted_at: surveyDate.toISOString().split('T')[0],
      });
    }
  }

  return responses;
}

/**
 * Get statistics about generated data
 */
export function getEnpsStats(responses: GeneratedEnpsResponse[], registry: EmployeeRegistry): Record<string, unknown> {
  const totalResponses = responses.length;

  // Calculate eNPS per survey
  const surveyStats: Record<string, { promoters: number; passives: number; detractors: number; total: number }> = {};

  for (const survey of SURVEYS) {
    surveyStats[survey.name] = { promoters: 0, passives: 0, detractors: 0, total: 0 };
  }

  for (const response of responses) {
    const stat = surveyStats[response.survey_name];
    stat.total++;
    if (response.score >= 9) stat.promoters++;
    else if (response.score >= 7) stat.passives++;
    else stat.detractors++;
  }

  // Calculate eNPS for each survey
  const enpsPerSurvey: Record<string, number> = {};
  for (const [name, stat] of Object.entries(surveyStats)) {
    const promoterPct = stat.promoters / stat.total;
    const detractorPct = stat.detractors / stat.total;
    enpsPerSurvey[name] = Math.round((promoterPct - detractorPct) * 100);
  }

  // Score distribution
  const scoreDistribution: Record<number, number> = {};
  for (let i = 0; i <= 10; i++) scoreDistribution[i] = 0;
  for (const response of responses) {
    scoreDistribution[response.score]++;
  }

  // Jennifer Walsh's team average
  const jenniferWalsh = registry.getByEmail(SPECIAL_EMPLOYEE_EMAILS.JENNIFER_WALSH);
  let teamAvg = 0;
  if (jenniferWalsh) {
    const teamResponses = responses.filter(r => {
      const emp = registry.getById(r.employee_id);
      return emp && emp.manager_id === jenniferWalsh.id;
    });
    if (teamResponses.length > 0) {
      teamAvg = teamResponses.reduce((sum, r) => sum + r.score, 0) / teamResponses.length;
    }
  }

  // Sarah Chen's scores
  const sarahChen = registry.getByEmail(SPECIAL_EMPLOYEE_EMAILS.SARAH_CHEN);
  const sarahScores = sarahChen
    ? responses.filter(r => r.employee_id === sarahChen.id).map(r => ({ survey: r.survey_name, score: r.score }))
    : [];

  // Average overall score
  const avgScore = responses.reduce((sum, r) => sum + r.score, 0) / totalResponses;

  return {
    totalResponses,
    surveyStats,
    enpsPerSurvey,
    scoreDistribution,
    averageScore: avgScore.toFixed(2),
    jenniferWalshTeamAvg: teamAvg.toFixed(2),
    sarahChenScores: sarahScores,
    feedbackRate: ((responses.filter(r => r.feedback_text).length / totalResponses) * 100).toFixed(1) + '%',
  };
}
