import { parseFlowchart } from './parsers/flowchartParser.js';
import { parseSequence } from './parsers/sequenceParser.js';
import { parseERD } from './parsers/erdParser.js';

export const MAX_CODE_LENGTH = 150000; // 150 KB

export function createEmptyAst(type = 'flowchart-diagram') {
  if (type === 'sequence-diagram') {
    return {
      type,
      title: '',
      autoNumber: 'off',
      typeface: 'rough',
      styleMode: 'shadow',
      textSize: 'medium',
      colorMode: 'pastel',
      participants: [],
      steps: [],
      errors: []
    };
  }
  if (type === 'erd-diagram') {
    return {
      type,
      title: '',
      notation: 'crows-foot',
      typeface: 'rough',
      styleMode: 'shadow',
      textSize: 'medium',
      colorMode: 'pastel',
      wrap: 'on',
      layout: 'sequential',
      tables: [],
      relationships: [],
      errors: []
    };
  }
  return {
    type,
    title: '',
    direction: type === 'cloud-architecture-diagram' ? 'right' : 'down',
    styleMode: 'shadow',
    typeface: 'rough',
    textSize: 'medium',
    colorMode: 'pastel',
    wrap: 'on',
    layout: 'sequential',
    nodes: [],
    edges: [],
    groups: [],
    errors: []
  };
}

export function parseDiagram(sourceCode, explicitType = null) {
  if (sourceCode === null || sourceCode === undefined) {
    sourceCode = '';
  }

  if (typeof sourceCode !== 'string') {
    return {
      ast: createEmptyAst(explicitType || 'flowchart-diagram'),
      errors: [{ line: 1, message: 'Invalid input: diagram source code must be a string.' }]
    };
  }

  if (sourceCode.length > MAX_CODE_LENGTH) {
    return {
      ast: createEmptyAst(explicitType || 'flowchart-diagram'),
      errors: [{
        line: 1,
        message: `Diagram code exceeds maximum allowed size of ${MAX_CODE_LENGTH} characters (received ${sourceCode.length}).`
      }]
    };
  }

  // Null byte / binary garbage check
  if (sourceCode.includes('\x00')) {
    return {
      ast: createEmptyAst(explicitType || 'flowchart-diagram'),
      errors: [{ line: 1, message: 'Binary garbage detected: source code contains null bytes.' }]
    };
  }

  const code = sourceCode.trim();
  const diagramType = explicitType || detectDiagramType(code);

  if (code.length === 0) {
    return {
      ast: createEmptyAst(diagramType),
      errors: []
    };
  }

  try {
    switch (diagramType) {
      case 'sequence-diagram':
        return parseSequence(code);

      case 'erd-diagram':
        return parseERD(code);

      case 'cloud-architecture-diagram':
        return parseFlowchart(code, true);

      case 'flowchart-diagram':
      default:
        return parseFlowchart(code, false);
    }
  } catch (err) {
    return {
      ast: createEmptyAst(diagramType),
      errors: [{ line: 1, message: `Parser error: ${err.message || 'Unknown parsing failure'}` }]
    };
  }
}

// Auto-detect diagram type from keywords if not explicitly specified
export function detectDiagramType(code) {
  // Sequence diagram indicators: "order", "activate", "loop {", "alt {"
  if (/\b(order\s+[a-zA-Z0-9_]|activate\s+|deactivate\s+|loop\s*\{|alt\s*\{)/i.test(code)) {
    return 'sequence-diagram';
  }

  // ERD indicators: table fields with pk/fk, "notation:"
  if (/\b(pk\b|fk\b|unique\b|notation\s*:)/i.test(code) && /\{[\s\S]*?\}/.test(code)) {
    return 'erd-diagram';
  }

  // Cloud Architecture indicators: icons matching aws, cloud, infra
  if (/\b(icon\s*:\s*(aws-|cloud|server|database|lambda|alb|rds|s3|router))/i.test(code)) {
    return 'cloud-architecture-diagram';
  }

  return 'flowchart-diagram';
}
