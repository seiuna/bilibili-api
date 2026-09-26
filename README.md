# @seiuna/bilibili-api

<div align="center">

**类型安全的 Bilibili API 客户端**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-GPL--3.0--only-blue)](./LICENSE)

</div>

## API 修复与安全约定

- [用户投稿与关注列表：参数、返回字段及 WBI](./docs/user-lists.md)
- [评论 ID 精度、回复对话类型和实体行为](./docs/comment-identifiers.md)
- [历史记录删除边界与游标分页](./docs/history-safety.md)
- [文章身份与视频/文章读取错误](./docs/article-video-read-safety.md)
- [分页与原始响应契约](./docs/api-pagination-contracts.md)
- [认证流程与传输约定](./docs/authentication.md)
- [HTTP、匿名请求、凭证刷新及 WBI 边界](./docs/transport.md)

## 测试

| 命令 | 范围 |
| --- | --- |
| `npm test` | 单元测试和匿名网络测试，排除 `*.login.test.ts` |
| `npm run test:watch` | 同样排除登录测试的 watch 模式 |
| `npm run test:login` | 仅运行 `*.login.test.ts` 的真实已登录账号读取测试 |
| `npm run test:all` | 先运行默认测试，再运行登录测试 |
| `npm run typecheck` | TypeScript 类型检查 |

登录测试须显式指定已有 Profile，不自动探测账号、不自动扫码、不执行点赞或发评等业务写操作。它验证现有登录态及账号 API，不测试交互式扫码登录流程。SDK 的正常 Cookie 合并和凭证刷新仍可能更新所选 Profile，请使用测试账号。已有 Profile 的 JSON 解析或非文件缺失类读取错误会直接抛出，不会用默认配置覆盖原文件。

PowerShell：

```powershell
$env:BILI_TEST_PROFILE = '你的UID或Profile别名'
npm run test:login
```

Bash：

```bash
BILI_TEST_PROFILE=你的UID或Profile别名 npm run test:login
```

也可指定包含路径分隔符的配置文件路径。缺少配置、凭证失效、网络错误或 API 非零业务码都会使登录测试失败，不会作为成功跳过。凭证应保存在已被 Git 忽略的 `profiles/` 中，不要提交或打印 Cookie。默认测试无需设置 `BILI_TEST_PROFILE`，即使设置了也不会运行登录测试。原 `full-test` 脚本由 `test:all` 取代。

### 创建动态并发表评论（真实写操作，仅显式运行）

`src/test/dynamic/create-comment.write.test.ts` 使用真实账号创建一条带唯一标记的纯文字动态，确认评论区类型及字符串 ID，发表评论，再读取评论验证正文、作者与根评论关系。测试结束时，无论中间断言是否失败，都会尝试删除本次创建的动态；删除失败会报错并输出动态链接。若创建请求超时或返回值缺少 ID，可能无法自动清理，请手动检查账号。测试内容可能在删除前被他人看到。

默认 `npm test`、watch、`test:login` 和 `test:all` **均不运行写操作测试**。仅在明确允许真实发动态、评论和删除后执行：

```powershell
$env:BILI_TEST_PROFILE = '你的测试账号UID或Profile别名'
$env:ENABLE_WRITE_TESTS = '1'
npm run test:write
```

`test:write` 使用独立的 `vitest.write.config.ts`，未设置写开关会失败而不是静默跳过。不自动扫码，测试本身不额外重试发动态或评论。SDK 遇到 `-101` 且存在刷新令牌时会尝试刷新；只自动重试 GET/HEAD，写请求会抛出 `AuthRequiredError`，调用者必须用新 CSRF 重建请求并明确决定是否重试。刷新后仍失败、其他远端错误、风控或内容尚未可读都会使测试失败。请使用专用测试账号。`CommentAPI.add` 和 `CommentAPI.getReply` 的 `oid` 参数支持 `number | string`，动态评论区应传入字符串 ID，不要转成 `number`。

