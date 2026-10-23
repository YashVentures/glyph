import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Edit2, 
  Check, 
  Smile, 
  AlertCircle, 
  Loader2,
  FileCode,
  Tag
} from 'lucide-react';
import { listIcons, uploadIcon, renameIcon, deleteIcon } from '../../lib/api/client';
import { setCustomIcons } from '../../lib/engine/constants';

export default function CustomIconModal({
  isOpen,
  onClose,
  onIconsUpdated
}) {
  const [icons, setIcons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form upload state
  const [name, setName] = useState('');
  const [svgContent, setSvgContent] = useState('');
  const [uploading, setUploading] = useState(false);

  // Rename state
  const [editingId, setEditingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const fileInputRef = useRef(null);

  const fetchIcons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listIcons();
      if (res.success && res.icons) {
        setIcons(res.icons);
        setCustomIcons(res.icons);
        onIconsUpdated?.(res.icons);
      }
    } catch (err) {
      console.error('Failed to load custom icons:', err);
      setError('Failed to load icons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchIcons();
      setName('');
      setSvgContent('');
      setEditingId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle local SVG file read
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError('SVG file exceeds maximum allowed size of 1MB.');
      return;
    }

    if (!name.trim()) {
      // Auto-populate name from filename
      const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      setName(baseName);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setSvgContent(content);
      }
    };
    reader.readAsText(file);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !svgContent.trim()) {
      setError('Please provide an icon name and SVG content.');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const res = await uploadIcon(name.trim(), svgContent.trim());
      if (res.success) {
        setName('');
        setSvgContent('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        await fetchIcons();
      }
    } catch (err) {
      console.error('Failed to upload icon:', err);
      setError(err?.data?.error?.message || err?.message || 'Failed to upload icon.');
    } finally {
      setUploading(false);
    }
  };

  const handleStartRename = (icon) => {
    setEditingId(icon.id);
    setRenameValue(icon.name);
  };

  const handleSaveRename = async (iconId) => {
    if (!renameValue.trim()) return;
    try {
      const res = await renameIcon(iconId, renameValue.trim());
      if (res.success) {
        setEditingId(null);
        await fetchIcons();
      }
    } catch (err) {
      console.error('Failed to rename icon:', err);
      setError('Failed to rename icon.');
    }
  };

  const handleDelete = async (iconId) => {
    try {
      const res = await deleteIcon(iconId);
      if (res.success) {
        await fetchIcons();
      }
    } catch (err) {
      console.error('Failed to delete icon:', err);
      setError('Failed to delete icon.');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1E222D',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        boxShadow: '0 20px 45px rgba(0,0,0,0.7)',
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
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F59E0B'
            }}>
              <Smile size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Custom Icons Manager
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                Upload sanitized SVGs (max 1MB). Usable in diagram code as [icon: name].
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '28px', height: '28px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

          {/* Upload Form */}
          <form onSubmit={handleUploadSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'var(--bg-surface)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Upload New Custom Icon
            </span>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Icon name (e.g. redis, stripe, my-logo)"
                style={{
                  flex: 1,
                  height: '34px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0 10px',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
              />
              <label className="btn btn-secondary" style={{ height: '34px', padding: '0 12px', fontSize: '12px', cursor: 'pointer', gap: '6px' }}>
                <Upload size={14} />
                <span>Select SVG</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {svgContent && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '4px' }}>
                <div 
                  dangerouslySetInnerHTML={{ __html: svgContent }} 
                  style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  SVG loaded ({Math.round(svgContent.length / 1024 * 10) / 10} KB)
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="submit"
                disabled={uploading || !name.trim() || !svgContent.trim()}
                className="btn btn-primary"
                style={{ height: '32px', padding: '0 14px', fontSize: '12px', gap: '6px' }}
              >
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                <span>Upload & Sanitize Icon</span>
              </button>
            </div>
          </form>

          {/* List of Custom Icons */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                Uploaded Custom Icons ({icons.length})
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Collision Rule: Custom icons take precedence over bundled icons
              </span>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Loader2 size={16} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                <span>Loading workspace icons...</span>
              </div>
            ) : icons.length === 0 ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '12px'
              }}>
                No custom icons uploaded yet. Upload your first SVG above!
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '10px'
              }}>
                {icons.map(ic => (
                  <div
                    key={ic.id}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{
                      height: '48px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '4px'
                    }}>
                      <div 
                        dangerouslySetInnerHTML={{ __html: ic.svg_content }}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      />
                    </div>

                    {editingId === ic.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(ic.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          style={{
                            flex: 1,
                            height: '24px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid #3B82F6',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            padding: '0 6px',
                            borderRadius: '3px'
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(ic.id)}
                          className="btn-icon"
                          style={{ width: '24px', height: '24px', color: '#10B981' }}
                          title="Save"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ic.name}
                        </span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            onClick={() => handleStartRename(ic)}
                            className="btn-icon"
                            style={{ width: '22px', height: '22px' }}
                            title="Rename icon"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            onClick={() => handleDelete(ic.id)}
                            className="btn-icon"
                            style={{ width: '22px', height: '22px', color: '#EF4444' }}
                            title="Delete icon"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
