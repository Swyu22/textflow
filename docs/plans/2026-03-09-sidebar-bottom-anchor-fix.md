# 2026-03-09 Sidebar Bottom Anchor Fix

## Goal
Restore the recycle bin entry and version label to the sidebar bottom-left without changing current functionality.

## Scope
- Frontend source of truth: `textflow-fe`
- Files: `src/components/AppSidebar.jsx`, `src/App.jsx`, `src/sidebar.layout.test.js`

## Changes
1. Make the sidebar inner container a full-height flex column.
2. Keep the category navigation scrollable with `flex-1 min-h-0`.
3. Wrap the recycle bin entry and version label in a bottom cluster pinned with `mt-auto`.
4. Preserve order: recycle bin above version label.
5. Append release metadata entries for the recent completed work so the displayed version updates.

## Verification
- `npm test -- src/sidebar.layout.test.js`
- `npm run lint`
- `npm test`
- `npm run build`
