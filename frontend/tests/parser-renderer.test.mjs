import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { parseFlowchart } from '../src/lib/engine/parsers/flowchartParser.js';
import { parseSequence } from '../src/lib/engine/parsers/sequenceParser.js';
import { parseERD } from '../src/lib/engine/parsers/erdParser.js';
import { renderDiagramToSVG } from '../src/lib/engine/renderer.js';

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

console.log('\n--- 1. FLOWCHART PARSER & RENDERER TESTS ---');

it('parses flowchart directives, shapes, and colors', () => {
  const code = `
title User Onboarding
direction right
styleMode watercolor
typeface rough
colorMode bold
layout compact
wrap off

start [shape: oval, color: blue]
inputForm [shape: rectangle, color: green, label: "Fill Form"]
checkValid [shape: diamond, color: orange, label: "Is Valid?"]
finish [shape: oval, color: purple]
`;
  const { ast, errors } = parseFlowchart(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.title, 'User Onboarding');
  assert.strictEqual(ast.direction, 'right');
  assert.strictEqual(ast.styleMode, 'watercolor');
  assert.strictEqual(ast.colorMode, 'bold');
  assert.strictEqual(ast.layout, 'compact');
  assert.strictEqual(ast.wrap, 'off');
  assert.strictEqual(ast.nodes.length, 4);

  const startNode = ast.nodes.find(n => n.id === 'start');
  assert.strictEqual(startNode.shape, 'oval');
  assert.strictEqual(startNode.color, 'blue');
  assert.strictEqual(startNode.sourceLineNumber, 10);
});

it('parses all connection operators, labels, and properties', () => {
  const code = `
A > B: forward solid
B --> C: forward dashed [color: red]
C < D: backward solid
D <-- E: backward dashed
E <> F: bidirectional solid
F <--> G: bidirectional dashed
G - H: undirected solid
H -- I: undirected dashed
`;
  const { ast, errors } = parseFlowchart(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.edges.length, 8);

  const dashedRedEdge = ast.edges.find(e => e.source === 'B' && e.target === 'C');
  assert.strictEqual(dashedRedEdge.dashed, true);
  assert.strictEqual(dashedRedEdge.color, 'red');
  assert.strictEqual(dashedRedEdge.label, 'forward dashed');

  const bidiEdge = ast.edges.find(e => e.source === 'E' && e.target === 'F');
  assert.strictEqual(bidiEdge.relationship, 'BIDIRECTIONAL');
});

it('parses groups and preserves member node hierarchy', () => {
  const code = `
Backend Services [color: blue] {
  api [shape: rectangle]
  worker [shape: rectangle]
}
api > worker: send job
`;
  const { ast, errors } = parseFlowchart(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.groups.length, 1);
  assert.strictEqual(ast.groups[0].id, 'Backend Services');
  assert.deepStrictEqual(ast.groups[0].nodeIds, ['api', 'worker']);
});

console.log('\n--- 2. SEQUENCE DIAGRAM PARSER & RENDERER TESTS ---');

it('parses sequence participant order, messages, and activations', () => {
  const code = `
title Authentication Flow
order Browser, Gateway, AuthService, Database
autoNumber on

Browser > Gateway: POST /login
activate Gateway
Gateway > AuthService: ValidateCredentials
activate AuthService
AuthService > Database: Query user
Database --> AuthService: User record
AuthService --> Gateway: JWT Token
deactivate AuthService
Gateway --> Browser: 200 OK (Set-Cookie)
deactivate Gateway
`;
  const { ast, errors } = parseSequence(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.title, 'Authentication Flow');
  assert.strictEqual(ast.autoNumber, 'on');
  assert.strictEqual(ast.participants.length, 4);

  const messages = ast.steps.filter(s => s.type === 'message');
  assert.strictEqual(messages.length, 6);
  assert.strictEqual(messages[0].from, 'Browser');
  assert.strictEqual(messages[0].to, 'Gateway');
  assert.strictEqual(messages[3].dashed, true); // Database --> AuthService
});

