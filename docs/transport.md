# Transport, login checks and credential refresh

## JSON and raw requests

`BiliClient.request<TData>(url: string, options?: RequestInit): Promise<TData>` injects configured credentials for Bilibili hosts unless anonymous, merges response cookies, and parses JSON. Non-2xx HTTP responses reject with an `Error` whose message includes `HTTP <status>`; invalid JSON rejects with the parsing error. Network and persistence errors propagate. It does **not** generally validate the business `code`: use `checkedRequest<TData>()` to require `code === 0` and throw `BiliApiError` otherwise. Entity-returning client facade methods also check business errors before construction.

`rawRequest(url, options?): Promise<Response>` preserves raw status/body semantics: a 404/503 is returned as a `Response`, not thrown by the transport. It still injects/strips credentials and merges permitted response cookies. It does not parse JSON, perform business-code credential refresh, or apply WBI signing. Its caller must inspect HTTP status. Fetch/persistence failures still reject.

`RequestInit` accepts `method?: string`, `headers?: Record<string,string>`, `body?: string | Uint8Array`, `wbi?: boolean`, `checked?: boolean`, and `anonymous?: boolean`. `checked` is a legacy unused option; it does not substitute for `checkedRequest`. WBI applies only to `request`/`checkedRequest`.

## Anonymous isolation

`anonymous: true` removes both caller-provided and configured `Cookie`/`Authorization` headers (case-insensitive), does not merge response `Set-Cookie`, and never triggers refresh on `-101`. External hosts default to anonymous; explicitly passing `anonymous: false` opts into credential transmission and cookie merging for that URL. Even that explicit external request cannot trigger Bilibili credential refresh. Anonymous WBI key acquisition also uses an anonymous nav request.

The host classification is the existing Bilibili/hdslb/bilibili.tv/biliapi.net/biliapi.com/acg.tv domain allowlist. This is not a general-purpose browser cookie jar or redirect-policy implementation; no new cross-host redirect guarantees are claimed.

## Login error boundaries

`isLoggedIn(): Promise<{ loggedIn: boolean; mid?: number }>` returns false for absent cookies, nav `code: -101` without successful automatic refresh, or a successful nav payload with `isLogin: false`. Other business errors throw `BiliApiError`; malformed nav payloads, HTTP/network/JSON errors and storage errors propagate rather than masquerading as logged-out status.

`ensureLogin(options?)` attempts cookie validation, then refresh when applicable, then QR only for a known logged-out state. A refresh rejection falls back to QR only for explicit `code: -101`; risk-control/unknown rejection codes are not assumed to mean expired credentials. Explicit refresh `-101` rejection during the initial nav probe also permits QR fallback without repeating the rejected refresh. Other refresh failures and a still-unauthorized retry propagate. QR/TV/password/logout calls use the configured `customFetch` transport. Failed logout business responses throw before returning an unauthenticated typed client.

`loginByPassword` captcha options include `challenge`, `validate`, `seccode` and optional `token`; compatibility permits omission at the type level, but password login requires a usable token at runtime. Consult the authentication documentation for the verified password flow.

## Refresh persistence fix (#11) and limitations

A successful refresh response uses `Headers.getSetCookie()` when available and the combined `set-cookie` header fallback otherwise. Both paths pass through `ConfigManager.mergeCookie`, not `updateCookie`: retain unrelated existing cookies, extract cookie name/value pairs, and keep `Expires`, `Path`, `HttpOnly`, and other attributes out of the outgoing Cookie header.

The new refresh token is staged before the cookie merge/save, so that save contains the rotated token and cookies together, instead of first saving new cookies with an old token. A token-only refresh saves once. After refresh, automatic replay is restricted to GET/HEAD. For other methods the credentials are refreshed but `AuthRequiredError` is thrown without replay; the caller must reconstruct the operation (including CSRF) and explicitly retry. This avoids reusing old CSRF fields or blindly replaying arbitrary business writes. **This is not an atomic filesystem transaction or cross-client locking**: the existing ConfigManager save implementation is unchanged, and storage failures propagate.

The current SDK refresh request remains the existing POST JSON `{ refresh_token }` to `/x/passport-login/web/cookie/refresh`. This change fixes local processing of a successful response; it does **not** establish that this request is a complete currently supported Bilibili refresh protocol. Correspond/refresh-CSRF acquisition, cookie-info checks and refresh confirmation are not implemented here. No real authenticated refresh was executed, and offline regression tests cannot validate the remote handshake. Do not interpret them as proof of working production automatic refresh.

## WBI and repeated query parameters

`wbiSign(record, imgKey, subKey)` continues returning `Record<string,string>`. Its `URLSearchParams` overload returns `URLSearchParams`, preserves repeated keys/value order, and replaces existing `wts`/`w_rid` fields rather than signing stale signatures. Values retain the existing WBI removal of `!'()*`; keys are sorted stably for signing. Client URL rebuilding no longer collapses repeated keys into an object. `buildWbiSignedQuery` retains its existing record input and string output. Repeated-parameter preservation is locally tested; no claim is made that every remote endpoint accepts repeated parameters.

## Offline regression coverage

Run `npx vitest run src/test/core/transport.test.ts`. This is explicitly an offline unit suite using synthetic responses and in-memory save interception, not a real-network test. It covers multi-cookie refresh and Expires fallback, coherent token/cookie snapshots, anonymous credential isolation, external `-101`, HTTP/JSON errors, login failure propagation, raw status preservation, duplicate WBI keys, and facade business-error checks. It does not load or modify real Profiles, scan QR codes, or execute real account operations.
