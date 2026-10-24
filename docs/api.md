# Glyph API Specification

This document details the backend REST and Streaming API endpoints implemented in Glyph (FastAPI backend mounted at prefix `/api/v1`). It aligns the observed upstream Eraser behavior documented in `docs/recon.md` with the local implementation.

---

## 1. AI Diagram Generation & Editing

### Endpoint Path
- **Active Route**: `POST /api/v1/ai/generate/stream`
- **Recon Upstream Reference**: `POST /api/playground/diagram/stream`

### Transport & Headers
- **HTTP Method**: `POST`
- **Content-Type**: `application/json`
- **Response Media Type**: `application/x-ndjson` (New-line Delimited JSON streaming)

### Request Payload (`AIGenerateRequest`)
```json
{
  "prompt": "Host a secure web app with CloudFront, S3 static assets, and an API Gateway to Lambda",
  "diagramType": "cloud-architecture-diagram",
  "code": "",
  "retry_error": ""
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `prompt` | `string` (required) | Prompt description of the desired diagram or edit instruction (capped at `AI_MAX_PROMPT_LENGTH = 4000`). |
| `diagramType` | `string` (optional) | Target diagram classification: `flowchart-diagram`, `cloud-architecture-diagram`, `sequence-diagram`, `erd-diagram`, or `auto`. |
| `code` | `string` (optional) | Existing diagram code when operating in **Edit Mode**. When provided, the prompt instructs the model to perform surgical edits on existing nodes and connections. |
| `retry_error` | `string` (optional) | Client-side parser error message passed during the automatic single-retry self-repair loop. |

### Streaming Event Protocol (NDJSON)
The response stream yields line-delimited JSON objects. Each object provides both an `event` and `type` discriminator:

#### 1. Progress Event (`event: "progress"`)
Emitted on start and as tokens stream from the LLM provider:
```json
{"event": "progress", "type": "progress", "data": {"status": "in_progress", "delta": "CloudFront > S3", "message": "Generating diagram specification..."}}
```

#### 2. Completed Event (`event: "completed"`)
Emitted when the stream finishes. Server-side fences (e.g. ```` ```diagram ````) are stripped cleanly before this event is dispatched:
```json
{"event": "completed", "type": "completed", "data": {"status": "completed", "code": "title Web App Architecture\ndirection right\n\nCloudFront > S3: Static Assets\nCloudFront > APIGateway: API Requests", "diagramType": "cloud-architecture-diagram"}}
```

#### 3. Error Event (`event: "error"`)
Emitted when configuration errors occur (e.g., missing API key, prompt length exceeded) or upstream provider issues arise:
```json
{"event": "error", "type": "error", "data": {"status": "error", "message": "AI API key is missing. Please configure AI_API_KEY in the backend environment."}}
```

---

## 2. Document & File Management

### `POST /api/v1/files`
Create a new file in a workspace or folder.
- **Request**: `{ "title": "My Diagram", "folderId"?: string, "docContent"?: string, "canvasData"?: string }`
- **Response**: `{ "success": true, "file": FileItem }`

### `GET /api/v1/files/{file_id}`
Retrieve a file's metadata, markdown notes (`doc_content`), and canvas diagrams (`canvas_data`).
- **Response**: `{ "success": true, "file": FileItem }`

### `PATCH /api/v1/files/{file_id}`
Autosave or update file content. Supports optimistic concurrency protection via `expected_version`.
- **Request**: `{ "title"?: string, "docContent"?: string, "canvasData"?: string, "expected_version"?: number, "force"?: boolean }`
- **Response**:
  - `200 OK`: `{ "success": true, "file": FileItem }` (returns incremented version)
  - `409 Conflict`: `{ "error": { "code": "VERSION_CONFLICT", "message": "Stale write detected", "server_version": number, "server_file": FileItem } }`

### `DELETE /api/v1/files/{file_id}`
Delete a file from the workspace.
- **Response**: `{ "success": true }`

### `POST /api/v1/files/{file_id}/duplicate`
Duplicate a file and its canvas diagrams.
- **Response**: `{ "success": true, "file": FileItem }`

