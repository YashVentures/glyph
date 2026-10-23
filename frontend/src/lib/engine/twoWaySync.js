/**
 * Two-Way Synchronization Engine
 * Handles reverse sync from Canvas mutations to Code,
 * patching only the affected sourceLineNumber while preserving
 * formatting, indentation, comments, and line ordering.
 */

import { parseAttributes } from './tokenizer.js';

function formatAttrVal(key, val) {
  if (val === true) return 'true';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1);
  }
  // Escape unescaped double quotes
  const escaped = str.replace(/(?<!\\)"/g, '\\"');
  if (escaped.includes(' ') || escaped.includes(':') || escaped.includes(',') || escaped.includes('[') || escaped.includes(']') || escaped.includes('"')) {
    return `"${escaped}"`;
  }
  return escaped;
}

/**
 * Patches a single attribute (or adds it) inside the [key: val] block of a specific line.
 */
export function patchLineAttribute(line, attrKey, attrValue) {
  const openBracket = line.indexOf('[');
  const closeBracket = line.lastIndexOf(']');

  // No existing attribute block: append [attrKey: attrValue] before any trailing comments or brace
  if (openBracket === -1 || closeBracket === -1 || closeBracket < openBracket) {
    const commentIdx = line.indexOf('//');
    const valFormatted = formatAttrVal(attrKey, attrValue);
    if (commentIdx !== -1) {
      const codePart = line.slice(0, commentIdx).trimEnd();
      const commentPart = line.slice(commentIdx);
      return `${codePart} [${attrKey}: ${valFormatted}] ${commentPart}`;
    }
    const braceIdx = line.indexOf('{');
    if (braceIdx !== -1) {
      const codePart = line.slice(0, braceIdx).trimEnd();
      const rest = line.slice(braceIdx);
      return `${codePart} [${attrKey}: ${valFormatted}] ${rest}`;
    }
    return `${line.trimEnd()} [${attrKey}: ${valFormatted}]`;
  }

  // Has attribute block: parse attributes, modify or add key
  const beforeBlock = line.slice(0, openBracket);
  const blockContent = line.slice(openBracket + 1, closeBracket);
  const afterBlock = line.slice(closeBracket + 1);

  let attributes = {};
  try {
    attributes = parseAttributes(blockContent);
  } catch (err) {
    attributes = {};
  }
  attributes[attrKey] = attrValue;

  const newAttrList = Object.entries(attributes)
    .filter(([_, val]) => val !== undefined && val !== null)
    .map(([k, v]) => `${k}: ${formatAttrVal(k, v)}`)
    .join(', ');

  return `${beforeBlock}[${newAttrList}]${afterBlock}`;
}

function findColonOutsideBrackets(line) {
  let inQuotes = false;
  let inBrackets = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '[') inBrackets = true;
      else if (ch === ']') inBrackets = false;
      else if (ch === ':' && !inBrackets) return i;
      else if (ch === '/' && line[i + 1] === '/') break;
    }
  }
  return -1;
}

function isConnectionLine(line) {
  let stripped = line;
  const commentIdx = stripped.indexOf('//');
  if (commentIdx !== -1) stripped = stripped.slice(0, commentIdx);
  const percentIdx = stripped.indexOf('%%');
  if (percentIdx !== -1) stripped = stripped.slice(0, percentIdx);

  const bracketOpen = stripped.indexOf('[');
  const bracketClose = stripped.lastIndexOf(']');
  let beforeAttrs = stripped;
  if (bracketOpen !== -1 && bracketClose > bracketOpen) {
    beforeAttrs = stripped.slice(0, bracketOpen) + stripped.slice(bracketClose + 1);
  }

  const operators = ['<-->', '<->', '-->', '<--', '<>', '->', '<-', '--', '>', '<', '-'];
  for (const op of operators) {
    const idx = beforeAttrs.indexOf(op);
    if (idx !== -1) {
      if (op === '-') {
        const charBefore = beforeAttrs[idx - 1];
        const charAfter = beforeAttrs[idx + 1];
        if (/[a-zA-Z0-9_]/.test(charBefore) && /[a-zA-Z0-9_]/.test(charAfter)) {
          continue; // Part of an identifier like user-profile
        }
      }
      return true;
    }
  }
  return false;
}

/**
 * Updates a node, edge, or table label on a specific line.
 */
