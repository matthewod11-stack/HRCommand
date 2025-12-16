/**
 * Performance Data Generator - Task 2.1.20
 *
 * Generates ~280 performance ratings and reviews across 3 review cycles.
 * Uses the EmployeeRegistry from Session 1 to ensure proper foreign key relationships.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  EmployeeRegistry,
  GeneratedEmployee,
  GeneratedReviewCycle,
  SPECIAL_EMPLOYEE_EMAILS,
  REVIEW_CYCLE_IDS,
} from './registry.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load review templates
const templatesPath = path.join(__dirname, '..', 'data', 'review-templates.json');
const TEMPLATES = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));

// Types for generated data
export interface GeneratedRating {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  reviewer_id: string;
  overall_rating: number;
  goals_rating: number;
  competency_rating: number;
  submitted_at: string;
}

export interface GeneratedReview {
  id: string;
  employee_id: string;
  review_cycle_id: string;
  reviewer_id: string;
  strengths: string;
  areas_for_improvement: string;
  accomplishments: string;
  manager_comments: string;
  submitted_at: string;
}

// Rating distribution targets
const RATING_DISTRIBUTION = {
  exceptional: 0.08,   // 5.0 - 8%
  exceeds: 0.22,       // 4.0-4.9 - 22%
  meets: 0.55,         // 3.0-3.9 - 55%
  developing: 0.12,    // 2.0-2.9 - 12%
  unsatisfactory: 0.03 // 1.0-1.9 - 3%
};

// Seeded random for reproducible results
let seed = 12345;
function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(seededRandom() * array.length)];
}

/**
 * Generate a unique rating ID
 */
function generateRatingId(employeeId: string, cycleId: string): string {
  const hash = `${employeeId}_${cycleId}`.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `rat_${Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)}`;
}

/**
 * Generate a unique review ID
 */
function generateReviewId(employeeId: string, cycleId: string): string {
  const hash = `rev_${employeeId}_${cycleId}`.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return `rev_${Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8)}`;
}

/**
 * Determine the rating band for an employee
 */
type RatingBand = 'exceptional' | 'exceeds' | 'meets' | 'developing' | 'unsatisfactory';

function getRatingBand(employee: GeneratedEmployee, cycleId: string): RatingBand {
  const email = employee.email;

  // Special case: Sarah Chen - high performer (4.5+)
  if (email === SPECIAL_EMPLOYEE_EMAILS.SARAH_CHEN) {
    return seededRandom() < 0.7 ? 'exceptional' : 'exceeds';
  }

  // Special case: Elena Rodriguez - high performer (4.5+)
  if (email === SPECIAL_EMPLOYEE_EMAILS.ELENA_RODRIGUEZ) {
    return seededRandom() < 0.6 ? 'exceptional' : 'exceeds';
  }

  // Special case: Marcus Johnson - underperformer (<2.5 two cycles)
  if (email === SPECIAL_EMPLOYEE_EMAILS.MARCUS_JOHNSON) {
    // Bad in 2023 and 2024, slightly improved in Q1 2025
    if (cycleId === REVIEW_CYCLE_IDS.Q1_2025) {
      return 'developing'; // Showing slight improvement
    }
    return seededRandom() < 0.7 ? 'unsatisfactory' : 'developing';
  }

  // Special case: James Park - new hire struggle
  if (email === SPECIAL_EMPLOYEE_EMAILS.JAMES_PARK) {
    return 'developing'; // 2.8 rating - still learning
  }

  // Special case: Robert Kim - steady performer
  if (email === SPECIAL_EMPLOYEE_EMAILS.ROBERT_KIM) {
    return 'meets'; // Consistent 3.5
  }

  // Special case: Jennifer Walsh - solid manager
  if (email === SPECIAL_EMPLOYEE_EMAILS.JENNIFER_WALSH) {
    return seededRandom() < 0.4 ? 'exceeds' : 'meets';
  }

  // General distribution for other employees
  const roll = seededRandom();
  let cumulative = 0;

  for (const [band, probability] of Object.entries(RATING_DISTRIBUTION)) {
    cumulative += probability;
    if (roll < cumulative) {
      return band as RatingBand;
    }
  }

  return 'meets'; // Default fallback
}

/**
 * Generate a specific rating within a band
 */
