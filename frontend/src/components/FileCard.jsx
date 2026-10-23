import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  FileText, 
  MoreVertical, 
  Copy, 
  Edit3, 
  FolderInput, 
  Trash2,
  ExternalLink,
  Code2
} from 'lucide-react';

export function timeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function FileCard({ 
  file, 
  onRename, 
  onDuplicate, 
  onMove, 
  onDelete 
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div style={{
      position: 'relative',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      height: '190px'
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = 'var(--border-focus)';
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = 'var(--shadow-md)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = 'var(--border-subtle)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Clickable Card Body */}
      <Link 
        href={`/workspace/${file.id}`}
        style={{
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '70px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--border-medium)',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Code2 size={20} color="#3B82F6" />
            <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Diagram & Notes
            </span>
          </div>
        </div>

        <div>
          <h3 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '4px'
          }}>
            {file.title || 'Untitled'}
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Updated {timeAgo(file.updated_at)}
          </span>
        </div>
      </Link>

      {/* Action Menu Button */}
      <div 
        ref={menuRef}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px'
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="btn-icon"
          title="More options"
          style={{
            backgroundColor: 'rgba(26, 26, 30, 0.8)',
            backdropFilter: 'blur(4px)',
            width: '28px',
            height: '28px'
          }}
        >
          <MoreVertical size={15} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute',
            top: '32px',
            right: '0',
            width: '160px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 100,
            overflow: 'hidden',
            padding: '4px'
          }}>
            <button
              onClick={() => {
                setMenuOpen(false);
                onRename(file);
              }}
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Edit3 size={13} />
              <span>Rename</span>
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                onDuplicate(file);
              }}
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Copy size={13} />
              <span>Duplicate</span>
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                onMove(file);
              }}
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <FolderInput size={13} />
              <span>Move to Folder</span>
            </button>

            <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

            <button
              onClick={() => {
                setMenuOpen(false);
                onDelete(file);
              }}
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                fontSize: '12px',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--danger)'
              }}
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