export function updateLabelAtLine(code, sourceLineNumber, newLabel) {
  const lines = code.split('\n');
  const idx = sourceLineNumber - 1;
  if (idx < 0 || idx >= lines.length) return code;

  let line = lines[idx];

  // 1. Connection line: A > B: label [attrs]
  if (isConnectionLine(line)) {
    const colonIdx = findColonOutsideBrackets(line);
    const formattedLabel = formatAttrVal('label', newLabel);

    if (colonIdx !== -1) {
      const beforeColon = line.slice(0, colonIdx);
      const afterColon = line.slice(colonIdx + 1);
      const attrMatch = afterColon.match(/(\s*\[[^\]]+\])(.*)$/);
      const commentMatch = afterColon.match(/(\s*\/\/.*)$/);
      const trailing = attrMatch ? attrMatch[0] : (commentMatch ? commentMatch[0] : '');
      lines[idx] = `${beforeColon}: ${formattedLabel}${trailing}`;
    } else {
      const attrIdx = line.indexOf('[');
      const commentIdx = line.indexOf('//');
      const splitIdx = attrIdx !== -1 ? attrIdx : (commentIdx !== -1 ? commentIdx : -1);
      if (splitIdx !== -1) {
        lines[idx] = `${line.slice(0, splitIdx).trimEnd()}: ${formattedLabel} ${line.slice(splitIdx).trimStart()}`;
      } else {
        lines[idx] = `${line.trimEnd()}: ${formattedLabel}`;
      }
    }
    return lines.join('\n');
  }

  // 2. Table line: TableName { or TableName [attrs] {
  if (line.includes('{')) {
    const braceIdx = line.indexOf('{');
    const header = line.slice(0, braceIdx).trim();
    const afterBrace = line.slice(braceIdx);
    const patchedHeader = patchLineAttribute(header, 'label', newLabel);
    lines[idx] = `${patchedHeader} ${afterBrace}`.replace(/\s+[{]/, ' {');
    return lines.join('\n');
  }

  // 3. Node line: nodeId [shape: diamond, color: yellow]
  lines[idx] = patchLineAttribute(line, 'label', newLabel);
  return lines.join('\n');
}

/**
 * Updates a node or table color on a specific line.
 */
export function updateColorAtLine(code, sourceLineNumber, newColor) {
  const lines = code.split('\n');
  const idx = sourceLineNumber - 1;
  if (idx < 0 || idx >= lines.length) return code;

  lines[idx] = patchLineAttribute(lines[idx], 'color', newColor);
  return lines.join('\n');
}

/**
 * Updates a node shape on a specific line.
 */
export function updateShapeAtLine(code, sourceLineNumber, newShape) {
  const lines = code.split('\n');
  const idx = sourceLineNumber - 1;
  if (idx < 0 || idx >= lines.length) return code;

  lines[idx] = patchLineAttribute(lines[idx], 'shape', newShape);
  return lines.join('\n');
}

/**
 * Updates a node icon on a specific line.
 */
export function updateIconAtLine(code, sourceLineNumber, newIcon) {
  const lines = code.split('\n');
  const idx = sourceLineNumber - 1;
  if (idx < 0 || idx >= lines.length) return code;

  lines[idx] = patchLineAttribute(lines[idx], 'icon', newIcon);
  return lines.join('\n');
}

/**
 * Deletes a single element line from code.
 */
export function deleteElementAtLine(code, sourceLineNumber) {
  const lines = code.split('\n');
  const idx = sourceLineNumber - 1;
  if (idx < 0 || idx >= lines.length) return code;

  // If deleting a table/group block with open brace, remove until matching closing brace
  if (lines[idx].includes('{')) {
    let depth = 1;
    let endIdx = idx + 1;
    while (endIdx < lines.length && depth > 0) {
      if (lines[endIdx].includes('{')) depth++;
      if (lines[endIdx].includes('}')) depth--;
      endIdx++;
    }
    lines.splice(idx, endIdx - idx);
    return lines.join('\n');
  }

  // Single line deletion
  lines.splice(idx, 1);
  return lines.join('\n');
}

/**
 * Adds a new node declaration to code.
 */
export function addNodeToCode(code, { id, label, shape = 'rectangle', color = 'blue', icon = null }) {
  const attrs = [];
  if (shape && shape !== 'rectangle') attrs.push(`shape: ${shape}`);
  if (color && color !== 'default') attrs.push(`color: ${color}`);
  if (icon) attrs.push(`icon: ${icon}`);
  if (label && label !== id) attrs.push(`label: ${formatAttrVal('label', label)}`);

  const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
  const nodeLine = `${id}${attrStr}`;

  const lines = code.split('\n');
  const firstConnIdx = lines.findIndex(l => isConnectionLine(l));
  if (firstConnIdx !== -1) {
    lines.splice(firstConnIdx, 0, nodeLine);
  } else {
    lines.push(nodeLine);
  }

  return lines.join('\n');
}

