/**
 * Glyph Central API Client
 * Typed API client for all backend communication with the FastAPI service.
 */

import { parseDiagram } from '../engine/parser.js';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

export interface ApiResponse<T = any> {
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  [key: string]: any;
}

export interface FileItem {
  id: string;
  title: string;
  folder_id: string | null;
  doc_content: string;
  canvas_data: string;
  workspace_id: string;
  user_id: string;
  is_archived: number;
  created_at: number;
  updated_at: number;
  last_accessed_at: number;
}

export interface FolderItem {
  id: string;
  name: string;
  workspace_id: string;
  user_id: string;
  created_at: number;
  updated_at: number;
}

export interface FileVersionItem {
  id: string;
  file_id: string;
  version_number: number;
  label?: string;
  doc_content: string;
  canvas_data: string;
  created_at: number;
  created_by: string;
}

export interface ShareLinkItem {
  id: string;
  file_id: string;
  token: string;
  permission: 'view' | 'edit';
  created_at: number;
}

export interface IconItem {
  name: string;
  svgContent: string;
  created_at?: number;
}

export interface TemplateItem {
  id: string;
  title: string;
  description: string;
  diagramType: string;
  code: string;
}

export interface AIStreamEvent {
  event: 'progress' | 'completed' | 'error';
  data: {
    status?: string;
    message?: string;
    code?: string;
    diagramType?: string;
    provider?: string;
  };
}

async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const message = data?.error?.message || data?.detail || `HTTP Error ${res.status}`;
      const err = new Error(typeof message === 'object' ? JSON.stringify(message) : message) as any;
      err.status = res.status;
      err.data = data;
      err.isConflict = res.status === 409;
      throw err;
    }
    return data as T;
  } catch (err: any) {
    if (err.status !== 409) {
      console.error(`[API Client] Request to ${endpoint} failed:`, err.message || err);
    }
    throw err;
  }
}

/* ==========================================================================
   FILES API
   ========================================================================== */

export async function listFiles(params: {
  folderId?: string | null;
  search?: string;
  recents?: boolean;
  archived?: boolean;
} = {}): Promise<{ success: boolean; files: FileItem[] }> {
  const q = new URLSearchParams();
  if (params.folderId !== undefined) {
    q.set('folderId', params.folderId === null ? 'null' : params.folderId);
  }
  if (params.search && params.search.trim()) {
    q.set('search', params.search.trim());
  }
  if (params.recents) {
    q.set('recents', 'true');
  }
  if (params.archived) {
    q.set('archived', 'true');
  }

  const qs = q.toString();
  return apiRequest(`/files${qs ? `?${qs}` : ''}`);
}

export async function getFile(id: string): Promise<{ success: boolean; file: FileItem }> {
  return apiRequest(`/files/${encodeURIComponent(id)}`);
}