## 安装

```bash
npm install @seiuna/bilibili-api
# 或
pnpm add @seiuna/bilibili-api
```

---

## 快速开始

```ts
import { BiliClient } from '@seiuna/bilibili-api';

// 创建客户端（未认证，仅可调用公开 API）
const client = await BiliClient.create();

// 获取视频（无需登录）
const video = await client.getVideo('BV1GJ411x7h7');
console.log(video.title, video.stat.view, video.owner.name);

// 获取评论区
const area = video.commentArea();
for await (const page of area.list()) {
  for (const c of page.comments) {
    console.log(`${c.member.uname}: ${c.content.message}`);
  }
  break;
}
```

### 登录后使用需要认证的 API

```ts
const authed = await client.ensureLogin({             // ← 返回 BiliClient<HasToken>
  onStatusChange: (status, msg, _, qrcodeTerminal) => {
    console.log(`[${status}] ${msg}`);
    if (qrcodeTerminal) console.log(qrcodeTerminal);
  },
});

// 现在可以调用需要登录的方法
const myInfo = await authed.getMyInfo();               // ✅ 获取当前登录用户信息（实体）
const toView = await authed.getToViewList();           // ✅ 稍后再看列表（实体）
const unread = await authed.message.unreadCount(authed); // ✅ 消息未读计数（底层 API）

// 退出登录后降级为未认证
const anon = await authed.logout();                    // BiliClient<void>
// anon.history.getToViewList(anon);                   // ❌ 编译错误：未认证客户端无法访问需要登录的子 API
```

---

## 架构

```
src/
├── core/                  # 核心层
│   ├── client.ts          # BiliClient<T> — 统一入口
│   ├── config.ts          # ConfigManager — 凭证持久化
│   ├── auth.ts            # 登录模块（二维码/密码/短信）
│   ├── sign.ts            # APP 签名 + WBI 签名
│   └── types.ts           # 全局公共类型
├── api/                   # API 层
│   ├── video.ts           # VideoAPI
│   ├── user.ts            # UserAPI
│   ├── comment.ts         # CommentAPI
│   ├── message.ts         # MessageAPI
│   ├── dynamic.ts         # DynamicAPI
│   ├── article.ts         # ArticleAPI
│   ├── search.ts          # SearchAPI
│   ├── history.ts         # HistoryAPI
│   ├── favorite.ts        # FavoriteAPI
│   ├── danmaku.ts         # DanmakuAPI
│   ├── emoji.ts           # EmojiAPI
│   ├── note.ts            # NoteAPI
│   ├── electric.ts        # ElectricAPI
│   ├── ranking.ts         # RankingAPI
│   ├── live.ts            # LiveAPI
│   ├── upload.ts          # UploadAPI
│   ├── opus.ts            # OpusAPI
│   └── common.ts          # 公共工具（av/bv转换、图片格式化等）
└── entities/              # Entity
    ├── Video.ts           # Video — 视频
    ├── User.ts            # User — 用户
    ├── Comment.ts         # Comment — 单条评论
    ├── CommentArea.ts     # CommentArea — 评论区绑定
    ├── Article.ts         # Article — 专栏
    ├── Dynamic.ts         # Dynamic — 动态
    ├── Opus.ts            # Opus — 图文
    ├── LiveRoom.ts        # LiveRoom — 直播间
    ├── FavoriteFolder.ts  # FavoriteFolder — 收藏夹
    ├── NotifyItem.ts      # ReplyNotifyItem / AtNotifyItem
    └── BaseEntity.ts      # 基类
```

---

## API 总览

### 门面方法（Facade）— 通过 `BiliClient` 实例调用

