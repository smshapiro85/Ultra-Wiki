---
phase: 05-article-editing
plan: 02
subsystem: editor
tags: [sharp, image-upload, image-compression, filesystem-storage, blocknote, multipart-upload]

# Dependency graph
requires:
  - phase: 05-article-editing
    plan: 01
    provides: BlockNote WYSIWYG editor with uploadFile prop, article_images schema table
  - phase: 01-foundation
    provides: article_images table in schema.ts, Dockerfile with /data/images directory
provides:
  - Image compression pipeline via sharp (max 1200x1200, JPEG quality 80, EXIF stripped)
  - Filesystem storage utilities (save, read, ensureDir, getImageUrl)
  - POST /api/articles/[id]/images upload endpoint with auth, validation, compression
  - GET /api/images/[articleId]/[filename] serving endpoint with immutable cache
  - Editor uploadFile integration enabling paste and drag-drop image insertion
affects: [05-03 version-history-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [multipart-form-upload, sharp-compression-pipeline, filesystem-image-storage, uuid-filename-immutable-cache]

key-files:
  created:
    - src/lib/images/compress.ts
    - src/lib/images/storage.ts
    - src/app/api/articles/[id]/images/route.ts
    - src/app/api/images/[articleId]/[filename]/route.ts
  modified:
    - src/components/editor/article-editor.tsx
    - .gitignore

key-decisions:
  - "uploadFile defined inline in ArticleEditor (self-contained) rather than passed as prop from parent"
  - "Uint8Array conversion for Response body to satisfy strict TypeScript typing for Buffer"
  - "/data/ added to .gitignore to prevent uploaded images from being committed"

patterns-established:
  - "Image upload: multipart FormData POST -> sharp compress -> filesystem save -> DB record -> return URL"
  - "Image serving: UUID filename with immutable cache headers (content never changes for a given filename)"
  - "Filesystem storage: /data/images/{articleId}/{uuid}.jpg in production, ./data/images/ in dev"

# Metrics
duration: 3min
completed: 2026-02-14
---

# Phase 5 Plan 2: Image Upload & Compression Summary

**Sharp-based image compression pipeline with filesystem storage, multipart upload API, and BlockNote paste/drag-drop integration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-14T02:53:00Z
- **Completed:** 2026-02-14T02:55:59Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Image compression utility: sharp pipeline resizes to max 1200x1200, converts to JPEG quality 80 with mozjpeg, strips EXIF metadata
- Filesystem storage: save/read/ensureDir utilities with production (/data/images) and development (./data/images) paths
- Upload API: POST /api/articles/[id]/images with auth guard, 10MB size limit, MIME validation, compression, DB record
- Serving API: GET /api/images/[articleId]/[filename] with immutable cache headers (1 year, UUID filenames)
- Editor integration: uploadFile callback in ArticleEditor enables BlockNote's built-in paste and drag-drop image handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Install sharp and create image compression + storage utilities** - `1b8feec` (feat)
2. **Task 2: Create upload/serve API routes and wire uploadFile into editor** - `31c7248` (feat)

## Files Created/Modified
- `src/lib/images/compress.ts` - Sharp-based image compression: resize, JPEG conversion, EXIF stripping
- `src/lib/images/storage.ts` - Filesystem read/write utilities with environment-aware paths
- `src/app/api/articles/[id]/images/route.ts` - POST endpoint for authenticated image upload with compression and DB recording
- `src/app/api/images/[articleId]/[filename]/route.ts` - GET endpoint serving stored images with immutable cache headers
- `src/components/editor/article-editor.tsx` - Added inline uploadFile callback, removed optional prop
- `.gitignore` - Added /data/ to exclude uploaded images from git

## Decisions Made
- **uploadFile self-contained in editor**: Rather than receiving uploadFile as a prop from the parent page, defined it as a useCallback inside ArticleEditor. This simplifies the component tree -- the editor already has articleId and no parent needs to configure upload behavior.
- **Uint8Array for Response body**: TypeScript strict typing doesn't accept Node.js Buffer as a Response body parameter. Converting via `new Uint8Array(data)` satisfies the type constraint without copying data.
- **/data/ in .gitignore**: Added to prevent local development images from being accidentally committed to the repository.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Buffer type incompatibility in image serving route**
- **Found during:** Task 2 (type-check verification)
- **Issue:** `new Response(data, ...)` where data is a Node.js Buffer fails TypeScript strict typing -- Buffer is not assignable to BodyInit
- **Fix:** Wrapped buffer in `new Uint8Array(data)` which is a valid BodyInit type
- **Files modified:** src/app/api/images/[articleId]/[filename]/route.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** 31c7248 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added /data/ to .gitignore**
- **Found during:** Task 2 (post-implementation review)
- **Issue:** The /data/ directory for uploaded images was not in .gitignore, risking accidental commits of binary image files
- **Fix:** Added `/data/` entry to .gitignore with descriptive comment
- **Files modified:** .gitignore
- **Verification:** `git status` no longer shows data/ directory
- **Committed in:** 31c7248 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required. Sharp is already a direct dependency. Dockerfile already creates /data/images with correct ownership.

## Next Phase Readiness
- Image upload fully integrated into the editor, ready for use
- Images persist in filesystem and article_images table for future management features
- Plan 03 (version history UI) can proceed -- no dependencies on image upload

## Self-Check: PASSED

All 6 files verified present. Both task commits (1b8feec, 31c7248) verified in git log.

---
*Phase: 05-article-editing*
*Plan: 02*
*Completed: 2026-02-14*
