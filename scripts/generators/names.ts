/**
 * Name generation utilities for diverse, realistic employee names
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Name pool types
interface NameData {
  firstNames: {
    male: string[];
    female: string[];
    neutral: string[];
  };
  lastNames: string[];
}

let nameData: NameData | null = null;

/**
 * Load name data from JSON files
 */
function loadNameData(): NameData {
  if (nameData) return nameData;

  const dataDir = path.join(__dirname, '..', 'data');

  const firstNamesRaw = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'first-names.json'), 'utf-8')
  );
  const lastNames = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'last-names.json'), 'utf-8')
  );

  nameData = {
    firstNames: firstNamesRaw,
    lastNames,
  };

  return nameData;
}

// Seeded random for deterministic generation
let seed = 12345;

export function setSeed(newSeed: number): void {
  seed = newSeed;
}

function seededRandom(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function randomChoice<T>(array: T[]): T {
  const index = Math.floor(seededRandom() * array.length);
  return array[index];
}

/**
 * Generate a first name based on gender
 */
export function generateFirstName(gender: string): string {
  const data = loadNameData();

  if (gender === 'Male') {
    return randomChoice(data.firstNames.male);
  } else if (gender === 'Female') {
    return randomChoice(data.firstNames.female);
  } else {
    // Non-binary or prefer not to say - use neutral names
    return randomChoice(data.firstNames.neutral);
  }
}

/**
 * Generate a last name
 */
export function generateLastName(): string {
  const data = loadNameData();
  return randomChoice(data.lastNames);
}

/**
 * Generate a full name
 */
export function generateFullName(gender: string): string {
  return `${generateFirstName(gender)} ${generateLastName()}`;
}

/**
 * Generate an email from a full name
 */
export function generateEmail(fullName: string, usedEmails: Set<string>): string {
  const parts = fullName.toLowerCase().split(' ');
  const first = parts[0];
  const last = parts[parts.length - 1];

  let email = `${first}.${last}@acmecorp.com`;

  // Handle duplicates by appending numbers
  let counter = 2;
  while (usedEmails.has(email)) {
    email = `${first}.${last}${counter}@acmecorp.com`;
    counter++;
  }

  usedEmails.add(email);
  return email;
}

/**
 * Generate a date of birth for an employee (age 22-65)
 */
export function generateDateOfBirth(): string {
  const currentYear = 2025;
  const minAge = 22;
  const maxAge = 65;

  const age = minAge + Math.floor(seededRandom() * (maxAge - minAge));
  const birthYear = currentYear - age;
  const month = 1 + Math.floor(seededRandom() * 12);
  const day = 1 + Math.floor(seededRandom() * 28); // Keep it simple

  return `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Generate a hire date within a range
 */
export function generateHireDateInRange(startDate: string, endDate: string): string {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const randomTime = start + Math.floor(seededRandom() * (end - start));
  const date = new Date(randomTime);

  return date.toISOString().split('T')[0];
}

// Gender distribution (from plan)
const GENDER_DISTRIBUTION = [
  { value: 'Male', weight: 48 },
  { value: 'Female', weight: 47 },
  { value: 'Non-binary', weight: 3 },
  { value: 'Prefer not to say', weight: 2 },
];

// Ethnicity distribution (from plan)
const ETHNICITY_DISTRIBUTION = [
  { value: 'White', weight: 45 },
  { value: 'Asian', weight: 25 },
  { value: 'Hispanic/Latino', weight: 15 },
  { value: 'Black/African American', weight: 10 },
  { value: 'Two or more', weight: 3 },
  { value: 'Prefer not to say', weight: 2 },
];

// Work state distribution (from plan)
const WORK_STATE_DISTRIBUTION = [
  { value: 'California', weight: 45 },
  { value: 'New York', weight: 15 },
  { value: 'Texas', weight: 12 },
  { value: 'Colorado', weight: 8 },
  { value: 'Washington', weight: 8 },
  { value: 'Florida', weight: 3 },
  { value: 'Illinois', weight: 3 },
  { value: 'Massachusetts', weight: 2 },
  { value: 'Oregon', weight: 2 },
  { value: 'Arizona', weight: 2 },
];

/**
 * Pick a value based on weighted distribution
 */
export function weightedChoice<T>(
  distribution: Array<{ value: T; weight: number }>
): T {
  const totalWeight = distribution.reduce((sum, item) => sum + item.weight, 0);
  let random = seededRandom() * totalWeight;

  for (const item of distribution) {
    random -= item.weight;
    if (random <= 0) {
      return item.value;
    }
  }

  // Fallback to last item
  return distribution[distribution.length - 1].value;
}

export function generateGender(): string {
  return weightedChoice(GENDER_DISTRIBUTION);
}

export function generateEthnicity(): string {
  return weightedChoice(ETHNICITY_DISTRIBUTION);
}

export function generateWorkState(): string {
  return weightedChoice(WORK_STATE_DISTRIBUTION);
}
