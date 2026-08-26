# BackChannel Improvement TODO

## Phase 1 — Stabilize (logic + DOM + obvious security footguns)
- [x] Fix missing/incorrect DOM element IDs referenced by public/app.js
- [x] Remove duplicated CryptoJS inclusion (choose one)
- [x] Remove/disable destructive anti-screenshot lock behavior (don't overwrite document.body)
- [x] Begin client stabilization by removing unused/misleading PFS/DH scaffolding state from app.js
- [x] Prevent conflicting anti-screenshot scripts/listeners from both running
- [x] Add basic input validation for socket payload sizes/fields

## Phase 2 — UI/UX cleanup
- [x] Make status/security panels consistent and readable
- [x] Improve message rendering safety (add escapeAttr, sanitizeUrl, and apply to rendered attachment/location/feedback HTML)
- [x] Reduce animation overhead (remove debugger loop, remove scramble loop, keep non-destructive lightweight overlays)

## Phase 3 — Security hardening that matters
- [x] Restrict Socket.IO CORS origin (no origin '*')
- [x] Rate limit /security/event and key socket events
- [x] Harden CSP (remove unsafe-inline where possible)
- [x] Ensure no trust of client-provided userId for security logging
- [x] Remove hardcoded IP exposure from startup logs
- [x] Add payload size limits for HTTP and Socket.IO

## Phase 4 — Cryptography correction
- [x] Decide whether E2EE is real or server-assisted; align claims
- [ ] Replace custom DH/PFS with vetted approach (WebCrypto or established E2EE library)
- [x] Remove plaintext fallback when encryption fails

## Phase 5 — Performance
- [x] Remove full-screen animated overlays by default (keep lightweight markers)
- [ ] Debounce countdown updates and reduce DOM churn

## Phase 6 — In-room communication reliability
- [x] Add backend typing indicator events (typing-start, typing-stop)
- [x] Add read-receipt and delivery status events
- [x] Add heartbeat + presence timeout cleanup
- [x] Add reconnect-to-room flow on connect_error
- [x] Add in-room member roster sync via user-joined/user-left/presence-update
- [x] Add typing indicator UI with auto-clear
- [ ] Verify recipient actually receives sender's encrypted messages end-to-end
- [x] Smoke test room lifecycle: join, typing, read-receipt, heartbeat, reconnect request, end-room