| 方法 | 返回 | 说明 | 需登录 |
| ------ | ------ | ------ | -------- |
| `getVideo(bvid)` | `Video` | 获取视频 | 否 |
| `getVideoByAid(aid)` | `Video` | 通过 avid 获取视频 | 否 |
| `getUser(mid)` | `User` | 获取用户 | 否 |
| `getArticle(cvid)` | `Article` | 获取专栏 | 否 |
| `getDynamic(id)` | `Dynamic` | 获取动态 | 否 |
| `getOpus(id)` | `Opus` | 获取图文 | 否 |
| `getLiveRoom(roomId)` | `LiveRoom` | 获取直播间 | 否 |
| `getFavoriteFolder(mediaId)` | `FavoriteFolder` | 获取收藏夹 | 否 |
| `getComment(oid, replyType, rpid)` | `Comment` | 获取单条评论 | 否 |
| `resolveComment(rpid, hint?)` | `Comment` | 自动定位并获取评论 | 否 |
| `getMyInfo()` | `MyInfoEntity` | 当前登录用户空间信息 | **是** |
| `getNavInfo()` | `NavInfoEntity` | 导航栏用户信息 | **是** |
| `getCurrentUser()` | `User` | 当前登录用户实体 | **是** |
| `getHistory()` | AsyncGenerator\<`HistoryItemEntity`\> | 翻页获取历史记录 | **是** |
| `getHistoryPage(ps, type, max, viewAt)` | `HistoryDataEntity` | 单页获取历史记录（游标分页） | **是** |
| `getToViewList()` | `ToViewListEntity` | 稍后再看列表 | **是** |
| `getAtFeedPage(cursorId?, cursorTime?)` | `AtFeedEntity` | 单页 "@我的" 通知 | **是** |
| `getReplyFeedPage(cursorId?, cursorTime?)` | `ReplyFeedEntity` | 单页 "回复我的" 通知 | **是** |
| `atFeed()` | AsyncGenerator\<`AtNotifyItem`\> | 翻页获取 "@我的" 通知 | **是** |
| `replyFeed()` | AsyncGenerator\<`ReplyNotifyItem`\> | 翻页获取 "回复我的" 通知 | **是** |
| `createDynamic(opts)` | `BiliApiResponse` | 发布动态（写操作，保留原始响应） | **是** |
| `publishDynamic(opts)` | `Dynamic` | 发布动态并返回实体 | **是** |
| `createVote(opts)` | `BiliApiResponse` | 发起投票（写操作，保留原始响应） | **是** |

> **实体命名约定**：与资源同名的一级实体直接用资源名（`Video`、`User`、`Article`、`Dynamic`、`Opus`、`LiveRoom`、`FavoriteFolder`、`Comment`）；附属实体统一加 `Entity` 后缀以避免与同名 raw 类型冲突（如 `VideoStatEntity`、`HistoryDataEntity`）。底层 API 类（`VideoAPI` / `CommentAPI` 等）仍返回原始 `BiliApiResponse`。

### 子 API 调用范式 — 通过静态类或 `client.<name>` 访问

底层子 API 以**静态类（Static Classes）**方式提供。多数普通 JSON 请求方法以 `client` 实例为第一个参数，返回 `Promise<BiliApiResponse<T>>`，但以下方法使用不同的契约：

- `DanmakuAPI.getXmlDanmaku(client, cid)` 返回 `Promise<string>`（XML 文本）；HTTP 非 2xx 和网络错误会抛出，不会把错误页当作空弹幕池。该方法不额外校验成功响应的 XML 结构。
- `SearchAPI.getSuggest(client, term)` 返回包含 `code` 和 `result.tag` 的对象（由 Promise 包装），而不是标准的 `data` 包装。
- 分页方法（如 `MessageAPI.sessions(client)`）返回 `AsyncGenerator`，通过 `for await...of` 消费。
- `CommonAPI.av2bv(aid)`、`CommonAPI.bv2av(bvid)`、`CommonAPI.getCurrentTimestamp()` 等纯工具方法不接收 `client`。

支持两种完全等价的调用风格：

