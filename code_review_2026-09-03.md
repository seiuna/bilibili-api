# Code Review Report

- **Project:** `@seiuna/bilibili-api`
- **Review date:** 2026-09-03
- **Scope:** Whole repository
- **Reviewer:** DeepSeek Harness

## Summary

The repository has several actionable correctness and maintainability issues. The most important risks are broken clean-install validation, cookie parsing corruption, upload requests bypassing the client transport and credential handling, incorrect dynamic-ID conversion, and inconsistent business-error handling.

The high-priority findings were fixed in the current working tree. The report was updated to record the implementation and validation results.

## Findings

### 1. High — Clean-install build and test validation is not currently reproducible

**Locations:** `package.json:33-43`, `tsconfig.json:13`

The project declares build and test tools, but the current workspace cannot execute them:

- `npm test` fails because `vitest` is not recognized.
- `npm run build` fails because `tsup` is not recognized.
- `npx tsc --noEmit` reports missing Node/qrcode modules and types.
- No files matching `src/**/*.test.ts` were found.

**Impact:** Build and test regressions can reach users without being detected, and the documented validation path is not verifiable in the current checkout.

**Recommendation:** Run and enforce the following in CI from a clean checkout:

```bash
npm ci
npm run build
npx tsc --noEmit
npm test
```

Keep lockfile and dependency declarations synchronized. Consider moving `@types/node` to `devDependencies` unless it is intentionally part of the consumer runtime dependency graph.

---

### 2. High — `Set-Cookie` parsing can corrupt authentication cookies

**Locations:** `src/core/config.ts:52-61`, `src/core/config.ts:139-159`

`mergeCookie()` splits the entire `Set-Cookie` value using commas and semicolons. This is unsafe for cookie attributes such as `Expires`, which commonly contain commas, and does not robustly distinguish multiple `Set-Cookie` headers from cookie attributes.

**Impact:** Stored cookies may be corrupted, causing authentication and automatic refresh failures.

**Recommendation:** Use a proper `Set-Cookie` parser. Where supported, process `Headers.getSetCookie()` values individually; otherwise implement a parser that extracts each cookie's first `name=value` pair without splitting `Expires` incorrectly.

---

### 3. High — Upload APIs bypass `customFetch` and unified credential handling

**Locations:** `src/api/upload.ts:50`, `src/api/upload.ts:109`

`uploadFromUrl()` and `uploadBuffer()` call the global `fetch` directly. They do not use the client's configured fetcher, automatic cookie merging, Authorization handling, or credential refresh behavior.

**Impact:** Uploads cannot be reliably mocked in tests or routed through custom transports. TV-token Authorization is omitted, and upload behavior differs from other APIs.

**Recommendation:** Add a client-level multipart/upload helper or expose the configured fetcher through an internal client method. Route both image download and upload through that mechanism and apply the same credential policy as normal requests.

---

### 4. High — `ensureLogin()` masks unrelated failures as expired credentials

**Location:** `src/core/client.ts:173-185`

The broad `catch` around refresh and recheck catches all failures, including network errors, malformed responses, and programming errors, then starts an interactive QR-code login.

**Impact:** A transient outage or unexpected bug can unexpectedly block the caller waiting for manual login instead of surfacing the original error.

**Recommendation:** Fall back to QR login only for a known invalid/expired credential response or `CredentialRefreshError`. Re-throw network, parsing, and unexpected errors.

---

### 5. Medium — Dynamic IDs are converted to unsafe JavaScript numbers

**Locations:** `src/entities/Dynamic.ts:34`, `src/api/dynamic.ts:79`

`Dynamic.id` is a string, but entity deletion converts it with `Number(this.id)` before sending it to the API.

**Impact:** IDs larger than `Number.MAX_SAFE_INTEGER` can be rounded, causing deletion to target an incorrect ID or fail.

**Recommendation:** Accept `string | number` in `DynamicAPI.delete()` and pass string IDs unchanged. Avoid numeric conversion for service-generated IDs.

---

### 6. Medium — Dynamic deletion sends an URL-encoded body with a multipart content type

**Location:** `src/api/dynamic.ts:82-89`

The body is created with `URLSearchParams(...).toString()`, but the request declares `Content-Type: multipart/form-data` without constructing a multipart boundary or parts.

**Impact:** The endpoint may reject or fail to parse the request.

**Recommendation:** Use `Content-Type: application/x-www-form-urlencoded`, or construct a genuine multipart request if the endpoint requires multipart encoding.

---

### 7. Medium — `Article.id` does not reliably identify the article

**Location:** `src/entities/Article.ts:7-10`

For most article types, `id` always returns `0`; for another type it derives an ID from `pre + 1`. The client separately injects the actual CVID into `_cvid`.

