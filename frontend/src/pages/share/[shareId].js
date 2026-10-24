import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  Lock, 
  Eye, 
  FileText, 
  Columns, 
  Layers, 
  AlertTriangle, 
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { getShareLink } from '../../lib/api/client';
import { renderDiagramToSVG } from '../../lib/engine/renderer';
import ResizableSplit from '../../components/editor/ResizableSplit';
import DocPane from '../../components/editor/DocPane';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function SharedViewPage() {
  const router = useRouter();
  const { shareId, diagram: targetDiagram, figure: targetFigure, elements: targetElements } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [shareMeta, setShareMeta] = useState(null);
  const [viewMode, setViewMode] = useState('split'); // 'doc' | 'split' | 'canvas'

  // Canvas pan & zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    if (!shareId) return;

    setLoading(true);
    setError(null);

    getShareLink(shareId, {
      diagram: targetDiagram,
      figure: targetFigure,
      elements: targetElements
    })
      .then(res => {
        if (res.success && res.file) {
          setFile(res.file);
          setShareMeta(res.share);
        } else {
          setError('Share link not found or expired');
        }
      })
      .catch(err => {
        console.error('Failed to load shared document:', err);
        setError(err.status === 404 ? 'Share link not found or expired' : 'Failed to load document');
      })
      .finally(() => setLoading(false));
  }, [shareId, targetDiagram, targetFigure, targetElements]);

  // Pan controls
  const handleMouseDown = (e) => {
    if (e.target === containerRef.current || e.target.classList.contains('canvas-background')) {
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
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

  // Parse canvas diagrams
  let canvasData = { diagrams: [] };
  if (file?.canvas_data) {
    try {
      canvasData = JSON.parse(file.canvas_data);
      if (!canvasData.diagrams) canvasData.diagrams = [];
    } catch (e) {
      console.error('Failed to parse canvas data:', e);
    }
  }

  // Active targeted diagram ID from query param or share doc
  const focusedDiagramId = targetDiagram || shareMeta?.target_diagram_id;

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px'
      }}>
        <Head>
          <title>Loading Shared Diagram...</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <span>Loading shared document...</span>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
        gap: '16px',
        padding: '20px'
      }}>
        <Head>
          <title>404 - Share Link Expired or Not Found</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F87171'
        }}>
          <AlertTriangle size={28} />
        </div>
        <h2 id="share-error-message" style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>
          Share link not found or expired
        </h2>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '440px', textAlign: 'center' }}>
          This link is invalid, has been revoked by the owner, or the shared document no longer exists.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: 'var(--bg-primary)',
      fontFamily: 'var(--font-sans)',
      overflow: 'hidden'
    }}>
      <Head>
        <title>{`${file.title || 'Untitled'} (Shared View)`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Read-Only Shared Header */}
      <header style={{
        height: '52px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        flexShrink: 0,
        zIndex: 30
      }}>
        {/* Left: Document Title & Read-Only Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{file.title || 'Untitled'}</span>
          </div>

          <div 
            id="badge-view-only"
            style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#60A5FA',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600
          }}>
            <Eye size={12} />
            <span>Read-Only</span>
          </div>

          {focusedDiagramId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#34D399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600
            }}>
              <span>Target: {focusedDiagramId}</span>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)',
          padding: '3px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          gap: '2px'
        }}>
          <button
            onClick={() => setViewMode('doc')}
            className="btn"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: viewMode === 'doc' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'doc' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            title="Notes Only"
          >
            <FileText size={14} />
            <span>Doc</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className="btn"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: viewMode === 'split' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            title="Split View"
          >
            <Columns size={14} />
            <span>Both</span>
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className="btn"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '12px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              backgroundColor: viewMode === 'canvas' ? 'var(--bg-card)' : 'transparent',
              color: viewMode === 'canvas' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            title="Canvas Only"
          >
            <Layers size={14} />
            <span>Canvas</span>
          </button>
        </div>
      </header>

      {/* Main Read-Only Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ErrorBoundary name="Shared Document View" minHeight="300px">
          <ResizableSplit
          viewMode={viewMode}
          leftPane={
            <DocPane
              docContent={file.doc_content || ''}
              onChange={() => {}} // Strictly read-only
              fileTitle={file.title}
              readOnly={true}
            />
          }
          rightPane={
            <div
              ref={containerRef}
              className="canvas-background"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'var(--bg-primary)',
                backgroundImage: 'radial-gradient(circle, #2A303C 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                position: 'relative',
                overflow: 'hidden',
                cursor: isPanning ? 'grabbing' : 'grab'
              }}
            >
              {/* Zoom Controls */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                zIndex: 20
              }}>
                <button
                  onClick={() => setZoom(z => Math.max(0.3, +(z - 0.15).toFixed(2)))}
                  className="btn-icon"
                  style={{ width: '28px', height: '28px' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={14} />
                </button>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '40px', textAlign: 'center' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(2.5, +(z + 0.15).toFixed(2)))}
                  className="btn-icon"
                  style={{ width: '28px', height: '28px' }}
                  title="Zoom In"
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                  className="btn-icon"
                  style={{ width: '28px', height: '28px' }}
                  title="Reset View"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Render Diagrams inside Stage */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                transition: isPanning ? 'none' : 'transform 0.05s ease-out',
                pointerEvents: 'auto'
              }}>
                {canvasData.diagrams.map((diag, index) => {
                  const isTargeted = focusedDiagramId ? diag.id === focusedDiagramId : true;
                  const svgHtml = renderDiagramToSVG(diag.code || '', diag.diagramType || 'flowchart-diagram');

                  return (
                    <div
                      key={diag.id || index}
                      id={`diagram-figure-${diag.id}`}
                      style={{
                        position: 'absolute',
                        left: `${diag.x || 60 + index * 30}px`,
                        top: `${diag.y || 60 + index * 30}px`,
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: 'rgba(24, 28, 38, 0.4)',
                        border: isTargeted && focusedDiagramId
                          ? '2px solid #3B82F6'
                          : '1px solid rgba(255,255,255,0.06)',
                        boxShadow: isTargeted && focusedDiagramId
                          ? '0 0 24px rgba(59, 130, 246, 0.35)'
                          : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: svgHtml }}
                        style={{ display: 'block' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          }
        />
        </ErrorBoundary>
      </div>
    </div>
  );
}