```ts
// 方式一：直接导入静态 API 类（推荐）
import { VideoAPI, SearchAPI } from '@seiuna/bilibili-api';

const info = await VideoAPI.getInfo(client, 'BV1GJ411x7h7');
const searchResult = await SearchAPI.searchAll(client, '哔哩哔哩');

// 方式二：通过 client 实例属性访问对应静态类
const info2 = await client.video.getInfo(client, 'BV1GJ411x7h7');
const searchResult2 = await client.search.searchAll(client, '哔哩哔哩');
```

| 子 API | 入口 | 需登录 getter | 需登录 setter |
| -------- | ------------ | -------------- | -------------- |
| 视频 | `client.video` | 否 | 是 |
| 用户 | `client.user` | 否 | 是 |
| 评论 | `client.comment` | 否 | 是 |
| 搜索 | `client.search` | 否 | — |
| 排行 | `client.ranking` | 否 | — |
| 表情 | `client.emoji` | 否 | — |
| 弹幕 | `client.danmaku` | 否 | 是 |
| 动态 | `client.dynamic` | 否 | 是 |
| 专栏 | `client.article` | 否 | 是 |
| 图文 | `client.opus` | 否 | — |
| 直播 | `client.live` | 否 | 是 |
| 收藏夹 | `client.favorite` | 否 | 是 |
| 消息 | `client.message` | **是** | — |
| 历史 | `client.history` | **是** | — |
| 笔记 | `client.note` | **是** | — |
| 充电 | `client.electric` | **是** | — |
| 上传 | `client.upload` | **是** | — |

---

## 登录

### Web 端扫码（推荐）

```ts
import { QrcodeStatus } from '@seiuna/bilibili-api';

const authed = await client.loginByQrcode({
  pollInterval: 2000,       // 轮询间隔
  timeout: 180_000,         // 超时（3分钟）
  onStatusChange: (status, msg, base64, terminal) => {
    if (status === QrcodeStatus.NOT_SCANNED) {
      if (terminal) console.log(terminal);
    }
  },
});
// authed: BiliClient<HasToken>
```

### 自动登录（推荐）

```ts
const authed = await client.ensureLogin({
  onStatusChange: (status, msg, _, terminal) => {
    console.log(`[${status}] ${msg}`);
    if (terminal) console.log(terminal);
  },
});
// 仅明确未登录或凭证失效时尝试刷新/二维码；网络、HTTP、解析与其他业务错误直接抛出。
```

### 密码登录

```ts
const authed = await client.loginByPassword('username', 'password');
```

### 退出登录

```ts
const anon = await authed.logout();   // BiliClient<void>
```

---

## 视频

```ts
// 门面方法（推荐）
const video = await client.getVideo('BV1GJ411x7h7');
console.log(video.title);
console.log(`播放: ${video.stat.view}  点赞: ${video.stat.like}`);

// 视频流地址（返回 PlayUrlEntity 实体，直接通过 getter 访问属性，无需 .data）
const playUrl = await video.getPlayUrl({ qn: 80, fnval: 16 });
console.log(playUrl.dash?.video[0]?.baseUrl);

// AI 摘要
const summary = await video.getAiSummary();

// 高能进度条
const pbp = await video.getPbp();

// 视频 TAG
const tags = await video.getTags();

// 推荐视频
const related = await video.getRecommend();

// 互动操作
await video.like();
await video.coin(2, true);      // 投 2 币 + 同时点赞
await video.triple();           // 一键三连
```

---

## 评论

### 评论区分页

```ts
import { ReplySort, CommentArea } from '@seiuna/bilibili-api';

const area = new CommentArea(authed, oid, type);
// 或快捷访问: video.commentArea()

for await (const page of area.list(ReplySort.TIME)) {
  for (const comment of page.comments) {
    console.log(`${comment.member.uname}: ${comment.content.message}`);
  }
  // page.hots — 热评
}

// 单页精准获取
const singlePage = await area.getPage(1, ReplySort.TIME, 20);
console.log(`总数: ${singlePage.data.page.acount}, 当前获取: ${singlePage.data.replies?.length}`);
```