it('parses sequence blocks: loop and alt/else', () => {
  const code = `
Client > Server: Connect
loop [label: "Heartbeat every 10s"] {
  Client > Server: Ping
  Server --> Client: Pong
}
`;
  const { ast, errors } = parseSequence(code);
  assert.strictEqual(errors.length, 0);
  const block = ast.steps.find(s => s.type === 'block');
  assert(block);
  assert.strictEqual(block.blockType, 'loop');
  assert.strictEqual(block.label, 'Heartbeat every 10s');
});

console.log('\n--- 3. ERD PARSER & RENDERER TESTS (STRICT RECON GRAMMAR) ---');

it('parses ERD tables, field constraints, and relationships with real operators (-, <, >, <>)', () => {
  const code = `
title Store Schema
notation crows-foot
colorMode pastel

Users [color: blue] {
  id int pk
  email string unique
  name string
  avatar_url string nullable
  created_at timestamp
}

Orders [color: green] {
  id int pk
  user_id int fk
  total decimal
  status string
}

Profiles [color: purple] {
  id int pk
  user_id int fk unique
}

Students [color: orange] {
  id int pk
  name string
}

Courses [color: yellow] {
  id int pk
  title string
}

Users < Orders: places
Orders > Users: belongs_to
Users - Profiles: has_profile
Students <> Courses: enrolled_in
`;
  const { ast, errors } = parseERD(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.title, 'Store Schema');
  assert.strictEqual(ast.notation, 'crows-foot');
  assert.strictEqual(ast.colorMode, 'pastel');
  assert.strictEqual(ast.tables.length, 5);

  const usersTable = ast.tables.find(t => t.name === 'Users');
  assert.strictEqual(usersTable.fields.length, 5);
  assert.strictEqual(usersTable.fields[0].isPk, true);
  assert.strictEqual(usersTable.fields[1].isUnique, true);

  assert.strictEqual(ast.relationships.length, 4);

  // 1. Users < Orders is One-to-Many (< is 1:N per recon)
  const rel1 = ast.relationships[0];
  assert.strictEqual(rel1.sourceTable, 'Users');
  assert.strictEqual(rel1.operator, '<');
  assert.strictEqual(rel1.cardinality, '1:N');
  assert.strictEqual(rel1.sourceCardinality, '1');
  assert.strictEqual(rel1.targetCardinality, '*');
  assert.strictEqual(rel1.label, 'places');

  // 2. Orders > Users is Many-to-One (> is N:1 per recon)
  const rel2 = ast.relationships[1];
  assert.strictEqual(rel2.sourceTable, 'Orders');
  assert.strictEqual(rel2.operator, '>');
  assert.strictEqual(rel2.cardinality, 'N:1');
  assert.strictEqual(rel2.sourceCardinality, '*');
  assert.strictEqual(rel2.targetCardinality, '1');
  assert.strictEqual(rel2.label, 'belongs_to');

  // 3. Users - Profiles is One-to-One (- is 1:1)
  const rel3 = ast.relationships[2];
  assert.strictEqual(rel3.sourceTable, 'Users');
  assert.strictEqual(rel3.operator, '-');
  assert.strictEqual(rel3.cardinality, '1:1');
  assert.strictEqual(rel3.sourceCardinality, '1');
  assert.strictEqual(rel3.targetCardinality, '1');
  assert.strictEqual(rel3.label, 'has_profile');

  // 4. Students <> Courses is Many-to-Many (<> is N:M)
  const rel4 = ast.relationships[3];
  assert.strictEqual(rel4.sourceTable, 'Students');
  assert.strictEqual(rel4.operator, '<>');
  assert.strictEqual(rel4.cardinality, 'N:M');
  assert.strictEqual(rel4.sourceCardinality, '*');
  assert.strictEqual(rel4.targetCardinality, '*');
  assert.strictEqual(rel4.label, 'enrolled_in');
});

