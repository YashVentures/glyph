import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import EditorHeader from '../../components/editor/EditorHeader';
import ResizableSplit from '../../components/editor/ResizableSplit';
import DocPane from '../../components/editor/DocPane';
import CanvasPane from '../../components/editor/CanvasPane';
import CodeDrawer from '../../components/editor/CodeDrawer';
import VersionHistoryDrawer from '../../components/editor/VersionHistoryDrawer';
import AIPromptModal from '../../components/editor/AIPromptModal';
import ExportModal from '../../components/editor/ExportModal';
import ShareModal from '../../components/editor/ShareModal';
import { getFile, updateFile } from '@/lib/api/client';
import { AlertTriangle, RotateCcw, X, Eye, Sparkles } from 'lucide-react';

export default function WorkspacePage() {
  const router = useRouter();
  const { workspaceId } = router.query;

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Editor layout & view mode
  const [viewMode, setViewMode] = useState('split'); // 'doc' | 'split' | 'canvas'
  const [docContent, setDocContent] = useState('');
  const [canvasData, setCanvasData] = useState({ diagrams: [] });
  const [selectedDiagramId, setSelectedDiagramId] = useState(null);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);

  // Step 5: Autosave, concurrency & status state
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error' | 'conflict'
  const [fileVersion, setFileVersion] = useState(1);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictError, setConflictError] = useState(null);

  // Step 6: Version history drawer & preview state
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState(null);

  // Step 7: AI Generation modal & Undo state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [lastAIOperation, setLastAIOperation] = useState(null); // { diagramId, previousCode }

  // Step 8: Client-side Export modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Step 9: View-only Share modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Browser keepalive limit is ~64KB. Keep a safe headroom limit.
  const KEEPALIVE_CAP_BYTES = 60 * 1024; // 60 KB
  // Maximum time edits may remain unsaved during continuous typing
  const MAX_UNSAVED_WAIT_MS = 3000; // 3 seconds cap

  // References for debounced save and window flush
  const debounceTimerRef = useRef(null);
  const firstDirtyTimeRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retryAttemptRef = useRef(0);
  const isSavingRef = useRef(false);

  const docContentRef = useRef(docContent);
  const canvasDataRef = useRef(canvasData);
  const fileVersionRef = useRef(fileVersion);
  const lastSavedRef = useRef({ docContent: '', canvasDataStr: '', version: 1 });

  docContentRef.current = docContent;
  canvasDataRef.current = canvasData;
  fileVersionRef.current = fileVersion;

  // Load initial file data (fast load, no empty flash)
  useEffect(() => {
    if (!workspaceId) return;
    async function load() {
      try {
        const data = await getFile(workspaceId);
        if (data.success && data.file) {
          const loadedFile = data.file;
          setFile(loadedFile);
          setDocContent(loadedFile.doc_content || '');
          setFileVersion(loadedFile.version || 1);

          let parsedCanvas = { diagrams: [] };
          try {
            parsedCanvas = JSON.parse(loadedFile.canvas_data || '{}');
            if (!parsedCanvas.diagrams) parsedCanvas.diagrams = [];
          } catch (e) {
            console.error('Failed to parse canvas_data JSON:', e);
          }
          setCanvasData(parsedCanvas);

          if (parsedCanvas.diagrams.length > 0) {
            setSelectedDiagramId(parsedCanvas.diagrams[0].id);
          }

          lastSavedRef.current = {
            docContent: loadedFile.doc_content || '',
            canvasDataStr: JSON.stringify(parsedCanvas),
            version: loadedFile.version || 1
          };
        }
      } catch (e) {
        console.error('Failed to load file:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [workspaceId]);

  // Core Save Executor (Debounced, Flush, or Forced)
  const performSave = useCallback(async ({ force = false, keepalive = false } = {}) => {
    if (!file || previewingVersion) return;
    if (isSavingRef.current && !force) return;

    const curDoc = docContentRef.current;
    const curCanvasStr = JSON.stringify(canvasDataRef.current);
    const curVer = fileVersionRef.current;

    // Check if content actually changed
    const isDirty = (
      curDoc !== lastSavedRef.current.docContent ||
      curCanvasStr !== lastSavedRef.current.canvasDataStr
    );

    if (!isDirty && !force) {
      firstDirtyTimeRef.current = null;
      return;
    }

    const payloadObj = {
      docContent: curDoc,
      canvasData: curCanvasStr,
      expected_version: force ? undefined : curVer,
      force
    };
    const payloadJson = JSON.stringify(payloadObj);

    // Browser Keepalive Payload Cap:
    // Browsers enforce a hard cap (~64KB total across in-flight requests) on fetch bodies with keepalive: true.
    // If the payload exceeds 60KB, attempting keepalive: true in pagehide will throw or fail silently.
    // In that case, we flush earlier on visibilitychange to 'hidden' using a standard request,
    // and skip oversized keepalive attempts during pagehide.
    if (keepalive && typeof window !== 'undefined') {
      const byteLength = typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(payloadJson).length
        : payloadJson.length;

      if (byteLength > KEEPALIVE_CAP_BYTES) {
        // Payload exceeds 64KB keepalive limit; reliance is on visibilitychange flush
        return;
      }

      const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
      try {
        fetch(`${apiBase}/files/${file.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: payloadJson,
          keepalive: true
        });
      } catch (e) {
        // Ignored on window unload
      }
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    try {
      const res = await updateFile(file.id, payloadObj);
      if (res.success && res.file) {
        setSaveStatus('saved');
        setFileVersion(res.file.version);
        lastSavedRef.current = {
          docContent: curDoc,
          canvasDataStr: curCanvasStr,
          version: res.file.version
        };
        firstDirtyTimeRef.current = null;
        retryAttemptRef.current = 0;
        setConflictModalOpen(false);
      }
    } catch (err) {
      if (err.isConflict || err.status === 409) {
        // Optimistic Concurrency Conflict
        setSaveStatus('conflict');
        setConflictError(err.message || 'File was modified in another session.');
        setConflictModalOpen(true);
      } else {
        // Network or server error: never discard local changes!
        setSaveStatus('error');
        // Schedule retry with exponential backoff (2s, 4s, 8s, up to 30s)
        const delay = Math.min(30000, 2000 * Math.pow(2, retryAttemptRef.current));
        retryAttemptRef.current += 1;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          performSave();
        }, delay);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [file, previewingVersion]);

  // Trigger Debounced Autosave on Edit
  // Enforces a hard cap (MAX_UNSAVED_WAIT_MS = 3s) so continuous typing cannot delay saves indefinitely
  const scheduleAutosave = useCallback(() => {
    if (firstDirtyTimeRef.current === null) {
      firstDirtyTimeRef.current = Date.now();
    }
    const elapsed = Date.now() - firstDirtyTimeRef.current;
    const remainingTime = Math.max(0, MAX_UNSAVED_WAIT_MS - elapsed);
    const delay = Math.min(1000, remainingTime);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, delay);
  }, [performSave]);

  // Flush on blur, visibilitychange to hidden, and pagehide
  useEffect(() => {
    const handleBlur = () => {
      performSave();
    };

    const handleVisibilityChange = () => {
      // Browsers limit keepalive request bodies to ~64KB. If payload is large,
      // flushing on visibilitychange to 'hidden' with a normal request guarantees
      // delivery before the tab can be terminated or pagehide fires.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        performSave({ keepalive: false });
      }
    };

    const handlePageHide = () => {
      performSave({ keepalive: true });
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [performSave]);

  // Handlers for Concurrency Conflict resolution
  const handleReloadServerVersion = async () => {
    if (!file) return;
    try {
      const data = await getFile(file.id);
      if (data.success && data.file) {
        setDocContent(data.file.doc_content || '');
        setFileVersion(data.file.version || 1);
        try {
          const parsed = JSON.parse(data.file.canvas_data || '{}');
          setCanvasData(parsed);
        } catch (e) {
          console.error(e);
        }
        lastSavedRef.current = {
          docContent: data.file.doc_content || '',
          canvasDataStr: data.file.canvas_data || '{}',
          version: data.file.version || 1
        };
        setSaveStatus('saved');
        setConflictModalOpen(false);
      }
    } catch (e) {
      console.error('Failed to reload server version:', e);
    }
  };

  const handleOverwriteServerVersion = () => {
    setConflictModalOpen(false);
    performSave({ force: true });
  };

  // Title rename
  const handleTitleChange = async (newTitle) => {
    if (!file) return;
    try {
      const data = await updateFile(file.id, { title: newTitle });
      if (data.success && data.file) {
        setFile(prev => ({ ...prev, title: newTitle }));
      }
    } catch (e) {
      console.error('Failed to rename file:', e);
    }
  };

  // Document notes edit (triggers debounced autosave)
  const handleDocChange = (newDoc) => {
    setDocContent(newDoc);
    scheduleAutosave();
  };

  // Canvas structure edit (triggers debounced autosave)
  const handleCanvasChange = (newCanvas) => {
    setCanvasData(newCanvas);
    scheduleAutosave();
  };

  // Diagram code edit from Monaco drawer (triggers debounced autosave)
  const handleCodeChange = (diagramId, newCode) => {
    setCanvasData(prev => {
      const nextDiagrams = (prev.diagrams || []).map(d => {
        if (d.id === diagramId) {
          return { ...d, code: newCode };
        }
        return d;
      });
      return { ...prev, diagrams: nextDiagrams };
    });
    scheduleAutosave();
  };

  // Step 7: AI Diagram Handlers (Generate & Edit)
  const handleApplyAIGenerate = (newCode, diagramType) => {
    const newId = `diag-${Date.now().toString(36)}`;
    const newDiagram = {
      id: newId,
      type: 'diagram',
      diagramType: diagramType || 'flowchart-diagram',
      code: newCode,
      x: 80 + (canvasData.diagrams?.length || 0) * 40,
      y: 80 + (canvasData.diagrams?.length || 0) * 40
    };
    setCanvasData(prev => ({
      ...prev,
      diagrams: [...(prev.diagrams || []), newDiagram]
    }));
    setSelectedDiagramId(newId);
    scheduleAutosave();
  };

  const handleApplyAIEdit = (diagramId, newCode, previousCode) => {
    setCanvasData(prev => ({
      ...prev,
      diagrams: (prev.diagrams || []).map(d => d.id === diagramId ? { ...d, code: newCode } : d)
    }));
    setLastAIOperation({ diagramId, previousCode });
    scheduleAutosave();
  };

  const handleUndoAIEdit = () => {
    if (!lastAIOperation) return;
    setCanvasData(prev => ({
      ...prev,
      diagrams: (prev.diagrams || []).map(d => d.id === lastAIOperation.diagramId ? { ...d, code: lastAIOperation.previousCode } : d)
    }));
    setLastAIOperation(null);
    scheduleAutosave();
  };

  // Version Restore Success handler (updates in place without full page reload)
  const handleRestoreSuccess = (restoredFile) => {
    setDocContent(restoredFile.doc_content || '');
    setFileVersion(restoredFile.version || fileVersion + 1);
    try {
      const parsed = JSON.parse(restoredFile.canvas_data || '{}');
      setCanvasData(parsed);
      if (parsed.diagrams?.length > 0) {
        setSelectedDiagramId(parsed.diagrams[0].id);
      }
    } catch (e) {
      console.error('Failed to parse restored canvas_data:', e);
    }
    lastSavedRef.current = {
      docContent: restoredFile.doc_content || '',
      canvasDataStr: restoredFile.canvas_data || '{}',
      version: restoredFile.version || fileVersion + 1
    };
    setSaveStatus('saved');
    setPreviewingVersion(null);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-muted)'
      }}>
        Loading workspace...
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        gap: '12px'
      }}>
        <h2>File not found</h2>
        <Link href="/dashboard/all" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Active rendering data (preview version or current editing content)
  const activeDocContent = previewingVersion ? previewingVersion.doc_content : docContent;
  let activeCanvasData = canvasData;
  if (previewingVersion) {
    try {
      activeCanvasData = JSON.parse(previewingVersion.canvas_data || '{}');
    } catch (e) {
      activeCanvasData = { diagrams: [] };
    }
  }

  const diagrams = activeCanvasData?.diagrams || [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      <Head>
        <title>{file.title} – Glyph</title>
      </Head>

      {/* Editor Header Bar with Save Status & Version History */}
      <EditorHeader
        file={file}
        onTitleChange={handleTitleChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        isCodeDrawerOpen={isCodeDrawerOpen}
        onToggleCodeDrawer={() => setIsCodeDrawerOpen(!isCodeDrawerOpen)}
        diagramCount={diagrams.length}
        activeDiagramId={selectedDiagramId}
        saveStatus={saveStatus}
        onRetrySave={() => performSave()}
        onResolveConflict={() => setConflictModalOpen(true)}
        isVersionsOpen={isVersionsOpen}
        onToggleVersions={() => setIsVersionsOpen(!isVersionsOpen)}
        onOpenAIModal={() => setIsAIModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
      />

      {/* Version Preview Mode Banner (Read Only) */}
      {previewingVersion && (
        <div style={{
          height: '38px',
          backgroundColor: '#1E3A8A',
          color: '#BFDBFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          fontSize: '12px',
          fontWeight: 600,
          zIndex: 40,
          borderBottom: '1px solid #3B82F6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={15} />
            <span>
              Previewing Version: <strong>"{previewingVersion.name || 'Snapshot'}"</strong> ({new Date(previewingVersion.created_at).toLocaleTimeString()}) – Read-Only
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPreviewingVersion(null)}
              className="btn btn-secondary"
              style={{ height: '26px', fontSize: '11px', padding: '0 8px' }}
            >
              Exit Preview
            </button>
            <button
              onClick={() => handleRestoreSuccess({
                doc_content: previewingVersion.doc_content,
                canvas_data: previewingVersion.canvas_data,
                version: fileVersion + 1
              })}
              className="btn btn-primary"
              style={{ height: '26px', fontSize: '11px', padding: '0 10px', gap: '4px' }}
            >
              <RotateCcw size={12} />
              <span>Restore this Version</span>
            </button>
          </div>
        </div>
      )}

      {/* Resizable Editor Shell (Doc Pane + Canvas Pane) */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <ResizableSplit
          viewMode={viewMode}
          leftPane={
            <DocPane
              docContent={activeDocContent}
              onChange={previewingVersion ? () => {} : handleDocChange}
              fileTitle={file.title}
            />
          }
          rightPane={
            <CanvasPane
              canvasData={activeCanvasData}
              onChange={previewingVersion ? () => {} : handleCanvasChange}
              selectedDiagramId={selectedDiagramId}
              onSelectDiagram={(id) => {
                setSelectedDiagramId(id);
              }}
              onOpenCodeDrawer={() => setIsCodeDrawerOpen(true)}
            />
          }
        />

        {/* Diagram Code Drawer (Monaco bound to selected diagram) */}
        <CodeDrawer
          isOpen={isCodeDrawerOpen}
          onClose={() => setIsCodeDrawerOpen(false)}
          diagrams={diagrams}
          selectedDiagramId={selectedDiagramId}
          onSelectDiagram={setSelectedDiagramId}
          onCodeChange={previewingVersion ? () => {} : handleCodeChange}
        />

        {/* Version History Drawer (Step 6) */}
        <VersionHistoryDrawer
          isOpen={isVersionsOpen}
          onClose={() => setIsVersionsOpen(false)}
          fileId={file.id}
          currentVersion={fileVersion}
          onPreviewVersion={(ver) => setPreviewingVersion(ver)}
          onRestoreSuccess={handleRestoreSuccess}
        />
      </div>

      {/* Optimistic Concurrency Conflict Modal (409) */}
      {conflictModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{
            backgroundColor: '#1E222D',
            border: '1px solid #F59E0B',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
              <AlertTriangle size={20} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Concurrent Edit Conflict
              </h3>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              This file was updated in another browser tab or session while you were editing. 
              How would you like to resolve this conflict?
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              backgroundColor: 'rgba(0,0,0,0.2)',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px'
            }}>
              <div><strong>Reload:</strong> Discard your local pending edits and load the latest server version.</div>
              <div><strong>Overwrite:</strong> Force-save your local changes and overwrite the server version.</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={handleReloadServerVersion}
                className="btn btn-secondary"
                style={{ height: '32px', fontSize: '12px' }}
              >
                Reload Server Version
              </button>
              <button
                onClick={handleOverwriteServerVersion}
                className="btn btn-primary"
                style={{ height: '32px', fontSize: '12px', backgroundColor: '#F59E0B', borderColor: '#D97706' }}
              >
                Overwrite Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 7: Floating AI Edit Undo Notification */}
      {lastAIOperation && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1E293B',
          border: '1px solid #3B82F6',
          borderRadius: '9999px',
          padding: '8px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.6)',
          zIndex: 70,
          fontSize: '13px',
          color: '#F1F5F9'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={15} color="#60A5FA" />
            <span>AI modification applied</span>
          </div>
          <button
            onClick={handleUndoAIEdit}
            className="btn btn-primary"
            style={{ height: '26px', padding: '0 10px', fontSize: '11px', gap: '4px' }}
          >
            <RotateCcw size={12} />
            <span>Undo</span>
          </button>
          <button
            onClick={() => setLastAIOperation(null)}
            className="btn-icon"
            style={{ width: '22px', height: '22px' }}
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Step 7: AI Prompt Modal */}
      <AIPromptModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        selectedDiagram={diagrams.find(d => d.id === selectedDiagramId)}
        onApplyGeneratedCode={handleApplyAIGenerate}
        onApplyEditCode={handleApplyAIEdit}
        onUndoLastEdit={handleUndoAIEdit}
        canUndo={Boolean(lastAIOperation)}
      />

      {/* Step 8: Client-Side Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        file={file}
        canvasData={canvasData}
        selectedDiagramId={selectedDiagramId}
        docContent={docContent}
      />

      {/* Step 9: View-Only Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        fileId={file?.id}
        fileTitle={file?.title}
        diagrams={diagrams}
      />
    </div>
  );
}
