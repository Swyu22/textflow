# TextFlow FlowChat Implementation Notes

> This file started as the 2026-02-21 implementation plan. It is now maintained as a historical design note plus a pointer to the current production source of truth.

## Current source of truth

- Frontend entry in the main app: `src/chat/EmbeddedChatRoomTab.jsx`
- Shared room experience UI: `src/chat/ChatRoomExperience.jsx`
- Chat API client: `src/chat/api.js`
- Lifecycle cleanup helpers: `src/chat/roomLifecycle.js`
- Current data-retention migration: `supabase/migrations/20260308223000_chat_zero_retention.sql`

## Historical scope of the original plan

The original 2026-02-21 plan introduced an anonymous room-code chat experience backed by Supabase Auth anonymous sessions, Postgres RPC, Realtime, and a one-hour room expiry window. That plan was correct for the first release, but parts of the runtime and retention model have changed since then.

## What changed after the first release

### Entry model

- The primary production entry is no longer a standalone `/chat` route shell.
- Chat is embedded in the main TextFlow application via the `流式聊天` tab.
- `src/chat/ChatApp.jsx` still exists as a route-style shell, but it now reuses the same shared chat experience and is not the primary production surface.

### Retention model

- The original implementation kept `messages` until room expiry and also stored `chat_events` for observability.
- Production now targets zero message retention after room destruction.
- When the last member leaves, or when purge destroys an expired room, the room lifecycle clears:
  - `rooms`
  - `room_members`
  - `messages`
  - `chat_events`
- `log_chat_event` is effectively a no-op in the zero-retention model.
- `chat_join_attempts` is retained only as a short-lived rate-limit window and should be purged after roughly 2 minutes.

### Exit and cleanup model

- Room exit is no longer only an explicit button flow.
- The frontend now sends best-effort leave requests on explicit leave, pagehide/unload, and component teardown via keepalive requests.
- Database cleanup still remains authoritative, but the client participates earlier to minimize retention windows.

## Current acceptance baseline

A production-correct chat room should satisfy all of the following:

- A room is destroyed when the last participant leaves.
- A room is also destroyed when it naturally expires.
- Destroying a room removes its messages and event records instead of leaving them behind for later review.
- Closing or refreshing the page should trigger a best-effort leave request.
- Non-members cannot read room metadata or messages.
- Join attempts remain rate-limited without creating long-lived behavioral logs.

## Verification checklist for future changes

- Run `npm test`
- Run `npm run lint`
- Run `npm run build`
- Run `npx -y react-doctor@latest . --verbose --diff`
- Re-check the latest retention behavior against `20260308223000_chat_zero_retention.sql`
- If chat lifecycle logic changes, verify both `EmbeddedChatRoomTab.jsx` and `ChatApp.jsx` still route through the same shared behavior
