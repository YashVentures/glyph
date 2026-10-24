import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_FILES = [
  'parser-renderer.test.mjs',
  'sync-roundtrip.test.mjs',
  'sync-hardening.test.mjs',
  'dashboard-crud.test.mjs',
  'autosave-concurrency.test.mjs',
  'ai-retry.test.mjs',
  'export.test.mjs',
  'sharing.test.mjs',
  'custom-icons.test.mjs',
  'template-gallery.test.mjs',
  'parser-stress-fuzz.test.mjs',
  'performance-budget.test.mjs',
  'undo-redo.test.mjs'
];

async function runTestFile(file) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, file);
    const proc = spawn('node', [fullPath], { stdio: 'inherit' });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Test file ${file} failed with exit code ${code}`));
    });
  });
}

async function runAll() {
  console.log('====================================================');
  console.log('RUNNING COMPLETE FRONTEND TEST SUITE (10 SUITES)');
  console.log('====================================================');

  let passed = 0;
  for (const file of TEST_FILES) {
    try {
      await runTestFile(file);
      passed++;
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  console.log('\n====================================================');
  console.log(`ALL ${passed}/${TEST_FILES.length} FRONTEND TEST SUITES COMPLETED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runAll();
