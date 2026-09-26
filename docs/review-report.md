# Issue and risk review report

## Scope and evidence

Reviewed the repository's four open issues (#11–#14), core authentication/transport/signing/configuration, API wrappers, all 41 entity source files, package-root exports, tests, README and relevant bundled upstream API documentation. A second independent review examined the integrated transport/authentication/comment/history changes. Claims below distinguish offline regression evidence from live endpoint checks.

## Fixed issues

| Issue | Repair | Regression |
| --- | --- | --- |
| #11 | Merge parsed refresh cookies, preserve identity cookies and persist rotated token together | `src/test/core/transport.test.ts` |
| #12 | Reject non-2xx XML danmaku responses; preserve successful text/network errors | `src/test/danmaku/xml-status.test.ts` |
| #13 | Precision-safe comment identifiers, dedicated dialog/root/page type | `src/test/comment/precision.unit.test.ts` |
| #14 | Typed user submissions (WBI) and following-list methods | `src/test/user/user-lists.test.ts` |

## Additional confirmed risks fixed

- **Destructive history boundary:** old `clearHistory(client, kid)` could clear the entire history despite looking scoped. Reject legacy scoped calls and add explicit `deleteHistory` endpoint.
- **Authentication:** ESM crypto loading, captcha token and Web form fields, risk-verification statuses, success-gated credentials, injected transport, and explicit expired-auth-only QR fallback.
- **Transport:** HTTP/JSON failures no longer become empty objects; anonymous caller credentials are stripped; external responses cannot trigger account refresh. Write requests are not automatically replayed with stale CSRF after refresh.
- **Precision/routing:** comment writes and dynamic/opus comment areas use authoritative string identifiers, including `comment_id_str` rather than unrelated `rid_str`.
- **Partial results:** pagination errors on any page throw instead of masquerading as complete results; history propagates the full business cursor.
- **Entity identity/errors:** Article requires a reliable CVID; entity/facade failures are checked before wrapping data or returning empty collections.
- **Contract drift:** hot search nesting, note identifier/time types, format-only image URLs, missing package-root type exports, incorrect upload example, stale architecture guidance.
- **Signing:** repeated WBI query keys survive signing and URL reconstruction.

## Verification

- `npm ci`: completed from the lockfile.
- `npm run build`: ESM and declaration build passed.
- `npx tsc --noEmit`: passed.
- `npm test`: **21 files / 195 tests passed** at the integrated implementation checkpoint, including actual anonymous Bilibili network tests. Later commits must rerun checks.
- `git diff --check`: passed.
- `npm audit --omit=dev`: zero production vulnerabilities. Initial full install reported one low-severity development dependency advisory.
- Offline tests use synthetic transport explicitly; they are not described as proof of live authenticated API behavior.
- No login-profile tests or real business-write tests were executed. Existing user edits to `src/test/dynamic/create-comment.write.test.ts` and `.agents/` are intentionally excluded from commits.

## Remaining limits (not claimed fixed or verified)

The existing refresh request is JSON `refresh_token` only; the full correspond/refresh-CSRF/confirmation protocol is not implemented or production-verified. This PR fixes processing of a successful response, not proof of a working live refresh handshake. Credential persistence is not a multi-file transaction or cross-client lock. Transport is not a full browser cookie jar or redirect policy. Upstream response shapes may change; generated declarations and field inventories describe SDK contracts, not verification of every remote field's business meaning. Real authenticated login, SMS, following visibility and writes require separate explicit test-account authorization.

GitHub Codex review and subsequent fixes are tracked in the PR discussion; this report is the pre-PR local review checkpoint, not a claim that external review/merge has completed.
