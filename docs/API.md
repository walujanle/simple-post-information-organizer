# API Reference

All endpoints are under `/api`. Auth uses an HttpOnly JWT cookie (4 h, HS256, bcrypt-hashed passwords). Cloud-store routes return `401` without a valid session.

## Health

### GET /api/health

Reports database connectivity. No auth required.

**Response** `200`:
```json
{ "status": "ok", "version": "0.0.1" }
```

`status` values: `"ok"` | `"unavailable"` | `"error"`

`version` is read from `package.json` at build time. The database driver is
deliberately **not** returned — see [SECURITY.md](SECURITY.md)..

---

## Authentication

### POST /api/auth/register

Create a new account. Rate-limited: 5 requests / min / IP.

**Body**:
```json
{ "username": "string (3–64 chars)", "password": "string (min 6 chars)" }
```

**Response** `200`:
```json
{ "status": "ok", "message": "Account created successfully." }
```

**Errors**: `400` — validation failure or duplicate username (generic message to prevent enumeration). `429` — rate limited.

### POST /api/auth/login

Authenticate and receive a session cookie. Rate-limited: 5 requests / min / IP.

**Body**:
```json
{ "username": "string", "password": "string" }
```

**Response** `200`:
```json
{ "status": "ok", "user": { "username": "string" } }
```

Sets `session` cookie: `HttpOnly; SameSite=Lax; Path=/; Max-Age=14400` (4 hours, matching the JWT `exp`). The `Secure` flag is added when `NODE_ENV=production` or the request host is not `localhost`.

**Errors**: `400` (missing fields), `401` (invalid credentials), `429` (rate limited).

### POST /api/auth/logout

Clear the session cookie and invalidate the server-side session cache entry.

**Response** `200`:
```json
{ "status": "ok" }
```

### GET /api/auth/session

Check current authentication status.

**Response** `200` (authenticated):
```json
{ "isAuthenticated": true, "user": { "username": "string" } }
```

**Response** `200` (unauthenticated):
```json
{ "isAuthenticated": false }
```

### POST /api/auth/change-password

Change password. Requires valid session. Rate-limited: 5 requests / min / IP.

**Body**:
```json
{ "currentPassword": "string", "newPassword": "string (min 6 chars)" }
```

**Response** `200`:
```json
{ "status": "ok", "message": "Password changed successfully." }
```

**Errors**: `400` (incorrect current password or validation), `401` (no session), `429` (rate limited).

---

## Presets

All preset endpoints require a valid session cookie.

### GET /api/presets

List all presets for the authenticated user (metadata only).

**Response** `200` — `PresetMeta[]`:
```json
[{ "id": "string", "name": "string", "updatedAt": "ISO string", "sectionKeys": ["string"] }]
```

### POST /api/presets

Create a new preset. Body limit: 1 MB.

**Body**: `Preset` shape.

**Response** `201`: The created `Preset`.

**Errors**: `400` (validation), `413` (payload too large).

### GET /api/presets/:id

Get a single preset by ID.

**Response** `200`: `Preset`. `404`: not found.

### PUT /api/presets/:id

Update an existing preset. Body limit: 1 MB.

**Body**: `Preset` shape.

**Response** `200`: The updated `Preset`.

**Errors**: `400` (validation), `404` (not found), `413` (payload too large).

### DELETE /api/presets/:id

Delete a preset.

**Response** `204`: No content.

---

## Export / Import

### GET /api/export

Export all presets for the authenticated user as a portable bundle.

**Response** `200`:
```json
{
  "pioExportVersion": 1,
  "source": "cloud",
  "exportedAt": "ISO string",
  "presets": [Preset]
}
```

### POST /api/import?mode=merge|replace

Import a preset bundle. Body limit: 10 MB. Default mode: `merge`.

**Body**: `ExportBundle` shape.

| Mode | Behaviour |
|------|-----------|
| `merge` | Adds new presets; updates existing ones by ID; skips identical ones |
| `replace` | Deletes all user presets in the same transaction, then inserts the imported set |

**Response** `200`:
```json
{ "created": 3, "updated": 1, "skipped": 0 }
```

**Errors**: `400` (validation), `401` (no session), `413` (payload too large).

---

## Types

### Preset

```typescript
interface Preset {
  id: string
  name: string
  sections: Section[]
  bodyBlocks: BodyBlock[]
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}
```

### Section

```typescript
interface Section {
  key: string       // pattern: [a-z0-9-]+
  value: string
  sort: number
}
```

### BodyBlock

```typescript
interface BodyBlock {
  label: string
  contentMd: string
  sort: number
}
```

### PresetMeta

```typescript
interface PresetMeta {
  id: string
  name: string
  updatedAt: string   // ISO 8601
  sectionKeys: string[]
}
```

### ExportBundle

```typescript
interface ExportBundle {
  pioExportVersion: 1
  source: "local" | "cloud"
  exportedAt: string
  presets: Preset[]
}
```

### Error shape

```json
{ "error": { "code": "UNAUTHORIZED | VALIDATION_ERROR | RATE_LIMITED | PAYLOAD_TOO_LARGE | RESOURCE_NOT_FOUND", "message": "string" } }
```
