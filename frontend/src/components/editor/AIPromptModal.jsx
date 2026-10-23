import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Loader2, 
  AlertCircle, 
  RefreshCw, 
  Check, 
  RotateCcw,
  Sliders,
  ChevronRight,
  Code
} from 'lucide-react';
import { streamAIGeneration } from '@/lib/api/client';

export default function AIPromptModal({
  isOpen,
  onClose,
  selectedDiagram,
  onApplyGeneratedCode,
  onApplyEditCode,
  onUndoLastEdit,
  canUndo = false
}) {
  const [prompt, setPrompt] = useState('');
  const [diagramType, setDiagramType] = useState('auto');
  const [mode, setMode] = useState(selectedDiagram ? 'edit' : 'generate'); // 'generate' | 'edit'
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [validationFailure, setValidationFailure] = useState(null);

  const abortControllerRef = useRef(null);

  useEffect(() => {
    if (selectedDiagram) {
      setMode('edit');
      setDiagramType(selectedDiagram.diagramType || 'auto');
    } else {
      setMode('generate');
      setDiagramType('auto');
    }
    setError(null);
    setValidationFailure(null);
    setStreamingText('');
    setStatusMessage('');
  }, [isOpen, selectedDiagram]);

  if (!isOpen) return null;

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStatusMessage('Cancelled');
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isStreaming) return;

    setError(null);
    setValidationFailure(null);
    setIsStreaming(true);
    setStreamingText('');
    setStatusMessage('Initiating generation...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const isEditMode = mode === 'edit' && selectedDiagram;
    const existingCode = isEditMode ? selectedDiagram.code : '';
    const previousCode = existingCode;

    await streamAIGeneration({
      prompt: prompt.trim(),
      diagramType: diagramType,
      code: existingCode,
      signal: controller.signal,
      onProgress: (info) => {
        if (info.message) setStatusMessage(info.message);
        if (info.delta) {
          setStreamingText(prev => prev + info.delta);
        }
      },
      onCompleted: (result) => {
        setIsStreaming(false);
        setStatusMessage('Complete');
        
        if (isEditMode) {
          onApplyEditCode?.(selectedDiagram.id, result.code, previousCode);
        } else {
          onApplyGeneratedCode?.(result.code, result.diagramType);
        }
        onClose();
      },
      onError: (err) => {
        setIsStreaming(false);
        setError(err);
      },
      onValidationError: ({ error: errString, rawCode, diagramType: resType }) => {
        setIsStreaming(false);
        setValidationFailure({
          error: errString,
          rawCode,
          diagramType: resType
        });
      }
    });
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
        maxWidth: '580px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
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
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Sparkles size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {mode === 'edit' ? 'Edit Diagram with AI' : 'Generate Diagram with AI'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                {mode === 'edit' 
                  ? `Modifying selected diagram (${selectedDiagram?.id || ''})`
                  : 'Creates a new diagram on your canvas'
                }
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Mode Switcher (if diagram is selected) */}
          {selectedDiagram && (
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface)',
              padding: '2px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}>
              <button
                type="button"
                onClick={() => setMode('edit')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  backgroundColor: mode === 'edit' ? 'var(--bg-card)' : 'transparent',
                  color: mode === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Edit Selected Diagram
              </button>
              <button
                type="button"
                onClick={() => setMode('generate')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-xs)',
                  border: 'none',
                  backgroundColor: mode === 'generate' ? 'var(--bg-card)' : 'transparent',
                  color: mode === 'generate' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Create New Diagram
              </button>
            </div>
          )}

          {/* Diagram Type Selector */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              Diagram Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {[
                { id: 'auto', label: 'Auto' },
                { id: 'flowchart-diagram', label: 'Flowchart' },
                { id: 'sequence-diagram', label: 'Sequence' },
                { id: 'entity-relationship-diagram', label: 'ERD' },
                { id: 'cloud-architecture-diagram', label: 'Cloud' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDiagramType(t.id)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: diagramType === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: diagramType === t.id ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                    color: diagramType === t.id ? '#93C5FD' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Textarea */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
              marginBottom: '6px'
            }}>
              {mode === 'edit' ? 'Describe changes to make' : 'Describe your diagram'}
            </label>
            <textarea
              id="ai-prompt-input"
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={mode === 'edit'
                ? "e.g., Add a Redis cache between API Gateway and AuthService, and change Database shape to cylinder [color: purple]"
                : "e.g., A microservices user signup flow with web client, API gateway, Cognito authentication, Lambda function, and DynamoDB"
              }
              disabled={isStreaming}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: '1.5',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '12px', color: '#FCA5A5' }}>
                <span style={{ fontWeight: 600 }}>Generation Error: </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Validation Failure Box (Shown if client parser fails after retry) */}
          {validationFailure && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="#F59E0B" />
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#FCD34D' }}>
                  Syntax validation failed after retry (not applied to canvas):
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#FDE68A', margin: 0 }}>
                {validationFailure.error}
              </p>
              <div style={{
                maxHeight: '120px',
                overflowY: 'auto',
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: '8px',
                borderRadius: 'var(--radius-xs)',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap'
              }}>
                {validationFailure.rawCode}
              </div>
            </div>
          )}

          {/* Live Streaming State Indicator */}
          {isStreaming && (
            <div style={{
              padding: '12px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={14} className="animate-spin" color="var(--accent-primary)" />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {statusMessage || 'Streaming tokens...'}
                </span>
              </div>
              {streamingText && (
                <div style={{
                  maxHeight: '100px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  whiteSpace: 'pre-wrap',
                  backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  padding: '6px 8px',
                  borderRadius: 'var(--radius-xs)'
                }}>
                  {streamingText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {canUndo ? (
            <button
              type="button"
              onClick={onUndoLastEdit}
              className="btn"
              style={{
                height: '32px',
                fontSize: '12px',
                gap: '6px',
                color: 'var(--text-secondary)'
              }}
              title="Undo last AI modification"
            >
              <RotateCcw size={13} />
              <span>Undo Last AI Edit</span>
            </button>
          ) : <div />}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isStreaming ? (
              <button
                type="button"
                onClick={handleCancel}
                className="btn"
                style={{
                  height: '32px',
                  padding: '0 14px',
                  fontSize: '12px',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#FCA5A5'
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="btn"
                style={{ height: '32px', padding: '0 14px', fontSize: '12px' }}
              >
                Close
              </button>
            )}

            <button
              id="btn-ai-generate-submit"
              type="button"
              onClick={handleGenerate}
              disabled={isStreaming || !prompt.trim()}
              className="btn btn-primary"
              style={{
                height: '32px',
                padding: '0 16px',
                fontSize: '12px',
                gap: '6px'
              }}
            >
              {isStreaming ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>{mode === 'edit' ? 'Apply Edit' : 'Generate'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
