import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
      });
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- AI STREAMING & CLIENT VALIDATION RETRY TESTS (STEP 7) ---');

// Mock stream runner mimicking streamAIGeneration logic
async function mockStreamAIGeneration({
  prompt,
  diagramType = 'flowchart-diagram',
  code = '',
  fetchMock,
  onCompleted,
  onError,
  onValidationError
}) {
  let attempts = 0;

  async function executeStream(retryErr) {
    attempts++;
    const res = await fetchMock({
      prompt,
      diagramType,
      code,
      retry_error: retryErr,
      attemptNumber: attempts
    });

    const generatedCode = res.code;
    const resolvedDiagramType = res.diagramType || diagramType;

    // Client-side parser validation loop
    if (generatedCode) {
      const validation = parseDiagram(generatedCode, resolvedDiagramType);
      if (validation && validation.errors && validation.errors.length > 0) {
        const errString = validation.errors.map(e => e.message || String(e)).join('; ');
        
        if (!retryErr) {
          // First failure: retry ONCE with error feedback
          return await executeStream(errString);
        } else {
          // Second failure: single-retry limit enforced! Never loop infinitely!
          onValidationError?.({
            error: errString,
            rawCode: generatedCode,
            diagramType: resolvedDiagramType
          });
          return;
        }
      }

      // Valid code
      onCompleted?.({
        code: generatedCode,
        diagramType: resolvedDiagramType
      });
    }
  }

  await executeStream(undefined);
  return { attempts };
}

async function runTests() {
  await it('recovers via single retry when first attempt has syntax errors', async () => {
    let completedResult = null;
    let validationFailed = null;
    let requestedWithRetryError = null;

    // Attempt 1 returns broken code (missing target node)
    // Attempt 2 returns repaired valid code
    const fetchMock = async (req) => {
      if (!req.retry_error) {
        return {
          code: 'title Broken Diagram\nstart > [invalid attribute',
          diagramType: 'flowchart-diagram'
        };
      }
      requestedWithRetryError = req.retry_error;
      return {
        code: 'title Repaired Diagram\nstart [shape: oval]\nfinish [shape: oval]\nstart > finish: repaired',
        diagramType: 'flowchart-diagram'
      };
    };

    const { attempts } = await mockStreamAIGeneration({
      prompt: 'Create a flow',
      fetchMock,
      onCompleted: (res) => { completedResult = res; },
      onValidationError: (res) => { validationFailed = res; }
    });

    assert.strictEqual(attempts, 2, 'Should have made exactly 2 attempts (initial + 1 retry)');
    assert.strictEqual(Boolean(requestedWithRetryError), true, 'Second attempt must carry retry_error');
    assert.strictEqual(Boolean(completedResult), true, 'Completed callback must be called on successful repair');
    assert.strictEqual(completedResult.code.includes('repaired'), true);
    assert.strictEqual(validationFailed, null, 'Validation failure should not be triggered');
  });

  await it('enforces single-retry limit and does not loop infinitely when repair fails', async () => {
    let completedResult = null;
    let validationFailed = null;

    // Both attempt 1 and attempt 2 return unparseable syntax with unclosed brackets
    const fetchMock = async (req) => {
      return {
        code: `title Persistently Broken\nnode_${req.attemptNumber} > [unclosed attribute`,
        diagramType: 'flowchart-diagram'
      };
    };

    const { attempts } = await mockStreamAIGeneration({
      prompt: 'Create invalid',
      fetchMock,
      onCompleted: (res) => { completedResult = res; },
      onValidationError: (res) => { validationFailed = res; }
    });

    assert.strictEqual(attempts, 2, 'Must stop strictly at 2 attempts (initial + 1 retry)');
    assert.strictEqual(completedResult, null, 'Must NOT apply unparseable code to canvas');
    assert.strictEqual(Boolean(validationFailed), true, 'Must invoke onValidationError');
    assert.strictEqual(validationFailed.rawCode.includes('Persistently Broken'), true);
    assert.strictEqual(Boolean(validationFailed.error), true);
  });

  await it('applies valid code directly without retrying when first attempt succeeds', async () => {
    let completedResult = null;
    let validationFailed = null;

    const fetchMock = async () => {
      return {
        code: 'title Valid Diagram\nA [shape: rectangle]\nB [shape: cylinder]\nA > B: query',
        diagramType: 'flowchart-diagram'
      };
    };

    const { attempts } = await mockStreamAIGeneration({
      prompt: 'Create flow',
      fetchMock,
      onCompleted: (res) => { completedResult = res; },
      onValidationError: (res) => { validationFailed = res; }
    });

    assert.strictEqual(attempts, 1, 'Valid code should succeed on first attempt without retry');
    assert.strictEqual(Boolean(completedResult), true);
    assert.strictEqual(validationFailed, null);
  });

  console.log(`\n========================================`);
  console.log(`AI RETRY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
