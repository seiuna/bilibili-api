# API 分页与响应契约修正

本页记录 `dynamic`、`message`、`favorite`、`note`、`electric`、`ranking`、`search`、`common` 的本次契约变更。它不是上述模块所有方法的完整参考；未列出的 API 行为未因本次修复改变。

## 分页失败不会再伪装为正常结束

以下异步生成器在**每一页**先调用 `assertOk(response)`：非零 `code` 抛出 `BiliApiError`（包含原始 `code`，错误消息格式为 `[code] message`）。即使错误响应没有 `data` 或列表为空，也先抛错。之前已经 yield 的条目不会回滚；后续失败意味着消费结果可能只是部分数据。请求/解析异常继续向调用者传播，不会自动重试。

参数表中的 `client` 均为必填 `BiliClient<any>`；返回值均为 `AsyncGenerator<表中 yield 类型>`，不是 `Promise<数组>`。

| 方法 | client 后的参数（默认值） | yield 类型 | 正常分页/结束规则 |
| --- | --- | --- | --- |
| `DynamicAPI.space` | `hostMid: number` | `DynamicFeedItem` | 传递原始字符串 `offset`；无 `has_more` 或无后续 offset 时结束 |
| `MessageAPI.replyFeed` | 无 | `ReplyNotification` | 使用响应 cursor 的 id/time；cursor.is_end 时结束 |
| `MessageAPI.atFeed` | 无 | `AtNotification` | 使用响应 cursor 的 id/time；cursor.is_end 时结束 |
| `MessageAPI.sessions` | `sessionType: SessionQueryType = SessionQueryType.ALL`, `size = 20`, `sortRule?: number` | `{ sessions: ChatSession[]; hasMore: boolean }` | 逐页 yield，下一页使用末条 session_ts；has_more !== 1 时结束 |
| `MessageAPI.newSessions` | `beginTs: number`, `size = 20` | `{ sessions: ChatSession[]; hasMore: boolean }` | 逐页 yield，下一页使用末条 session_ts；has_more !== 1 时结束 |
| `FavoriteAPI.folderList` | `mediaId: number`, `ps = 20` | `FavoriteMedia` | pn 从 1 递增；无 has_more 时结束 |
| `NoteAPI.userNotes` | `ps = 10` | `NoteListItem` | pn 从 1 递增；达到首个已知 page.total 时结束 |
| `ElectricAPI.chargeRemarks` | `ps = 10` | `ChargeRemarkItem` | pn 从 1 递增；达到首个已知 pager.total 时结束 |
| `RankingAPI.popular` | `ps = 20`, `maxPages?: number` | `RecommendVideo` | pn 从 1 递增；no_more 或达到 maxPages 时结束；maxPages 为 0 不发请求 |

成功响应中的空/缺失列表仍正常结束。`sessions/newSessions` 的 size 在单页请求中上限为 100。对应单页方法 `getSpace/getReplyFeed/getAtFeed/getSessions/getNewSessions/getFolderList/getUserNotes/getChargeRemarks/getPopular` 仍返回原始 `Promise<BiliApiResponse<...>>`，不会因这次修改自行抛出业务错误；调用者可显式使用 `assertOk`。

```ts
import { BiliApiError, RankingAPI, type BiliClient } from '@seiuna/bilibili-api';

async function printPopular(client: BiliClient<any>) {
  try {
    for await (const video of RankingAPI.popular(client, 20, 2)) {
      console.log(video.bvid);
    }
  } catch (error) {
    if (error instanceof BiliApiError) console.error(error.code, error.message);
    throw error; // 不把部分结果误认成完整结果
  }
}
```

## 热搜：保留上游 trending 包装

`SearchAPI.getHotSearch(client, limit = 50): Promise<BiliApiResponse<HotSearchData>>` 使用 WBI 签名。上游 limit 文档范围为 1–50；SDK 原样传递，不作范围校验。

```ts
interface HotSearchData {
  trending: {
    title: string;     // 榜单标题
    trackid: string;   // 上游跟踪标识；业务含义未进一步确认
    list: HotSearchItem[];
    top_list: unknown[]; // 文档样例为空；非空元素结构未确认
  };
}
interface HotSearchItem {
  keyword: string;   // 搜索关键词
  show_name: string; // 展示文本
  icon: string;      // 图标 URL
  uri: string;       // 上游字段，文档样例为空
  goto: string;      // 上游字段，文档样例为空
}
```

以上字段在当前类型中均必填。迁移：把 `response.data.list/title/trackid` 改为 `response.data.trending.list/title/trackid`；方法不再用错误的扁平类型描述未转换的原始 JSON。