### 精确查找评论

`CommentAPI.getReply(client, oid, replyType, rpid)` 返回 `Promise<BiliApiResponse<ReplyEntry | null>>`。`oid` 和 `rpid` 接受正整数或十进制字符串，超出安全整数范围时必须使用字符串；输入两端空白会被移除。方法优先按响应的 `rpid_str` 匹配，并遍历根评论及子评论。上游失败或响应中不包含指定评论时，`data` 为 `null`，不会返回其他评论代替目标；`code`、`message`、`ttl` 保留上游值，因此 `code === 0` 后仍需检查 `data`。`rpid` 是所需评论的 ID，不固定对应通知的 `target_id`。

### 从评论获取所属资源

`Comment.getDynamic(): Promise<Dynamic>` 仅支持 `type=17` 的动态评论，优先使用原始响应的 `dynamic_id_str`，仅当 `oid` 为正的安全整数时才回退使用它。缺少可靠 ID 时会抛出错误，不发送可能已丢失精度的 ID。`type=11` 的 `oid` 是图文动态的 `doc_id`，不能直接作为动态 ID。

`Comment.getSubject(): Promise<Video | Dynamic>` 对 `type=1` 调用 `getVideo()`，对 `type=17` 调用 `getDynamic()`；其他类型会抛出错误。

### 发表 / 回复 / 带图

```ts
// 一级评论
const { data } = await area.add('评论内容');
console.log(`rpid=${data.rpid}`);

// 回复某条评论
await area.add('回复内容', rootRpid, parentRpid);

// 上传图片后发表带图评论
const img = await authed.upload.image(authed, './cat.png');
await area.add('带图评论', 0, 0, [img.data]);
```

### 点赞 / 点踩 / 删除 / 举报 / 置顶

```ts
const c = new Comment(authed, replyEntry, oid);
await c.like();
await c.hate();
await c.reply('回复');
await c.delete();
await c.report(ReplyReportReason.SPAM);
await c.top(true);
```

### CommentAPI 直接调用

```ts
import { CommentAPI } from '@seiuna/bilibili-api';

// 评论总数
const { data } = await CommentAPI.replyCount(authed, aid, 1);

// 翻页查询
for await (const page of CommentAPI.replies(authed, aid, 1, ReplySort.TIME)) { }

// 懒加载翻页
for await (const { cursor, comments } of CommentAPI.repliesWbi(authed, aid, 1)) { }

// 热评
for await (const page of CommentAPI.hotReplies(authed, aid, 1)) { }
```

---

## 用户

```ts
const user = await client.getUser(mid);
console.log(user.name, user.level, user.sign);

const stat = await user.getStat();      // following/follower
const upStat = await user.getUpStat();  // archive.view/likes

const medals = await user.getMedalWall();

await user.follow();
await user.unfollow();
await user.block();
```

### UserAPI

```ts
import { UserAPI } from '@seiuna/bilibili-api';

const info = await UserAPI.getInfo(authed, mid);
const stat = await UserAPI.getRelationStat(authed, vmid);
const log  = await UserAPI.getLoginLog(authed);
const uid  = await UserAPI.nameToUid(authed, 'bilibili');
```

---

## 消息与私信

```ts
// 门面方法（推荐：逐项返回 NotifyItem 包装实体，直接通过 getter 取值）
for await (const item of authed.replyFeed()) {
  console.log(`${item.authorName}: ${item.content}`);
}

for await (const item of authed.atFeed()) {
  console.log(`${item.authorName}: ${item.content}`);
}

// 底层 MessageAPI 调用（传入客户端实例）
import { MessageAPI } from '@seiuna/bilibili-api';

// 未读计数
const unread = await MessageAPI.unreadCount(authed);
console.log(`回复:${unread.data.reply}  @:${unread.data.at}`);

// 会话列表
for await (const { sessions } of MessageAPI.sessions(authed)) { }

// 消息中心设置
const settings = await MessageAPI.getSettings(authed);
```

