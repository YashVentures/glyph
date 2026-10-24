// Tokenizer for Eraser Diagram-as-Code grammar
// Extracts lines, preserves 1-based sourceLineNumber, and parses tokens & attribute blocks

export const MAX_LINE_LENGTH = 20000;

export function tokenize(source) {
  const rawLines = (source || '').split(/\r?\n/);
  const lines = [];

  for (let i = 0; i < rawLines.length; i++) {
    let raw = rawLines[i];
    const lineNumber = i + 1;

    // Safety guard against extremely long individual lines
    if (raw.length > MAX_LINE_LENGTH) {
      raw = raw.slice(0, MAX_LINE_LENGTH);
    }

    // Strip inline comments: // or %%
    let content = raw;
    const commentIdx = findCommentIndex(content);
    if (commentIdx !== -1) {
      content = content.slice(0, commentIdx);
    }

    content = content.trim();
    if (content.length > 0) {
      lines.push({
        lineNumber,
        raw,
        content
      });
    }
  }

  return lines;
}

function findCommentIndex(str) {
  let inQuotes = false;
  for (let i = 0; i < str.length - 1; i++) {
    if (str[i] === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if ((str[i] === '/' && str[i + 1] === '/') || (str[i] === '%' && str[i + 1] === '%')) {
        return i;
      }
    }
  }
  return -1;
}

// Helper to parse [key: value, key2: value2] attribute block from the end of a line
export function extractAttributeBlock(str) {
  let openCount = 0;
  let closeCount = 0;
  let inQuotes = false;
  let firstOpen = -1;
  let lastClose = -1;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '[') {
        openCount++;
        if (firstOpen === -1) firstOpen = i;
      } else if (ch === ']') {
        closeCount++;
        lastClose = i;
      }
    }
  }

  const snippet = str.length > 60 ? `${str.slice(0, 57)}...` : str;

  if (openCount !== closeCount) {
    throw new Error(`Unmatched square brackets in line: "${snippet}"`);
  }

  if (openCount > 1) {
    throw new Error(`Multiple or nested square bracket blocks are not supported in line: "${snippet}"`);
  }

  if (openCount === 1) {
    if (lastClose < firstOpen) {
      throw new Error(`Invalid bracket order in line: "${snippet}"`);
    }
    const attrString = str.slice(firstOpen + 1, lastClose).trim();
    const before = str.slice(0, firstOpen).trim();
    const after = str.slice(lastClose + 1).trim();
    const rest = after ? `${before} ${after}`.trim() : before;

    const attributes = parseAttributes(attrString);
    return { rest, attributes, hasAttrs: true };
  }

  return { rest: str, attributes: {}, hasAttrs: false };
}

export function parseAttributes(attrStr) {
  const attrs = {};
  if (!attrStr) return attrs;

  // Split on commas not inside quotes
  const parts = splitOutsideQuotes(attrStr, ',');
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx !== -1) {
      const key = part.slice(0, colonIdx).trim().toLowerCase();
      let val = part.slice(colonIdx + 1).trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
        throw new Error(`Invalid attribute key: "${key}"`);
      }
      // Strip outer quotes if string literal and unescape
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1).replace(/\\"/g, '"');
      }
      attrs[key] = val;
    } else {
      // Boolean or flag attribute (e.g. [pk], [unique])
      const flag = part.trim();
      if (flag) {
        if (!/^[a-zA-Z0-9_-]+$/.test(flag)) {
          throw new Error(`Invalid attribute flag or format: "${flag}"`);
        }
        attrs[flag.toLowerCase()] = true;
      }
    }
  }

  return attrs;
}

export function splitOutsideQuotes(str, delimiter = ',') {
  const parts = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (char === delimiter && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

export function stripQuotes(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"');
  }
  return trimmed;
}