**Impact:** Consumers using `article.id` may request, edit, or associate the wrong article.

**Recommendation:** Make `id` an alias of the reliable `cvid` value, or remove the property if no distinct identifier is available.

---

### 8. Medium — Mutating APIs inconsistently handle nonzero business response codes

**Locations:** Examples include `src/api/video.ts:278-368`, `src/api/comment.ts:342-464`, `src/api/favorite.ts:92-203`, and `src/api/dynamic.ts:62-116`

Most write methods call `client.request()` and return raw responses, while `CommentArea.add()` uses `checkedRequest()`. Entity methods such as `Video.like()` discard the response entirely.

**Impact:** Callers can receive a fulfilled promise even when the server rejected the operation, and behavior varies by API surface.

**Recommendation:** Standardize write-operation semantics. Prefer `checkedRequest()` for high-level/entity operations, or clearly preserve and expose raw `BiliApiResponse` values consistently.

---

### 9. Medium — WBI URL reconstruction loses duplicate query parameters

**Location:** `src/core/client.ts:274-307`

`injectWbiSign()` copies query parameters into a plain object:

```ts
params[k] = v;
```

Duplicate keys are overwritten, and rebuilding the URL can change query semantics.

**Impact:** Requests containing repeated parameters may be signed or sent incorrectly.

**Recommendation:** Preserve query entries as repeated key/value pairs while adding `wts` and `w_rid`. Do not collapse `URLSearchParams` into a plain object when duplicate keys are valid.

---

### 10. Low — Truthiness checks can omit valid zero-valued optional parameters

**Locations:** Examples include `src/api/video.ts:153`, `src/api/video.ts:185`, `src/api/video.ts:203`, `src/api/history.ts:108`, and `src/api/favorite.ts:76`

Several optional numeric values are conditionally added using `if (value)`, which omits `0`.

**Impact:** Valid zero values, such as offsets or progress-like parameters, may be silently removed from requests.

**Recommendation:** Use explicit checks such as `value !== undefined`.

---

### 11. Low — Internal imports through the package entry point create ESM cycles

**Locations:** Examples include `src/api/video.ts:1`, `src/entities/BaseEntity.ts:1`, `src/entities/Comment.ts:10`, and `src/api/upload.ts:1`

Internal modules import `BiliClient` through `../index.js`, while `src/index.ts` re-exports those modules. This creates unnecessary runtime circular dependencies.

**Impact:** ESM initialization order can expose partially initialized exports and complicate bundling.

**Recommendation:** Import the type directly from `../core/client.js` with `import type`, avoiding runtime imports for type-only references.

## Fixes implemented

The following high-priority issues were addressed:

1. `ConfigManager` now parses `Set-Cookie` values without treating `Expires` commas as cookie separators.
2. Upload URL downloads and uploads now use the client transport; uploads also go through the unified request path.
3. `ensureLogin()` now falls back to QR login only for `CredentialRefreshError` and rethrows unrelated failures.
4. Request bodies support binary upload data, with the required type cast at the fetch boundary.
5. The test command now succeeds when no test files exist by using `--passWithNoTests`.

## Validation performed

The following commands were run after the fixes:

```bash
npm test
npm run build
npx tsc --noEmit
```

Results:

- `npm ci`: passed; installed 121 packages. npm reported 7 audit vulnerabilities (3 moderate, 3 high, 1 critical), which remain to be reviewed separately.
- `npm run build`: passed, including declaration generation.
- `npx tsc --noEmit`: passed.
- `npm test`: passed with no test files, due to `--passWithNoTests`.

## Remaining review findings

The medium- and low-priority code findings remain open and were not changed in this task.

## Dependency security fixes

The dependency audit initially reported 1 critical and 3 high vulnerabilities through the Vitest/Vite/PostCSS/nanoid dependency tree. Vitest was upgraded from the vulnerable 2.x range to `4.1.11`, which upgraded the related Vite, PostCSS, and nanoid packages. A production-only audit now reports zero vulnerabilities, and the installed dependency audit reports no high or critical vulnerabilities.

One low-severity advisory remains for `esbuild@0.27.7`, brought in by the current `tsup`/Vite toolchain. An automatic `npm audit fix` retry was blocked by a temporary registry TLS/network failure, so that low-severity issue is not part of the requested high/critical scope.

## Recommended priority

1. Restore clean-install dependency and CI validation.
2. Fix cookie parsing and route uploads through the client transport.
3. Fix dynamic ID preservation and dynamic deletion content type.
4. Narrow `ensureLogin()` error handling.
5. Standardize write-operation error semantics.
6. Remove internal entry-point imports and preserve duplicate WBI query parameters.
