import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { 
  updateLabelAtLine, 
  updateColorAtLine, 
  updateShapeAtLine, 
  updateIconAtLine, 
  deleteElementAtLine, 
  addNodeToCode, 
  addConnectionToCode 
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

console.log('\n--- 1. FLOWCHART TWO-WAY SYNC ROUND-TRIP TESTS ---');

it('patches node color from canvas without touching comments or other lines', () => {
  const initialCode = `// User Registration Flow
start [shape: oval, color: blue] // entry point
process [shape: rectangle, color: green]
start > process: trigger`;

  // 1. Canvas edit: change start node color from blue to purple
  const updatedCode = updateColorAtLine(initialCode, 2, 'purple');

  // Verify code diff: only line 2 was modified
  const lines = updatedCode.split('\n');
  assert.strictEqual(lines[0], '// User Registration Flow');
  assert(lines[1].includes('color: purple'));
  assert(lines[1].includes('shape: oval'));
  assert(lines[1].includes('// entry point'));
  assert.strictEqual(lines[2], 'process [shape: rectangle, color: green]');

  // 2. Code edit -> Canvas state forward sync
  const { ast, errors } = parseDiagram(updatedCode, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  const startNode = ast.nodes.find(n => n.id === 'start');
  assert.strictEqual(startNode.color, 'purple');
  assert.strictEqual(startNode.shape, 'oval');
});

it('patches node label and shape from canvas style panel', () => {
  const initialCode = `step1 [color: yellow]
step2 [color: orange]
step1 > step2`;

  // 1. Canvas edit: update shape to diamond and label to "Validate Token"
  let code = updateShapeAtLine(initialCode, 1, 'diamond');
  code = updateLabelAtLine(code, 1, 'Validate Token');

  // Verify code patch
  const line1 = code.split('\n')[0];
  assert(line1.includes('shape: diamond'));
  assert(line1.includes('label: "Validate Token"'));
  assert(line1.includes('color: yellow'));

  // 2. Forward parse check
  const { ast } = parseDiagram(code, 'flowchart-diagram');
  const node = ast.nodes.find(n => n.id === 'step1');
  assert.strictEqual(node.shape, 'diamond');
  assert.strictEqual(node.label, 'Validate Token');
});

it('adds node and connection from canvas toolbar', () => {
  const initialCode = `A [color: blue]
A > B`;

  // Add node C
  let code = addNodeToCode(initialCode, { id: 'C', shape: 'cylinder', color: 'green', label: 'Database' });
  // Add connection B > C
  code = addConnectionToCode(code, { source: 'B', target: 'C', operator: '-->', label: 'persist' });

  const { ast, errors } = parseDiagram(code, 'flowchart-diagram');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.nodes.length, 3);
  assert.strictEqual(ast.edges.length, 2);
  const edge = ast.edges.find(e => e.source === 'B' && e.target === 'C');
  assert.strictEqual(edge.dashed, true);
  assert.strictEqual(edge.label, 'persist');
});

console.log('\n--- 2. SEQUENCE DIAGRAM TWO-WAY SYNC ROUND-TRIP TESTS ---');

it('patches message labels and respects autoNumber across round trips', () => {
  const initialCode = `title Payment Flow
autoNumber nested

Client > Gateway: InitiatePayment
Gateway > Bank: Authorize
Bank --> Gateway: Approved`;

  // Canvas edit: change message label on line 5 to "AuthorizeTransaction"
  const updatedCode = updateLabelAtLine(initialCode, 5, 'AuthorizeTransaction');
  assert(updatedCode.includes('Gateway > Bank: AuthorizeTransaction'));

  // Forward parse check
  const { ast, errors } = parseDiagram(updatedCode, 'sequence-diagram');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.autoNumber, 'nested');
  const msg = ast.steps.find(s => s.type === 'message' && s.from === 'Gateway');
  assert.strictEqual(msg.label, 'AuthorizeTransaction');
});

console.log('\n--- 3. ERD TWO-WAY SYNC ROUND-TRIP TESTS ---');

it('patches ERD table labels and colors while keeping strict operators (<, >, -)', () => {
  const initialCode = `title Store Data Model
notation crows-foot

Users [color: blue] {
  id int pk
}

Orders [color: green] {
  id int pk
  user_id int fk
}

Users < Orders: places`;

  // Canvas edit: change Users table color from blue to purple
  const updatedCode = updateColorAtLine(initialCode, 4, 'purple');
  assert(updatedCode.includes('Users [color: purple] {'));
  assert(updatedCode.includes('Users < Orders: places'));

  // Forward parse check
  const { ast, errors } = parseDiagram(updatedCode, 'erd-diagram');
  assert.strictEqual(errors.length, 0);
  const users = ast.tables.find(t => t.name === 'Users');
  assert.strictEqual(users.color, 'purple');
  const rel = ast.relationships[0];
  assert.strictEqual(rel.operator, '<');
  assert.strictEqual(rel.cardinality, '1:N');
});

console.log('\n--- 4. CLOUD ARCHITECTURE TWO-WAY SYNC ROUND-TRIP TESTS ---');

it('patches icon and color on cloud architecture components', () => {
  const initialCode = `direction right
App [icon: server, color: blue]
Storage [icon: bucket, color: yellow]
App > Storage: upload`;

  // Canvas edit: change App icon to aws-ecs and Storage icon to aws-s3
  let code = updateIconAtLine(initialCode, 2, 'aws-ecs');
  code = updateIconAtLine(code, 3, 'aws-s3');
  code = updateColorAtLine(code, 3, 'green');

  assert(code.includes('App [icon: aws-ecs, color: blue]'));
  assert(code.includes('Storage [icon: aws-s3, color: green]'));

  // Forward parse check
  const { ast, errors } = parseDiagram(code, 'cloud-architecture-diagram');
  assert.strictEqual(errors.length, 0);
  const storage = ast.nodes.find(n => n.id === 'Storage');
  assert.strictEqual(storage.icon, 'aws-s3');
  assert.strictEqual(storage.color, 'green');
});

console.log('\n--- 5. ERROR RESILIENCE & LAST GOOD RENDER TESTS ---');

it('detects syntax errors with exact line numbers to preserve last good render', () => {
  const invalidCode = `title Error Test
start [shape: rectangle]
process [[invalid syntax]]
start > process`;

  const { ast, errors } = parseDiagram(invalidCode, 'flowchart-diagram');
  assert(errors.length > 0);
  assert.strictEqual(errors[0].line, 3);
  assert(errors[0].message.length > 0);
});

console.log(`\n========================================`);
console.log(`ROUND-TRIP TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
