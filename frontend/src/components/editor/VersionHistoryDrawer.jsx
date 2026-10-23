import React, { useState, useEffect } from 'react';
import { 
  X, 
  History, 
  RotateCcw, 
  Bookmark, 
  Clock, 
  Check, 
  AlertCircle, 
  Eye, 
  Plus, 
  Sparkles 
} from 'lucide-react';
import { listVersions, createNamedVersion, restoreVersion } from '../../lib/api/client';

export default function VersionHistoryDrawer({
  isOpen,
  onClose,
  fileId,
  currentVersion,
  onPreviewVersion,
  onRestoreSuccess
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [confirmRestoreVersion, setConfirmRestoreVersion] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchVersions = async () => {
    if (!fileId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await listVersions(fileId, 1, 50);
      if (res.success) {
        setVersions(res.versions || []);
      }
    } catch (err) {
      console.error('Failed to load version history:', err);
      setErrorMsg('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fileId]);

  const handleCreateNamedVersion = async (e) => {
    e.preventDefault();
    if (savingVersion) return;
    setSavingVersion(true);
    setErrorMsg(null);
    try {
      const name = newVersionName.trim() || undefined;
      const res = await createNamedVersion(fileId, name);
      if (res.success) {
        setNewVersionName('');
        await fetchVersions();
      }
    } catch (err) {
      console.error('Failed to create named version:', err);
      setErrorMsg('Failed to create snapshot');
    } finally {
      setSavingVersion(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreVersion) return;
    setRestoringId(confirmRestoreVersion.id);
    setErrorMsg(null);
    try {
      const res = await restoreVersion(fileId, confirmRestoreVersion.id);
      if (res.success && res.file) {
        onRestoreSuccess(res.file);
        setConfirmRestoreVersion(null);
        await fetchVersions();
      }
    } catch (err) {
      console.error('Failed to restore version:', err);
      setErrorMsg('Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: '360px',
      backgroundColor: '#181A20',
      borderLeft: '1px solid var(--border-medium)',
      boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 60,
      animation: 'slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Header */}
      <div style={{
        height: '52px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: '#131418'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60A5FA' }}>
          <History size={17} />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em' }}>
            VERSION HISTORY
          </span>
        </div>
        <button 
          onClick={onClose}
          className="btn-icon"
          title="Close Version History"
          style={{ width: '28px', height: '28px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Manual Save Snapshot Section */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      }}>
        <form onSubmit={handleCreateNamedVersion} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            placeholder="Version name (optional)..."
            style={{
              flex: 1,
              height: '30px',
              fontSize: '12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 8px',
              color: 'var(--text-primary)'
            }}
          />
          <button
            type="submit"
            disabled={savingVersion}
            className="btn btn-primary"
            style={{ height: '30px', fontSize: '11px', padding: '0 10px', gap: '4px' }}
          >
            <Bookmark size={13} />
            <span>{savingVersion ? 'Saving...' : 'Save'}</span>
          </button>
        </form>
      </div>

      {errorMsg && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#FCA5A5',
          fontSize: '12px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Versions List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '24px 0' }}>
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '24px 0' }}>
            No versions saved yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {versions.map((ver) => {
              const dateStr = new Date(ver.created_at).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={ver.id}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ver.name || 'Snapshot'}
                      </span>
                      {ver.is_auto ? (
                        <span style={{
                          fontSize: '9px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          backgroundColor: 'rgba(148, 163, 184, 0.15)',
                          color: '#94A3B8',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          Auto
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '9px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          backgroundColor: 'var(--accent-subtle)',
                          color: '#60A5FA',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          Named
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <Clock size={11} />
                    <span>{dateStr}</span>
                  </div>

                  {ver.note && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {ver.note}
                    </div>
                  )}

                  {/* Actions: Preview & Restore */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => onPreviewVersion(ver)}
                      className="btn btn-secondary"
                      style={{ height: '24px', fontSize: '11px', padding: '0 8px', gap: '4px', flex: 1 }}
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => setConfirmRestoreVersion(ver)}
                      className="btn btn-secondary"
                      style={{ height: '24px', fontSize: '11px', padding: '0 8px', gap: '4px', color: '#60A5FA' }}
                    >
                      <RotateCcw size={12} />
                      <span>Restore</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Restore */}
      {confirmRestoreVersion && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 70
        }}>
          <div style={{
            backgroundColor: '#1E222D',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px',
            width: '100%',
            maxWidth: '300px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Restore Version?
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Restore to <strong>"{confirmRestoreVersion.name || 'this version'}"</strong>? 
              A backup snapshot of your current state will be created automatically before restoring.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => setConfirmRestoreVersion(null)}
                className="btn btn-secondary"
                style={{ height: '28px', fontSize: '11px' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={!!restoringId}
                className="btn btn-primary"
                style={{ height: '28px', fontSize: '11px' }}
              >
                {restoringId ? 'Restoring...' : 'Confirm Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
