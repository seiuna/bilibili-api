# @seiuna/bilibili-api

<div align="center">

**类型安全的 Bilibili API 客户端**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)

</div>

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
const myInfo = await authed.getMyInfo();               // ✅ 获取当前登录用户信息
const toView = await authed.history.getToViewList();  // ✅
const unread = await authed.message.unreadCount();     // ✅

// 退出登录后降级为未认证
const anon = await authed.logout();                    // BiliClient<void>
// anon.history.getToViewList();                       // ❌ 编译错误
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
| `getHistory()` | AsyncGenerator | 翻页获取历史记录 | **是** |
| `getToViewList()` | `ToViewVideo[]` | 稍后再看列表 | **是** |

### 子 API — 通过 `client.video` / `client.user` / `client.comment` 等访问

所有子 API 以**静态类**方式提供，也可独立导入使用：

```ts
import { VideoAPI } from '@seiuna/bilibili-api';

const info = await VideoAPI.getInfo(client, 'BV1GJ411x7h7');
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
// 优先序：已有 cookie → refresh_token 刷新 → 弹出二维码
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

// 视频流地址
const playUrl = await video.getPlayUrl({ qn: 80, fnval: 16 });
console.log(playUrl.data.dash?.video[0]?.baseUrl);

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
```

### 发表 / 回复 / 带图

```ts
// 一级评论
const { data } = await area.add('评论内容');
console.log(`rpid=${data.rpid}`);

// 回复某条评论
await area.add('回复内容', rootRpid, parentRpid);

// 上传图片后发表带图评论
const img = await authed.upload.image('./cat.png');
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
const msg = authed.message;

// 未读计数
const unread = await msg.unreadCount();
console.log(`回复:${unread.data.reply}  @:${unread.data.at}`);

// "回复我的" 翻页
for await (const item of msg.replyFeed()) {
  console.log(`${item.user.nickname}: ${item.item.source_content}`);
}

// "@我的" 翻页
for await (const item of msg.atFeed()) { }

// 会话列表
for await (const { sessions } of msg.sessions()) { }

// 消息中心设置
const settings = await msg.getSettings();
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
const search = client.search;

// 综合搜索
const result = await search.searchAll(authed, 'meow');

// 热搜
const hot = await search.getHotSearch(authed, 10);

// 搜索建议
const suggest = await search.getSuggest(authed, 'bilibili');
```

---

## 历史记录与稍后再看

```ts
const history = authed.history;   // 需登录

// 翻页获取历史
for await (const item of history.history(authed, 30)) {
  console.log(item.title, item.progress);
}

// 稍后再看
const list = await history.getToViewList(authed);
await history.addToView(authed, aid);
await history.removeFromView(authed, aid);
```

---

## 收藏夹

```ts
const fav = client.favorite;

// 获取收藏夹列表
const folders = await fav.getCreatedFolders(authed, mid);
if (folders.data.list?.length) {
  const folder = folders.data.list[0];

  // 获取内容
  const contents = await fav.getFolderList(authed, folder.id);
}
```

---

## 弹幕

```ts
const dm = client.danmaku;

// 历史弹幕日期索引
const dates = await dm.getHistoryDates(authed, cid, '2025-07');

// 发送弹幕
await dm.postDanmaku(authed, oid, '弹幕内容', { aid, progress: 10000 });
```

---

## 表情

```ts
const emoji = client.emoji;

const panel = await emoji.getPanel(authed);
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

// 空间动态
const feed = await dyn.getSpace(authed, mid);

// 动态操作
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
const rank = client.ranking;

// 热门视频
const popular = await rank.getPopular(authed);

// 排行榜
const ranking = await rank.getRanking(authed);

// 入站必刷
const precious = await rank.getPreciousVideos(authed);
```

---

## 直播

```ts
const live = client.live;

const room = await live.getRoomInfo(authed, roomId);
console.log(`标题: ${room.data.title}  在线: ${room.data.online}`);
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

av2bv(170001);                 // "BV1xx411c7mD"
bv2av('BV1xx411c7mD');         // 170001

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

*(兼容说明：若根目录下存在旧版 `bili-config.json`，系统会自动平滑迁移至 `profiles/<userid>.json`)*

---

## 注意事项

- `SESSDATA` 和 `bili_jct` 可操控账号，**有泄露风险，本地存储没有加密**
- 部分 Opus / Dynamic ID 超过 `Number.MAX_SAFE_INTEGER`，请用字符串传参
- 登录信息存储在本地 JSON 文件中

---

<div align="center">

Meow Meow Meow Meow Meow ~

</div>
