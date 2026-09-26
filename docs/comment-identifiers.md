# Comment identifiers and dialog pagination

## Exact identifiers

All `CommentAPI` methods accept `string | number` for comment-area `oid`, reply `rpid`, and dialog `rootRpid`. This includes `getReplies`, `replies`, `getRepliesWbi`, `repliesWbi`, `getReplyDialog`, `replyDialog`, `getHotReplies`, `hotReplies`, `replyCount`, `getReply`, `resolveReply`, `add`, `like`, `hate`, `delete`, `top`, and `report`.

Use decimal strings for large IDs. Numeric inputs must be safe integers; unsafe numbers, fractions, NaN and Infinity throw `RangeError` before transport. IDs must be positive decimal integers; malformed or nonpositive IDs throw `TypeError`. Surrounding whitespace is trimmed. `add`'s `root` and `parent` additionally accept numeric/string zero to mean no reply target. Never convert an already rounded number to a string expecting to recover precision.

`BiliClient.getComment(oid: string | number, replyType: number, rpid: string | number)` returns `Promise<Comment>`. The jump lookup searches nested replies and the separate root, prefers `rpid_str`, and never substitutes an unrelated reply. The client facade throws `BiliApiError` on business errors or when the requested reply is absent (`-404`); absence does not prove deletion. The low-level `CommentAPI.getReply` preserves nonzero business codes and returns null data; `CommentArea.getReply` throws on business errors and returns `Comment | null` on a successful lookup.

`resolveReply(client, rpid, candidateSubjects?)` accepts `{ oid: string | number; replyType: number }[]` and returns `{ reply: ReplyEntry; oid: string | number; replyType: number } | null`. It remains a best-effort notification/candidate search: unavailable candidates can lead to null, not proof that the comment was deleted. Invalid caller IDs are rejected before searching.

## Single-page and generator contracts

```ts
import { CommentAPI, ReplySort } from '@seiuna/bilibili-api';
// client is an initialized BiliClient; IDs must come from real resource metadata.
const page = await CommentAPI.getReplies(client, oid, replyType,
  ReplySort.TIME, 0, 1, 20);
const dialog = await CommentAPI.getReplyDialog(client, oid, rootRpid,
  replyType, 1, 20);
if (dialog.code !== 0) throw new Error(dialog.message);
const root = dialog.data.root;       // separate root; may be null
const children = dialog.data.replies ?? [];
```

- `getReplies(client, oid, replyType, sort = TIME, nohot = 0, pn = 1, pageSize = 20)` returns `Promise<BiliApiResponse<ReplyMainData>>` and caps page size at 20.
- `getReplyDialog(client, oid, rootRpid, replyType, pn = 1, pageSize = 20)` returns `Promise<BiliApiResponse<ReplyDialogData>>`, not `ReplyMainData`, and caps the request size at 49.
- `pn` and page size must be positive safe integers. `getHotReplies` applies the same validation, with a size cap of 49.
- `replyDialog(client, oid, rootRpid, replyType, pageSize = 20)` yields `{ page: number; comments: ReplyEntry[] }`. Only child replies are yielded; the root is not mixed into this list. Pagination uses `page.count / page.size`, not `acount`.
- `replies` and `hotReplies` also paginate using `page.count` (root/hot entries), not `page.acount` (including nested replies).
- All four comment generators (`replies`, `repliesWbi`, `replyDialog`, `hotReplies`) throw on nonzero business responses or absent success data instead of silently ending. Single-page methods retain raw `BiliApiResponse` semantics.

### `ReplyDialogData`

| Field | Type | Meaning |
| --- | --- | --- |
| `root` | `ReplyEntry \| null` | Root comment, separate from children |
| `replies` | `ReplyEntry[] \| null` | Child replies for this page |
| `page.num` | `number` | Current page number |
| `page.size` | `number` | Server page size |
| `page.count` | `number` | Total child reply count (no required `acount`) |
| `config?` | `unknown` | Upstream display configuration |
| `control?` | `unknown` | Upstream input controls |
| `upper?` | `{ mid: number } \| null` | Resource owner metadata |
| `show_bvid?` | `boolean` | Upstream bvid-display flag |
| `show_text?` | `string` | Upstream display text; further semantics unspecified |
| `show_type?` | `number` | Upstream display type; numeric meanings unspecified |

This shape is backed by the repository's [upstream dialog contract](../api-doc/docs/comment/list.md), not by a new live-network verification.

## Entities and authoritative string fields

`ReplyEntry` supports optional `rpid_str`, `oid_str`, `root_str`, and `parent_str` strings. When present they are authoritative, even if the corresponding numeric field disagrees. Existing raw numeric fields and `Comment.rpid`, `.oid`, `.root`, `.parent` getters are unchanged for compatibility; they are not precision-safe ID sources.

`Comment` now exposes exact string getters:

| Getter | Selection |
| --- | --- |
| `rpidStr: string` | `rpid_str`, otherwise safe numeric `rpid` |
| `oidStr: string` | `oid_str`, otherwise the constructor's supplied `oid` |
| `rootStr: string` | `root_str`, otherwise safe numeric `root`; zero allowed |
| `parentStr: string` | `parent_str`, otherwise safe numeric `parent`; zero allowed |

These getters validate and throw if no valid precise source is available. `Comment(client, entry, oid)` accepts a string or number context ID. `commentArea()`, `reply`, `like`, `hate`, `delete`, `top`, and `report` route through exact IDs, never the rounded numeric getters. `reply()` uses `rootStr`, or `rpidStr` when root is zero. `getDynamic()` supports only type 17 and can use `dynamic_id_str`, exact `oid_str`, or the supplied string context before a safe numeric fallback; type 11 document IDs are not dynamic IDs.

`CommentArea(client, oid: string | number, replyType: number)` requires the business type and validates its ID. `getOid` returns `string | number`. `getReply`, `like`, `hate`, `delete`, `top`, `report` accept string/number reply IDs; `add(message, root = 0, parent = 0, pictures?)` accepts string/number targets. High-level writes throw on business errors; raw `CommentAPI` writes preserve the response envelope.

`Dynamic.commentArea()` and `Opus.commentArea()` use `basic.comment_id_str` plus `basic.comment_type`. They do not use `rid_str` or the entity ID: these values can differ for resource types such as PGC/live shares. Missing or invalid comment metadata is rejected rather than guessed.

## Verification boundary

`src/test/comment/precision.unit.test.ts` uses an isolated synthetic transport for precision, request-body, dialog pagination and error regression coverage. No real write or login tests are needed to run it. Passing these tests establishes local serialization/selection behavior, not current server availability or a newly verified live response schema.