### 自动处理 @ 和 回复

```ts
const client = await BiliClient.create();

const authedClient = await client.ensureLogin({
  onStatusChange: (status, msg, _qrcodeBase64, qrcodeTerminal) => {
    console.log(`[${status}] ${msg}`);
    if (qrcodeTerminal) console.log(qrcodeTerminal);
  },
});

const interval = setInterval(async () => {
  const count = await MessageAPI.unreadCount(authedClient);
  if (count.data.at) {
    let atCount = count.data.at;
    for await (const rawItem of MessageAPI.atFeed(authedClient)) {
      if (atCount-- <= 0) break;
      const atItem = new AtNotifyItem(authedClient, rawItem);
      console.log(`#${atItem.sourceId} [${atItem.businessId}]: ${atItem.content}`);
      await atItem.reply(atItem.content);
    }
    console.log('未读消息数:', count.data.at);
  }
}, 10000);

```

---

## 搜索

```ts
import { SearchAPI } from '@seiuna/bilibili-api';

// 综合搜索
const result = await SearchAPI.searchAll(client, 'meow');

// 热搜
const hot = await SearchAPI.getHotSearch(client, 10);
// 原始响应保留 trending 层级；非零 code 应使用 assertOk 检查。
const hotWords = hot.data.trending.list;

// 搜索建议
const suggest = await SearchAPI.getSuggest(client, 'bilibili');
```

---

## 历史记录与稍后再看

```ts
// 门面方法（推荐：逐项返回 HistoryItemEntity 实体）
for await (const item of authed.getHistory(30)) {
  console.log(item.title, item.progress);
}

// 稍后再看（返回 ToViewListEntity 实体）
const toView = await authed.getToViewList();
console.log(`待看视频数: ${toView.count}`);

// 底层 HistoryAPI 操作
import { HistoryAPI } from '@seiuna/bilibili-api';

await HistoryAPI.addToView(authed, aid);
await HistoryAPI.removeFromView(authed, aid);
```

---

## 收藏夹

```ts
// 门面方法（推荐：获取 FavoriteFolder 实体）
const folder = await client.getFavoriteFolder(mediaId);
console.log(folder.title, folder.mediaCount);

// 翻页遍历收藏夹内容（返回 FavoriteMediaEntity 实体）
for await (const media of folder.medias(20)) {
  console.log(media.title, media.bvid);
}

// 底层 FavoriteAPI 访问
import { FavoriteAPI } from '@seiuna/bilibili-api';

const folders = await FavoriteAPI.getCreatedFolders(client, mid);
if (folders.data?.list?.length) {
  const f = folders.data.list[0];
  const contents = await FavoriteAPI.getFolderList(client, f.id);
}
```

---

## 弹幕

```ts
import { DanmakuAPI } from '@seiuna/bilibili-api';

// 获取 XML 实时弹幕（公开接口）
const xml = await DanmakuAPI.getXmlDanmaku(client, cid);

// 历史弹幕日期索引（需登录）
const dates = await DanmakuAPI.getHistoryDates(authed, cid, '2025-07');

// 发送弹幕（需登录）
await DanmakuAPI.postDanmaku(authed, oid, '弹幕内容', { aid, progress: 10000 });
```

---

## 表情

```ts
import { EmojiAPI } from '@seiuna/bilibili-api';

const panel = await EmojiAPI.getPanel(client, 'reply');
// panel.data.packages[].emote[] — 每个表情包内的表情列表
```

---

## 笔记

```ts
const note = authed.note;   // 需登录

// 检查视频是否禁止笔记
const { data } = await note.isForbid(authed, aid);

// 获取用户笔记列表
const list = await note.getUserNotes(authed);
```

---

## 动态

```ts
const dyn = client.dynamic;

