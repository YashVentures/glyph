import { parseFlowchart } from './parsers/flowchartParser.js';
import { parseSequence } from './parsers/sequenceParser.js';
import { parseERD } from './parsers/erdParser.js';

export function parseDiagram(sourceCode, explicitType = null) {
  const code = (sourceCode || '').trim();
  const diagramType = explicitType || detectDiagramType(code);

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
