# Authentication

Authentication performs real account operations. Do not use live credentials, send SMS, poll login QR codes, or log out an account in offline tests.

## Verified protocol and compatibility

The implementation follows the checked-in [password protocol](../api-doc/docs/login/login_action/password.md), [SMS protocol](../api-doc/docs/login/login_action/SMS.md), [captcha flow](../api-doc/docs/login/login_action/readme.md), and [QR protocol](../api-doc/docs/login/login_action/QR.md). These are protocol references, not proof that a live login was tested.

### Password

`loginByPassword(config, username, password, options?, transport?)` returns `Promise<PasswordLoginResult>`. `username` and `password` are strings. `options` contains:

- `captcha?: { token?: string; challenge: string; validate: string; seccode: string }`: all four nonempty fields are required at runtime. Optional typing preserves existing callers; missing captcha/token produces `success: false` without a network request. The caller obtains the token/challenge via the documented captcha endpoint and completes the human verification. The SDK does not solve it or fabricate values.
- `keep?: boolean`: deprecated compatibility field, ignored. The modern Web endpoint documents numeric `keep=0`; the SDK sends the string `0` in the URL-encoded form. Boolean `true`/`false` belongs to the older endpoint, and `keep=1` semantics are not established by this repository.

The salt is prepended to the password and encrypted using Node's ESM `node:crypto` import, RSA PKCS#1 v1.5, then base64 encoded. Both PEM and bare base64 public keys are accepted. Requests use `application/x-www-form-urlencoded`.

A zero outer `code` alone is **not login success**: `data.status` must also equal `0`. In particular, status `2` requiring additional verification returns `success: false`, preserves the server message/status/URL, and does not persist cookies or refresh tokens. Verification URLs are not followed automatically. Unknown or missing statuses fail closed. A completed response must include cookies; the SDK does not claim a separate live session validation.

`PasswordLoginResult` and `SmsLoginResult` fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `success` | `boolean` | Whether the documented completion conditions were met |
| `message` | `string` | Success, business error, or incomplete-login description |
| `cookie?` | `string` | Stored cookie header after completed login |
| `refreshToken?` | `string` | Returned refresh token (may be empty on success) |
| `status?` | `number` | Raw server status on incomplete login; only status 0 is accepted as complete |
| `url?` | `string` | Raw server-provided URL on incomplete login; not automatically visited |

### SMS

`sendSmsCode(config, cid, tel, loginSessionId, recaptchaToken, geeChallenge, geeValidate, geeSeccode, transport?)` retains the original argument order/types: config is `ConfigManager`, cid/tel are numbers, the five following arguments are strings. It returns `Promise<BiliApiResponse<{ captcha_key: string }>>` **without throwing for nonzero business codes**. Check `code` before using `data.captcha_key`.

Despite legacy positional names, this method uses the **Web** endpoint. `loginSessionId` is retained but ignored (APP-only). `recaptchaToken` supplies Web `token`; `geeChallenge`, `geeValidate`, and `geeSeccode` supply `challenge`, `validate`, and `seccode`. The request includes `cid`, `tel`, and `source=main_web`. No APP `login_session_id`, `recaptcha_token`, or `gee_*` field is sent. `config` remains positional for compatibility and is not mutated by SMS sending.

`loginBySms(config, captchaKey, tel, code, cid, transport?)` returns `Promise<SmsLoginResult>`. `captchaKey` is a string; tel/code/cid are numbers. It sends `captcha_key`, `tel`, `code`, `cid`, and `source=main_web`. Cookies and refresh tokens are persisted only after outer code 0, status 0, and cookie presence. This conservatively accepts only the status documented in the Web SMS example; it does not invent meanings for other SMS statuses.

### QR and logout

`loginByWebQrcode(config, options?, transport?)` and `loginByTvQrcode(config, options?, transport?)` return `Promise<QrcodeLoginResult>`.

- Web options: `pollInterval?: number` (milliseconds, default 2000), `timeout?: number` (milliseconds, default 180000), `onStatusChange?: QrcodeStatusCallback`.
- TV options extend Web options with `appKeyPair?: { appkey: string; appsec: string }` (default known TV pair) and `localId?: number` (default 0).
- `QrcodeStatusCallback(status, message, qrcodeBase64?, qrcodeTerminal?)` receives `QrcodeStatus`, a string, and optional QR image/terminal strings; returns void.
- `QrcodeLoginResult` has required `success: boolean` and `message: string`, optional `cookie: string`, `refreshToken: string`, `accessToken: string`, `mid: number`, and `expiresIn: number`. Web supplies cookies/refresh token; TV supplies access/refresh tokens, UID, and expiry seconds.

Web QR generation cookies remain in memory for polling and are not persisted on failed/expired/timed-out login. Only outer code 0 and nested code 0 enter completion; null data is not success. Successful Web login requires response cookies. TV completion requires nonempty access and refresh tokens before writing tokens/UID. Callback, transport, and persistence errors propagate.

`logout(config, transport?)` returns `Promise<BiliApiResponse<{ redirectUrl: string }>>`; it preserves raw business error codes and clears Web cookies/refresh token only for code 0. Callers must check the code before treating the account as logged out. It does not clear TV tokens.

## Injectable transport and error handling

All functions above accept an optional **last** argument:

```ts
type AuthTransport = (url: string, init?: globalThis.RequestInit) => Promise<Response>;
```

Omitting it preserves standalone behavior using `fetch`. The `BiliClient` wrappers must inject their configured transport so `customFetch` also controls authentication. An auth transport must return the untouched response and **must not persist Set-Cookie, retry/replay login writes, or trigger credential refresh**. Auth functions themselves validate HTTP status and JSON before saving credentials. Do not route them through a request path that auto-merges cookies before authentication is checked. Preserve explicitly supplied headers and redirect policy.

HTTP failures, transport failures, invalid JSON, crypto errors, and persistence failures reject the promise; they are never converted into successful login. Business failures in password/SMS/QR helpers return `success: false`. Set-Cookie extraction handles multiple headers and combined fallback headers without splitting the comma inside `Expires`. Persistence is sequential rather than transactional: a storage failure propagates, but prior successful writes are not rolled back.

These low-level exports live in `src/core/auth.ts`; package-level availability depends on the library entry exports. No new deep package import path is promised here.

## Offline verification

Run only the isolated regression file:

```sh
npx vitest run src/test/core/auth.offline.test.ts
```

It injects queued local Responses, uses generated test-only RSA keys, and stubs configuration saves. It does not load profiles, contact Bilibili, send SMS, or write credentials. The tests establish local protocol encoding/error/persistence behavior, not live service availability.
