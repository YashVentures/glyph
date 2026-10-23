import { tokenize, extractAttributeBlock, splitOutsideQuotes, stripQuotes } from '../tokenizer.js';
import { CONNECTION_OPERATORS } from '../constants.js';

export function parseSequence(sourceCode) {
  const lines = tokenize(sourceCode);
  const errors = [];

  const ast = {
    type: 'sequence-diagram',
    title: '',
    autoNumber: 'off',    // on | off | nested
    typeface: 'rough',    // rough | clean | mono
    styleMode: 'shadow',  // plain | shadow | watercolor
    textSize: 'medium',   // small | medium | large
    colorMode: 'pastel',  // pastel | bold | outline
    participants: [], // array of { id, label, sourceLineNumber }
    steps: [], // array of Message | Block | Activation
    errors: []
  };

  const participantSet = new Set();
  const blockStack = [];

  for (const lineObj of lines) {
    const { lineNumber, content } = lineObj;

    try {
      // 1. Block Closing: } or } else [label: ...] {
      if (content.startsWith('}')) {
        const currentBlock = blockStack.pop();
        if (!currentBlock) {
          errors.push({
            line: lineNumber,
            message: 'Unexpected closing brace "}" without matching block',
            context: content
          });
          continue;
        }

        const afterBrace = content.slice(1).trim();
        if (afterBrace.startsWith('else')) {
          // Alt block 'else' branch
          const elsePart = afterBrace.slice(4).trim();
          let branchLabel = 'else';
          const { rest, attributes } = extractAttributeBlock(elsePart);
          if (attributes.label) branchLabel = attributes.label;
          else if (rest.replace('{', '').trim()) branchLabel = stripQuotes(rest.replace('{', '').trim());

          const newBranch = {
            label: branchLabel,
            sourceLineNumber: lineNumber,
            steps: []
          };
          currentBlock.branches.push(newBranch);
          blockStack.push(currentBlock);
        }
        continue;
      }

      // 2. Global Directives
      if (handleSequenceDirective(content, ast)) {
        continue;
      }

      // 3. Participant Order: order Client, Gateway, AuthServer
      if (/^order\b/i.test(content)) {
        const orderList = content.replace(/^order\s+/i, '').trim();
        const names = splitOutsideQuotes(orderList, ',').map(stripQuotes).filter(Boolean);
        for (const name of names) {
          if (!participantSet.has(name)) {
            participantSet.add(name);
            ast.participants.push({
              id: name,
              label: name,
              sourceLineNumber: lineNumber
            });
          }
        }
        continue;
      }

      // 4. Activation / Deactivation: activate Service, deactivate Service
      const actMatch = content.match(/^(activate|deactivate)\s+(\S+)/i);
      if (actMatch) {
        const action = actMatch[1].toLowerCase();
        const actor = stripQuotes(actMatch[2]);
        ensureParticipant(actor, participantSet, ast, lineNumber);

        const activationStep = {
          type: 'activation',
          action,
          participant: actor,
          sourceLineNumber: lineNumber
        };
        addStep(activationStep, blockStack, ast);
        continue;
      }

      // 5. Sequence Blocks: loop, alt, opt, par, break
      const blockMatch = content.match(/^(loop|alt|opt|par|break)\b(.*)\{$/i);
      if (blockMatch) {
        const blockType = blockMatch[1].toLowerCase();
        const headerRest = blockMatch[2].trim();
        const { attributes } = extractAttributeBlock(headerRest);
        const label = attributes.label || stripQuotes(headerRest) || blockType;

        const blockNode = {
          type: 'block',
          blockType,
          label,
          sourceLineNumber: lineNumber,
          branches: [
            {
              label,
              sourceLineNumber: lineNumber,
              steps: []
            }
          ]
        };

        addStep(blockNode, blockStack, ast);
        blockStack.push(blockNode);
        continue;
      }

      // 6. Messages: Sender > Receiver: Message text [color: blue]
      const msgParsed = parseMessage(content, lineNumber);
      if (msgParsed) {
        ensureParticipant(msgParsed.from, participantSet, ast, lineNumber);
        ensureParticipant(msgParsed.to, participantSet, ast, lineNumber);
        addStep(msgParsed, blockStack, ast);
        continue;
      }

      // Unrecognized statement
      errors.push({
        line: lineNumber,
        message: `Unrecognized sequence diagram statement: "${content}"`,
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

  // Check unclosed blocks
  while (blockStack.length > 0) {
    const unclosed = blockStack.pop();
    errors.push({
      line: unclosed.sourceLineNumber,
      message: `Unclosed sequence block "${unclosed.blockType}"`,
      context: unclosed.label
    });
  }

  return { ast, errors };
}

function handleSequenceDirective(content, ast) {
  if (/^title\b/i.test(content)) {
    ast.title = stripQuotes(content.replace(/^title\s*:?\s*/i, '').trim());
    return true;
  }
  if (/^autoNumber\b/i.test(content)) {
    const val = content.replace(/^autoNumber\s*:?\s*/i, '').trim().toLowerCase();
    if (['on', 'off', 'nested'].includes(val)) {
      ast.autoNumber = val;
    }
    return true;
  }
  const match = content.match(/^(typeface|styleMode|textSize|colorMode)\s*:?\s*(\S+)/i);
  if (match) {
    const key = match[1].toLowerCase();
    const val = stripQuotes(match[2].toLowerCase());
    if (key === 'typeface' && ['rough', 'clean', 'mono'].includes(val)) ast.typeface = val;
    if (key === 'stylemode' && ['plain', 'shadow', 'watercolor'].includes(val)) ast.styleMode = val;
    if (key === 'textsize' && ['small', 'medium', 'large'].includes(val)) ast.textSize = val;
    if (key === 'colormode' && ['pastel', 'bold', 'outline'].includes(val)) ast.colorMode = val;
    return true;
  }
  return false;
}

function ensureParticipant(name, participantSet, ast, lineNumber) {
  if (!participantSet.has(name)) {
    participantSet.add(name);
    ast.participants.push({
      id: name,
      label: name,
      sourceLineNumber: lineNumber
    });
  }
}

function addStep(step, blockStack, ast) {
  if (blockStack.length > 0) {
    const currentBlock = blockStack[blockStack.length - 1];
    const currentBranch = currentBlock.branches[currentBlock.branches.length - 1];
    currentBranch.steps.push(step);
  } else {
    ast.steps.push(step);
  }
}

function parseMessage(content, lineNumber) {
  // Operators: --> (async/dashed), -> (sync), > (sync), -- (dashed), - (plain)
  const opKeys = ['-->', '<--', '<->', '<>', '->', '<-', '>', '<', '--', '-'];
  let foundOp = null;
  let opIdx = -1;

  for (const op of opKeys) {
    const idx = content.indexOf(op);
    if (idx !== -1) {
      foundOp = op;
      opIdx = idx;
      break;
    }
  }

  if (!foundOp) return null;

  const { rest, attributes } = extractAttributeBlock(content);
  let leftSide = rest;
  let label = '';

  const colonIdx = rest.indexOf(':');
  if (colonIdx !== -1) {
    leftSide = rest.slice(0, colonIdx).trim();
    label = stripQuotes(rest.slice(colonIdx + 1).trim());
  }

  const parts = leftSide.split(foundOp);
  if (parts.length < 2) return null;

  const from = stripQuotes(parts[0].trim());
  const to = stripQuotes(parts[1].trim());

  if (!from || !to) return null;

  const meta = CONNECTION_OPERATORS[foundOp] || { type: 'FORWARD', dashed: false };

  return {
    type: 'message',
    from,
    to,
    operator: foundOp,
    dashed: meta.dashed,
    bidirectional: meta.type === 'BIDIRECTIONAL',
    isSelf: from === to,
    label,
    color: attributes.color || 'default',
    attributes,
    sourceLineNumber: lineNumber
  };
}