export async function createFile(data: {
  title?: string;
  folderId?: string | null;
  docContent?: string;
  canvasData?: string;
} = {}): Promise<{ success: boolean; file: FileItem }> {
  return apiRequest('/files', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export async function updateFile(
  id: string,
  updates: Record<string, any>
): Promise<{ success: boolean; file: FileItem }> {
  return apiRequest(`/files/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  });
}

export async function deleteFile(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/files/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export async function duplicateFile(id: string): Promise<{ success: boolean; file: FileItem }> {
  return apiRequest(`/files/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST'
  });
}

/* ==========================================================================
   FOLDERS API
   ========================================================================== */

export async function listFolders(): Promise<{ success: boolean; folders: FolderItem[] }> {
  return apiRequest('/folders');
}

export async function createFolder(name: string): Promise<{ success: boolean; folder: FolderItem }> {
  return apiRequest('/folders', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}

export async function renameFolder(id: string, name: string): Promise<{ success: boolean; folder: FolderItem }> {
  return apiRequest(`/folders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name })
  });
}

export async function deleteFolder(id: string): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/folders/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

/* ==========================================================================
   VERSIONS API (STEP 6)
   ========================================================================== */

export async function listVersions(
  fileId: string,
  page: number = 1,
  limit: number = 20
): Promise<{ success: boolean; versions: FileVersionItem[]; total: number; page: number; limit: number }> {
  return apiRequest(`/files/${encodeURIComponent(fileId)}/versions?page=${page}&limit=${limit}`);
}

export async function createNamedVersion(
  fileId: string,
  name?: string,
  note?: string
): Promise<{ success: boolean; version: FileVersionItem }> {
  return apiRequest(`/files/${encodeURIComponent(fileId)}/versions`, {
    method: 'POST',
    body: JSON.stringify({ name, note })
  });
}

export async function getVersion(
  fileId: string,
  versionId: string
): Promise<{ success: boolean; version: FileVersionItem }> {
  return apiRequest(`/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}`);
}

export async function restoreVersion(
  fileId: string,
  versionId: string
): Promise<{ success: boolean; restored_version_id: string; file: FileItem }> {
  return apiRequest(`/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/restore`, {
    method: 'POST'
  });
}

/* ==========================================================================
   SHARE API
   ========================================================================== */

export async function createShareLink(
  fileId: string,
  permission: 'view' | 'edit' = 'view'
): Promise<{ success: boolean; share: ShareLinkItem }> {
  return apiRequest('/share', {
    method: 'POST',
    body: JSON.stringify({ fileId, permission })
  });
}

export async function getShareLink(token: string): Promise<{ success: boolean; file: FileItem; permission: string }> {
  return apiRequest(`/share/${encodeURIComponent(token)}`);
}

/* ==========================================================================
   ICONS API
   ========================================================================== */

export async function listIcons(): Promise<{ success: boolean; icons: IconItem[] }> {
  return apiRequest('/icons');
}

export async function uploadIcon(
  name: string,
  svgContent: string
): Promise<{ success: boolean; icon: IconItem }> {
  return apiRequest('/icons', {
    method: 'POST',
    body: JSON.stringify({ name, svgContent })
  });
}

export async function getIcon(name: string): Promise<{ success: boolean; icon: IconItem }> {
  return apiRequest(`/icons/${encodeURIComponent(name)}`);
}

/* ==========================================================================
   TEMPLATES API
   ========================================================================== */

export async function listTemplates(): Promise<{ success: boolean; templates: TemplateItem[] }> {
  return apiRequest('/templates');
}

/* ==========================================================================
   AI GENERATION API (WITH BROWSER CLIENT-SIDE PARSER VALIDATION)
   ========================================================================== */

export async function streamAIGeneration({
  prompt,
  diagramType,
  code = '',
  retryError = undefined,
  signal,
  onProgress,
  onCompleted,
  onError,
  onValidationError
}: {
  prompt: string;
  diagramType?: string;
  code?: string;
  retryError?: string;
  signal?: AbortSignal;
  onProgress?: (info: { delta?: string; message?: string }) => void;
  onCompleted?: (result: { code: string; diagramType: string }) => void;
  onError?: (err: string) => void;
  onValidationError?: (info: { error: string; rawCode: string; diagramType: string }) => void;
}) {
  const url = `${API_BASE}/ai/generate/stream`;

  async function executeStream(retryErr?: string): Promise<void> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          prompt,
          diagramType: diagramType && diagramType !== 'auto' ? diagramType : undefined,
          code: code || undefined,
          retry_error: retryErr
        })
      });

      if (!res.ok) {
        throw new Error(`AI Streaming failed with HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Streaming response body is null');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let generatedCode = '';
      let resolvedDiagramType = diagramType || 'flowchart-diagram';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsedEvent: any = JSON.parse(line);
            const evtType = parsedEvent.event || parsedEvent.type;
            const data = parsedEvent.data || {};

            if (evtType === 'progress') {
              onProgress?.({
                delta: data.delta || '',
                message: data.message || ''
              });
            } else if (evtType === 'completed') {
              generatedCode = data.code || '';
              if (data.diagramType) {
                resolvedDiagramType = data.diagramType;
              }
            } else if (evtType === 'error') {
              throw new Error(data.message || 'AI Generation error');
            }
          } catch (e: any) {
            if (e.message && e.message.includes('AI Generation error') || e.message?.includes('AI API key')) {
              throw e;
            }
            console.warn('[AI Client] Failed to parse NDJSON line:', line, e);
          }
        }
      }

      // CLIENT-SIDE PARSER VALIDATION LOOP
      if (generatedCode) {
        const validation = parseDiagram(generatedCode, resolvedDiagramType);
        if (validation && validation.errors && validation.errors.length > 0) {
          const errString = validation.errors.map((e: any) => e.message || String(e)).join('; ');
          console.warn(`[AI Client] Generated code had parse errors: ${errString}`);
          
          if (!retryErr) {
            // First failure: retry once with retry_error
            onProgress?.({ message: `Repairing syntax error: ${errString.slice(0, 60)}...` });
            return await executeStream(errString);
          } else {
            // Second failure (single-retry limit reached): do NOT apply, pass to onValidationError
            console.error(`[AI Client] Validation failed after single retry limit: ${errString}`);
            onValidationError?.({
              error: errString,
              rawCode: generatedCode,
              diagramType: resolvedDiagramType
            });
            return;
          }
        }

        // Parse succeeded
        onCompleted?.({
          code: generatedCode,
          diagramType: resolvedDiagramType
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Cancelled by user
        return;
      }
      onError?.(err.message || String(err));
    }
  }

  await executeStream(retryError);
}