---

## 3. Folder Management

### `POST /api/v1/folders`
Create a new folder.
- **Request**: `{ "name": "Architecture Specs", "parentId"?: string }`
- **Response**: `{ "success": true, "folder": FolderItem }`

### `GET /api/v1/folders`
List all folders in the workspace.
- **Response**: `{ "success": true, "folders": FolderItem[] }`

### `PATCH /api/v1/folders/{folder_id}`
Rename or move a folder.
- **Request**: `{ "name"?: string, "parentId"?: string }`
- **Response**: `{ "success": true, "folder": FolderItem }`

### `DELETE /api/v1/folders/{folder_id}`
Delete a folder and unnest child documents.
- **Response**: `{ "success": true }`

---

## 4. Version History & Restore

### `POST /api/v1/files/{file_id}/versions`
Create a manual or automatic version snapshot.
- **Request**: `{ "name"?: string, "note"?: string, "is_auto"?: boolean }`
- **Response**: `{ "success": true, "version": VersionItem }`

### `GET /api/v1/files/{file_id}/versions`
List version snapshots with pagination.
- **Query Params**: `?page=1&limit=20`
- **Response**: `{ "success": true, "versions": VersionItem[], "total": number, "page": number, "limit": number }`

### `POST /api/v1/files/{file_id}/versions/{version_id}/restore`
Restore a historical snapshot. Automatically creates a safety backup of current state before applying.
- **Response**: `{ "success": true, "restored_version_id": string, "file": FileItem }`

---

## 5. View-Only Sharing

### `POST /api/v1/share`
Create or retrieve an unguessable view-only link for a document.
- **Request**: `{ "fileId": string, "targetDiagramId"?: string, "targetFigureId"?: string, "targetElements"?: string[] }`
- **Response**: `{ "success": true, "share": ShareLinkItem, "shareUrl": string }`

### `GET /api/v1/share/file/{file_id}`
Retrieve the active share link for a file if one exists.
- **Response**: `{ "success": true, "share": ShareLinkItem }`

### `GET /api/v1/share/{share_id}`
Public view-only endpoint. Requires no login. Returns only the single shared document.
- **Query Params**: `?diagram=...`, `?figure=...`, `?elements=...` (allows link recipients to target specific diagram figures or elements).
- **Response**: `{ "success": true, "share": ShareLinkItem, "file": SharedFileItem }`
- **Errors**: `404 Not Found` if the link does not exist or was revoked.

### `DELETE /api/v1/share/{share_id}`
Revoke an active share link immediately.
- **Response**: `{ "success": true, "message": "Share link revoked" }`

---

## 6. Custom Icons

### `POST /api/v1/icons`
Upload a new custom SVG icon. Sanitized against scripts, foreign objects, and remote references.
- **Request**: `{ "name": "k8s-pod", "svgContent": "<svg>...</svg>" }`
- **Response**: `{ "success": true, "icon": IconItem }`

### `GET /api/v1/icons`
List custom icons available in the workspace.
- **Response**: `{ "success": true, "icons": IconItem[] }`

### `GET /api/v1/icons/{icon_id_or_name}/raw`
Serve the raw SVG icon directly with strict security headers:
- `Content-Type: image/svg+xml`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox`

### `PATCH /api/v1/icons/{icon_id}`
Rename a custom icon.
- **Request**: `{ "name": "new-icon-name" }`
- **Response**: `{ "success": true, "icon": IconItem }`

### `DELETE /api/v1/icons/{icon_id}`
Delete a custom icon.
- **Response**: `{ "success": true }`

---

## 7. Template Gallery

### `GET /api/v1/templates`
List all seeded reference templates.
- **Query Params**: `?category=Flowchart` (or `Sequence`, `ERD`, `Cloud Architecture`, `All`)
- **Response**: `{ "success": true, "templates": TemplateItem[] }`

### `GET /api/v1/templates/{template_id}`
Retrieve full details of a specific template including diagram code and category notes.
- **Response**: `{ "success": true, "template": TemplateItem }`
