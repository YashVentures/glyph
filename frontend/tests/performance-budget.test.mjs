import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { renderDiagramToSVG } from '../src/lib/engine/renderer.js';

console.log('\n--- STEP 15: PERFORMANCE BUDGET (200 NODES, 300 EDGES) ---');

// Generate large graph code with 200 nodes and 300 edges
function generateLargeDiagram(numNodes = 200, numEdges = 300) {
  const lines = ['title Performance Scale Benchmark', 'direction right', 'styleMode shadow'];
  
  for (let i = 1; i <= numNodes; i++) {
    const color = i % 3 === 0 ? 'blue' : (i % 3 === 1 ? 'green' : 'purple');
    const shape = i % 2 === 0 ? 'rectangle' : 'cylinder';
    lines.push(`Node_${i} [shape: ${shape}, color: ${color}, label: "Microservice Worker ${i}"]`);
  }

  // Generate 300 interconnected edges
  for (let e = 1; e <= numEdges; e++) {
    const from = (e % numNodes) + 1;
    const to = ((e * 7) % numNodes) + 1;
    if (from !== to) {
      lines.push(`Node_${from} > Node_${to}: RPC ${e}`);
    } else {
      const altTo = (to % numNodes) + 1;
      lines.push(`Node_${from} > Node_${altTo}: RPC ${e}`);
    }
  }

  return lines.join('\n');
}

const largeCode = generateLargeDiagram(200, 300);
console.log(`Generated diagram code: ${largeCode.length} characters, ~500 lines`);

// 1. Benchmark Parser execution
const parseStart = performance.now();
const { ast, errors } = parseDiagram(largeCode);
const parseTime = performance.now() - parseStart;
console.log(`1. Parse 200 nodes & 300 edges: ${parseTime.toFixed(2)}ms (errors: ${errors.length})`);
assert.strictEqual(errors.length, 0);
assert(ast.nodes.length >= 200);
assert(ast.edges.length >= 300);

// 2. Benchmark Dagre Layout & SVG Renderer
const renderStart = performance.now();
const svgOutput = renderDiagramToSVG(ast, { theme: 'dark' });
const renderTime = performance.now() - renderStart;
console.log(`2. Dagre Layout & SVG Render: ${renderTime.toFixed(2)}ms`);
assert(svgOutput.includes('<svg') && svgOutput.includes('</svg>'));
assert(svgOutput.length > 50000);

// 3. Incremental keystroke simulation (10 rapid simulated keystrokes modifying code)
const typingTimes = [];
for (let k = 1; k <= 10; k++) {
  const tStart = performance.now();
  const modifiedCode = largeCode + `\nNode_1 > Node_200: Stream Packet ${k}`;
  const res = parseDiagram(modifiedCode);
  const tElapsed = performance.now() - tStart;
  typingTimes.push(tElapsed);
}
const avgTypingParse = typingTimes.reduce((a, b) => a + b, 0) / typingTimes.length;
console.log(`3. Incremental keystroke parse time (avg over 10 edits): ${avgTypingParse.toFixed(2)}ms`);

const totalPipeline = parseTime + renderTime;
console.log(`\nTOTAL PIPELINE LATENCY: ${totalPipeline.toFixed(2)}ms`);
assert(totalPipeline < 1000, `Performance budget exceeded: ${totalPipeline}ms > 1000ms`);

console.log('\n========================================');
console.log('PERFORMANCE BUDGET PASSED: STAYS RESPONSIVE UNDER LOAD');
console.log('========================================\n');
