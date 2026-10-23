import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { 
  updateLabelAtLine, 
  updateColorAtLine, 
  updateShapeAtLine, 
  deleteElementAtLine, 
  addNodeToCode, 
  addConnectionToCode,
  renameNode,
  deleteNode
} from '../src/lib/engine/twoWaySync.js';

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

console.log('\n--- HARDENED TWO-WAY SYNC TESTS ---');

it('renames a node and updates all connection and ERD references without touching comments or labels', () => {
  const initialCode = `// Top comment
Users [label: "Users Directory", color: blue] // entry
Orders [color: green]

Users > Orders: places // direct
AuditLog > Users, Orders: notify
Users.id < Orders.user_id`;

  const updated = renameNode(initialCode, 'Users', 'Accounts');

  // Verify code lines
  const lines = updated.split('\n');
  assert.strictEqual(lines[0], '// Top comment');
  assert(lines[1].includes('Accounts [label: "Users Directory", color: blue] // entry'));
  assert.strictEqual(lines[2], 'Orders [color: green]');
  assert.strictEqual(lines[3], '');
  assert(lines[4].includes('Accounts > Orders: places // direct'));
  assert(lines[5].includes('AuditLog > Accounts, Orders: notify'));
  assert(lines[6].includes('Accounts.id < Orders.user_id'));

  // Forward parse check
  const { ast, errors } = parseDiagram(updated, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  assert(ast.nodes.some(n => n.id === 'Accounts'));
  assert(!ast.nodes.some(n => n.id === 'Users'));
});

it('deletes a node with connections and prunes multi-target lines (A > B, C -> A > C)', () => {
  const initialCode = `// Start
A [color: blue]
B [color: green]
C [color: orange]

A > B, C: broadcast
B > C: direct
C > A: ack`;

  // Delete node B
  const updated = deleteNode(initialCode, 'B', 3);

  // B declaration removed
  assert(!updated.includes('B [color: green]'));
  // B > C: direct removed
  assert(!updated.includes('B > C: direct'));
  // A > B, C: broadcast becomes A > C: broadcast
  assert(updated.includes('A > C: broadcast'));
  // C > A: ack kept
  assert(updated.includes('C > A: ack'));

  const { ast, errors } = parseDiagram(updated, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.nodes.length, 2);
  assert.strictEqual(ast.edges.length, 2);
});

it('edits a node on a line that holds chained or multi connections without breaking edges', () => {
  const initialCode = `// Chained pipeline
StepA > StepB > StepC: pipeline [color: red]`;

  // Update label on line 2
  const updated = updateLabelAtLine(initialCode, 2, 'fast-pipeline');
  assert(updated.includes('StepA > StepB > StepC: fast-pipeline [color: red]'));

  const { ast, errors } = parseDiagram(updated, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.edges.length, 2);
  assert.strictEqual(ast.edges[0].label, 'fast-pipeline');
});

it('edits nodes inside a group without breaking braces or group hierarchy', () => {
  const initialCode = `title Architecture
vpc [color: gray] {
  web [shape: rectangle, color: blue]
  api [shape: rectangle, color: green]
}

web > api: http`;

  // Edit web node color to purple on line 3
  let updated = updateColorAtLine(initialCode, 3, 'purple');
  // Edit web node shape to diamond on line 3
  updated = updateShapeAtLine(updated, 3, 'diamond');

  const lines = updated.split('\n');
  assert.strictEqual(lines[1], 'vpc [color: gray] {');
  assert(lines[2].startsWith('  web ['));
  assert(lines[2].includes('color: purple'));
  assert(lines[2].includes('shape: diamond'));
  assert.strictEqual(lines[3], '  api [shape: rectangle, color: green]');
  assert.strictEqual(lines[4], '}');

  const { ast, errors } = parseDiagram(updated, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  const webNode = ast.nodes.find(n => n.id === 'web');
  assert.strictEqual(webNode.color, 'purple');
  assert.strictEqual(webNode.shape, 'diamond');
  assert.strictEqual(webNode.groupId, 'vpc');
});

it('handles labels containing quotes, colons, commas, and brackets', () => {
  const initialCode = `task1 [color: yellow]
task2 [color: orange]
task1 > task2: simple`;

  // Complex label with quotes, colon, comma, brackets
  const complexLabel = 'Status: "Active", [Priority: High]';
  let updated = updateLabelAtLine(initialCode, 1, complexLabel);
  updated = updateLabelAtLine(updated, 3, 'Action: Send, [Port: 443]');

  const lines = updated.split('\n');
  assert(lines[0].includes('label: "Status: \\"Active\\", [Priority: High]"'));
  assert(lines[2].includes('task1 > task2: "Action: Send, [Port: 443]"'));

  // Forward parse and verify clean retrieval
  const { ast, errors } = parseDiagram(updated, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  const t1 = ast.nodes.find(n => n.id === 'task1');
  assert.strictEqual(t1.label, complexLabel);
  const edge = ast.edges[0];
  assert.strictEqual(edge.label, 'Action: Send, [Port: 443]');
});

it('preserves blank lines and comments in exact locations', () => {
  const initialCode = `// Top header comment

// Section A
A [color: blue] // inline comment A

// Section B
B [color: green]

A > B // connection comment`;

  const updated = updateColorAtLine(initialCode, 4, 'purple');
  const lines = updated.split('\n');

  assert.strictEqual(lines[0], '// Top header comment');
  assert.strictEqual(lines[1], '');
  assert.strictEqual(lines[2], '// Section A');
  assert(lines[3].includes('A [color: purple] // inline comment A'));
  assert.strictEqual(lines[4], '');
  assert.strictEqual(lines[5], '// Section B');
  assert.strictEqual(lines[6], 'B [color: green]');
  assert.strictEqual(lines[7], '');
  assert.strictEqual(lines[8], 'A > B // connection comment');
});

it('handles rapid sequential canvas edits without line drift', () => {
  const initialCode = `start [shape: oval, color: blue]
process [shape: rectangle, color: green]
start > process`;

  // Edit 1: change color
  let code = updateColorAtLine(initialCode, 1, 'purple');
  // Edit 2: change shape
  code = updateShapeAtLine(code, 1, 'diamond');
  // Edit 3: change label
  code = updateLabelAtLine(code, 1, 'Initiate Payment');
  // Edit 4: change process color
  code = updateColorAtLine(code, 2, 'orange');

  const { ast, errors } = parseDiagram(code, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  const start = ast.nodes.find(n => n.id === 'start');
  assert.strictEqual(start.color, 'purple');
  assert.strictEqual(start.shape, 'diamond');
  assert.strictEqual(start.label, 'Initiate Payment');

  const process = ast.nodes.find(n => n.id === 'process');
  assert.strictEqual(process.color, 'orange');
});

console.log(`\n========================================`);
console.log(`HARDENED SYNC SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
