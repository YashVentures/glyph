import assert from 'node:assert';
import { parseDiagram, MAX_CODE_LENGTH } from '../src/lib/engine/parser.js';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- STEP 15: PARSER & TOKENIZER STRESS & FUZZING TESTS ---');

// 1. Empty and whitespace input
it('handles empty input, whitespace, null, and undefined without throwing', () => {
  const emptyRes = parseDiagram('');
  assert.strictEqual(emptyRes.errors.length, 0);
  assert(emptyRes.ast !== null);

  const wsRes = parseDiagram('   \n\n\t  \r\n  ');
  assert.strictEqual(wsRes.errors.length, 0);

  const nullRes = parseDiagram(null);
  assert.strictEqual(nullRes.errors.length, 0);

  const undefRes = parseDiagram(undefined);
  assert.strictEqual(undefRes.errors.length, 0);
});

// 2. Very long lines (100,000 characters)
it('handles very long lines without hanging or blowing the call stack', () => {
  const longName = 'Node_' + 'A'.repeat(50000);
  const code = `${longName} > NodeB: connection`;
  const startTime = Date.now();
  const res = parseDiagram(code);
  const elapsed = Date.now() - startTime;

  assert(elapsed < 2000, `Parsing very long line took too long: ${elapsed}ms`);
  assert(res !== null && res.ast !== null);
});

// 3. Deep group nesting (50 nested levels)
it('handles deeply nested group braces without recursion limit crashes', () => {
  let nestedCode = '';
  for (let i = 1; i <= 50; i++) {
    nestedCode += `Group${i} {\n`;
  }
  nestedCode += 'CoreService [shape: circle]\n';
  for (let i = 1; i <= 50; i++) {
    nestedCode += '}\n';
  }

  const startTime = Date.now();
  const res = parseDiagram(nestedCode);
  const elapsed = Date.now() - startTime;

  assert(elapsed < 1000, `Deep group nesting took too long: ${elapsed}ms`);
  assert(res.ast !== null);
});

// 4. Huge node labels (10,000 characters)
it('handles huge node labels cleanly', () => {
  const hugeLabel = 'A'.repeat(10000);
  const code = `ServiceA [label: "${hugeLabel}"]\nServiceA > ServiceB`;
  const res = parseDiagram(code);
  assert(res.ast !== null);
  const node = res.ast.nodes.find(n => n.id === 'ServiceA');
  assert(node !== undefined);
  assert.strictEqual(node.label, hugeLabel);
});

// 5. Unbalanced braces
it('recovers gracefully from unbalanced opening and closing braces', () => {
  // Missing closing brace
  const unclosed = `
GroupA {
  ServiceA > ServiceB
  `.trim();
  const res1 = parseDiagram(unclosed);
  assert(res1.errors.length > 0);
  assert(res1.errors.some(e => e.message.toLowerCase().includes('unclosed')));

  // Extra closing brace
  const extraClosing = `
ServiceA > ServiceB
}
}
  `.trim();
  const res2 = parseDiagram(extraClosing);
  assert(res2.errors.length > 0);
  assert(res2.errors.some(e => e.message.toLowerCase().includes('unexpected closing brace')));
});

// 6. Unknown directives
it('handles unknown global directives without crashing', () => {
  const code = `
customUnknownDirective: foobar_value
superDirective 12345
[Client] > [Server]
  `.trim();
  const res = parseDiagram(code);
  assert(res.ast !== null);
  assert.strictEqual(res.ast.nodes.length, 2);
});

// 7. Binary garbage & null bytes
it('detects binary garbage and null bytes with clear error messages', () => {
  const garbage = 'title BinaryGarbage\x00\x01\x02\xFF\xFE\x00';
  const res = parseDiagram(garbage);
  assert(res.errors.length > 0);
  assert(res.errors.some(e => e.message.toLowerCase().includes('binary garbage')));
});

// 8. Total code size limit (MAX_CODE_LENGTH)
it('enforces maximum code size limit and rejects oversized inputs', () => {
  const oversized = 'A > B\n'.repeat(30000); // ~180 KB > 150 KB
  assert(oversized.length > MAX_CODE_LENGTH);

  const res = parseDiagram(oversized);
  assert(res.errors.length > 0);
  assert(res.errors[0].message.includes('exceeds maximum allowed size'));
});

// 9. Sequence diagram unbalanced blocks
it('handles sequence diagram unbalanced loop/alt blocks gracefully', () => {
  const unclosedSeq = `
title Unclosed Sequence
order A, B
loop {
  A > B: Message
  `.trim();
  const res = parseDiagram(unclosedSeq, 'sequence-diagram');
  assert(res.errors.length > 0);
  assert(res.errors.some(e => e.message.toLowerCase().includes('unclosed sequence block')));
});

// 10. ERD unbalanced table body
it('handles ERD unbalanced table braces gracefully', () => {
  const unclosedErd = `
title Unclosed ERD
Users {
  id string pk
  name string
  `.trim();
  const res = parseDiagram(unclosedErd, 'erd-diagram');
  assert(res.ast !== null);
  // Auto-closed table preserved or recorded in errors
  assert(res.ast.tables.length > 0 || res.errors.length > 0);
});

console.log('\n========================================');
console.log(`STRESS & FUZZ TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