/**
 * Adds a new connection edge to code.
 */
export function addConnectionToCode(code, { source, target, operator = '>', label = '' }) {
  const connLine = label 
    ? `${source} ${operator} ${target}: ${label}` 
    : `${source} ${operator} ${target}`;

  const lines = code.split('\n');
  lines.push(connLine);
  return lines.join('\n');
}

/**
 * Renames a node identifier across the entire diagram code.
 * Updates the declaration and all connection references without touching comments or labels.
 */
export function renameNode(code, oldId, newId) {
  const lines = code.split('\n');
  const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?<=^|[^a-zA-Z0-9_-])${escapedOld}(?=[^a-zA-Z0-9_-]|$)`, 'g');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commentIdx = line.indexOf('//');
    const codePart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;
    const commentPart = commentIdx !== -1 ? line.slice(commentIdx) : '';

    const replacedCodePart = replaceOutsideQuotes(codePart, regex, newId);
    lines[i] = replacedCodePart + commentPart;
  }
  return lines.join('\n');
}

function replaceOutsideQuotes(str, regex, replacement) {
  let inQuotes = false;
  let result = '';
  let segment = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) {
      if (!inQuotes) {
        result += segment.replace(regex, replacement);
        segment = '';
      }
      inQuotes = !inQuotes;
      result += ch;
    } else if (inQuotes) {
      result += ch;
    } else {
      segment += ch;
    }
  }
  if (segment) {
    result += segment.replace(regex, replacement);
  }
  return result;
}

/**
 * Deletes a node and prunes all connection lines that reference it.
 * Multi-target connections (e.g. A > B, C when B is deleted) become A > C.
 */
export function deleteNode(code, nodeId, sourceLineNumber = null) {
  let lines = code.split('\n');

  // 1. Delete declaration line
  if (sourceLineNumber && sourceLineNumber >= 1 && sourceLineNumber <= lines.length) {
    lines = deleteElementAtLine(lines.join('\n'), sourceLineNumber).split('\n');
  } else {
    const declIdx = lines.findIndex(l => {
      const trimmed = l.trim();
      return trimmed === nodeId || 
             trimmed.startsWith(`${nodeId} `) || 
             trimmed.startsWith(`${nodeId}[`) || 
             trimmed.startsWith(`${nodeId}{`);
    });
    if (declIdx !== -1) {
      lines = deleteElementAtLine(lines.join('\n'), declIdx + 1).split('\n');
    }
  }

  // 2. Remove / prune connections that reference nodeId
  const escapedId = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetRegex = new RegExp(`(?<=^|[^a-zA-Z0-9_-])${escapedId}(?=[^a-zA-Z0-9_-]|$)`);

  const updatedLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isConnectionLine(line)) {
      updatedLines.push(line);
      continue;
    }

    const commentIdx = line.indexOf('//');
    const codePart = commentIdx !== -1 ? line.slice(0, commentIdx).trimEnd() : line.trimEnd();
    const commentPart = commentIdx !== -1 ? line.slice(commentIdx) : '';

    if (!targetRegex.test(codePart)) {
      updatedLines.push(line);
      continue;
    }

    const colonIdx = findColonOutsideBrackets(codePart);
    const beforeColon = colonIdx !== -1 ? codePart.slice(0, colonIdx) : codePart;
    const afterColon = colonIdx !== -1 ? codePart.slice(colonIdx) : '';

    const operators = ['<-->', '<->', '-->', '<--', '<>', '->', '<-', '--', '>', '<', '-'];
    let op = null;
    let opIdx = -1;
    for (const testOp of operators) {
      const idx = beforeColon.indexOf(testOp);
      if (idx !== -1) {
        op = testOp;
        opIdx = idx;
        break;
      }
    }

    if (!op) {
      continue;
    }

    const sources = beforeColon.slice(0, opIdx).split(',').map(s => s.trim()).filter(Boolean);
    const targets = beforeColon.slice(opIdx + op.length).split(',').map(s => s.trim()).filter(Boolean);

    const nextSources = sources.filter(s => s !== nodeId && !s.startsWith(`${nodeId}.`));
    const nextTargets = targets.filter(t => t !== nodeId && !t.startsWith(`${nodeId}.`));

    if (nextSources.length === 0 || nextTargets.length === 0) {
      continue; // edge deleted
    }

    const reconstructed = `${nextSources.join(', ')} ${op} ${nextTargets.join(', ')}${afterColon}${commentPart ? ` ${commentPart}` : ''}`.trimEnd();
    updatedLines.push(reconstructed);
  }

  return updatedLines.join('\n');
}
