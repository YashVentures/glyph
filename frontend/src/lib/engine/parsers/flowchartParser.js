import { tokenize, extractAttributeBlock, splitOutsideQuotes, stripQuotes } from '../tokenizer.js';
import { CONNECTION_OPERATORS } from '../constants.js';

export function parseFlowchart(sourceCode, isCloudArchitecture = false) {
  const lines = tokenize(sourceCode);
  const errors = [];

  const ast = {
    type: isCloudArchitecture ? 'cloud-architecture-diagram' : 'flowchart-diagram',
    title: '',
    direction: isCloudArchitecture ? 'right' : 'down',
    styleMode: 'shadow',     // plain | shadow | watercolor
    typeface: 'rough',       // rough | clean | mono
    textSize: 'medium',      // small | medium | large
    colorMode: 'pastel',     // pastel | bold | outline
    wrap: 'on',              // on | off
    layout: 'sequential',    // compact | sequential
    nodes: new Map(),        // id -> Node
    edges: [],
    groups: [],
    errors: []
  };

  let currentGroup = null;

  for (const lineObj of lines) {
    const { lineNumber, content, raw } = lineObj;

    try {
      // 1. Group closing
      if (content === '}') {
        if (currentGroup) {
          ast.groups.push(currentGroup);
          currentGroup = null;
        } else {
          errors.push({
            line: lineNumber,
            message: 'Unexpected closing brace "}" without matching group',
            context: content
          });
        }
        continue;
      }

      // 2. Global Directives
      if (handleDirective(content, ast, lineNumber)) {
        continue;
      }

      // 3. Group opening: GroupName [attrs] {
      if (content.endsWith('{')) {
        const groupHeader = content.slice(0, -1).trim();
        const { rest: groupNameRaw, attributes } = extractAttributeBlock(groupHeader);
        const groupId = stripQuotes(groupNameRaw);

        currentGroup = {
          id: groupId,
          label: attributes.label || groupId,
          attributes,
          sourceLineNumber: lineNumber,
          nodeIds: []
        };
        continue;
      }

      // 4. Connection line (e.g. A > B: label [color: red])
      const connectionParsed = parseConnection(content, lineNumber);
      if (connectionParsed) {
        for (const edge of connectionParsed.edges) {
          ast.edges.push(edge);
          // Ensure auto-discovered source and target nodes exist in ast.nodes
          ensureNodeExists(edge.source, ast, lineNumber, currentGroup);
          ensureNodeExists(edge.target, ast, lineNumber, currentGroup);
        }
        continue;
      }

      // 5. Explicit Node declaration: NodeId [shape: oval, color: blue, label: "My Node"]
      const { rest: nodeNameRaw, attributes, hasAttrs } = extractAttributeBlock(content);
      const nodeId = stripQuotes(nodeNameRaw);

      if (nodeId) {
        const existing = ast.nodes.get(nodeId);
        const node = {
          id: nodeId,
          label: attributes.label || (existing ? existing.label : nodeId),
          shape: attributes.shape || (existing ? existing.shape : 'rectangle'),
          color: attributes.color || (existing ? existing.color : 'default'),
          icon: attributes.icon || (existing ? existing.icon : null),
          link: attributes.link || null,
          attributes: { ...(existing?.attributes || {}), ...attributes },
          sourceLineNumber: lineNumber,
          groupId: currentGroup ? currentGroup.id : (existing ? existing.groupId : null)
        };

        ast.nodes.set(nodeId, node);
        if (currentGroup && !currentGroup.nodeIds.includes(nodeId)) {
          currentGroup.nodeIds.push(nodeId);
        }
        continue;
      }

      // If we couldn't parse line
      errors.push({
        line: lineNumber,
        message: `Unrecognized statement: "${content}"`,
        context: content
      });

    } catch (err) {
      errors.push({
        line: lineNumber,
        message: err.message || 'Syntax error',
        context: content
      });
    }
  }

  // If a group was left unclosed
  if (currentGroup) {
    errors.push({
      line: currentGroup.sourceLineNumber,
      message: `Unclosed group block "${currentGroup.id}"`,
      context: currentGroup.id
    });
    ast.groups.push(currentGroup);
  }

  return {
    ast: {
      ...ast,
      nodes: Array.from(ast.nodes.values())
    },
    errors
  };
}