function generateRatingValue(band: RatingBand, employee: GeneratedEmployee, cycleId: string): number {
  const ranges: Record<RatingBand, [number, number]> = {
    exceptional: [4.8, 5.0],
    exceeds: [4.0, 4.7],
    meets: [3.0, 3.9],
    developing: [2.0, 2.9],
    unsatisfactory: [1.0, 1.9],
  };

  const [min, max] = ranges[band];
  let rating = min + seededRandom() * (max - min);

  // Special case tweaks
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.SARAH_CHEN) {
    rating = Math.max(rating, 4.5); // Ensure 4.5+
  }
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.ELENA_RODRIGUEZ) {
    rating = Math.max(rating, 4.5); // Ensure 4.5+
  }
  // Marcus Johnson: <2.5 for 2023 and 2024, slight improvement in Q1 2025
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.MARCUS_JOHNSON) {
    if (cycleId === REVIEW_CYCLE_IDS.Q1_2025) {
      // Q1 2025: Show improvement (2.5-2.9 range)
      rating = 2.5 + seededRandom() * 0.4;
    } else {
      // 2023 and 2024: Struggling (<2.5)
      rating = Math.min(rating, 2.4);
    }
  }
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.JAMES_PARK) {
    rating = 2.7 + seededRandom() * 0.3; // Around 2.8
  }
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.ROBERT_KIM) {
    rating = 3.4 + seededRandom() * 0.2; // Steady 3.5
  }

  return Math.round(rating * 10) / 10; // Round to 1 decimal
}

/**
 * Check if an employee should have a rating for a specific cycle
 */
function shouldHaveRatingForCycle(employee: GeneratedEmployee, cycle: GeneratedReviewCycle): boolean {
  // Must have been hired before cycle end date
  if (employee.hire_date > cycle.end_date) {
    return false;
  }

  // If terminated, must have been active during part of the cycle
  if (employee.status === 'terminated' && employee.termination_date) {
    // Terminated before cycle started = no rating
    if (employee.termination_date < cycle.start_date) {
      return false;
    }
  }

  // Special case: James Park hired Sept 2024, only gets 2024 Annual + Q1 2025
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.JAMES_PARK) {
    return cycle.id === REVIEW_CYCLE_IDS.ANNUAL_2024 || cycle.id === REVIEW_CYCLE_IDS.Q1_2025;
  }

  // Special case: Amanda Foster terminated Nov 2024, no Q1 2025
  if (employee.email === SPECIAL_EMPLOYEE_EMAILS.AMANDA_FOSTER) {
    return cycle.id !== REVIEW_CYCLE_IDS.Q1_2025;
  }

  return true;
}

/**
 * Get department key for templates
 */
function getDepartmentKey(department: string): string {
  const mapping: Record<string, string> = {
    'Engineering': 'engineering',
    'Sales': 'sales',
    'Marketing': 'marketing',
    'Operations': 'operations',
    'HR': 'hr',
    'Finance': 'finance',
    'Customer Success': 'customer_success',
    'Executive': 'generic',
  };
  return mapping[department] || 'generic';
}

/**
 * Generate accomplishment text
 */
function generateAccomplishments(employee: GeneratedEmployee, band: RatingBand): string {
  const deptKey = getDepartmentKey(employee.department);
  const templates = TEMPLATES.accomplishments[deptKey] || TEMPLATES.accomplishments.generic;

  // Pick 2-3 accomplishments
  const count = band === 'exceptional' ? 3 : band === 'exceeds' ? 3 : 2;
  const selected: string[] = [];
  const available = [...templates];

  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(seededRandom() * available.length);
    let item = available.splice(idx, 1)[0];

    // Fill in placeholders with random values
    item = item.replace('{feature}', randomChoice(['user dashboard', 'reporting module', 'integration layer', 'mobile app']));
    item = item.replace('{system}', randomChoice(['legacy database', 'authentication service', 'payment system', 'API gateway']));
    item = item.replace('{project}', randomChoice(['Q2 initiative', 'customer portal', 'data pipeline', 'platform refresh']));
    item = item.replace('{percent}', String(10 + Math.floor(seededRandom() * 40)));
    item = item.replace('{count}', String(2 + Math.floor(seededRandom() * 6)));
    item = item.replace('{amount}', String(20 + Math.floor(seededRandom() * 80)));
    item = item.replace('{hours}', String(5 + Math.floor(seededRandom() * 15)));
    item = item.replace('{days}', String(2 + Math.floor(seededRandom() * 5)));
    item = item.replace('{points}', String(5 + Math.floor(seededRandom() * 10)));

    selected.push(item);
  }

  return selected.join('. ') + '.';
}

/**
 * Generate a performance rating
 */
function generateRating(
  employee: GeneratedEmployee,
  cycle: GeneratedReviewCycle,
  reviewerId: string
): GeneratedRating {
  const band = getRatingBand(employee, cycle.id);
  const overallRating = generateRatingValue(band, employee, cycle.id);

  // Goals and competency ratings are typically close to overall
  const variance = () => (seededRandom() - 0.5) * 0.4;
  const goalsRating = Math.max(1.0, Math.min(5.0, overallRating + variance()));
  const competencyRating = Math.max(1.0, Math.min(5.0, overallRating + variance()));

  // Submitted date is near cycle end
  const cycleEnd = new Date(cycle.end_date);
  const submitOffset = Math.floor(seededRandom() * 14); // Within 2 weeks of cycle end
  cycleEnd.setDate(cycleEnd.getDate() - submitOffset);

  return {
    id: generateRatingId(employee.id, cycle.id),
    employee_id: employee.id,
    review_cycle_id: cycle.id,
    reviewer_id: reviewerId,
    overall_rating: Math.round(overallRating * 10) / 10,
    goals_rating: Math.round(goalsRating * 10) / 10,
    competency_rating: Math.round(competencyRating * 10) / 10,
    submitted_at: cycleEnd.toISOString().split('T')[0],
  };
}

