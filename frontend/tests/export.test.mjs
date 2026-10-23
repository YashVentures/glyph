import assert from 'node:assert';
import { 
  buildSelfContainedSVG, 
  exportDiagramToPNG, 
  extractSvgDimensions,
  EXPORT_SCOPES,
  EXPORT_FORMATS,
  SCOPE_FORMATS_MAP
} from '../src/lib/engine/export.js';
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

console.log('\n--- EXPORT ENGINE TESTS (STEP 8) ---');

async function runTests() {
  // Test 1: Self-contained SVG has valid structure and NO external references
  await it('exported SVG is self-contained and has NO external URLs or remote assets', async () => {
    const dsl = `title Architecture Overview
direction right
styleMode shadow
colorMode pastel
typeface rough

Client [icon: user, shape: oval]
Gateway [icon: router, color: green]
Database [icon: database, shape: cylinder, color: purple]

Client > Gateway: HTTPS request
Gateway > Database: SQL query
`;
    const ast = parseDiagram(dsl, 'cloud-architecture-diagram');
    const svg = buildSelfContainedSVG(ast, { background: 'solid', theme: 'dark' });

    // 1. Valid SVG wrapper
    assert.strictEqual(svg.startsWith('<svg') || svg.includes('<svg'), true, 'Must start with <svg tag');
    assert.strictEqual(svg.includes('</svg>'), true, 'Must properly close </svg>');

    // 2. Embedded fonts style block present
    assert.strictEqual(svg.includes('@font-face'), true, 'Must contain self-contained @font-face definitions');
    assert.strictEqual(svg.includes("font-family: 'rough'"), true, 'Must define rough font');
    assert.strictEqual(svg.includes("font-family: 'clean'"), true, 'Must define clean font');
    assert.strictEqual(svg.includes("font-family: 'mono'"), true, 'Must define mono font');

    // 3. Embedded icons: contains inline SVG path data, not external <img>
    assert.strictEqual(svg.includes('<img'), false, 'Must not contain external <img> tags');
    assert.strictEqual(svg.includes('<image'), false, 'Must not contain external <image> tags');
    assert.strictEqual(svg.includes('data-icon="user"'), true, 'Must embed user icon');
    assert.strictEqual(svg.includes('data-icon="database"'), true, 'Must embed database icon');

    // 4. NO EXTERNAL URLs: check for http://, https://, ftp://, or //
    // The ONLY allowed URL is standard xmlns="http://www.w3.org/2000/svg"
    const svgWithoutXmlns = svg.replace('xmlns="http://www.w3.org/2000/svg"', '');
    const hasExternalUrl = /https?:\/\//i.test(svgWithoutXmlns) || /@import/i.test(svgWithoutXmlns);
    assert.strictEqual(hasExternalUrl, false, 'SVG must not contain any external URLs or @import');
  });

  // Test 2: PNG dimensions match scale (1x, 2x, 3x)
  await it('PNG export dimensions match scales 1x, 2x, and 3x', async () => {
    const dsl = `title Scaling Test
start [shape: rectangle]
finish [shape: rectangle]
start > finish
`;
    const ast = parseDiagram(dsl, 'flowchart-diagram');
    const svg = buildSelfContainedSVG(ast);
    const { width: baseWidth, height: baseHeight } = extractSvgDimensions(svg);

    // Test 1x
    const res1x = await exportDiagramToPNG(ast, { scale: 1 });
    assert.strictEqual(res1x.scale, 1);
    assert.strictEqual(res1x.width, baseWidth * 1);
    assert.strictEqual(res1x.height, baseHeight * 1);

    // Test 2x
    const res2x = await exportDiagramToPNG(ast, { scale: 2 });
    assert.strictEqual(res2x.scale, 2);
    assert.strictEqual(res2x.width, baseWidth * 2);
    assert.strictEqual(res2x.height, baseHeight * 2);

    // Test 3x
    const res3x = await exportDiagramToPNG(ast, { scale: 3 });
    assert.strictEqual(res3x.scale, 3);
    assert.strictEqual(res3x.width, baseWidth * 3);
    assert.strictEqual(res3x.height, baseHeight * 3);
  });

  // Test 3: Every diagram type exports to SVG and PNG without error
  await it('every diagram type exports to SVG and PNG without error', async () => {
    const diagramSamples = [
      {
        type: 'flowchart-diagram',
        code: `title Flowchart Sample\ndirection down\nNodeA [shape: oval, color: blue]\nNodeB [shape: rectangle, color: green]\nNodeA > NodeB: execute`
      },
      {
        type: 'cloud-architecture-diagram',
        code: `title Cloud Sample\ndirection right\nApp [icon: server, color: purple]\nDB [icon: aws-rds, shape: cylinder, color: blue]\nApp > DB: query`
      },
      {
        type: 'sequence-diagram',
        code: `title Sequence Sample\norder Alice, Bob\nAlice > Bob: Hello\nBob > Alice: Hi`
      },
      {
        type: 'erd-diagram',
        code: `title ERD Sample\nnotation crows-foot\nUsers [color: blue] {\n  id int pk\n  email string unique\n}\nOrders [color: green] {\n  id int pk\n  user_id int fk\n}\nUsers < Orders: places`
      }
    ];

    for (const sample of diagramSamples) {
      const ast = parseDiagram(sample.code, sample.type);
      assert.strictEqual(Boolean(ast), true, `AST parsing failed for ${sample.type}`);

      // Export SVG
      const svg = buildSelfContainedSVG(ast, { background: 'solid', theme: 'dark' });
      assert.strictEqual(svg.includes('</svg>'), true, `SVG export failed for ${sample.type}`);

      // Export PNG at 2x
      const pngRes = await exportDiagramToPNG(ast, { scale: 2 });
      assert.strictEqual(pngRes.width > 0, true, `PNG width invalid for ${sample.type}`);
      assert.strictEqual(pngRes.height > 0, true, `PNG height invalid for ${sample.type}`);
    }
  });

  // Test 4: Renders correctly for every styleMode (including watercolor filter), colorMode, and typeface
  await it('renders correctly for styleMode watercolor, shadow, plain, colorMode, and typeface', async () => {
    // 1. Watercolor filter test
    const watercolorDsl = `title Watercolor Style
styleMode watercolor
colorMode bold
typeface rough

A [shape: rectangle, color: green]
B [shape: cylinder, color: orange]
A > B
`;
    const watercolorAst = parseDiagram(watercolorDsl);
    const watercolorSvg = buildSelfContainedSVG(watercolorAst);
    assert.strictEqual(watercolorSvg.includes('id="watercolor-filter"'), true, 'Must include watercolor filter in defs');
    assert.strictEqual(watercolorSvg.includes('feTurbulence'), true, 'Must include feTurbulence noise generator');
    assert.strictEqual(watercolorSvg.includes('feDisplacementMap'), true, 'Must include feDisplacementMap for watercolor edge distortion');
    assert.strictEqual(watercolorSvg.includes('filter="url(#watercolor-filter)"'), true, 'Elements must apply watercolor filter');

    // 2. Shadow styleMode test
    const shadowDsl = `title Shadow Style\nstyleMode shadow\nNode [shape: oval]\n`;
    const shadowAst = parseDiagram(shadowDsl);
    const shadowSvg = buildSelfContainedSVG(shadowAst);
    assert.strictEqual(shadowSvg.includes('id="shadow-filter"'), true, 'Must include shadow-filter in defs');
    assert.strictEqual(shadowSvg.includes('feDropShadow'), true);

    // 3. Plain styleMode test
    const plainDsl = `title Plain Style\nstyleMode plain\nNode [shape: oval]\n`;
    const plainAst = parseDiagram(plainDsl);
    const plainSvg = buildSelfContainedSVG(plainAst);
    assert.strictEqual(plainSvg.includes('filter="url(#watercolor-filter)"'), false);

    // 4. ColorMode tests (pastel, bold, outline)
    const outlineDsl = `title Outline\ncolorMode outline\nBox [color: blue]\n`;
    const outlineAst = parseDiagram(outlineDsl);
    const outlineSvg = buildSelfContainedSVG(outlineAst);
    assert.strictEqual(outlineSvg.includes('fill="none"'), true, 'Outline colorMode must use fill="none"');

    // 5. Typeface tests (rough, clean, mono)
    const monoDsl = `title Mono\ntypeface mono\nCodeNode [shape: rectangle]\n`;
    const monoAst = parseDiagram(monoDsl);
    const monoSvg = buildSelfContainedSVG(monoAst);
    assert.strictEqual(monoSvg.includes('monospace'), true, 'Mono typeface must specify monospace font family');
  });

  // Test 5: Export scopes and format mappings match recon
  await it('export scopes and format mappings provide required formats', () => {
    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.CANVAS].includes(EXPORT_FORMATS.PNG_1X), true);
    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.CANVAS].includes(EXPORT_FORMATS.PNG_2X), true);
    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.CANVAS].includes(EXPORT_FORMATS.PNG_3X), true);
    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.CANVAS].includes(EXPORT_FORMATS.SVG), true);
    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.CANVAS].includes(EXPORT_FORMATS.PDF), true);

    assert.strictEqual(SCOPE_FORMATS_MAP[EXPORT_SCOPES.SELECTION].includes(EXPORT_FORMATS.COPY_CODE), true);
  });

  console.log(`\n========================================`);
  console.log(`EXPORT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