function handleDirective(content, ast, lineNumber) {
  // Title
  if (/^title\b/i.test(content)) {
    const titleText = content.replace(/^title\s*:?\s*/i, '').trim();
    ast.title = stripQuotes(titleText);
    return true;
  }

  // Direction: up | down | left | right
  if (/^direction\b/i.test(content)) {
    const dir = content.replace(/^direction\s*:?\s*/i, '').trim().toLowerCase();
    if (['up', 'down', 'left', 'right'].includes(dir)) {
      ast.direction = dir;
    }
    return true;
  }

  // Global Style Directives: styleMode, typeface, textSize, colorMode, wrap, layout
  const styleMatch = content.match(/^(styleMode|typeface|textSize|colorMode|wrap|layout)\s*:?\s*(\S+)/i);
  if (styleMatch) {
    const key = styleMatch[1].toLowerCase();
    const val = stripQuotes(styleMatch[2].toLowerCase());
    if (key === 'stylemode' && ['plain', 'shadow', 'watercolor'].includes(val)) ast.styleMode = val;
    if (key === 'typeface' && ['rough', 'clean', 'mono'].includes(val)) ast.typeface = val;
    if (key === 'textsize' && ['small', 'medium', 'large'].includes(val)) ast.textSize = val;
    if (key === 'colormode' && ['pastel', 'bold', 'outline'].includes(val)) ast.colorMode = val;
    if (key === 'wrap' && ['on', 'off'].includes(val)) ast.wrap = val;
    if (key === 'layout' && ['compact', 'sequential'].includes(val)) ast.layout = val;
    return true;
  }

  return false;
}

function ensureNodeExists(nodeId, ast, lineNumber, currentGroup) {
  if (!ast.nodes.has(nodeId)) {
    ast.nodes.set(nodeId, {
      id: nodeId,
      label: nodeId,
      shape: 'rectangle',
      color: 'default',
      icon: null,
      attributes: {},
      sourceLineNumber: lineNumber,
      groupId: currentGroup ? currentGroup.id : null
    });
    if (currentGroup && !currentGroup.nodeIds.includes(nodeId)) {
      currentGroup.nodeIds.push(nodeId);
    }
  }
}

// Parses connection declarations including chaining (A > B > C) and multi-targets (A > B, C)
function parseConnection(content, lineNumber) {
  // Check if line contains any connection operator
  // Order of operators matters for matching (longer symbols first)
  const opKeys = ['<-->', '<->', '-->', '<--', '<>', '->', '<-', '--', '>', '<', '-'];
  let foundOp = null;

  for (const op of opKeys) {
    // Check if operator occurs outside quotes
    const idx = indexOfOutsideQuotes(content, op);
    if (idx !== -1) {
      foundOp = op;
      break;
    }
  }

  if (!foundOp) return null;

  // Extract trailing attribute block if present: [color: red]
  const { rest, attributes } = extractAttributeBlock(content);

  // Split label by colon: "A > B: some label"
  let leftSide = rest;
  let label = '';

  const colonIdx = indexOfOutsideQuotes(rest, ':');
  if (colonIdx !== -1) {
    leftSide = rest.slice(0, colonIdx).trim();
    label = stripQuotes(rest.slice(colonIdx + 1).trim());
  }

  // Parse chain of nodes: "A > B > C"
  // Split on found operators
  const segments = splitByOperatorChain(leftSide);
  if (segments.length < 2) return null;

  const edges = [];
  const edgeMeta = CONNECTION_OPERATORS[foundOp] || { type: 'FORWARD', dashed: false };

  for (let i = 0; i < segments.length - 1; i++) {
    const fromSegment = segments[i];
    const toSegment = segments[i + 1];

    const fromTargets = splitOutsideQuotes(fromSegment.text, ',').map(stripQuotes).filter(Boolean);
    const toTargets = splitOutsideQuotes(toSegment.text, ',').map(stripQuotes).filter(Boolean);
    const currentOp = toSegment.operator || foundOp;
    const currentMeta = CONNECTION_OPERATORS[currentOp] || edgeMeta;

    for (const src of fromTargets) {
      for (const tgt of toTargets) {
        edges.push({
          id: `edge-${src}-${tgt}-${lineNumber}-${i}`,
          source: src,
          target: tgt,
          operator: currentOp,
          relationship: currentMeta.type,
          dashed: currentMeta.dashed,
          label: i === 0 ? label : '', // Attach label to primary link
          color: attributes.color || 'default',
          attributes,
          sourceLineNumber: lineNumber
        });
      }
    }
  }

  return { edges };
}

function splitByOperatorChain(str) {
  const opKeys = ['<-->', '<->', '-->', '<--', '<>', '->', '<-', '--', '>', '<', '-'];
  const segments = [];
  let buffer = '';
  let lastOp = null;
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }

    if (!inQuotes) {
      // Check if an operator starts here
      let matchedOp = null;
      for (const op of opKeys) {
        if (str.startsWith(op, i)) {
          matchedOp = op;
          break;
        }
      }

      if (matchedOp) {
        segments.push({ text: buffer.trim(), operator: lastOp });
        buffer = '';
        lastOp = matchedOp;
        i += matchedOp.length - 1;
        continue;
      }
    }

    buffer += char;
  }

  if (buffer.trim().length > 0) {
    segments.push({ text: buffer.trim(), operator: lastOp });
  }

  return segments;
}

function indexOfOutsideQuotes(str, search) {
  let inQuotes = false;
  for (let i = 0; i <= str.length - search.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (!inQuotes && str.startsWith(search, i)) {
      return i;
    }
  }
  return -1;
}
