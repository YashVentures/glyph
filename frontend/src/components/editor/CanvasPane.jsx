import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Minus, 
  RotateCcw, 
  Code2, 
  Layers, 
  Move,
  Maximize2,
  GitCommit,
  Sparkles,
  Trash2,
  Palette,
  Shapes,
  Smile,
  Type,
  AlertTriangle,
  ArrowRight,
  PlusCircle
} from 'lucide-react';
import { parseDiagram } from '../../lib/engine/parser.js';
import { renderDiagramToSVG } from '../../lib/engine/renderer.js';
import { setCustomIcons } from '../../lib/engine/constants.js';
import { listIcons } from '../../lib/api/client';
import { ErrorBoundary } from '../ErrorBoundary';
import CustomIconModal from './CustomIconModal';
import { 
  updateLabelAtLine, 
  updateColorAtLine, 
  updateShapeAtLine, 
  updateIconAtLine, 
  deleteElementAtLine, 
  addNodeToCode, 
  addConnectionToCode,
  deleteNode,
  renameNode
} from '../../lib/engine/twoWaySync.js';

const COLOR_SWATCHES = [
  { name: 'blue', hex: '#3B82F6' },
  { name: 'green', hex: '#10B981' },
  { name: 'red', hex: '#EF4444' },
  { name: 'orange', hex: '#F97316' },
  { name: 'purple', hex: '#8B5CF6' },
  { name: 'yellow', hex: '#F59E0B' },
  { name: 'black', hex: '#334155' },
  { name: 'white', hex: '#E2E8F0' },
  { name: 'default', hex: '#64748B' }
];

const SHAPE_OPTIONS = [
  'rectangle', 'diamond', 'cylinder', 'oval', 'circle', 'hexagon'
];

const ICON_OPTIONS = [
  'server', 'database', 'cloud', 'user', 'bucket',
  'aws-ecs', 'aws-s3', 'aws-rds', 'aws-lambda', 'aws-alb'
];