依据：[上游热搜字段和示例](../api-doc/docs/search/hot.md#获取热搜列表)。

## 笔记：数值字段与无损字符串字段分开

`NoteListItem` 所有字段均为必填：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| title | string | 笔记标题 |
| summary | string | 预览文本 |
| mtime | string | 提交时间，`YYYY-MM-DD hh:mm`；原 number 类型已修正 |
| arc | unknown | 上游视频信息，SDK 未细化结构 |
| note_id | number | 原始 JSON 数值 ID；原 string 类型已修正，可能超出安全整数范围 |
| audit_status | number | 上游审核状态；本页不推断未确认的枚举含义 |
| web_url | string | 笔记 H5 页面 URL |
| note_id_str | string | **权威、无损的笔记 ID** |
| message | string | 更新信息，例如“更新于 YYYY-MM-DD hh:mm” |
| forbid_note_entrance | boolean | 上游笔记入口限制标记 |
| likes | number | 点赞数 |
| has_like | boolean | 当前账号是否点赞 |

`getUserNotes(client, ps = 10, pn = 1)` 返回 `Promise<BiliApiResponse<{ list: NoteListItem[]; page: { total: number; size: number; num: number } }>>`；page 分别为总条数、页大小、页码。

`NoteAPI.save` 的返回值改为 `Promise<BiliApiResponse<{ note_id: number }>>`，符合保存接口的数值 JSON。该接口文档**没有**保证返回 `note_id_str`，因此未虚构该字段。不能从已经失真的数值恢复准确 ID；需要继续引用笔记时，从用户笔记列表获取 `note_id_str`，不要对 `note_id` 做字符串转换后冒充无损 ID。

接收 ID 的接口仍保留字符串参数：`getInfo(client, oid: number, noteId: string, oidType = 0)`、`save(..., options.noteId?: string)`、`delete(client, oid: number, noteId: string)`。这里仅调整响应类型，未修改写接口请求行为，测试也不调用真实写接口。

依据：[用户笔记列表](../api-doc/docs/note/list.md)、[保存笔记响应](../api-doc/docs/note/action.md)。列表文档示例的 `note_id` 与 `note_id_str` 不同，正是不能依赖数值字段的原因。

## 图片格式化：仅转换格式也需要 @

`formatImageUrl(url: string, options = {}): string`（也可通过 `CommonAPI.formatImageUrl` 调用）不发网络请求。

| options 字段 | 类型 | 含义 |
| --- | --- | --- |
| width? | number | 最大宽度，追加 `Nw` |
| height? | number | 最大高度，追加 `Nh` |
| quality? | number | 质量百分比，追加 `Nq` |
| format? | `'png' \| 'jpeg' \| 'webp' \| 'avif'` | 输出格式 |
| crop? | `0 \| 1 \| 2 \| 3` | 0 不裁切；1 预设位置（无则右下）；2 左上；3 右上 |

多个参数以 `_` 连接，格式放在末尾；width/height/quality 的 0 值不输出，crop=0 会输出。无选项时原样返回；传入 URL 应是未带变换后缀的原始图片地址，本函数仅拼接参数，不解析或移除已有后缀。

```ts
formatImageUrl('https://i1.hdslb.com/bfs/archive/example.jpg', { format: 'webp' });
// https://i1.hdslb.com/bfs/archive/example.jpg@.webp
formatImageUrl('https://i1.hdslb.com/bfs/archive/example.jpg', { width: 200, format: 'webp' });
// https://i1.hdslb.com/bfs/archive/example.jpg@200w.webp
```

依据：[图片格式化](../api-doc/docs/misc/picture.md)。

## 动态 basic 注释修正（不改实体实现）

`DynamicDetail.item.basic.comment_id_str: string` 是评论区 OID，必须配对 `comment_type: number`；后者取决于内容类型，不能恒定使用 11，例如视频为 1、图文为 11、专栏为 12、文字为 17。`rid_str: string` 是关联资源 ID，不能假定等于评论区 OID；所有字符串 ID 均应原样保留。本次仅修正这些字段注释，不改变字段类型或实体逻辑。

依据：[动态类型表](../api-doc/docs/dynamic/dynamic_enum.md)、[空间动态响应](../api-doc/docs/dynamic/space.md)（包含 comment_id_str 与 rid_str 不同的示例）。

## 验证边界

`src/test/api/pagination-errors.test.ts` 是离线控制流单元测试：覆盖九个生成器的首页错误、第二页错误（null/空列表载荷）、正常空页终止与分页游标。`src/test/api/response-contracts.test.ts` 使用仓库上游文档样例检查响应类型/无损 ID，并验证图片 URL 拼接。它们不是实时网络契约验证；未访问真实账号或执行真实写操作。