// 1. 发布纯文本动态
const res1 = await authed.createDynamic('大家好，这是一条测试动态！');
console.log('发布成功，动态 ID:', res1.data.dyn_id_str);

// 2. 发布带 @用户 的动态
await authed.createDynamic({
  content: '欢迎关注 @哔哩哔哩弹幕网 和 @小助手 哦',
  at: [
    { name: '哔哩哔哩弹幕网', mid: 208259 },
    { name: '小助手', mid: 99999 },
  ],
});

// 3. 发布带图片的动态（支持本地文件路径、Buffer 二进制、网络图片或已上传对象）
await authed.createDynamic({
  content: '今天天气不错，分享两张照片~',
  images: [
    './photos/pic1.jpg', // 本地图片路径，自动上传至 B 站 BFS
    './photos/pic2.png',
  ],
  closeComment: false, // 是否关闭评论区
});

// 4. 发起投票动态（自动创建投票卡片并关联到动态）
await authed.createDynamic({
  content: '大家更喜欢吃什么夜宵呢？',
  vote: {
    title: '深夜夜宵选择',
    options: ['烧烤', '炸鸡', '小龙虾', '轻食水果'],
    choiceCount: 1,      // 单选或多选
    duration: 7 * 86400, // 持续时间（秒）
  },
});

// 5. 组合发布（图文 + @ + 投票 + 精选评论控制）
const dynEntity = await authed.publishDynamic({
  content: '带图带投票全能动态测试 @朋友',
  at: [{ name: '朋友', mid: 123456 }],
  images: ['./cover.png'],
  vote: {
    title: '投票标题',
    options: ['支持', '反对'],
  },
  upChooseComment: true, // 开启精选评论
});
// 返回 Dynamic 实体，可直接调用实体方法：
await dynEntity.like(); // 点赞本条动态

// 空间动态与列表
const feed = await dyn.getSpace(authed, mid);

// 动态管理
await dyn.like(authed, dynIdStr);
await dyn.delete(authed, dynamicId);
await dyn.setTop(authed, dynStr);
```

---

## 专栏与图文

```ts
// 专栏
const article = await client.getArticle(cvid);
console.log(article.title);

// 图文
const opus = await client.getOpus('1216412988246851587');
const opusArea = opus.commentArea();
```

---

## 排行与热门

```ts
import { RankingAPI } from '@seiuna/bilibili-api';

// 热门视频
const popular = await RankingAPI.getPopular(client, 1, 20);

// 排行榜
const ranking = await RankingAPI.getRanking(client, 0, 'all');

// 入站必刷
const precious = await RankingAPI.getPreciousVideos(client);
```

---

## 直播

```ts
// 门面方法（推荐：返回 LiveRoom 实体）
const room = await client.getLiveRoom(roomId);
console.log(`标题: ${room.title}  在线: ${room.online}  短号: ${room.shortId}`);

// 底层 LiveAPI 静态类调用
import { LiveAPI } from '@seiuna/bilibili-api';

const res = await LiveAPI.getRoomInfo(client, roomId);
console.log(`标题: ${res.data.title}  在线: ${res.data.online}`);
```

---

## 充电

```ts
const elec = authed.electric;   

const list = await elec.getMonthlyChargeList(authed, mid);
const show = await elec.getVideoChargeShow(authed, mid, aid);
```

---

## 上传

```ts
const upload = authed.upload;  

// 上传本地图片
const img = await upload.image(authed, './image.png');

// 上传 base64
const b64 = await upload.uploadFromBase64(authed, base64Str);

// 从 URL 下载后上传
const url = await upload.uploadFromUrl(authed, 'https://example.com/pic.jpg');
```

---

## 公共工具

```ts
import { av2bv, bv2av, formatImageUrl } from '@seiuna/bilibili-api';

av2bv(170001);                 // "BV17x411w7KC"
bv2av('BV17x411w7KC');         // 170001

