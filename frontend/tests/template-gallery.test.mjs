import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { renderDiagramToSVG } from '../src/lib/engine/renderer.js';

const API_BASE = 'http://localhost:8000/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTemplateGalleryTests() {
  console.log('\n--- TEMPLATE GALLERY & ENGINE VALIDATION TESTS (STEP 11) ---');

  // 1. Fetch all seed templates from backend
  const tplRes = await request('/templates');
  assert.strictEqual(tplRes.status, 200, 'Templates endpoint returned 200');
  const templates = tplRes.data.templates;
  assert.ok(Array.isArray(templates) && templates.length >= 8, 'At least 8 seed templates present');

  console.log(`  Found ${templates.length} seed reference templates across categories:`);
  const categories = {};
  for (const t of templates) {
    categories[t.category] = (categories[t.category] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`    - ${cat}: ${count} templates`);
  }

  // 2. ENFORCE: Every single seed diagram must parse cleanly with zero errors through real engine
  for (const tpl of templates) {
    const { ast, errors } = parseDiagram(tpl.code, tpl.diagramType);
    assert.strictEqual(
      errors ? errors.length : 0, 
      0, 
      `Template "${tpl.name}" (${tpl.id}) failed to parse cleanly: ${JSON.stringify(errors)}`
    );

    // Verify SVG rendering succeeds for every template
    const svg = renderDiagramToSVG(ast, { theme: 'dark' });
    assert.ok(svg.includes('<svg'), `Template "${tpl.name}" must produce valid SVG`);
    assert.ok(svg.includes('</svg>'), `Template "${tpl.name}" SVG must be closed`);
    console.log(`  ✓ parsed & rendered seed template: "${tpl.name}" [${tpl.category}]`);
  }

  // 3. Test "Use Template" action (creates a new file with doc notes and diagram canvas)
  const chosenTemplate = templates[0];
  const newFilePayload = {
    title: chosenTemplate.name,
    docContent: `# ${chosenTemplate.name}\n\n${chosenTemplate.description}`,
    canvasData: JSON.stringify({
      diagrams: [
        {
          id: 'diag-template-1',
          type: 'diagram',
          diagramType: chosenTemplate.diagramType,
          code: chosenTemplate.code,
          x: 80,
          y: 80
        }
      ]
    })
  };

  const createRes = await request('/files', {
    method: 'POST',
    body: JSON.stringify(newFilePayload)
  });

  assert.strictEqual(createRes.status, 201, 'New file created from template');
  const createdFile = createRes.data.file;
  assert.strictEqual(createdFile.title, chosenTemplate.name);
  assert.ok(createdFile.doc_content.includes(chosenTemplate.description));
  console.log(`  ✓ "Use template" successfully created new file (ID: ${createdFile.id})`);

  // Cleanup created file
  await request(`/files/${createdFile.id}`, { method: 'DELETE' });

  console.log('\n========================================');
  console.log('TEMPLATE GALLERY TEST SUMMARY: ALL PASSED, 0 FAILED');
  console.log('========================================\n');
}

runTemplateGalleryTests().catch(err => {
  console.error('Template gallery test failed:', err);
  process.exit(1);
});