/**
 * Generate a performance review narrative
 */
function generateReview(
  employee: GeneratedEmployee,
  cycle: GeneratedReviewCycle,
  reviewerId: string,
  rating: GeneratedRating
): GeneratedReview {
  // Determine band from overall rating
  let band: RatingBand;
  if (rating.overall_rating >= 4.8) band = 'exceptional';
  else if (rating.overall_rating >= 4.0) band = 'exceeds';
  else if (rating.overall_rating >= 3.0) band = 'meets';
  else if (rating.overall_rating >= 2.0) band = 'developing';
  else band = 'unsatisfactory';

  // Generate each section
  const strengths = randomChoice(TEMPLATES.strengths[band] || TEMPLATES.strengths.meets);
  const areasForImprovement = randomChoice(
    TEMPLATES.areasForImprovement[band] || TEMPLATES.areasForImprovement.meets
  );
  const accomplishments = generateAccomplishments(employee, band);
  const managerComment = randomChoice(TEMPLATES.managerComments[band] || TEMPLATES.managerComments.meets)
    .replace('{name}', employee.full_name.split(' ')[0]);

  return {
    id: generateReviewId(employee.id, cycle.id),
    employee_id: employee.id,
    review_cycle_id: cycle.id,
    reviewer_id: reviewerId,
    strengths,
    areas_for_improvement: areasForImprovement,
    accomplishments,
    manager_comments: managerComment,
    submitted_at: rating.submitted_at, // Same as rating
  };
}

/**
 * Main generation function
 * Returns ratings and reviews arrays
 */
export function generatePerformanceData(registry: EmployeeRegistry): {
  ratings: GeneratedRating[];
  reviews: GeneratedReview[];
} {
  const ratings: GeneratedRating[] = [];
  const reviews: GeneratedReview[] = [];
  const cycles = registry.getAllCycles();

  for (const employee of registry.getAllEmployees()) {
    // Skip CEO (no manager to review them in this simple model)
    // In real systems, CEO would be reviewed by board or skip this
    if (!employee.manager_id) {
      continue;
    }

    for (const cycle of cycles) {
      // Check if employee should have a rating for this cycle
      if (!shouldHaveRatingForCycle(employee, cycle)) {
        continue;
      }

      // Reviewer is always the employee's manager
      const reviewerId = employee.manager_id;

      // Generate rating and review
      const rating = generateRating(employee, cycle, reviewerId);
      const review = generateReview(employee, cycle, reviewerId, rating);

      ratings.push(rating);
      reviews.push(review);
    }
  }

  return { ratings, reviews };
}

/**
 * Get statistics about generated data
 */
export function getPerformanceStats(ratings: GeneratedRating[]): Record<string, unknown> {
  const totalRatings = ratings.length;

  // Distribution by rating band
  const distribution = {
    exceptional: 0,
    exceeds: 0,
    meets: 0,
    developing: 0,
    unsatisfactory: 0,
  };

  for (const rating of ratings) {
    if (rating.overall_rating >= 4.8) distribution.exceptional++;
    else if (rating.overall_rating >= 4.0) distribution.exceeds++;
    else if (rating.overall_rating >= 3.0) distribution.meets++;
    else if (rating.overall_rating >= 2.0) distribution.developing++;
    else distribution.unsatisfactory++;
  }

  // Ratings per cycle
  const byCycle: Record<string, number> = {};
  for (const rating of ratings) {
    byCycle[rating.review_cycle_id] = (byCycle[rating.review_cycle_id] || 0) + 1;
  }

  // Average rating
  const avgRating = ratings.reduce((sum, r) => sum + r.overall_rating, 0) / totalRatings;

  return {
    totalRatings,
    distribution,
    distributionPercent: {
      exceptional: ((distribution.exceptional / totalRatings) * 100).toFixed(1) + '%',
      exceeds: ((distribution.exceeds / totalRatings) * 100).toFixed(1) + '%',
      meets: ((distribution.meets / totalRatings) * 100).toFixed(1) + '%',
      developing: ((distribution.developing / totalRatings) * 100).toFixed(1) + '%',
      unsatisfactory: ((distribution.unsatisfactory / totalRatings) * 100).toFixed(1) + '%',
    },
    byCycle,
    averageRating: avgRating.toFixed(2),
  };
}