av2bv(80433022);               // "BV1GJ411x7h7"
bv2av('BV1GJ411x7h7');         // 80433022

// 图片 CDN 参数格式化
formatImageUrl(url, { width: 200, height: 200, format: 'webp' });

// APP 签名
import { signParams, buildSignedQuery, KNOWN_APPKEYS } from '@seiuna/bilibili-api';
const query = buildSignedQuery({ foo: 1 }, KNOWN_APPKEYS.tv.appkey, KNOWN_APPKEYS.tv.appsec);

// WBI 签名
import { wbiSign, buildWbiSignedQuery } from '@seiuna/bilibili-api';
const signed = wbiSign({ id: 123 }, imgKey, subKey);
```

---

## 凭证持久化与多账号管理 (Profiles)

### 1. 默认保存为 `profiles/<userid>.json`
登录后凭证将根据账号 UID 自动保存为 `profiles/<userid>.json`（例如 `profiles/390794259.json`），无需手动建档：

```json
{
  "cookie": "DedeUserID=390794259; SESSDATA=xxx; bili_jct=yyy; ...",
  "refreshToken": "...",
  "mid": 390794259
}
```

### 2. 多账号加载与指定 Profile
- **默认加载**：`BiliClient.create()` 自动探测已有 profile；若不存在，登录成功后自动创建 `profiles/<userid>.json`。
- **指定账号**：通过数字 UID 或 Profile 名直接加载：
  ```ts
  const clientA = await BiliClient.create(390794259);
  const clientB = await BiliClient.create('sub_account');
  ```
- **自定义路径**：传入文件路径兼容自定义存储：
  ```ts
  const clientCustom = await BiliClient.create('./my-config.json');
  ```

> ⚠️ **多账号并发提示**：在多进程或多实例并发初始化时，无参调用 `BiliClient.create()` 依赖扫描目录获取最新修改的 Profile，可能存在状态不确定性。在并发或多账号场景下，**强烈建议显式指定 UID 或 Profile 别名**，或统一使用 `fromProfiles` 进行批量加载。

### 3. 函数式批量加载客户端 (`fromProfiles`)
可通过函数式谓词从 `profiles/` 批量筛选并初始化客户端：

```ts
import { ConfigManager, BiliClient } from '@seiuna/bilibili-api';

// 场景 1：无条件创建所有已有 Profile 的客户端
const allClients = await BiliClient.fromProfiles();

// 场景 2：函数式筛选仅创建已登录的客户端
const authedClients = await ConfigManager.fromProfiles((user, isRequestLogin) => {
  return isRequestLogin; // 只选有登录凭证的账号
});

// 场景 3：根据 UID 列表定向加载
const myClients = await BiliClient.fromProfiles((user) => {
  return ['390794259', '123456789'].includes(user.userId);
});
```

*(兼容说明：若根目录下存在旧版 `bili-config.json`，系统会自动平滑迁移至 `profiles/<userid>.json` 并备份为 `bili-config.json.bak`)*

---

## 日志系统与自定义 Logger

SDK 默认内置零额外依赖的轻量彩色控制台 Logger，不强绑第三方重型日志库：

```ts
import { logger, getLogger, setLogger } from '@seiuna/bilibili-api';

// 1. 直接使用内置 Logger（可通过环境变量 LOG_LEVEL 控制 debug/info/warn/error）
logger.info('这是一条信息日志');

// 2. 自定义注入外部 Logger（如 Winston / Pino / log4js 实例）
setLogger({
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
});
```

---

## 注意事项

- `SESSDATA` 和 `bili_jct` 可操控账号，**有泄露风险，本地存储没有加密**
- 部分 Opus / Dynamic ID 超过 `Number.MAX_SAFE_INTEGER`，请用字符串传参
- 登录信息存储在本地 JSON 文件中

---

<div align="center">

Meow Meow Meow Meow Meow ~

</div>
