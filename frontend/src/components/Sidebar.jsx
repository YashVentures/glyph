import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  FileText, 
  Clock, 
  Folder, 
  Plus, 
  Search, 
  Trash2, 
  ChevronRight, 
  FolderPlus,
  LayoutGrid,
  Sparkles,
  LayoutTemplate
} from 'lucide-react';

export default function Sidebar({ 
  folders = [], 
  onNewFile, 
  onNewFolder, 
  onOpenTemplateGallery,
  activeRoute = 'all',
  currentFolderId = null 
}) {
  const router = useRouter();

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none'
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <Link href="/dashboard/all" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 700,
          fontSize: '18px',
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)'
        }}>
          {/* Custom SVG Glyph Logo */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#3B82F6" fillOpacity="0.2"/>
            <path d="M7 6L17 6M7 12L17 12M7 18L13 18" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16.5" cy="18" r="2" fill="#10B981" />
          </svg>
          <span>glyph</span>
        </Link>

        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border-subtle)'
        }}>
          LOCAL
        </span>
      </div>

      {/* Primary Action Button */}
      <div style={{ padding: '16px 16px 8px 16px' }}>
        <button 
          onClick={onNewFile}
          className="btn btn-primary"
          style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-md)' }}
        >
          <Plus size={16} />
          <span>New File</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <Link 
            href="/dashboard/all"
            className={`btn-ghost ${activeRoute === 'all' && !currentFolderId ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: activeRoute === 'all' && !currentFolderId ? 'var(--bg-active)' : 'transparent',
              color: activeRoute === 'all' && !currentFolderId ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            <LayoutGrid size={16} />
            <span>All Files</span>
          </Link>

          <Link 
            href="/dashboard/recents"
            className={`btn-ghost ${activeRoute === 'recents' ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: activeRoute === 'recents' ? 'var(--bg-active)' : 'transparent',
              color: activeRoute === 'recents' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            <Clock size={16} />
            <span>Recents</span>
          </Link>

          {onOpenTemplateGallery && (
            <button
              onClick={onOpenTemplateGallery}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 500,
                width: '100%',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <LayoutTemplate size={16} color="#60A5FA" />
              <span>Templates</span>
            </button>
          )}
        </div>

        {/* Folders Section */}
        <div style={{ marginTop: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)'
          }}>
            <span>Folders</span>
            <button 
              onClick={onNewFolder}
              className="btn-icon"
              title="Create Folder"
              style={{ width: '20px', height: '20px' }}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
            {folders.length === 0 ? (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                padding: '8px 12px',
                fontStyle: 'italic'
              }}>
                No folders yet
              </div>
            ) : (
              folders.map(folder => {
                const isSelected = currentFolderId === folder.id;
                return (
                  <Link
                    key={folder.id}
                    href={`/dashboard/folder/${folder.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '7px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <Folder size={15} color={isSelected ? '#3B82F6' : 'currentColor'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.name}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer / Default Workspace context */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#3B82F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          G
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Default Workspace
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Single user mode
          </span>
        </div>
      </div>
    </aside>
  );
}
