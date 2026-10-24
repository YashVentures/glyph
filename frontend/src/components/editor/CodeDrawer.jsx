import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  X, 
  Code2, 
  ChevronDown, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  AlertCircle,
  FileCode,
  Sparkles
} from 'lucide-react';
import { parseDiagram } from '../../lib/engine/parser.js';

// Dynamic Monaco editor import to prevent SSR hydration issues
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      backgroundColor: '#1E1E1E',
      color: 'var(--text-muted)',
      fontSize: '13px',
      fontFamily: 'var(--font-mono)'
    }}>
      Loading diagram code editor...
    </div>
  )
});

export default function CodeDrawer({
  isOpen,
  onClose,
  diagrams = [],
  selectedDiagramId,
  onSelectDiagram,
  onCodeChange
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentDiagram = diagrams.find(d => d.id === selectedDiagramId) || diagrams[0];

  const parseErrors = useMemo(() => {
    if (!currentDiagram || !currentDiagram.code) return [];
    try {
      const { errors } = parseDiagram(currentDiagram.code, currentDiagram.diagramType);
      return errors || [];
    } catch (e) {
      return [{ line: 1, message: e.message }];
    }
  }, [currentDiagram?.code, currentDiagram?.diagramType]);

  const hasErrors = parseErrors.length > 0;

  if (!isOpen || !mounted) return null;

  return (
    <div 
      id="code-drawer-panel"
      data-testid="code-drawer-panel"
      style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: isExpanded ? '85vh' : '360px',
      backgroundColor: '#181A20',
      borderTop: '2px solid var(--accent-primary)',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Drawer Top Navigation Bar */}
      <div style={{
        height: '42px',
        backgroundColor: '#131418',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0
      }}>
        {/* Left: Diagram Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#60A5FA' }}>
            <Code2 size={16} />
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em' }}>DIAGRAM CODE</span>
          </div>

          {diagrams.length > 1 ? (
            <select
              value={currentDiagram?.id || ''}
              onChange={e => onSelectDiagram(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {diagrams.map(d => (
                <option key={d.id} value={d.id}>
                  {d.id} ({d.diagramType?.replace('-diagram', '') || 'diagram'})
                </option>
              ))}
            </select>
          ) : (
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-surface)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>
              {currentDiagram?.id || 'No diagram selected'}
            </span>
          )}

          <span style={{
            fontSize: '11px',
            color: hasErrors ? '#EF4444' : '#10B981',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {hasErrors ? (
              <>
                <AlertCircle size={12} color="#EF4444" />
                <span>{parseErrors.length} {parseErrors.length === 1 ? 'Error' : 'Errors'} (Canvas Locked)</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} color="#10B981" />
                <span>Valid Syntax</span>
              </>
            )}
          </span>
        </div>

        {/* Right: Drawer Actions (Expand & Close) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-icon"
            title={isExpanded ? 'Collapse Drawer' : 'Expand Drawer'}
            style={{ width: '28px', height: '28px' }}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            onClick={onClose}
            className="btn-icon"
            title="Close Drawer"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Syntax Error Notice Banner */}
      {hasErrors && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '6px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          fontSize: '11px',
          color: '#FCA5A5',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0
        }}>
          {parseErrors.slice(0, 3).map((err, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: '#EF4444' }}>Line {err.line}:</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Diagram Code Editor Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {currentDiagram ? (
          <textarea
            id="code-drawer-textarea"
            data-testid="code-drawer-textarea"
            value={currentDiagram.code || ''}
            onChange={(e) => {
              if (onCodeChange && currentDiagram) {
                onCodeChange(currentDiagram.id, e.target.value);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1E1E1E',
              color: '#D4D4D4',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              padding: '16px',
              border: 'none',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box'
            }}
            placeholder="Type diagram code here..."
            spellCheck={false}
          />
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '13px'
          }}>
            Select a diagram on the canvas to edit its code.
          </div>
        )}
      </div>
    </div>
  );
}