export default function CanvasPane({
  canvasData,
  onChange,
  selectedDiagramId,
  onSelectDiagram,
  onOpenCodeDrawer
}) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Diagram Card Dragging state
  const [draggingCard, setDraggingCard] = useState(null); // { id, startX, startY, origX, origY, currentX, currentY, moved }

  // Selected element state for canvas interactions & style panel
  const [selectedElement, setSelectedElement] = useState(null);

  // Custom icons state & modal
  const [customIcons, setCustomIconsList] = useState([]);
  const [isCustomIconModalOpen, setIsCustomIconModalOpen] = useState(false);

  useEffect(() => {
    listIcons()
      .then(res => {
        if (res.success && res.icons) {
          setCustomIconsList(res.icons);
          setCustomIcons(res.icons);
        }
      })
      .catch(err => console.error('Failed to load custom icons:', err));
  }, []);

  const diagrams = canvasData?.diagrams || [];

  // Window-level mouse listeners for smooth diagram card dragging
  useEffect(() => {
    if (!draggingCard) return;

    const onWinMove = (e) => {
      const dx = (e.clientX - draggingCard.startX) / zoom;
      const dy = (e.clientY - draggingCard.startY) / zoom;
      setDraggingCard(prev => prev ? ({
        ...prev,
        currentX: Math.round(prev.origX + dx),
        currentY: Math.round(prev.origY + dy),
        moved: true
      }) : null);
    };

    const onWinUp = () => {
      setDraggingCard(current => {
        if (current && current.moved) {
          const nextDiagrams = diagrams.map(d => {
            if (d.id === current.id) {
              return { ...d, x: current.currentX, y: current.currentY };
            }
            return d;
          });
          onChange({
            ...canvasData,
            diagrams: nextDiagrams
          });
        }
        return null;
      });
    };

    window.addEventListener('mousemove', onWinMove);
    window.addEventListener('mouseup', onWinUp);
    return () => {
      window.removeEventListener('mousemove', onWinMove);
      window.removeEventListener('mouseup', onWinUp);
    };
  }, [draggingCard, zoom, diagrams, canvasData, onChange]);

  // Zoom handlers (camera position)
  const handleZoomIn = () => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Card header mouse down to begin card dragging
  const handleCardHeaderMouseDown = (e, diag) => {
    if (e.button !== 0 || e.target.closest('button') || e.target.closest('input')) return;
    e.stopPropagation();
    onSelectDiagram(diag.id);

    setDraggingCard({
      id: diag.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: diag.x || 80,
      origY: diag.y || 80,
      currentX: diag.x || 80,
      currentY: diag.y || 80,
      moved: false
    });
  };

  // Canvas pan via mouse drag on blank canvas area
  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('canvas-background')) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedElement(null);
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Helper to mutate diagram code and propagate to parent
  const updateDiagramCode = (diagramId, nextCode) => {
    const nextDiagrams = diagrams.map(d => {
      if (d.id === diagramId) {
        return { ...d, code: nextCode };
      }
      return d;
    });
    onChange({
      ...canvasData,
      diagrams: nextDiagrams
    });
  };

  // Helper to update persistent manual node coordinates
  const handleUpdateNodePosition = (diagramId, nodeId, x, y) => {
    const nextDiagrams = diagrams.map(d => {
      if (d.id === diagramId) {
        const prevPositions = d.nodePositions || {};
        return {
          ...d,
          nodePositions: {
            ...prevPositions,
            [nodeId]: { x, y }
          }
        };
      }
      return d;
    });
    onChange({
      ...canvasData,
      diagrams: nextDiagrams
    });
  };

  // Auto-arrange all diagram cards in a clean, non-overlapping grid
  const handleTidyDiagrams = () => {
    if (!diagrams.length) return;
    const COLS = diagrams.length > 2 ? 2 : diagrams.length;
    const CARD_W = 560;
    const CARD_H = 420;
    const START_X = 80;
    const START_Y = 80;

    const nextDiagrams = diagrams.map((diag, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      return {
        ...diag,
        x: START_X + col * CARD_W,
        y: START_Y + row * CARD_H
      };
    });

    onChange({
      ...canvasData,
      diagrams: nextDiagrams
    });
  };

  // 1. Label edit
  const handleUpdateLabel = (newLabel) => {
    if (!selectedElement) return;
    const diag = diagrams.find(d => d.id === selectedElement.diagramId);
    if (!diag) return;
    const updatedCode = updateLabelAtLine(diag.code, selectedElement.sourceLineNumber, newLabel);
    updateDiagramCode(diag.id, updatedCode);
    setSelectedElement(prev => ({ ...prev, label: newLabel }));
  };

  // 2. Color edit
  const handleUpdateColor = (colorName) => {
    if (!selectedElement) return;
    const diag = diagrams.find(d => d.id === selectedElement.diagramId);
    if (!diag) return;
    const updatedCode = updateColorAtLine(diag.code, selectedElement.sourceLineNumber, colorName);
    updateDiagramCode(diag.id, updatedCode);
    setSelectedElement(prev => ({ ...prev, color: colorName }));
  };

  // 3. Shape edit
  const handleUpdateShape = (shapeName) => {
    if (!selectedElement) return;
    const diag = diagrams.find(d => d.id === selectedElement.diagramId);
    if (!diag) return;
    const updatedCode = updateShapeAtLine(diag.code, selectedElement.sourceLineNumber, shapeName);
    updateDiagramCode(diag.id, updatedCode);
    setSelectedElement(prev => ({ ...prev, shape: shapeName }));
  };

  // 4. Icon edit
  const handleUpdateIcon = (iconName) => {
    if (!selectedElement) return;
    const diag = diagrams.find(d => d.id === selectedElement.diagramId);
    if (!diag) return;
    const updatedCode = updateIconAtLine(diag.code, selectedElement.sourceLineNumber, iconName);
    updateDiagramCode(diag.id, updatedCode);
    setSelectedElement(prev => ({ ...prev, icon: iconName }));
  };

  // 5. Delete element
  const handleDeleteElement = () => {
    if (!selectedElement) return;
    const diag = diagrams.find(d => d.id === selectedElement.diagramId);
    if (!diag) return;
    const updatedCode = selectedElement.type === 'node'
      ? deleteNode(diag.code, selectedElement.id, selectedElement.sourceLineNumber)
      : deleteElementAtLine(diag.code, selectedElement.sourceLineNumber);
    updateDiagramCode(diag.id, updatedCode);
    setSelectedElement(null);
  };

  // 6. Add Node
  const handleAddNode = (diagramId) => {
    const diag = diagrams.find(d => d.id === diagramId);
    if (!diag) return;
    const nodeId = `node_${Math.random().toString(36).substring(2, 6)}`;
    const updatedCode = addNodeToCode(diag.code, {
      id: nodeId,
      label: 'New Node',
      shape: 'rectangle',
      color: 'blue'
    });
    updateDiagramCode(diag.id, updatedCode);
  };

  // 7. Add Connection
  const handleAddConnection = (diagramId) => {
    const diag = diagrams.find(d => d.id === diagramId);
    if (!diag) return;
    const { ast } = parseDiagram(diag.code, diag.diagramType);
    const nodes = ast.nodes || [];
    if (nodes.length < 2) {
      const updatedCode = addConnectionToCode(diag.code, {
        source: 'Start',
        target: 'End',
        operator: '>',
        label: 'trigger'
      });
      updateDiagramCode(diag.id, updatedCode);
      return;
    }
    const source = selectedElement?.id || nodes[nodes.length - 2].id;
    const target = nodes[nodes.length - 1].id;
    const updatedCode = addConnectionToCode(diag.code, {
      source,
      target,
      operator: '>',
      label: 'next'
    });
    updateDiagramCode(diag.id, updatedCode);
  };

  // Helper to add a new diagram card
  const handleAddDiagram = (diagramType = 'flowchart-diagram') => {
    const id = `diag-${Date.now().toString(36)}`;
    const starterCodes = {
      'flowchart-diagram': 'title Flowchart\n\nstart [shape: oval, color: blue]\nprocess [shape: rectangle, color: green]\nend [shape: oval, color: purple]\n\nstart > process: trigger\nprocess > end: finish',
      'sequence-diagram': 'title Authentication Sequence\n\nClient > Gateway: POST /login\nGateway > AuthServer: ValidateCredentials\nAuthServer > Gateway: Token Issued\nGateway > Client: 200 OK + JWT',
      'erd-diagram': 'title Store Data Model\nnotation crows-foot\n\nUsers [color: blue] {\n  id int pk\n  email string unique\n}\n\nOrders [color: green] {\n  id int pk\n  user_id int fk\n}\n\nUsers < Orders: places',
      'cloud-architecture-diagram': 'title Cloud Infrastructure\ndirection right\n\nUser [icon: user]\nALB [icon: aws-alb, color: orange]\nAPI [icon: aws-ecs, color: blue]\nDB [icon: aws-rds, color: purple]\n\nUser > ALB: HTTPS\nALB > API: proxy\nAPI > DB: SQL query'
    };

    const count = diagrams.length;
    const col = count % 2;
    const row = Math.floor(count / 2);

    const newDiagram = {
      id,
      type: 'diagram',
      diagramType,
      code: starterCodes[diagramType] || starterCodes['flowchart-diagram'],
      x: 80 + col * 560,
      y: 80 + row * 420
    };

    const nextCanvas = {
      ...canvasData,
      diagrams: [...diagrams, newDiagram]
    };
    onChange(nextCanvas);
    onSelectDiagram(id);
    onOpenCodeDrawer();
  };

  return (
    <div 
      ref={containerRef}
      className="canvas-background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0D0E11',
        backgroundImage: 'radial-gradient(circle, #252836 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        overflow: 'hidden',
        cursor: isPanning ? 'grabbing' : 'default',
        userSelect: 'none'
      }}
    >
      {/* Canvas Top-Right Zoom and Pan Overlay Controls */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: 'rgba(24, 25, 31, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-subtle)',
        padding: '3px 6px',
        borderRadius: 'var(--radius-md)',
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <button 
          onClick={handleZoomOut}
          className="btn-icon"
          title="Zoom Out"
          style={{ width: '28px', height: '28px' }}
        >
          <Minus size={14} />
        </button>

        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          minWidth: '38px',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)'
        }}>
          {Math.round(zoom * 100)}%
        </span>

        <button 
          onClick={handleZoomIn}
          className="btn-icon"
          title="Zoom In"
          style={{ width: '28px', height: '28px' }}
        >
          <Plus size={14} />
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

        <button 
          onClick={handleResetZoom}
          className="btn-icon"
          title="Reset Zoom & Pan"
          style={{ width: '28px', height: '28px' }}
        >
          <RotateCcw size={13} />
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Canvas Auto-Arrange / Tidy button */}
        <button 
          id="btn-canvas-tidy"
          onClick={handleTidyDiagrams}
          className="btn-icon"
          title="Auto-arrange Diagram Cards (Clean Grid)"
          style={{ width: '28px', height: '28px', color: '#60A5FA' }}
        >
          <Layers size={14} />
        </button>
      </div>

      {/* Floating Add Diagram Toolbar (Bottom Left) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: 'rgba(24, 25, 31, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border-subtle)',
        padding: '6px 10px',
        borderRadius: 'var(--radius-md)',
        zIndex: 20,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>
          + DIAGRAM:
        </span>
        <button 
          onClick={() => handleAddDiagram('flowchart-diagram')}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
        >
          Flowchart
        </button>
        <button 
          onClick={() => handleAddDiagram('sequence-diagram')}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
        >
          Sequence
        </button>
        <button 
          onClick={() => handleAddDiagram('erd-diagram')}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
        >
          ERD
        </button>
        <button 
          onClick={() => handleAddDiagram('cloud-architecture-diagram')}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
        >
          Cloud Arch
        </button>
        <button 
          id="btn-open-custom-icons"
          onClick={() => setIsCustomIconModalOpen(true)}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px', gap: '4px' }}
          title="Manage Custom Icons"
        >
          <Smile size={12} color="#F59E0B" />
          <span>Icons</span>
        </button>
        <button 
          id="btn-canvas-tidy-bar"
          onClick={handleTidyDiagrams}
          className="btn btn-secondary"
          style={{ height: '28px', fontSize: '11px', padding: '0 8px', gap: '4px' }}
          title="Auto-arrange diagram cards on canvas"
        >
          <Layers size={12} color="#60A5FA" />
          <span>Arrange</span>
        </button>
      </div>

      {/* Transformable Canvas Surface */}
      <div style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: '0 0',
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0
      }}>
        {diagrams.map((diag) => {
          const isSelected = selectedDiagramId === diag.id;
          const isCardDragging = draggingCard && draggingCard.id === diag.id;
          const leftPos = isCardDragging ? draggingCard.currentX : (diag.x || 80);
          const topPos = isCardDragging ? draggingCard.currentY : (diag.y || 80);

          return (
            <div
              key={diag.id}
              className="diagram-card"
              data-diagram-id={diag.id}
              onClick={(e) => {
                e.stopPropagation();
                onSelectDiagram(diag.id);
              }}
              style={{
                position: 'absolute',
                left: `${leftPos}px`,
                top: `${topPos}px`,
                minWidth: '460px',
                minHeight: '300px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                border: isSelected 
                  ? '2px solid var(--accent-primary)' 
                  : '1px solid var(--border-medium)',
                boxShadow: isCardDragging
                  ? '0 12px 32px rgba(0,0,0,0.7), 0 0 0 2px var(--accent-primary)'
                  : isSelected 
                  ? '0 0 0 4px var(--accent-subtle), 0 8px 24px rgba(0,0,0,0.5)' 
                  : '0 4px 16px rgba(0,0,0,0.35)',
                transition: isCardDragging ? 'none' : 'border 0.15s ease, box-shadow 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'default',
                overflow: 'visible',
                zIndex: isCardDragging ? 40 : (isSelected ? 10 : 1)
              }}
            >
              {/* Diagram Card Header Toolbar (Click & Drag Header to Move Card) */}
              <div 
                onMouseDown={(e) => handleCardHeaderMouseDown(e, diag)}
                title="Drag header to move diagram card"
                style={{
                  height: '42px',
                  backgroundColor: 'var(--bg-surface)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 12px',
                  borderTopLeftRadius: 'var(--radius-lg)',
                  borderTopRightRadius: 'var(--radius-lg)',
                  cursor: isCardDragging ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Move size={13} style={{ color: 'var(--text-muted)', cursor: 'grab', opacity: 0.7 }} />
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    backgroundColor: 'var(--accent-subtle)',
                    color: '#60A5FA',
                    padding: '3px 6px',
                    borderRadius: '4px'
                  }}>
                    {diag.diagramType?.replace('-diagram', '') || 'DIAGRAM'}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {diag.id}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Canvas Toolbar Quick Action: Add Node */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNode(diag.id);
                    }}
                    className="btn btn-secondary"
                    title="Add Node to diagram"
                    style={{ height: '26px', fontSize: '11px', padding: '0 7px', gap: '4px' }}
                  >
                    <PlusCircle size={12} />
                    <span>Node</span>
                  </button>

                  {/* Canvas Toolbar Quick Action: Add Connection */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddConnection(diag.id);
                    }}
                    className="btn btn-secondary"
                    title="Add Connection to diagram"
                    style={{ height: '26px', fontSize: '11px', padding: '0 7px', gap: '4px' }}
                  >
                    <ArrowRight size={12} />
                    <span>Edge</span>
                  </button>

                  {/* Toggle Code Drawer */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDiagram(diag.id);
                      onOpenCodeDrawer();
                    }}
                    className="btn btn-secondary"
                    style={{ height: '26px', fontSize: '11px', padding: '0 8px', gap: '4px' }}
                  >
                    <Code2 size={12} />
                    <span>Code</span>
                  </button>
                </div>
              </div>

              {/* Diagram Body: Rendered SVG surface with selection & error locking wrapped in ErrorBoundary */}
              <ErrorBoundary name="Diagram Canvas" minHeight="240px">
                <DiagramCardBody 
                  diag={diag}
                  code={diag.code}
                  diagramType={diag.diagramType}
                  typeface={diag.typeface}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  onUpdateLabel={handleUpdateLabel}
                  onUpdateColor={handleUpdateColor}
                  onUpdateShape={handleUpdateShape}
                  onUpdateIcon={handleUpdateIcon}
                  onDeleteElement={handleDeleteElement}
                  customIcons={customIcons}
                  onOpenCustomIconModal={() => setIsCustomIconModalOpen(true)}
                  onUpdateNodePosition={handleUpdateNodePosition}
                  zoom={zoom}
                />
              </ErrorBoundary>
            </div>
          );
        })}
      </div>

      {/* Step 10: Custom Icon Management Modal */}
      <CustomIconModal
        isOpen={isCustomIconModalOpen}
        onClose={() => setIsCustomIconModalOpen(false)}
        onIconsUpdated={(updated) => {
          setCustomIconsList(updated);
          setCustomIcons(updated);
        }}
      />
    </div>
  );
}

