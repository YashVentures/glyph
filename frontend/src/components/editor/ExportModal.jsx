import React, { useState } from 'react';
import { 
  Download, 
  X, 
  Copy, 
  Check, 
  FileText, 
  Layers, 
  CheckSquare, 
  Eye, 
  Image as ImageIcon,
  FileCode
} from 'lucide-react';
import { 
  EXPORT_SCOPES, 
  EXPORT_FORMATS, 
  SCOPE_FORMATS_MAP,
  buildSelfContainedSVG, 
  exportDiagramToPNG, 
  exportDiagramToPDF, 
  triggerDownload, 
  copyToClipboard 
} from '@/lib/engine/export';
import { parseDiagram } from '@/lib/engine/parser';

export default function ExportModal({
  isOpen,
  onClose,
  file,
  canvasData,
  selectedDiagramId,
  docContent
}) {
  const [scope, setScope] = useState(selectedDiagramId ? EXPORT_SCOPES.SELECTION : EXPORT_SCOPES.CANVAS);
  const [format, setFormat] = useState(EXPORT_FORMATS.PNG_2X);
  const [background, setBackground] = useState('solid'); // 'solid' | 'transparent'
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const diagrams = canvasData?.diagrams || [];
  const selectedDiagram = diagrams.find(d => d.id === selectedDiagramId) || diagrams[0];

  // Allowed formats for the current scope
  const availableFormats = SCOPE_FORMATS_MAP[scope] || [EXPORT_FORMATS.PNG_2X, EXPORT_FORMATS.SVG];

  // Get active AST for export based on scope
  const getActiveAST = () => {
    if (scope === EXPORT_SCOPES.SELECTION && selectedDiagram) {
      return parseDiagram(selectedDiagram.code, selectedDiagram.diagramType);
    }
    // Canvas or All: render primary diagram or combine
    if (selectedDiagram) {
      return parseDiagram(selectedDiagram.code, selectedDiagram.diagramType);
    }
    if (diagrams.length > 0) {
      return parseDiagram(diagrams[0].code, diagrams[0].diagramType);
    }
    return parseDiagram('title Empty Diagram\nstart [shape: oval]');
  };

  const activeAST = getActiveAST();
  const previewSvg = buildSelfContainedSVG(activeAST, { background, theme });

  const handleScopeChange = (newScope) => {
    setScope(newScope);
    const newFormats = SCOPE_FORMATS_MAP[newScope] || [];
    if (!newFormats.includes(format)) {
      setFormat(newFormats[0]);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const titleSlug = (file?.title || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-');

      if (format === EXPORT_FORMATS.COPY_CODE) {
        if (selectedDiagram) {
          await copyToClipboard(selectedDiagram.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
        setExporting(false);
        return;
      }

      if (format === EXPORT_FORMATS.SVG) {
        const svgData = buildSelfContainedSVG(activeAST, { background, theme });
        triggerDownload(svgData, `${titleSlug}.svg`, 'image/svg+xml');
      } else if (format === EXPORT_FORMATS.PDF) {
        const pdfDoc = await exportDiagramToPDF(activeAST, { theme, background });
        pdfDoc.save(`${titleSlug}.pdf`);
      } else {
        // PNG (1x, 2x, 3x)
        const scale = format === EXPORT_FORMATS.PNG_3X ? 3 : (format === EXPORT_FORMATS.PNG_2X ? 2 : 1);
        const result = await exportDiagramToPNG(activeAST, { scale, background, theme });
        if (result.blob) {
          triggerDownload(result.blob, `${titleSlug}-${scale}x.png`, 'image/png');
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err.message || String(err)));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '640px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Export Diagram & Document
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Scope Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Export Scope
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {[
                { id: EXPORT_SCOPES.SELECTION, label: 'Selection', icon: CheckSquare },
                { id: EXPORT_SCOPES.CANVAS, label: 'Canvas', icon: Layers },
                { id: EXPORT_SCOPES.DOCUMENT, label: 'Document', icon: FileText },
                { id: EXPORT_SCOPES.ALL, label: 'All', icon: Eye }
              ].map(s => {
                const Icon = s.icon;
                const isSelected = scope === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleScopeChange(s.id)}
                    style={{
                      padding: '8px 6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: 'var(--radius-sm)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                      color: isSelected ? '#93C5FD' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Icon size={14} />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Export Format
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {availableFormats.map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: format === f ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: format === f ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: format === f ? '#93C5FD' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Background & Theme (Only for image/svg formats) */}
          {format !== EXPORT_FORMATS.COPY_CODE && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Background
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['solid', 'transparent'].map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBackground(b)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '11px',
                        textTransform: 'capitalize',
                        borderRadius: 'var(--radius-sm)',
                        border: background === b ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: background === b ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        color: background === b ? '#93C5FD' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Theme
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {['dark', 'light'].map(th => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setTheme(th)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        fontSize: '11px',
                        textTransform: 'capitalize',
                        borderRadius: 'var(--radius-sm)',
                        border: theme === th ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        backgroundColor: theme === th ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        color: theme === th ? '#93C5FD' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {th}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live SVG Thumbnail Preview */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Preview
            </label>
            <div 
              style={{
                height: '140px',
                backgroundColor: background === 'solid' ? (theme === 'dark' ? '#12141A' : '#FFFFFF') : 'transparent',
                backgroundImage: background === 'transparent' ? 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)' : 'none',
                backgroundSize: '12px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px'
              }}
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={onClose}
            className="btn"
            style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
          >
            Cancel
          </button>

          <button
            id="btn-execute-export"
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="btn btn-primary"
            style={{
              height: '32px',
              padding: '0 16px',
              fontSize: '12px',
              gap: '6px'
            }}
          >
            {format === EXPORT_FORMATS.COPY_CODE ? (
              copied ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Code</span>
                </>
              )
            ) : (
              <>
                <Download size={14} />
                <span>{exporting ? 'Exporting...' : `Export ${format}`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
