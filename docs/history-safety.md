# 历史记录：删除边界与分页错误

## 删除单条与清空全部

`HistoryAPI.clearHistory(client): Promise<BiliApiResponse<unknown>>` **清空账号全部历史记录**，发送 `/x/v2/history/clear`。它不接受记录 ID。旧版的可选数字 `kid` 参数会被服务端忽略而清空全部历史，因此现在类型层禁止该参数，运行时收到非 `undefined` 的第二参数会在发送请求之前抛出 `TypeError`。

删除一条记录请使用：

```ts
import { HistoryAPI } from '@seiuna/bilibili-api';
// 真实写操作，只有明确需要删除时才执行。
await HistoryAPI.deleteHistory(client, 'archive_540580868');
```

`deleteHistory(client, kid: string): Promise<BiliApiResponse<unknown>>` 调用 `/x/v2/history/delete`。`kid` 必须是业务前缀加正十进制 ID：`archive_avid`、`live_roomid`、`article_cvid`、`pgc_ssid`、`article-list_rlid`。ID 字符串不会转成数字；格式错误在请求前抛出 `TypeError`。两种写接口均需要登录 Cookie 和 CSRF，返回原始业务响应；调用者必须检查 `code`，可使用 `assertOk`。

## 游标分页

`HistoryAPI.getHistory(client, ps = 20, type = 'all', max?, viewAt?, business?)` 返回 `Promise<BiliApiResponse<HistoryData>>`。`type` 是 `'all' | 'archive' | 'live' | 'article'`；`max` 和 `viewAt` 是数字，`business` 是字符串，应来自上页 `data.cursor`，三者需一起传递。每页 `ps` 上限为 30。

`client.getHistoryPage(ps?, type?, max?, viewAt?, business?)` 是需要认证的实体包装方法，返回 `Promise<HistoryDataEntity>`。

`HistoryAPI.history(client, ps = 20, type = 'all'): AsyncGenerator<HistoryItem>` 自动传递完整游标。任何页的非零业务码都抛出 `BiliApiError`，不会返回看似完整的部分历史；空列表或没有下一页游标才正常结束。

离线回归：`src/test/core/history-safety.test.ts` 验证目标 URL、精确 ID、清空防护和第二页失败。未执行真实删除或清空操作。
