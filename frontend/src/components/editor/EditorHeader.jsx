import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  FileText, 
  Columns, 
  LayoutDashboard, 
  Code2, 
  Share2, 
  Download, 
  Check, 
  Sparkles,
  Layers,
  History,
  Loader2,
  AlertCircle,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

export default function EditorHeader({
  file,
  onTitleChange,
  viewMode, // 'doc' | 'split' | 'canvas'
  onViewModeChange,
  isCodeDrawerOpen,
  onToggleCodeDrawer,
  diagramCount = 1,
  activeDiagramId,
  saveStatus = 'saved', // 'saving' | 'saved' | 'error' | 'conflict'
  onRetrySave,
  onResolveConflict,
  isVersionsOpen = false,
  onToggleVersions,
  onOpenAIModal,
  onOpenExportModal,
  onOpenShareModal
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(file?.title || 'Untitled');

  useEffect(() => {
    if (file?.title) {
      setTitleValue(file.title);
    }
  }, [file?.title]);

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue.trim() !== file?.title) {
      onTitleChange(titleValue.trim());
    } else {
      setTitleValue(file?.title || 'Untitled');
    }
  };

  return (
    <header style={{
      height: '52px',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      flexShrink: 0,
      zIndex: 30
    }}>
      {/* Left: Dashboard link, Title & Save Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link 
          href="/dashboard/all" 
          className="btn-icon" 
          title="Back to All Files"
          style={{ width: '32px', height: '32px' }}
        >
          <ChevronLeft size={18} />
        </Link>

        {editingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleValue(file?.title || 'Untitled');
                setEditingTitle(false);
              }
            }}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              padding: '4px 8px',
              height: '28px',
              width: '260px'
            }}
          />
        ) : (
          <div 
            onClick={() => setEditingTitle(true)}
            title="Click to rename"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              transition: 'background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span>{titleValue}</span>
          </div>
        )}

        {/* Autosave Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
          {saveStatus === 'saving' && (
            <span style={{ color: '#60A5FA', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Check size={12} />
              <span>Saved</span>
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={12} />
              <span>Save error</span>
              {onRetrySave && (
                <button
                  onClick={onRetrySave}
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #EF4444',
                    color: '#FCA5A5',
                    borderRadius: '4px',
                    fontSize: '10px',
                    padding: '1px 6px',
                    cursor: 'pointer'
                  }}
                >
                  Retry
                </button>
              )}
            </span>
          )}
          {saveStatus === 'conflict' && (
            <span style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={12} />
              <span>Conflict</span>
              {onResolveConflict && (
                <button
                  onClick={onResolveConflict}
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    border: '1px solid #F59E0B',
                    color: '#FCD34D',
                    borderRadius: '4px',
                    fontSize: '10px',
                    padding: '1px 6px',
                    cursor: 'pointer'
                  }}
                >
                  Resolve
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Middle: View Mode Toggle (Doc Only, Split, Canvas Only) */}
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
          id="view-mode-doc"
          onClick={() => onViewModeChange('doc')}
          className="btn"
          style={{
            height: '28px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: viewMode === 'doc' ? 'var(--bg-card)' : 'transparent',
            color: viewMode === 'doc' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: viewMode === 'doc' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'
          }}
          title="Document Only"
        >
          <FileText size={14} />
          <span>Doc</span>
        </button>

        <button
          id="view-mode-split"
          onClick={() => onViewModeChange('split')}
          className="btn"
          style={{
            height: '28px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: viewMode === 'split' ? 'var(--bg-card)' : 'transparent',
            color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: viewMode === 'split' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'
          }}
          title="Split View (Doc + Canvas)"
        >
          <Columns size={14} />
          <span>Both</span>
        </button>

        <button
          id="view-mode-canvas"
          onClick={() => onViewModeChange('canvas')}
          className="btn"
          style={{
            height: '28px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            backgroundColor: viewMode === 'canvas' ? 'var(--bg-card)' : 'transparent',
            color: viewMode === 'canvas' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: viewMode === 'canvas' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'
          }}
          title="Canvas Only"
        >
          <Layers size={14} />
          <span>Canvas</span>
        </button>
      </div>

      {/* Right: AI, Export, Version History & Code Drawer Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* AI Generation Modal Button */}
        <button
          id="btn-open-ai-modal"
          onClick={onOpenAIModal}
          className="btn"
          style={{
            height: '32px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            color: '#60A5FA',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            gap: '6px'
          }}
          title="Generate or Edit Diagram with AI"
        >
          <Sparkles size={14} />
          <span>AI</span>
        </button>

        {/* Export Modal Button */}
        <button
          id="btn-open-export-modal"
          onClick={onOpenExportModal}
          className="btn"
          style={{
            height: '32px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-subtle)',
            gap: '6px'
          }}
          title="Export (PNG, SVG, PDF)"
        >
          <Download size={14} />
          <span>Export</span>
        </button>

        {/* Share View-Only Modal Button */}
        <button
          id="btn-open-share-modal"
          onClick={onOpenShareModal}
          className="btn"
          style={{
            height: '32px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-subtle)',
            gap: '6px'
          }}
          title="Share View-Only Link"
        >
          <Share2 size={14} />
          <span>Share</span>
        </button>

        {/* Version History Toggle Button */}
        <button
          id="btn-toggle-version-history"
          onClick={onToggleVersions}
          className="btn"
          style={{
            height: '32px',
            padding: '0 10px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: isVersionsOpen ? 'var(--accent-subtle)' : 'var(--bg-surface)',
            color: isVersionsOpen ? '#60A5FA' : 'var(--text-primary)',
            borderColor: isVersionsOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
            gap: '6px'
          }}
          title="Version History"
        >
          <History size={14} />
          <span>History</span>
        </button>

        {/* Code Drawer Toggle Button */}
        <button
          id="btn-toggle-code-drawer"
          onClick={onToggleCodeDrawer}
          className="btn"
          style={{
            height: '32px',
            padding: '0 12px',
            fontSize: '12px',
            fontWeight: 500,
            backgroundColor: isCodeDrawerOpen ? 'var(--accent-subtle)' : 'var(--bg-surface)',
            color: isCodeDrawerOpen ? '#60A5FA' : 'var(--text-primary)',
            borderColor: isCodeDrawerOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
            gap: '6px'
          }}
          title="Toggle Diagram Code Drawer"
        >
          <Code2 size={15} />
          <span>Diagram Code</span>
          <span style={{
            fontSize: '10px',
            backgroundColor: isCodeDrawerOpen ? 'rgba(59,130,246,0.3)' : 'var(--bg-tertiary)',
            color: isCodeDrawerOpen ? '#93C5FD' : 'var(--text-muted)',
            padding: '1px 6px',
            borderRadius: '10px',
            fontWeight: 600
          }}>
            {diagramCount}
          </span>
        </button>
      </div>
    </header>
  );
}
