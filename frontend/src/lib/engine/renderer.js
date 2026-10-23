import dagre from 'dagre';
import { PALETTE, ICONS, getNodeColors, getCustomIcon } from './constants.js';
import { parseDiagram } from './parser.js';

export function renderDiagramToSVG(astOrResult, options = {}) {
  // If string code is passed, automatically parse it
  if (typeof astOrResult === 'string') {
    const diagType = typeof options === 'string' ? options : (options.diagramType || 'flowchart-diagram');
    const opts = typeof options === 'object' ? options : {};
    const parsed = parseDiagram(astOrResult, diagType);
    return renderDiagramToSVG(parsed, opts);
  }

  const {
    padding = 40,
    theme = 'dark'
  } = options;

  const ast = (astOrResult && astOrResult.ast) ? astOrResult.ast : astOrResult;

  if (!ast) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="20" y="40" fill="#EF4444">Empty or invalid AST</text></svg>`;
  }

  switch (ast.type) {
    case 'sequence-diagram':
      return renderSequenceSVG(ast, { padding, theme, ...options });

    case 'erd-diagram':
      return renderErdSVG(ast, { padding, theme, ...options });

    case 'cloud-architecture-diagram':
    case 'flowchart-diagram':
    default:
      return renderFlowchartSVG(ast, { padding, theme, ...options });
  }
}

// ----------------------------------------------------
// 1. FLOWCHART & CLOUD ARCHITECTURE RENDERER
// ----------------------------------------------------
function renderFlowchartSVG(ast, options = {}) {
  const { padding = 40, theme = 'dark', customIcons = {} } = options;
  const g = new dagre.graphlib.Graph({ compound: true });
  const isLR = ast.direction === 'right';
  const rankDir = {
    up: 'BT',
    down: 'TB',
    left: 'RL',
    right: 'LR'
  }[ast.direction] || 'TB';

  const isCompact = ast.layout === 'compact';
  g.setGraph({
    rankdir: rankDir,
    nodesep: isCompact ? 25 : 45,
    ranksep: isCompact ? 35 : 55,
    marginx: padding,
    marginy: padding
  });
  g.setDefaultEdgeLabel(() => ({}));

  // Add groups if present
  for (const group of ast.groups || []) {
    g.setNode(group.id, {
      label: group.label || group.id,
      clusterLabelPos: 'top'
    });
  }

  // Calculate node dimensions
  for (const node of ast.nodes || []) {
    const label = node.label || node.id;
    const hasIcon = !!node.icon;
    const charLen = label.length;
    let width = Math.max(140, Math.min(280, charLen * 9 + 40));
    let height = 50;

    if (node.shape === 'circle') {
      const size = Math.max(70, charLen * 8 + 20);
      width = size;
      height = size;
    } else if (node.shape === 'diamond') {
      width = Math.max(130, charLen * 10 + 40);
      height = Math.max(80, charLen * 6 + 30);
    } else if (hasIcon) {
      width = Math.max(width, 160);
      height = 58;
    }

    g.setNode(node.id, {
      width,
      height,
      nodeData: node
    });

    if (node.groupId && (ast.groups || []).some(grp => grp.id === node.groupId)) {
      g.setParent(node.id, node.groupId);
    }
  }

  // Add edges
  for (const edge of ast.edges || []) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target, {
        edgeData: edge,
        minlen: 1,
        weight: 1
      });
    }
  }

  // Run Dagre Layout
  dagre.layout(g);

  // Compute bounding box
  const graphMeta = g.graph();
  const width = Math.max(500, (graphMeta.width || 600) + padding * 2);
  const height = Math.max(300, (graphMeta.height || 400) + padding * 2);

  // SVG Header & Defs
  const defs = getSharedSvgDefs(ast.typeface, ast.styleMode);

  // Render Groups
  let groupsSvg = '';
  for (const group of ast.groups || []) {
    const groupNode = g.node(group.id);
    if (groupNode && groupNode.width && groupNode.height) {
      const gx = groupNode.x - groupNode.width / 2;
      const gy = groupNode.y - groupNode.height / 2;
      const color = PALETTE[group.attributes?.color] || PALETTE.default;

      groupsSvg += `
        <g class="diagram-group" data-source-line="${group.sourceLineNumber}" data-group-id="${escapeXml(group.id)}">
          <rect x="${gx}" y="${gy}" width="${groupNode.width}" height="${groupNode.height}"
            rx="10" ry="10"
            fill="rgba(30, 33, 44, 0.4)"
            stroke="${color.stroke}"
            stroke-width="1.5"
            stroke-dasharray="4 4"
          />
          <text x="${gx + 12}" y="${gy + 18}"
            fill="${color.text}"
            font-size="12"
            font-weight="600"
            font-family="${getFontFamily(ast.typeface)}"
          >${escapeXml(group.label)}</text>
        </g>
      `;
    }
  }

  // Render Edges
  let edgesSvg = '';
  g.edges().forEach((e) => {
    const edgeObj = g.edge(e);
    const edgeData = edgeObj.edgeData || {};
    const points = edgeObj.points || [];
    if (points.length < 2) return;

    const pathD = buildCurvePath(points);
    const color = PALETTE[edgeData.color] || PALETTE.default;
    const strokeColor = color.stroke === PALETTE.default.stroke ? '#94A3B8' : color.stroke;
    const isDashed = edgeData.dashed;
    const isBidirectional = edgeData.relationship === 'BIDIRECTIONAL';
    const isBackward = edgeData.relationship === 'BACKWARD' || edgeData.relationship === 'BACKWARD_DASHED';
    const isUndirected = edgeData.relationship === 'UNDIRECTED' || edgeData.relationship === 'UNDIRECTED_DASHED';

    let markerEnd = `url(#arrow-${edgeData.color || 'default'})`;
    let markerStart = isBidirectional ? `url(#arrow-start-${edgeData.color || 'default'})` : 'none';

    if (isBackward) {
      markerStart = markerEnd;
      markerEnd = 'none';
    } else if (isUndirected) {
      markerStart = 'none';
      markerEnd = 'none';
    }

    // Midpoint for label
    const midIdx = Math.floor(points.length / 2);
    const midPoint = points[midIdx] || points[0];

    edgesSvg += `
      <g class="diagram-edge" data-source-line="${edgeData.sourceLineNumber || 1}" data-edge-id="${escapeXml(edgeData.id || '')}">
        <path d="${pathD}"
          fill="none"
          stroke="${strokeColor}"
          stroke-width="2"
          stroke-dasharray="${isDashed ? '6 4' : 'none'}"
          marker-end="${markerEnd}"
          marker-start="${markerStart}"
        />
        ${edgeData.label ? `
          <g transform="translate(${midPoint.x}, ${midPoint.y})">
            <rect x="${-(edgeData.label.length * 4 + 8)}" y="-11"
              width="${edgeData.label.length * 8 + 16}" height="20"
              rx="4" ry="4"
              fill="#181A20"
              stroke="${strokeColor}"
              stroke-width="1"
            />
            <text x="0" y="3"
              text-anchor="middle"
              fill="#F1F5F9"
              font-size="11"
              font-family="${getFontFamily(ast.typeface)}"
              font-weight="500"
            >${escapeXml(edgeData.label)}</text>
          </g>
        ` : ''}
      </g>
    `;
  });

  // Render Nodes
  let nodesSvg = '';
  g.nodes().forEach((nodeId) => {
    const nodeObj = g.node(nodeId);
    if (!nodeObj || !nodeObj.nodeData) return; // skip compound group wrappers
    const nodeData = nodeObj.nodeData;
    const nx = nodeObj.x - nodeObj.width / 2;
    const ny = nodeObj.y - nodeObj.height / 2;
    const nw = nodeObj.width;
    const nh = nodeObj.height;
    const color = getNodeColors(nodeData.color, ast.colorMode);
    const filterAttr = getFilterAttr(ast.styleMode);
    const textScale = getTextScale(ast.textSize);
    const fontSize = Math.round(13 * textScale);

    nodesSvg += `
      <g class="diagram-node" 
         id="node-${escapeXml(nodeData.id)}"
         data-source-line="${nodeData.sourceLineNumber || 1}"
         data-node-id="${escapeXml(nodeData.id)}"
         transform="translate(${nx}, ${ny})"
         ${filterAttr}
      >
        ${renderShapeSvg(nodeData.shape, nw, nh, color, ast.typeface)}
        ${(() => {
          // Collision Rule: Workspace custom icons take precedence over bundled icons
          const customSvg = (customIcons && customIcons[nodeData.icon]) || getCustomIcon(nodeData.icon);
          if (customSvg) {
            return `
              <image href="data:image/svg+xml;utf8,${encodeURIComponent(customSvg)}" 
                     x="14" y="${(nh - 20) / 2}" width="20" height="20" 
                     data-custom-icon="${escapeXml(nodeData.icon)}"/>
            `;
          } else if (nodeData.icon && ICONS[nodeData.icon]) {
            return `
              <g transform="translate(14, ${(nh - 20) / 2}) scale(0.85)" stroke="${color.stroke}" stroke-width="2" fill="none" data-icon="${escapeXml(nodeData.icon)}">
                ${ICONS[nodeData.icon]}
              </g>
            `;
          }
          // Unknown icon name degrades gracefully without crashing render
          return '';
        })()}
        <text 
          x="${Boolean((customIcons && customIcons[nodeData.icon]) || getCustomIcon(nodeData.icon) || (nodeData.icon && ICONS[nodeData.icon])) ? nw / 2 + 10 : nw / 2}" 
          y="${nh / 2 + 5}"
          text-anchor="middle"
          fill="${color.text}"
          font-size="${fontSize}"
          font-weight="600"
          font-family="${getFontFamily(ast.typeface)}"
        >${escapeXml(nodeData.label || nodeData.id)}</text>
      </g>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: transparent;">
      ${defs}
      ${ast.title ? `
        <text x="${padding}" y="${padding - 10}" fill="#F8FAFC" font-size="18" font-weight="700" font-family="${getFontFamily(ast.typeface)}">
          ${escapeXml(ast.title)}
        </text>
      ` : ''}
      <g class="diagram-content">
        ${groupsSvg}
        ${edgesSvg}
        ${nodesSvg}
      </g>
    </svg>
  `;
}

// ----------------------------------------------------
// 2. SEQUENCE DIAGRAM RENDERER
// ----------------------------------------------------
function renderSequenceSVG(ast, { padding, theme }) {
  const participants = ast.participants || [];
  const steps = ast.steps || [];

  const partWidth = 120;
  const partHeight = 44;
  const colGap = 160;
  const stepHeight = 52;

  const totalCols = Math.max(1, participants.length);
  const width = Math.max(600, totalCols * colGap + padding * 2);
  const totalSteps = steps.length;
  const height = Math.max(400, totalSteps * stepHeight + 180 + padding * 2);

  // Map participant x positions
  const partXMap = new Map();
  participants.forEach((p, idx) => {
    const x = padding + (idx * colGap) + (colGap / 2);
    partXMap.set(p.id, x);
  });

  const defs = getSharedSvgDefs(ast.typeface, ast.styleMode);

  // Render Participant Headers & Lifelines
  let lifelinesSvg = '';
  let participantBoxesSvg = '';

  participants.forEach((p) => {
    const px = partXMap.get(p.id);
    const boxX = px - partWidth / 2;
    const boxY = padding + 40;
    const bottomY = height - padding - 20;

    // Lifeline vertical dashed line
    lifelinesSvg += `
      <line x1="${px}" y1="${boxY + partHeight}" x2="${px}" y2="${bottomY}"
        stroke="#475569" stroke-width="1.5" stroke-dasharray="6 6"
      />
    `;

    // Participant Header Box
    participantBoxesSvg += `
      <g class="diagram-participant" data-source-line="${p.sourceLineNumber || 1}" data-participant-id="${escapeXml(p.id)}">
        <rect x="${boxX}" y="${boxY}" width="${partWidth}" height="${partHeight}"
          rx="6" ry="6"
          fill="#1E222D"
          stroke="#3B82F6"
          stroke-width="1.5"
          filter="url(#shadow-filter)"
        />
        <text x="${px}" y="${boxY + partHeight / 2 + 4}"
          text-anchor="middle"
          fill="#E2E8F0"
          font-size="13"
          font-weight="600"
          font-family="${getFontFamily(ast.typeface)}"
        >${escapeXml(p.label || p.id)}</text>
      </g>
    `;
  });

  // Render Steps (Messages, Activations, Blocks)
  let stepsSvg = '';
  let currentY = padding + 40 + partHeight + 35;
  let autoNum = 1;

  for (const step of steps) {
    if (step.type === 'message') {
      const fromX = partXMap.get(step.from) || padding + 40;
      const toX = partXMap.get(step.to) || padding + 180;
      const isSelf = step.isSelf || fromX === toX;
      const color = PALETTE[step.color] || PALETTE.default;
      const strokeColor = color.stroke === PALETTE.default.stroke ? '#60A5FA' : color.stroke;
      const isDashed = step.dashed;

      let msgLabel = step.label || '';
      if (ast.autoNumber === 'on') {
        msgLabel = `${autoNum}. ${msgLabel}`;
        autoNum++;
      } else if (ast.autoNumber === 'nested') {
        const numStr = step.blockDepth > 0 ? `${step.blockMajor || 1}.${step.blockMinor || 1}` : `${autoNum}`;
        msgLabel = `${numStr}. ${msgLabel}`;
        if (step.blockDepth > 0) {
          // within block
        } else {
          autoNum++;
        }
      }

      if (isSelf) {
        // Self call loop
        const loopW = 40;
        const loopH = 26;
        stepsSvg += `
          <g class="diagram-message" data-source-line="${step.sourceLineNumber || 1}">
            <path d="M ${fromX} ${currentY} L ${fromX + loopW} ${currentY} L ${fromX + loopW} ${currentY + loopH} L ${fromX} ${currentY + loopH}"
              fill="none" stroke="${strokeColor}" stroke-width="1.5"
              stroke-dasharray="${isDashed ? '4 3' : 'none'}"
              marker-end="url(#arrow-${step.color || 'blue'})"
            />
            <text x="${fromX + loopW + 6}" y="${currentY + loopH / 2 + 4}"
              fill="#F1F5F9" font-size="11" font-family="${getFontFamily(ast.typeface)}"
            >${escapeXml(msgLabel)}</text>
          </g>
        `;
        currentY += stepHeight;
      } else {
        // Direct message
        const midX = (fromX + toX) / 2;
        stepsSvg += `
          <g class="diagram-message" data-source-line="${step.sourceLineNumber || 1}">
            <line x1="${fromX}" y1="${currentY}" x2="${toX}" y2="${currentY}"
              stroke="${strokeColor}" stroke-width="1.5"
              stroke-dasharray="${isDashed ? '5 4' : 'none'}"
              marker-end="url(#arrow-${step.color || 'blue'})"
              ${step.bidirectional ? `marker-start="url(#arrow-start-${step.color || 'blue'})"` : ''}
            />
            ${msgLabel ? `
              <text x="${midX}" y="${currentY - 7}"
                text-anchor="middle"
                fill="#F1F5F9"
                font-size="12"
                font-weight="500"
                font-family="${getFontFamily(ast.typeface)}"
              >${escapeXml(msgLabel)}</text>
            ` : ''}
          </g>
        `;
        currentY += stepHeight;
      }
    } else if (step.type === 'activation') {
      const actorX = partXMap.get(step.participant);
      if (actorX) {
        stepsSvg += `
          <rect x="${actorX - 5}" y="${currentY - 10}" width="10" height="24"
            fill="#3B82F6" stroke="#60A5FA" stroke-width="1" rx="2"
            data-source-line="${step.sourceLineNumber || 1}"
          />
        `;
      }
    } else if (step.type === 'block') {
      // Sequence Block (loop, alt, opt)
      const blockMinX = padding + 20;
      const blockMaxX = width - padding - 20;
      const blockH = (step.branches[0]?.steps?.length || 1) * stepHeight + 40;

      stepsSvg += `
        <g class="diagram-block" data-source-line="${step.sourceLineNumber || 1}">
          <rect x="${blockMinX}" y="${currentY - 14}" width="${blockMaxX - blockMinX}" height="${blockH}"
            rx="4" ry="4"
            fill="rgba(30, 41, 59, 0.2)"
            stroke="#64748B"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
          <rect x="${blockMinX}" y="${currentY - 14}" width="70" height="20"
            fill="#334155" rx="3"
          />
          <text x="${blockMinX + 8}" y="${currentY}"
            fill="#94A3B8" font-size="10" font-weight="700" font-family="${getFontFamily(ast.typeface)}"
          >${step.blockType.toUpperCase()}</text>
          <text x="${blockMinX + 78}" y="${currentY}"
            fill="#E2E8F0" font-size="11" font-weight="500" font-family="${getFontFamily(ast.typeface)}"
          >[${escapeXml(step.label)}]</text>
        </g>
      `;
      currentY += 28;
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: transparent;">
      ${defs}
      ${ast.title ? `
        <text x="${padding}" y="${padding + 16}" fill="#F8FAFC" font-size="18" font-weight="700" font-family="${getFontFamily(ast.typeface)}">
          ${escapeXml(ast.title)}
        </text>
      ` : ''}
      <g class="diagram-content">
        ${lifelinesSvg}
        ${stepsSvg}
        ${participantBoxesSvg}
      </g>
    </svg>
  `;
}

// ----------------------------------------------------
// 3. ENTITY RELATIONSHIP (ERD) RENDERER
// ----------------------------------------------------
function renderErdSVG(ast, { padding, theme }) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 60,
    ranksep: 80,
    marginx: padding,
    marginy: padding
  });
  g.setDefaultEdgeLabel(() => ({}));

  const tables = ast.tables || [];
  const tableWidth = 220;
  const rowHeight = 24;
  const headerHeight = 36;

  for (const table of tables) {
    const fieldCount = (table.fields || []).length;
    const height = headerHeight + Math.max(1, fieldCount) * rowHeight + 12;
    g.setNode(table.name, {
      width: tableWidth,
      height,
      tableData: table
    });
  }

  for (const rel of ast.relationships || []) {
    if (g.hasNode(rel.sourceTable) && g.hasNode(rel.targetTable)) {
      g.setEdge(rel.sourceTable, rel.targetTable, { relData: rel });
    }
  }

  dagre.layout(g);

  const graphMeta = g.graph();
  const width = Math.max(600, (graphMeta.width || 700) + padding * 2);
  const height = Math.max(400, (graphMeta.height || 500) + padding * 2);

  const defs = getSharedSvgDefs(ast.typeface, ast.styleMode);

  // Render Relationship Edges
  let edgesSvg = '';
  const isChen = ast.notation === 'chen';

  g.edges().forEach((e) => {
    const edgeObj = g.edge(e);
    const relData = edgeObj.relData || {};
    const points = edgeObj.points || [];
    if (points.length < 2) return;

    const pathD = buildCurvePath(points);
    const midIdx = Math.floor(points.length / 2);
    const mid = points[midIdx];

    const isTargetMany = relData.targetCardinality === '*';
    const isSourceMany = relData.sourceCardinality === '*';

    let markerEnd = 'none';
    let markerStart = 'none';

    if (!isChen) {
      // Crow's foot notation
      markerEnd = isTargetMany ? 'url(#crowsfoot-many)' : 'url(#crowsfoot-one)';
      markerStart = isSourceMany ? 'url(#crowsfoot-many-start)' : 'url(#crowsfoot-one-start)';
    }

    // Edge label or field connection info
    let displayLabel = relData.label || '';
    if (relData.sourceField && relData.targetField) {
      const fieldInfo = `${relData.sourceField} → ${relData.targetField}`;
      displayLabel = displayLabel ? `${displayLabel} (${fieldInfo})` : fieldInfo;
    }

    edgesSvg += `
      <g class="diagram-edge" data-source-line="${relData.sourceLineNumber || 1}">
        <path d="${pathD}"
          fill="none"
          stroke="#94A3B8"
          stroke-width="1.8"
          marker-end="${markerEnd}"
          marker-start="${markerStart}"
        />
        ${isChen ? `
          <!-- Chen Notation: Relationship Diamond -->
          <g transform="translate(${mid.x}, ${mid.y})">
            <polygon points="0,-16 26,0 0,16 -26,0"
              fill="#181A20" stroke="#3B82F6" stroke-width="1.5"
            />
            <text x="0" y="3" text-anchor="middle" fill="#93C5FD" font-size="10" font-weight="600" font-family="${getFontFamily(ast.typeface)}">
              ${escapeXml(displayLabel || (isTargetMany ? '1:N' : '1:1'))}
            </text>
          </g>
          <text x="${points[0].x + 14}" y="${points[0].y - 6}" fill="#CBD5E1" font-size="11" font-family="${getFontFamily(ast.typeface)}" font-weight="600">
            ${isSourceMany ? 'M' : '1'}
          </text>
          <text x="${points[points.length - 1].x - 18}" y="${points[points.length - 1].y - 6}" fill="#CBD5E1" font-size="11" font-family="${getFontFamily(ast.typeface)}" font-weight="600">
            ${isTargetMany ? 'N' : '1'}
          </text>
        ` : `
          <!-- Crow's Foot Notation Label -->
          ${displayLabel ? `
            <g transform="translate(${mid.x}, ${mid.y})">
              <rect x="${-(displayLabel.length * 4 + 6)}" y="-10"
                width="${displayLabel.length * 8 + 12}" height="18"
                rx="4" ry="4" fill="#181A20" stroke="#475569" stroke-width="1"
              />
              <text x="0" y="3" text-anchor="middle" fill="#E2E8F0" font-size="10" font-family="${getFontFamily(ast.typeface)}">
                ${escapeXml(displayLabel)}
              </text>
            </g>
          ` : ''}
        `}
      </g>
    `;
  });

  // Render Tables
  let tablesSvg = '';
  g.nodes().forEach((tableName) => {
    const nodeObj = g.node(tableName);
    if (!nodeObj || !nodeObj.tableData) return;
    const table = nodeObj.tableData;
    const tx = nodeObj.x - nodeObj.width / 2;
    const ty = nodeObj.y - nodeObj.height / 2;
    const tw = nodeObj.width;
    const th = nodeObj.height;
    const color = getNodeColors(table.color, ast.colorMode);
    const filterAttr = getFilterAttr(ast.styleMode);
    const textScale = getTextScale(ast.textSize);

    let rowsSvg = '';
    (table.fields || []).forEach((f, idx) => {
      const rowY = ty + headerHeight + (idx * rowHeight);
      rowsSvg += `
        <g data-source-line="${f.sourceLineNumber || table.sourceLineNumber}">
          <text x="${tx + 12}" y="${rowY + 16}" fill="#F1F5F9" font-size="${Math.round(12 * textScale)}" font-family="${getFontFamily(ast.typeface)}" font-weight="${f.isPk ? '700' : '500'}">
            ${escapeXml(f.name)}
          </text>
          <text x="${tx + tw - 58}" y="${rowY + 16}" fill="#64748B" font-size="${Math.round(11 * textScale)}" font-family="var(--font-mono, monospace)">
            ${escapeXml(f.type)}
          </text>
          ${f.isPk ? `
            <rect x="${tx + tw - 32}" y="${rowY + 5}" width="22" height="14" rx="3" fill="rgba(245, 158, 11, 0.2)" stroke="#F59E0B" stroke-width="0.7"/>
            <text x="${tx + tw - 21}" y="${rowY + 15}" fill="#FCD34D" font-size="9" font-weight="700" text-anchor="middle">PK</text>
          ` : f.isFk ? `
            <rect x="${tx + tw - 32}" y="${rowY + 5}" width="22" height="14" rx="3" fill="rgba(59, 130, 246, 0.2)" stroke="#3B82F6" stroke-width="0.7"/>
            <text x="${tx + tw - 21}" y="${rowY + 15}" fill="#93C5FD" font-size="9" font-weight="700" text-anchor="middle">FK</text>
          ` : f.isUnique ? `
            <rect x="${tx + tw - 32}" y="${rowY + 5}" width="22" height="14" rx="3" fill="rgba(139, 92, 246, 0.2)" stroke="#8B5CF6" stroke-width="0.7"/>
            <text x="${tx + tw - 21}" y="${rowY + 15}" fill="#C4B5FD" font-size="9" font-weight="700" text-anchor="middle">UQ</text>
          ` : ''}
        </g>
      `;
    });

    tablesSvg += `
      <g class="diagram-table" data-source-line="${table.sourceLineNumber || 1}" data-table-name="${escapeXml(table.name)}">
        <!-- Table Card Container -->
        <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="8" ry="8"
          fill="#1A1C23" stroke="${color.stroke}" stroke-width="1.5"
          ${filterAttr}
        />
        <!-- Table Header Bar -->
        <path d="M ${tx} ${ty + 8} Q ${tx} ${ty} ${tx + 8} ${ty} L ${tx + tw - 8} ${ty} Q ${tx + tw} ${ty} ${tx + tw} ${ty + 8} L ${tx + tw} ${ty + headerHeight} L ${tx} ${ty + headerHeight} Z"
          fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5"
        />
        <text x="${tx + 12}" y="${ty + 23}" fill="${color.text}" font-size="${Math.round(13 * textScale)}" font-weight="700" font-family="${getFontFamily(ast.typeface)}">
          ${escapeXml(table.label || table.name)}
        </text>
        ${rowsSvg}
      </g>
    `;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: transparent;">
      ${defs}
      ${ast.title ? `
        <text x="${padding}" y="${padding - 10}" fill="#F8FAFC" font-size="18" font-weight="700" font-family="${getFontFamily(ast.typeface)}">
          ${escapeXml(ast.title)}
        </text>
      ` : ''}
      <g class="diagram-content">
        ${edgesSvg}
        ${tablesSvg}
      </g>
    </svg>
  `;
}

// ----------------------------------------------------
// HELPER FUNCTIONS & SVG SHAPES
// ----------------------------------------------------
function renderShapeSvg(shape, w, h, color, typeface) {
  const stroke = color.stroke;
  const fill = color.fill;
  const strokeWidth = 1.8;

  switch (shape) {
    case 'circle': {
      const r = Math.min(w, h) / 2;
      return `<circle cx="${w/2}" cy="${h/2}" r="${r - 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'oval':
    case 'ellipse': {
      return `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="${h / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'diamond': {
      const pts = `${w/2},2 ${w-2},${h/2} ${w/2},${h-2} 2,${h/2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'cylinder': {
      const ry = 10;
      return `
        <path d="M 2 ${ry} A ${w/2 - 2} ${ry} 0 0 0 ${w - 2} ${ry} L ${w - 2} ${h - ry} A ${w/2 - 2} ${ry} 0 0 1 2 ${h - ry} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        <ellipse cx="${w/2}" cy="${ry}" rx="${w/2 - 2}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
      `;
    }
    case 'parallelogram': {
      const skew = 18;
      const pts = `${skew},2 ${w-2},2 ${w-skew},${h-2} 2,${h-2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'trapezoid': {
      const indent = 16;
      const pts = `${indent},2 ${w - indent},2 ${w - 2},${h - 2} 2,${h - 2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'hexagon': {
      const side = 14;
      const pts = `${side},2 ${w-side},2 ${w-2},${h/2} ${w-side},${h-2} ${side},${h-2} 2,${h/2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'triangle': {
      const pts = `${w/2},2 ${w-2},${h-2} 2,${h-2}`;
      return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case 'document': {
      return `
        <path d="M 2 2 L ${w - 2} 2 L ${w - 2} ${h - 12} Q ${w * 0.75} ${h - 2} ${w * 0.5} ${h - 8} Q ${w * 0.25} ${h - 14} 2 ${h - 8} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
      `;
    }
    case 'rectangle':
    default: {
      return `<rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" ry="6" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
  }
}

function buildCurvePath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  // Smooth bezier through dagre spline control points
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function getFontFamily(typeface) {
  if (typeface === 'mono') {
    return 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace';
  }
  if (typeface === 'clean') {
    return 'Inter, system-ui, -apple-system, sans-serif';
  }
  // Rough typeface
  return 'Inter, system-ui, sans-serif';
}

function getFilterAttr(styleMode) {
  if (styleMode === 'watercolor') return 'filter="url(#watercolor-filter)"';
  if (styleMode === 'shadow') return 'filter="url(#shadow-filter)"';
  return '';
}

function getTextScale(textSize) {
  if (textSize === 'small') return 0.9;
  if (textSize === 'large') return 1.35;
  return 1.15; // medium default
}

function getSharedSvgDefs(typeface, styleMode) {
  return `
    <defs>
      <!-- Drop Shadow Filter -->
      <filter id="shadow-filter" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
      </filter>

      <!-- Watercolor / Hand-drawn Texture Filter -->
      <filter id="watercolor-filter" x="-10%" y="-10%" width="130%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" result="displaced" />
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.25" />
      </filter>

      <!-- Arrowhead Markers for Palette Colors -->
      ${Object.keys(PALETTE).map(col => `
        <marker id="arrow-${col}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${PALETTE[col].stroke === PALETTE.default.stroke ? '#94A3B8' : PALETTE[col].stroke}" />
        </marker>
        <marker id="arrow-start-${col}" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="${PALETTE[col].stroke === PALETTE.default.stroke ? '#94A3B8' : PALETTE[col].stroke}" />
        </marker>
      `).join('')}

      <!-- Crow's Foot ERD Markers -->
      <marker id="crowsfoot-many" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M 0 1 L 10 6 L 0 11 M 0 6 L 10 6" fill="none" stroke="#94A3B8" stroke-width="1.8" />
      </marker>
      <marker id="crowsfoot-many-start" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M 12 1 L 2 6 L 12 11 M 12 6 L 2 6" fill="none" stroke="#94A3B8" stroke-width="1.8" />
      </marker>
      <marker id="crowsfoot-one" viewBox="0 0 10 12" refX="8" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <line x1="8" y1="1" x2="8" y2="11" stroke="#94A3B8" stroke-width="2" />
        <line x1="4" y1="1" x2="4" y2="11" stroke="#94A3B8" stroke-width="2" />
      </marker>
      <marker id="crowsfoot-one-start" viewBox="0 0 10 12" refX="2" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <line x1="2" y1="1" x2="2" y2="11" stroke="#94A3B8" stroke-width="2" />
        <line x1="6" y1="1" x2="6" y2="11" stroke="#94A3B8" stroke-width="2" />
      </marker>
    </defs>
  `;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
