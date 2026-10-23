import React, { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Trash2, 
  ExternalLink, 
  Lock, 
  Globe, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { createShareLink, getShareLinkForFile, revokeShareLink } from '../../lib/api/client';

export default function ShareModal({
  isOpen,
  onClose,
  fileId,
  fileTitle = 'Untitled',
  diagrams = []
}) {
  const [loading, setLoading] = useState(false);
  const [activeShare, setActiveShare] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [targetDiagramId, setTargetDiagramId] = useState('');
  const [error, setError] = useState(null);

  // Fetch current share status when modal opens
  useEffect(() => {
    if (!isOpen || !fileId) return;
    setLoading(true);
    setError(null);
    setCopied(false);

    getShareLinkForFile(fileId)
      .then(res => {
        if (res.success && res.share) {
          setActiveShare(res.share);
          const origin = typeof window !== 'undefined' ? window.location.origin : '';
          setShareUrl(`${origin}${res.shareUrl}`);
        } else {
          setActiveShare(null);
          setShareUrl('');
        }
      })
      .catch(err => {
        console.error('Failed to load share link:', err);
        setError('Failed to check share status.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, fileId]);

  if (!isOpen) return null;

  const handleCreateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createShareLink({
        fileId,
        targetDiagramId: targetDiagramId || undefined
      });
      if (res.success && res.share) {
        setActiveShare(res.share);
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setShareUrl(`${origin}${res.shareUrl}`);
      }
    } catch (err) {
      console.error('Failed to create share link:', err);
      setError('Failed to create share link.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!activeShare) return;
    setLoading(true);
    setError(null);
    try {
      await revokeShareLink(activeShare.id);
      setActiveShare(null);
      setShareUrl('');
      setCopied(false);
    } catch (err) {
      console.error('Failed to revoke share link:', err);
      setError('Failed to revoke link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1E222D',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60A5FA'
            }}>
              <Share2 size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Share View-Only Link
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                {fileTitle}
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

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#F87171',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Access Mode Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--bg-surface)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Globe size={18} color="#10B981" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Public View Access
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Anyone with this link can view this document and canvas without logging in. All edit routes, code modifying, and autosave calls are strictly disabled.
              </div>
            </div>
          </div>

          {/* Target Diagram Option */}
          {diagrams && diagrams.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Target Diagram (Optional)
              </label>
              <select
                value={targetDiagramId}
                onChange={e => setTargetDiagramId(e.target.value)}
                style={{
                  height: '34px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0 10px',
                  fontSize: '12px'
                }}
              >
                <option value="">Full Document & All Diagrams</option>
                {diagrams.map(d => (
                  <option key={d.id} value={d.id}>
                    Diagram {d.id} ({d.diagramType || 'diagram'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Share Link Display or Generate Button */}
          {activeShare && shareUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Active Public Link
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    height: '36px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)'
                  }}
                />
                <button
                  id="btn-copy-share-link"
                  onClick={handleCopy}
                  className="btn btn-primary"
                  style={{ height: '36px', padding: '0 14px', gap: '6px', fontSize: '12px' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ height: '36px', padding: '0 10px' }}
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>

              {/* Revoke button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  id="btn-revoke-share-link"
                  onClick={handleRevokeLink}
                  disabled={loading}
                  className="btn"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    color: '#F87171',
                    fontSize: '12px',
                    height: '30px',
                    gap: '6px',
                    padding: '0 12px'
                  }}
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  <span>Revoke Link</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              padding: '24px 0'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                No active share link for this file. Create a cryptographically secure view-only link.
              </p>
              <button
                id="btn-generate-share-link"
                onClick={handleCreateLink}
                disabled={loading}
                className="btn btn-primary"
                style={{ height: '36px', padding: '0 18px', gap: '8px', fontSize: '13px' }}
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                <span>Create Public View Link</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
