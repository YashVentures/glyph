import React, { useState, useEffect } from 'react';
import { X, Folder, AlertTriangle } from 'lucide-react';

export function CreateFileModal({ isOpen, onClose, onSubmit, folders = [] }) {
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setFolderId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create New File</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (title.trim()) {
            onSubmit({ title: title.trim(), folderId: folderId || null });
          }
        }}>
          <div className="modal-body">
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                File Title
              </label>
              <input 
                type="text"
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Authentication Flow"
                style={{ width: '100%' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                Folder (Optional)
              </label>
              <select
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">No Folder (Root)</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Create File</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CreateFolderModal({ isOpen, onClose, onSubmit }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) setName('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">New Folder</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}>
          <div className="modal-body">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Folder Name
            </label>
            <input 
              type="text"
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Architecture Diagrams"
              style={{ width: '100%' }}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Create Folder</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RenameModal({ isOpen, onClose, onSubmit, initialValue = '' }) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Rename</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}>
          <div className="modal-body">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Name
            </label>
            <input 
              type="text"
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value)}
              style={{ width: '100%' }}
              required
            />
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MoveModal({ isOpen, onClose, onSubmit, folders = [], currentFolderId = null }) {
  const [selectedFolderId, setSelectedFolderId] = useState(currentFolderId || '');

  useEffect(() => {
    if (isOpen) setSelectedFolderId(currentFolderId || '');
  }, [isOpen, currentFolderId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Move to Folder</h2>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          onSubmit(selectedFolderId || null);
        }}>
          <div className="modal-body">
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
              Select Destination Folder
            </label>
            <select
              value={selectedFolderId}
              onChange={e => setSelectedFolderId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Root (No Folder)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Move File</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, itemName = 'this file' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <AlertTriangle size={20} />
            <h2 className="modal-title" style={{ color: 'var(--danger)' }}>Delete Confirmation</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Are you sure you want to permanently delete <strong>{itemName}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="button" onClick={onConfirm} className="btn btn-danger">Delete</button>
        </div>
      </div>
    </div>
  );
}
