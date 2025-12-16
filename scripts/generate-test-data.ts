#!/usr/bin/env npx ts-node

/**
 * Test Data Generator - CLI Entry Point
 *
 * Generates realistic Acme Corp test data for HR Command Center.
 *
 * Usage:
 *   npx ts-node scripts/generate-test-data.ts --employees    # Session 1
 *   npx ts-node scripts/generate-test-data.ts --performance  # Session 2
 *   npx ts-node scripts/generate-test-data.ts --enps         # Session 3
 *   npx ts-node scripts/generate-test-data.ts --all          # All data
 *   npx ts-node scripts/generate-test-data.ts --clear        # Clear generated
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EmployeeRegistry } from './generators/registry.js';
import { generateReviewCycles } from './generators/review-cycles.js';
import { generateEmployees, getSpecialEmployeeIds } from './generators/employees.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'generated');

// Ensure output directory exists
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Clear generated files
function clearGenerated(): void {
  if (fs.existsSync(OUTPUT_DIR)) {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const file of files) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    console.log('Cleared generated files');
  }
}

// Write JSON file
function writeJson(filename: string, data: unknown): void {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${filePath}`);
}

/**
 * Session 1: Generate employees and review cycles
 * Output: registry.json, employees.json, review-cycles.json
 */
function generateSession1(): void {
  console.log('\n=== Session 1: Employees & Review Cycles ===\n');

  const registry = new EmployeeRegistry();

  // Step 1: Generate review cycles FIRST (no dependencies)
  console.log('Step 1: Generating review cycles...');
  const cycles = generateReviewCycles(registry);
  writeJson('review-cycles.json', cycles);

  // Step 2: Generate all employees
  console.log('\nStep 2: Generating employees...');
  const employees = generateEmployees(registry);
  writeJson('employees.json', employees);

  // Step 3: Save registry for Session 2
  console.log('\nStep 3: Saving registry...');
  registry.save(OUTPUT_DIR);

  // Step 4: Output special employee IDs for reference
  console.log('\n=== Special Employee IDs ===');
  const specialIds = getSpecialEmployeeIds(registry);
  for (const [key, id] of Object.entries(specialIds)) {
    const emp = registry.getById(id);
    console.log(`${key}: ${id} (${emp?.full_name})`);
  }

  // Verification
  console.log('\n=== Verification ===');
  console.log(`Total employees: ${registry.count}`);
  console.log(`Total review cycles: ${registry.getAllCycles().length}`);

  // Department breakdown
  const deptCounts: Record<string, number> = {};
  for (const emp of registry.getAllEmployees()) {
    deptCounts[emp.department] = (deptCounts[emp.department] || 0) + 1;
  }
  console.log('\nDepartment counts:');
  for (const [dept, count] of Object.entries(deptCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${dept}: ${count}`);
  }

  // Status breakdown
  const statusCounts = {
    active: registry.getByStatus('active').length,
    terminated: registry.getByStatus('terminated').length,
    leave: registry.getByStatus('leave').length,
  };
  console.log('\nStatus counts:');
  console.log(`  Active: ${statusCounts.active}`);
  console.log(`  Terminated: ${statusCounts.terminated}`);
  console.log(`  On Leave: ${statusCounts.leave}`);

  console.log('\n=== Session 1 Complete ===');
  console.log('Output files:');
  console.log('  - scripts/generated/registry.json');
  console.log('  - scripts/generated/employees.json');
  console.log('  - scripts/generated/review-cycles.json');
  console.log('\nNext: Run Session 2 to generate performance data');
}

/**
 * Main entry point
 */
function main(): void {
  const args = process.argv.slice(2);

  ensureOutputDir();

  if (args.includes('--clear')) {
    clearGenerated();
    return;
  }

  if (args.includes('--employees') || args.includes('--session1')) {
    generateSession1();
    return;
  }

  if (args.includes('--performance') || args.includes('--session2')) {
    console.log('Session 2 (performance data) - Not yet implemented');
    console.log('Will be implemented in Phase 2.1.D Session 2');
    return;
  }

  if (args.includes('--enps') || args.includes('--session3')) {
    console.log('Session 3 (eNPS data) - Not yet implemented');
    console.log('Will be implemented in Phase 2.1.D Session 2-3');
    return;
  }

  if (args.includes('--all')) {
    generateSession1();
    // Session 2 and 3 would be called here once implemented
    return;
  }

  // Default: show help
  console.log(`
HR Command Center - Test Data Generator

Usage:
  npx ts-node scripts/generate-test-data.ts [options]

Options:
  --employees, --session1    Generate employees + review cycles (Session 1)
  --performance, --session2  Generate performance ratings/reviews (Session 2)
  --enps, --session3         Generate eNPS responses (Session 3)
  --all                      Generate all test data
  --clear                    Clear all generated files

Output:
  All generated files go to scripts/generated/

Session 1 outputs:
  - registry.json        Central ID registry (source of truth)
  - employees.json       100 employees with hierarchy
  - review-cycles.json   3 review cycles

Session 2 outputs (coming):
  - ratings.json         ~280 performance ratings
  - reviews.json         ~280 performance reviews

Session 3 outputs (coming):
  - enps.json           ~246 eNPS survey responses
`);
}

main();
