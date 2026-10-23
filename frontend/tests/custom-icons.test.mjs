import assert from 'node:assert';
import { parseDiagram } from '../src/lib/engine/parser.js';
import { renderDiagramToSVG } from '../src/lib/engine/renderer.js';
import { setCustomIcons, getCustomIcon } from '../src/lib/engine/constants.js';

const API_BASE = 'http://localhost:8000/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runCustomIconTests() {
  console.log('\n--- CUSTOM ICONS & COLLISION TESTS (STEP 10) ---');

  // 1. Upload custom SVG icon
  const sampleSvg = '<svg viewBox="0 0 100 100"><polygon points="50,15 90,85 10,85" fill="purple"/></svg>';
  const uploadRes = await request('/icons', {
    method: 'POST',
    body: JSON.stringify({
      name: 'triangle-corp',
      svgContent: sampleSvg
    })
  });
  assert.strictEqual(uploadRes.status, 201, 'Custom icon uploaded');
  const icon = uploadRes.data.icon;
  assert.strictEqual(icon.name, 'triangle-corp');
  console.log('  ✓ uploads sanitized SVG custom icon with name');

  // 2. List icons and register in engine registry
  const listRes = await request('/icons');
  assert.strictEqual(listRes.status, 200);
  assert.ok(listRes.data.icons.some(i => i.name === 'triangle-corp'));
  setCustomIcons(listRes.data.icons);
  assert.ok(getCustomIcon('triangle-corp'), 'Icon resolved from constants registry');
  console.log('  ✓ lists workspace custom icons and registers in local engine');

  // 3. Render diagram referencing custom icon by name
  const codeWithCustomIcon = `
    title Custom Icon Diagram
    direction right
    App [icon: triangle-corp, color: purple, label: "Custom Service"]
  `;
  const ast = parseDiagram(codeWithCustomIcon, 'flowchart-diagram');
  const svgOutput = renderDiagramToSVG(ast, { theme: 'dark' });

  assert.ok(svgOutput.includes('data-custom-icon="triangle-corp"'), 'Embeds custom icon in node');
  assert.ok(svgOutput.includes('data:image/svg+xml'), 'Uses self-contained data URL');
  
  // The only allowed HTTP URL is standard W3C XML namespace
  const svgWithoutXmlns = svgOutput.replace(/xmlns(:[a-z0-9_-]+)?="http:\/\/www\.w3\.org\/[^"]+"/gi, '');
  assert.ok(!/https?:\/\//i.test(svgWithoutXmlns), 'No external HTTP/HTTPS URLs in rendered SVG');
  assert.ok(!/@import/i.test(svgWithoutXmlns), 'No external @import in rendered SVG');
  console.log('  ✓ renders custom icon safely in canvas & export SVG without external network calls');

  // 4. Verify Collision Rule: Custom icon overrides bundled icon when names collide
  const overridingSvg = '<svg viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z" fill="gold"/></svg>';
  await request('/icons', {
    method: 'POST',
    body: JSON.stringify({
      name: 'database', // Same name as bundled icon!
      svgContent: overridingSvg
    })
  });
  const updatedList = await request('/icons');
  setCustomIcons(updatedList.data.icons);

  const collideCode = `
    title Collision Diagram
    Storage [icon: database, color: blue, label: "Overridden Database"]
  `;
  const collideAst = parseDiagram(collideCode, 'flowchart-diagram');
  const collideSvg = renderDiagramToSVG(collideAst, { theme: 'dark' });

  assert.ok(collideSvg.includes('data-custom-icon="database"'), 'Custom icon overrides bundled icon');
  console.log('  ✓ collision rule enforced: custom workspace icon takes precedence over bundled icon');

  // 5. Verify Graceful Degradation: Unknown icon name does not crash or break layout
  const unknownCode = `
    title Unknown Icon Test
    UnknownNode [icon: totally-fictional-icon-999, color: green, label: "Safe Node"]
  `;
  const unknownAst = parseDiagram(unknownCode, 'flowchart-diagram');
  assert.strictEqual(unknownAst.errors.length, 0, 'No parser syntax errors for unknown icon name');

  const unknownSvg = renderDiagramToSVG(unknownAst, { theme: 'dark' });
  assert.ok(unknownSvg.includes('Safe Node'), 'Node renders successfully');
  assert.ok(!unknownSvg.includes('data-custom-icon="totally-fictional-icon-999"'), 'Omits missing icon');
  console.log('  ✓ unknown icon name degrades gracefully without crashing the render');

  // 6. Rename icon
  const renameRes = await request(`/icons/${icon.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'triangle-renamed' })
  });
  assert.strictEqual(renameRes.status, 200);
  assert.strictEqual(renameRes.data.icon.name, 'triangle-renamed');
  console.log('  ✓ renames custom icon in workspace');

  // 7. Delete icon
  const delRes = await request(`/icons/${icon.id}`, {
    method: 'DELETE'
  });
  assert.strictEqual(delRes.status, 200);
  console.log('  ✓ deletes custom icon from workspace');

  console.log('\n========================================');
  console.log('CUSTOM ICON TEST SUMMARY: ALL 7 PASSED, 0 FAILED');
  console.log('========================================\n');
}

runCustomIconTests().catch(err => {
  console.error('Custom icon test failed:', err);
  process.exit(1);
});