it('parses ERD field member references (TableA.id < TableB.fk)', () => {
  const code = `
Users {
  id int pk
}
Orders {
  id int pk
  user_id int fk
}
Users.id < Orders.user_id: foreign_key
`;
  const { ast, errors } = parseERD(code);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.relationships.length, 1);
  const rel = ast.relationships[0];
  assert.strictEqual(rel.sourceTable, 'Users');
  assert.strictEqual(rel.sourceField, 'id');
  assert.strictEqual(rel.targetTable, 'Orders');
  assert.strictEqual(rel.targetField, 'user_id');
  assert.strictEqual(rel.operator, '<');
  assert.strictEqual(rel.cardinality, '1:N');
});

it('renders ERD with Crow’s Foot and Chen notation', () => {
  const codeCrows = `
notation crows-foot
Users < Orders: places
`;
  const astCrows = parseERD(codeCrows).ast;
  const svgCrows = renderDiagramToSVG(astCrows);
  assert(svgCrows.includes('marker-end="url(#crowsfoot-many)"'));
  assert(svgCrows.includes('marker-start="url(#crowsfoot-one-start)"'));

  const codeChen = `
notation chen
Users < Orders
`;
  const astChen = parseERD(codeChen).ast;
  const svgChen = renderDiagramToSVG(astChen);
  assert(svgChen.includes('polygon points="0,-16 26,0 0,16 -26,0"')); // Chen relationship diamond
  assert(svgChen.includes('1:N'));
});

console.log('\n--- 4. CLOUD ARCHITECTURE PARSER & RENDERER TESTS ---');

it('parses cloud architecture with open icons and cloud components', () => {
  const code = `
title Production Architecture
direction right

Internet [icon: globe]
LoadBalancer [icon: aws-alb, color: orange, label: "Application Load Balancer"]
AppCluster [icon: aws-ecs, color: blue, label: "ECS Fargate Cluster"]
PrimaryDB [icon: aws-rds, color: purple, label: "Aurora PostgreSQL"]
StaticAssets [icon: aws-s3, color: green, label: "S3 Bucket"]

Internet > LoadBalancer: HTTPS
LoadBalancer > AppCluster: Reverse Proxy
AppCluster > PrimaryDB: Read/Write SQL
AppCluster > StaticAssets: Store Uploads
`;
  const { ast, errors } = parseDiagram(code, 'cloud-architecture-diagram');
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(ast.type, 'cloud-architecture-diagram');
  assert.strictEqual(ast.direction, 'right');
  assert.strictEqual(ast.nodes.length, 5);

  const alb = ast.nodes.find(n => n.id === 'LoadBalancer');
  assert.strictEqual(alb.icon, 'aws-alb');
  assert.strictEqual(alb.color, 'orange');
});

console.log('\n--- 5. GLOBAL DIRECTIVES TESTS ---');

it('verifies colorMode (pastel/bold/outline), styleMode (plain/shadow/watercolor), typeface (rough/clean/mono), and direction', () => {
  const directivesTest = `
title Directive Showcase
direction left
styleMode watercolor
typeface mono
colorMode outline
textSize large
layout compact
wrap off

Node1 > Node2
`;
  const { ast } = parseFlowchart(directivesTest);
  assert.strictEqual(ast.direction, 'left');
  assert.strictEqual(ast.styleMode, 'watercolor');
  assert.strictEqual(ast.typeface, 'mono');
  assert.strictEqual(ast.colorMode, 'outline');
  assert.strictEqual(ast.textSize, 'large');
  assert.strictEqual(ast.layout, 'compact');
  assert.strictEqual(ast.wrap, 'off');

  const svg = renderDiagramToSVG(ast);
  assert(svg.includes('font-family="ui-monospace'));
  assert(svg.includes('filter="url(#watercolor-filter)"'));
});

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
