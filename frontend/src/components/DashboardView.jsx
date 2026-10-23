import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import FileCard from './FileCard';
import { 
  CreateFileModal, 
  CreateFolderModal, 
  RenameModal, 
  MoveModal, 
  ConfirmDeleteModal 
} from './DashboardModals';
import TemplateGalleryModal from './TemplateGalleryModal';
import { 
  Search, 
  Plus, 
  Folder, 
  Edit2, 
  Trash2, 
  Sparkles,
  Grid,
  List as ListIcon,
  FolderPlus,
  LayoutTemplate
} from 'lucide-react';
import { 
  listFiles as apiListFiles, 
  createFile as apiCreateFile, 
  updateFile as apiUpdateFile, 
  deleteFile as apiDeleteFile, 
  duplicateFile as apiDuplicateFile, 
  listFolders as apiListFolders, 
  createFolder as apiCreateFolder, 
  renameFolder as apiRenameFolder, 
} from '@/lib/api/client';

export default function DashboardView({ 
  mode = 'all', 
  folderId = null 
}) {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [fileToRename, setFileToRename] = useState(null);
  const [fileToMove, setFileToMove] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [folderToRename, setFolderToRename] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

  // Fetch folders
  async function loadFolders() {
    try {
      const data = await apiListFolders();
      if (data.success) {
        setFolders(data.folders);
      }
    } catch (e) {
      console.error('Failed to load folders:', e);
    }
  }

  // Fetch files
  async function loadFiles() {
    setLoading(true);
    try {
      const data = await apiListFiles({
        folderId: folderId || undefined,
        search: searchQuery.trim(),
        recents: mode === 'recents'
      });
      if (data.success) {
        setFiles(data.files);
      }
    } catch (e) {
      console.error('Failed to load files:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    loadFiles();
  }, [mode, folderId, searchQuery]);

  // Actions
  async function handleCreateFile({ title, folderId: targetFolderId }) {
    try {
      const data = await apiCreateFile({ 
        title, 
        folderId: targetFolderId || folderId || null 
      });
      if (data.success && data.file) {
        setShowCreateFile(false);
        router.push(`/workspace/${data.file.id}`);
      }
    } catch (e) {
      console.error('Failed to create file:', e);
    }
  }

  async function handleCreateFolder(name) {
    try {
      const data = await apiCreateFolder(name);
      if (data.success) {
        setShowCreateFolder(false);
        loadFolders();
      }
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  }

  async function handleRenameFile(newTitle) {
    if (!fileToRename) return;
    try {
      await apiUpdateFile(fileToRename.id, { title: newTitle });
      setFileToRename(null);
      loadFiles();
    } catch (e) {
      console.error('Failed to rename file:', e);
    }
  }

  async function handleDuplicateFile(file) {
    try {
      const data = await apiDuplicateFile(file.id);
      if (data.success) {
        loadFiles();
      }
    } catch (e) {
      console.error('Failed to duplicate file:', e);
    }
  }

  async function handleMoveFile(targetFolderId) {
    if (!fileToMove) return;
    try {
      await apiUpdateFile(fileToMove.id, { folderId: targetFolderId });
      setFileToMove(null);
      loadFiles();
    } catch (e) {
      console.error('Failed to move file:', e);
    }
  }

  async function handleDeleteFile() {
    if (!fileToDelete) return;
    try {
      await apiDeleteFile(fileToDelete.id);
      setFileToDelete(null);
      loadFiles();
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  }

  async function handleRenameFolder(newName) {
    if (!folderToRename) return;
    try {
      await apiRenameFolder(folderToRename.id, newName);
      setFolderToRename(null);
      loadFolders();
    } catch (e) {
      console.error('Failed to rename folder:', e);
    }
  }

  async function handleDeleteFolder() {
    if (!folderToDelete) return;
    try {
      await apiDeleteFolder(folderToDelete.id);
      setFolderToDelete(null);
      loadFolders();
      if (folderId === folderToDelete.id) {
        router.push('/dashboard/all');
      }
    } catch (e) {
      console.error('Failed to delete folder:', e);
    }
  }

  const currentFolder = useMemo(() => {
    return folders.find(f => f.id === folderId);
  }, [folders, folderId]);

  const viewTitle = useMemo(() => {
    if (searchQuery.trim()) return `Search results for "${searchQuery}"`;
    if (folderId && currentFolder) return currentFolder.name;
    if (mode === 'recents') return 'Recent Files';
    return 'All Files';
  }, [searchQuery, folderId, currentFolder, mode]);

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <Sidebar 
        folders={folders}
        activeRoute={mode}
        currentFolderId={folderId}
        onNewFile={() => setShowCreateFile(true)}
        onNewFolder={() => setShowCreateFolder(true)}
        onOpenTemplateGallery={() => setShowTemplateGallery(true)}
      />

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)'
      }}>
        {/* Top Header Bar */}
        <header style={{
          height: '60px',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          flexShrink: 0
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            width: '320px',
            maxWidth: '100%'
          }}>
            <Search 
              size={16} 
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input 
              type="text"
              placeholder="Search files or diagrams..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '36px',
                height: '36px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)'
              }}
            />
          </div>

          {/* Quick Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              id="btn-open-template-gallery"
              onClick={() => setShowTemplateGallery(true)}
              className="btn btn-secondary"
              style={{ height: '36px', gap: '6px' }}
              title="Browse reference templates"
            >
              <LayoutTemplate size={15} color="#60A5FA" />
              <span>Templates</span>
            </button>

            <button 
              onClick={() => setShowCreateFile(true)}
              className="btn btn-primary"
              style={{ height: '36px' }}
            >
              <Plus size={16} />
              <span>Create</span>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 36px'
        }}>
          {/* Section Heading & Folder actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {folderId && <Folder size={22} color="#3B82F6" />}
              <h1 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}>
                {viewTitle}
              </h1>
            </div>

            {folderId && currentFolder && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={() => setFolderToRename(currentFolder)}
                  className="btn btn-secondary"
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  <Edit2 size={13} />
                  <span>Rename</span>
                </button>
                <button 
                  onClick={() => setFolderToDelete(currentFolder)}
                  className="btn btn-danger"
                  style={{ height: '32px', fontSize: '12px' }}
                >
                  <Trash2 size={13} />
                  <span>Delete Folder</span>
                </button>
              </div>
            )}
          </div>

          {/* Files Grid */}
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 0',
              color: 'var(--text-muted)',
              fontSize: '14px'
            }}>
              Loading files...
            </div>
          ) : files.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              border: '2px dashed var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: 'var(--bg-secondary)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <Sparkles size={24} color="#3B82F6" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {searchQuery ? 'No matching files found' : 'No diagrams or notes here yet'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px', marginBottom: '20px' }}>
                {searchQuery 
                  ? 'Try searching with different keywords or clear your search query.'
                  : 'Get started by creating a new document to write notes or design diagrams.'}
              </p>
              <button 
                onClick={() => setShowCreateFile(true)}
                className="btn btn-primary"
              >
                <Plus size={16} />
                <span>Create New File</span>
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '20px'
            }}>
              {files.map(file => (
                <FileCard
                  key={file.id}
                  file={file}
                  onRename={f => setFileToRename(f)}
                  onDuplicate={handleDuplicateFile}
                  onMove={f => setFileToMove(f)}
                  onDelete={f => setFileToDelete(f)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Reusable Modals */}
      <CreateFileModal
        isOpen={showCreateFile}
        onClose={() => setShowCreateFile(false)}
        onSubmit={handleCreateFile}
        folders={folders}
      />

      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onSubmit={handleCreateFolder}
      />

      <RenameModal
        isOpen={!!fileToRename}
        onClose={() => setFileToRename(null)}
        onSubmit={handleRenameFile}
        initialValue={fileToRename?.title || ''}
      />

      <RenameModal
        isOpen={!!folderToRename}
        onClose={() => setFolderToRename(null)}
        onSubmit={handleRenameFolder}
        initialValue={folderToRename?.name || ''}
      />

      <MoveModal
        isOpen={!!fileToMove}
        onClose={() => setFileToMove(null)}
        onSubmit={handleMoveFile}
        folders={folders}
        currentFolderId={fileToMove?.folder_id}
      />

      <ConfirmDeleteModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleDeleteFile}
        itemName={fileToDelete?.title || 'this file'}
      />

      <ConfirmDeleteModal
        isOpen={!!folderToDelete}
        onClose={() => setFolderToDelete(null)}
        onConfirm={handleDeleteFolder}
        itemName={`folder "${folderToDelete?.name}"`}
      />

      <TemplateGalleryModal
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
      />
    </div>
  );
}
