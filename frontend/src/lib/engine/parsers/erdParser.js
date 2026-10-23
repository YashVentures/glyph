import { tokenize, extractAttributeBlock, splitOutsideQuotes, stripQuotes } from '../tokenizer.js';
import { CONNECTION_OPERATORS } from '../constants.js';

export function parseERD(sourceCode) {
  const lines = tokenize(sourceCode);
  const errors = [];

  const ast = {
    type: 'erd-diagram',
    title: '',
    notation: 'crows-foot', // crows-foot | chen
    typeface: 'rough',      // rough | clean | mono
    styleMode: 'shadow',    // plain | shadow | watercolor
    textSize: 'medium',     // small | medium | large
    colorMode: 'pastel',    // pastel | bold | outline
    wrap: 'on',             // on | off
    layout: 'sequential',   // compact | sequential
    tables: new Map(),      // name -> Table
    relationships: [],
    errors: []
  };

  let currentTable = null;

  for (const lineObj of lines) {
    const { lineNumber, content } = lineObj;

    try {
      // 1. Table closing brace: }
      if (content === '}') {
        if (currentTable) {
          ast.tables.set(currentTable.name, currentTable);
          currentTable = null;
        } else {
          errors.push({
            line: lineNumber,
            message: 'Unexpected closing brace "}" without open table block',
            context: content
          });
        }
        continue;
      }

      // 2. Directives (outside or inside)
      if (!currentTable && handleErdDirective(content, ast)) {
        continue;
      }

      // 3. Table Header: TableName [color: blue] {
      if (content.endsWith('{')) {
        const header = content.slice(0, -1).trim();
        const { rest, attributes } = extractAttributeBlock(header);
        const tableName = stripQuotes(rest);

        currentTable = {
          name: tableName,
          label: attributes.label || tableName,
          color: attributes.color || 'default',
          attributes,
          fields: [],
          sourceLineNumber: lineNumber
        };
        continue;
      }

      // 4. Table Field Line: inside currentTable
      if (currentTable) {
        const field = parseFieldLine(content, lineNumber);
        if (field) {
          currentTable.fields.push(field);
        } else {
          errors.push({
            line: lineNumber,
            message: `Invalid field definition in table "${currentTable.name}": "${content}"`,
            context: content
          });
        }
        continue;
      }

      // 5. ERD Relationship outside table: TableA > TableB or TableA.id > TableB.user_id: label
      const rels = parseErdRelationships(content, lineNumber);
      if (rels && rels.length > 0) {
        for (const rel of rels) {
          ast.relationships.push(rel);
          ensureTablePlaceholder(rel.sourceTable, ast, lineNumber);
          ensureTablePlaceholder(rel.targetTable, ast, lineNumber);
        }
        continue;
      }

      // Unrecognized line
      errors.push({
        line: lineNumber,
        message: `Unrecognized ERD statement: "${content}"`,
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

  if (currentTable) {
    errors.push({
      line: currentTable.sourceLineNumber,
      message: `Unclosed table block "${currentTable.name}"`,
      context: currentTable.name
    });
    ast.tables.set(currentTable.name, currentTable);
  }

  return {
    ast: {
      ...ast,
      tables: Array.from(ast.tables.values())
    },
    errors
  };
}

function handleErdDirective(content, ast) {
  if (/^title\b/i.test(content)) {
    ast.title = stripQuotes(content.replace(/^title\s*:?\s*/i, '').trim());
    return true;
  }
  if (/^notation\b/i.test(content)) {
    const not = content.replace(/^notation\s*:?\s*/i, '').trim().toLowerCase();
    if (not === 'chen' || not === 'crows-foot') {
      ast.notation = not;
    }
    return true;
  }
  const match = content.match(/^(typeface|styleMode|textSize|colorMode|wrap|layout)\s*:?\s*(\S+)/i);
  if (match) {
    const key = match[1].toLowerCase();
    const val = stripQuotes(match[2].toLowerCase());
    if (key === 'typeface' && ['rough', 'clean', 'mono'].includes(val)) ast.typeface = val;
    if (key === 'stylemode' && ['plain', 'shadow', 'watercolor'].includes(val)) ast.styleMode = val;
    if (key === 'textsize' && ['small', 'medium', 'large'].includes(val)) ast.textSize = val;
    if (key === 'colormode' && ['pastel', 'bold', 'outline'].includes(val)) ast.colorMode = val;
    if (key === 'wrap' && ['on', 'off'].includes(val)) ast.wrap = val;
    if (key === 'layout' && ['compact', 'sequential'].includes(val)) ast.layout = val;
    return true;
  }
  return false;
}

// Parse field line per recon grammar:
// ErdFieldLine ::= FieldIdentifier DataType { FieldConstraint } ;
// FieldConstraint ::= "pk" | "fk" | "unique" | "nullable" | "[" Ident "]" ;
function parseFieldLine(content, lineNumber) {
  const { rest, attributes } = extractAttributeBlock(content);
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const name = stripQuotes(parts[0]);
  const type = parts.length > 1 ? parts[1] : 'string';
  const constraints = [];

  // Remaining parts can be constraints: pk, fk, unique, nullable
  for (let i = 2; i < parts.length; i++) {
    const c = parts[i].toLowerCase();
    if (['pk', 'fk', 'unique', 'nullable', 'index'].includes(c)) {
      constraints.push(c);
    }
  }

  // Also include any bracketed attributes: [pk], [unique]
  for (const key of Object.keys(attributes)) {
    if (['pk', 'fk', 'unique', 'nullable', 'index'].includes(key) && !constraints.includes(key)) {
      constraints.push(key);
    }
  }

  return {
    name,
    type,
    constraints,
    isPk: constraints.includes('pk') || !!attributes.pk,
    isFk: constraints.includes('fk') || !!attributes.fk,
    isUnique: constraints.includes('unique') || !!attributes.unique,
    isNullable: constraints.includes('nullable') || !!attributes.nullable,
    sourceLineNumber: lineNumber
  };
}

// Parse relationship per recon grammar:
// ConnectionDeclaration ::= NodeTargetList ConnectionOperator NodeTargetList [ ":" [ ConnectionLabel ] [ AttributeBlock ] ] ;
// NodeTarget ::= NodeIdentifier [ "." MemberIdentifier ] ;
// Real operators:
// "-" or "--"   : One-to-One (1:1)
// ">" or "->"   : One-to-Many (1:N)
// "<" or "<-"   : Many-to-One (N:1)
// "<>" or "<->" : Many-to-Many (N:M)
function parseErdRelationships(content, lineNumber) {
  const opKeys = ['<-->', '<->', '-->', '<--', '<>', '->', '<-', '--', '>', '<', '-'];
  let foundOp = null;

  for (const op of opKeys) {
    const idx = content.indexOf(op);
    if (idx !== -1) {
      foundOp = op;
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

  const sourceTargets = splitOutsideQuotes(parts[0], ',').map(stripQuotes).filter(Boolean);
  const targetTargets = splitOutsideQuotes(parts[1], ',').map(stripQuotes).filter(Boolean);

  if (sourceTargets.length === 0 || targetTargets.length === 0) return null;

  // Determine cardinality from operator
  let cardinality = '1:1';
  let sourceCardinality = '1';
  let targetCardinality = '1';

  if (foundOp === '<' || foundOp === '<-' || foundOp === '<--') {
    cardinality = '1:N';
    sourceCardinality = '1';
    targetCardinality = '*';
  } else if (foundOp === '>' || foundOp === '->' || foundOp === '-->') {
    cardinality = 'N:1';
    sourceCardinality = '*';
    targetCardinality = '1';
  } else if (foundOp === '<>' || foundOp === '<->' || foundOp === '<-->') {
    cardinality = 'N:M';
    sourceCardinality = '*';
    targetCardinality = '*';
  } else {
    // '-' or '--'
    cardinality = '1:1';
    sourceCardinality = '1';
    targetCardinality = '1';
  }

  const relationships = [];

  for (const src of sourceTargets) {
    const [sourceTable, sourceField] = src.split('.');
    for (const tgt of targetTargets) {
      const [targetTable, targetField] = tgt.split('.');
      relationships.push({
        id: `rel-${sourceTable}-${targetTable}-${lineNumber}`,
        sourceTable,
        sourceField: sourceField || null,
        operator: foundOp,
        cardinality,
        sourceCardinality,
        targetCardinality,
        targetTable,
        targetField: targetField || null,
        label,
        color: attributes.color || 'default',
        attributes,
        sourceLineNumber: lineNumber
      });
    }
  }

  return relationships;
}

function ensureTablePlaceholder(tableName, ast, lineNumber) {
  if (!ast.tables.has(tableName)) {
    ast.tables.set(tableName, {
      name: tableName,
      label: tableName,
      color: 'default',
      attributes: {},
      fields: [],
      sourceLineNumber: lineNumber
    });
  }
}