function DiagramCardBody({ 
  diag,
  code, 
  diagramType, 
  typeface,
  selectedElement,
  onSelectElement,
  onUpdateLabel,
  onUpdateColor,
  onUpdateShape,
  onUpdateIcon,
  onDeleteElement,
  customIcons = [],
  onOpenCustomIconModal,
  onUpdateNodePosition,
  zoom = 1
}) {
  const lastGoodAstRef = useRef(null);
  const lastGoodSvgRef = useRef(null);
  const [nodeDrag, setNodeDrag] = useState(null); // { nodeId, isTable, sourceLine, startClientX, startClientY, initX, initY, scaleX, scaleY, moved, currentX, currentY }

  const { ast, errors } = useMemo(() => {
    return parseDiagram(code, diagramType);
  }, [code, diagramType]);

  const hasParseErrors = errors && errors.length > 0;

  // Last-good-render caching logic with live nodePositions support
  const svgHtml = useMemo(() => {
    const activePositions = {
      ...(diag.nodePositions || {})
    };
    if (nodeDrag && nodeDrag.moved) {
      activePositions[nodeDrag.nodeId] = {
        x: nodeDrag.currentX,
        y: nodeDrag.currentY
      };
    }

    if (!hasParseErrors) {
      try {
        const rendered = renderDiagramToSVG(ast, { 
          theme: 'dark', 
          customIcons,
          nodePositions: activePositions 
        });
        lastGoodAstRef.current = ast;
        lastGoodSvgRef.current = rendered;
        return rendered;
      } catch (e) {
        console.error('Failed to render diagram SVG:', e);
        return lastGoodSvgRef.current || `<svg width="300" height="100"><text x="20" y="40" fill="#EF4444">Rendering Error</text></svg>`;
      }
    } else {
      // Keep last good render!
      if (lastGoodSvgRef.current) {
        return lastGoodSvgRef.current;
      }
      return `<svg width="400" height="200"><text x="20" y="40" fill="#EF4444">Initial code has syntax errors. Fix in Code Drawer.</text></svg>`;
    }
  }, [ast, hasParseErrors, customIcons, diag.nodePositions, nodeDrag]);

  // Window listeners for node drag movement
  useEffect(() => {
    if (!nodeDrag) return;

    const onMove = (e) => {
      const dx = (e.clientX - nodeDrag.startClientX) * nodeDrag.scaleX;
      const dy = (e.clientY - nodeDrag.startClientY) * nodeDrag.scaleY;
      const hasMoved = Math.hypot(dx, dy) > 3;

      setNodeDrag(prev => prev ? ({
        ...prev,
        currentX: Math.round(prev.initX + dx),
        currentY: Math.round(prev.initY + dy),
        moved: hasMoved
      }) : null);
    };

    const onUp = () => {
      if (nodeDrag.moved && onUpdateNodePosition) {
        onUpdateNodePosition(diag.id, nodeDrag.nodeId, nodeDrag.currentX, nodeDrag.currentY);
        // Select the moved element for immediate inspection
        const activeAst = lastGoodAstRef.current || ast;
        if (nodeDrag.isTable) {
          const tableObj = (activeAst.tables || []).find(t => t.name === nodeDrag.nodeId);
          onSelectElement({
            diagramId: diag.id,
            type: 'table',
            id: nodeDrag.nodeId,
            label: tableObj?.label || nodeDrag.nodeId,
            color: tableObj?.color || 'default',
            sourceLineNumber: nodeDrag.sourceLine
          });
        } else {
          const nodeObj = (activeAst.nodes || []).find(n => n.id === nodeDrag.nodeId);
          onSelectElement({
            diagramId: diag.id,
            type: 'node',
            id: nodeDrag.nodeId,
            label: nodeObj?.label || nodeDrag.nodeId,
            color: nodeObj?.color || 'default',
            shape: nodeObj?.shape || 'rectangle',
            icon: nodeObj?.icon || null,
            sourceLineNumber: nodeDrag.sourceLine
          });
        }
      }
      setNodeDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [nodeDrag, ast, diag.id, onSelectElement, onUpdateNodePosition]);

  // Handle MouseDown on SVG for node/table dragging
  const handleSvgMouseDown = (e) => {
    if (hasParseErrors || e.button !== 0) return;
    const nodeEl = e.target.closest('.diagram-node, .diagram-table');
    if (!nodeEl) return;

    e.stopPropagation();
    const isTable = nodeEl.classList.contains('diagram-table');
    const nodeId = isTable ? nodeEl.getAttribute('data-table-name') : nodeEl.getAttribute('data-node-id');
    const sourceLine = parseInt(nodeEl.getAttribute('data-source-line'), 10);

    const svgEl = nodeEl.closest('svg');
    const rect = svgEl?.getBoundingClientRect();
    const viewBox = svgEl?.viewBox?.baseVal;
    const scaleX = (viewBox && rect && rect.width > 0) ? (viewBox.width / rect.width) : 1;
    const scaleY = (viewBox && rect && rect.height > 0) ? (viewBox.height / rect.height) : 1;

    let initX = 150;
    let initY = 100;
    if (diag.nodePositions && diag.nodePositions[nodeId]) {
      initX = diag.nodePositions[nodeId].x;
      initY = diag.nodePositions[nodeId].y;
    } else {
      const transform = nodeEl.getAttribute('transform');
      if (transform) {
        const match = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/);
        if (match) {
          try {
            const bbox = nodeEl.getBBox();
            initX = parseFloat(match[1]) + bbox.width / 2;
            initY = parseFloat(match[2]) + bbox.height / 2;
          } catch {
            initX = parseFloat(match[1]) + 70;
            initY = parseFloat(match[2]) + 25;
          }
        }
      }
    }

    setNodeDrag({
      nodeId,
      isTable,
      sourceLine,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initX,
      initY,
      scaleX,
      scaleY,
      moved: false,
      currentX: initX,
      currentY: initY
    });
  };

  // Click on SVG elements: Select node, table, edge, or participant
  const handleSvgClick = (e) => {
    if (hasParseErrors || (nodeDrag && nodeDrag.moved)) {
      // Canvas edits are strictly blocked until syntax errors are fixed, or drag just finished
      return;
    }

    const nodeEl = e.target.closest('.diagram-node');
    const tableEl = e.target.closest('.diagram-table');
    const edgeEl = e.target.closest('.diagram-edge');
    const partEl = e.target.closest('.diagram-participant');

    const activeAst = lastGoodAstRef.current || ast;

    if (nodeEl) {
      const sourceLine = parseInt(nodeEl.getAttribute('data-source-line'), 10);
      const nodeId = nodeEl.getAttribute('data-node-id');
      const nodeObj = (activeAst.nodes || []).find(n => n.id === nodeId);
      onSelectElement({
        diagramId: diag.id,
        type: 'node',
        id: nodeId,
        label: nodeObj?.label || nodeId,
        color: nodeObj?.color || 'default',
        shape: nodeObj?.shape || 'rectangle',
        icon: nodeObj?.icon || null,
        sourceLineNumber: sourceLine
      });
      return;
    }

    if (tableEl) {
      const sourceLine = parseInt(tableEl.getAttribute('data-source-line'), 10);
      const tableName = tableEl.getAttribute('data-table-name');
      const tableObj = (activeAst.tables || []).find(t => t.name === tableName);
      onSelectElement({
        diagramId: diag.id,
        type: 'table',
        id: tableName,
        label: tableObj?.label || tableName,
        color: tableObj?.color || 'default',
        sourceLineNumber: sourceLine
      });
      return;
    }

    if (edgeEl) {
      const sourceLine = parseInt(edgeEl.getAttribute('data-source-line'), 10);
      const edgeId = edgeEl.getAttribute('data-edge-id');
      const edgeObj = (activeAst.edges || []).find(ed => ed.id === edgeId) || (activeAst.edges || []).find(ed => ed.sourceLineNumber === sourceLine);
      onSelectElement({
        diagramId: diag.id,
        type: 'edge',
        id: edgeId || `edge-${sourceLine}`,
        label: edgeObj?.label || '',
        color: edgeObj?.color || 'default',
        sourceLineNumber: sourceLine
      });
      return;
    }

    if (partEl) {
      const sourceLine = parseInt(partEl.getAttribute('data-source-line'), 10);
      const partId = partEl.getAttribute('data-participant-id');
      const partObj = (activeAst.participants || []).find(p => p.id === partId);
      onSelectElement({
        diagramId: diag.id,
        type: 'participant',
        id: partId,
        label: partObj?.label || partId,
        sourceLineNumber: sourceLine
      });
      return;
    }

    // Clicked empty background: deselect element
    onSelectElement(null);
  };

  const isCurrentDiagSelected = selectedElement && selectedElement.diagramId === diag.id;

  return (
    <div style={{
      flex: 1,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(18, 20, 26, 0.95)',
      overflow: 'visible',
      minHeight: '260px',
      borderBottomLeftRadius: 'var(--radius-lg)',
      borderBottomRightRadius: 'var(--radius-lg)'
    }}>
      {/* Floating Style Panel (Color, Shape, Icon, Label, Delete) */}
      {isCurrentDiagSelected && (
        <FloatingStylePanel 
          selectedElement={selectedElement}
          isBlocked={hasParseErrors}
          diagramType={diagramType}
          onUpdateLabel={onUpdateLabel}
          onUpdateColor={onUpdateColor}
          onUpdateShape={onUpdateShape}
          onUpdateIcon={onUpdateIcon}
          onDeleteElement={onDeleteElement}
          customIcons={customIcons}
          onOpenCustomIconModal={onOpenCustomIconModal}
        />
      )}

      {/* SVG Styles & Dragging Cursors */}
      <style dangerouslySetInnerHTML={{ __html: `
        .diagram-node, .diagram-table {
          cursor: grab;
          user-select: none;
        }
        .diagram-node:active, .diagram-table:active {
          cursor: grabbing;
        }
        ${isCurrentDiagSelected ? `
          [data-source-line="${selectedElement.sourceLineNumber}"] > rect,
          [data-source-line="${selectedElement.sourceLineNumber}"] > polygon,
          [data-source-line="${selectedElement.sourceLineNumber}"] > path:first-of-type,
          [data-node-id="${selectedElement.id}"] > rect,
          [data-node-id="${selectedElement.id}"] > polygon {
            stroke: #60A5FA !important;
            stroke-width: 2.5px !important;
            filter: drop-shadow(0 0 6px rgba(96, 165, 250, 0.8)) !important;
          }
        ` : ''}
      `}} />

      {/* SVG Canvas Area with Node Drag Support */}
      <div 
        onMouseDown={handleSvgMouseDown}
        onClick={handleSvgClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          minWidth: '400px',
          minHeight: '260px'
        }}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
      />

      {/* Syntax Error Banner with Exact Line Numbers & Lock Notice */}
      {hasParseErrors && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderTop: '1px solid rgba(239, 68, 68, 0.4)',
          padding: '8px 14px',
          fontSize: '11px',
          color: '#FCA5A5',
          fontFamily: 'var(--font-mono)',
          borderBottomLeftRadius: 'var(--radius-lg)',
          borderBottomRightRadius: 'var(--radius-lg)'
        }}>
          <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <AlertTriangle size={13} color="#EF4444" />
            <span>{errors.length} Syntax {errors.length === 1 ? 'Error' : 'Errors'} – Last Good Render Kept (Canvas Edits Locked):</span>
          </div>
          {errors.slice(0, 3).map((err, i) => (
            <div key={i} style={{ paddingLeft: '18px' }}>
              Line {err.line}: {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FloatingStylePanel({
  selectedElement,
  isBlocked,
  diagramType,
  onUpdateLabel,
  onUpdateColor,
  onUpdateShape,
  onUpdateIcon,
  onDeleteElement,
  customIcons = [],
  onOpenCustomIconModal
}) {
  const [labelValue, setLabelValue] = useState(selectedElement.label || '');

  useEffect(() => {
    setLabelValue(selectedElement.label || '');
  }, [selectedElement.label, selectedElement.id]);

  if (isBlocked) {
    return (
      <div style={{
        position: 'absolute',
        top: '-46px',
        left: '12px',
        backgroundColor: '#7F1D1D',
        color: '#FECACA',
        border: '1px solid #DC2626',
        borderRadius: '6px',
        padding: '6px 12px',
        fontSize: '11px',
        fontWeight: 600,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
      }}>
        <AlertTriangle size={14} />
        <span>Canvas editing locked: Fix syntax errors in Code Drawer to edit.</span>
      </div>
    );
  }

  const isNode = selectedElement.type === 'node';
  const allowsShapes = isNode && (diagramType === 'flowchart-diagram' || diagramType === 'cloud-architecture-diagram');
  const allowsIcons = isNode;

  return (
    <div style={{
      position: 'absolute',
      top: '-48px',
      left: '12px',
      backgroundColor: 'rgba(24, 25, 31, 0.95)',
      backdropFilter: 'blur(12px)',
      border: '1px solid var(--border-medium)',
      borderRadius: '8px',
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 30,
      boxShadow: '0 8px 24px rgba(0,0,0,0.55)'
    }}>
      {/* Element Type Badge */}
      <span style={{
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: '2px 5px',
        borderRadius: '4px'
      }}>
        {selectedElement.type}
      </span>

      {/* Label Edit Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input 
          id="input-node-label"
          type="text"
          value={labelValue}
          onChange={(e) => setLabelValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onUpdateLabel(labelValue);
            }
          }}
          onBlur={() => {
            if (labelValue !== selectedElement.label) {
              onUpdateLabel(labelValue);
            }
          }}
          placeholder="Edit label..."
          style={{
            height: '24px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '11px',
            padding: '0 6px',
            width: '110px'
          }}
        />
      </div>

      {/* Color Palette Swatches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.name}
            onClick={() => onUpdateColor(swatch.name)}
            title={`Color: ${swatch.name}`}
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: swatch.hex,
              border: selectedElement.color === swatch.name ? '2px solid #FFFFFF' : '1px solid rgba(0,0,0,0.4)',
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
              transform: selectedElement.color === swatch.name ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.1s ease'
            }}
          />
        ))}
      </div>

      {/* Shape Selector (if supported by element type) */}
      {allowsShapes && (
        <select
          value={selectedElement.shape || 'rectangle'}
          onChange={(e) => onUpdateShape(e.target.value)}
          style={{
            height: '24px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '4px',
            color: 'var(--text-primary)',
            fontSize: '11px',
            padding: '0 4px'
          }}
        >
          {SHAPE_OPTIONS.map((sh) => (
            <option key={sh} value={sh}>{sh}</option>
          ))}
        </select>
      )}

      {/* Icon Selector (if node) */}
      {allowsIcons && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select
            value={selectedElement.icon || ''}
            onChange={(e) => onUpdateIcon(e.target.value || null)}
            style={{
              height: '24px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '11px',
              padding: '0 4px',
              maxWidth: '120px'
            }}
          >
            <option value="">No Icon</option>
            <optgroup label="Bundled Icons">
              {ICON_OPTIONS.map((ic) => (
                <option key={ic} value={ic}>{ic}</option>
              ))}
            </optgroup>
            {customIcons && customIcons.length > 0 && (
              <optgroup label="Custom Icons">
                {customIcons.map(ci => (
                  <option key={ci.id} value={ci.name}>{ci.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          {onOpenCustomIconModal && (
            <button
              type="button"
              onClick={onOpenCustomIconModal}
              className="btn-icon"
              title="Upload & Manage Custom Icons"
              style={{ width: '22px', height: '22px', borderRadius: '4px', color: '#F59E0B' }}
            >
              <Smile size={12} />
            </button>
          )}
        </div>
      )}

      {/* Delete Element Button */}
      <button
        onClick={onDeleteElement}
        className="btn-icon"
        title="Delete element"
        style={{
          width: '24px',
          height: '24px',
          color: '#EF4444',
          borderRadius: '4px'
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
