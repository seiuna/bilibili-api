# bilibili-api



<div align="center">



**类型安全的 Bilibili API 客户端 — 扫码登录、评论区、私信、用户空间、图片上传，支持自动凭证刷新与 Generator 分页**



*支持扫码登录、评论区操作、私信、动态、用户空间、图片上传... 你需要的都有*



[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)](https://nodejs.org/)

[![License](https://img.shields.io/badge/License-MIT-yellow)](./LICENSE)



</div>



---



## 功能



- **二维码登录** — Web 端 & TV 端两种登录方式，终终端里直接扫码，也支持 base64 图片渲染到 UI

- **自动续期** — Cookie 失效时自动用 `refresh_token` 刷新，无需频繁扫码

- **Async Generator 翻页** — 评论区、通知、私信全部用 `for await...of` 遍历，再也不用手动处理分页逻辑

- **链式查询** — 视频 → 评论区 → 用户，关联数据一键串联

- **轻量无冗余** — 只依赖 `qrcode`（生成二维码）和 `zod`（可选校验）



---



## 安装



```bash

npm install @seiuna/bilibili-api

# 或

yarn add @seiuna/bilibili-api

# 或

pnpm add @seiuna/bilibili-api

```



### 从 GitHub Packages 安装





```bash

echo "@seiuna:registry=https://npm.pkg.github.com" >> .npmrc

```





```bash

npm login --registry=https://npm.pkg.github.com

# Username: 你的 GitHub 用户名

# Password: 你的 GitHub Personal Access Token（需要 read:packages 权限）

```



---



## 快速开始



```ts

import { BiliClient } from '@seiuna/bilibili-api';



// 1. 创建客户端（配置自动持久化到 bili-config.json）

const client = await BiliClient.create();



// 2. 扫码登录（终端会打印二维码）

const login = await client.ensureLogin({

  onStatusChange: (status, msg, _, qrcodeTerminal) => {

    console.log(`[${status}] ${msg}`);

    if (qrcodeTerminal) console.log(qrcodeTerminal);

  },

});



if (!login.success) {

  console.error('登录失败:', login.message);

  process.exit(1);

}



console.log('登录成功！');



```

> 扫码一次后，cookie 会存到本地文件，下次启动自动复用，不用重复扫码。


---



## API 总览





| API | 入口 | 功能 |

|---|---|---|

| 视频 | `client.video(bvid).fetch()` | 获取视频详情、数据统计 |

| 评论 | `client.comment` / `new CommentArea()` | 评论翻页、发评、点赞、举报、置顶、删除 |

| 用户 | `video.getUser()` / `UserQuery` | 用户卡片、等级、VIP 信息 |

| 通知 | `client.notify` | 未读计数、"回复我的"、"@我的" 翻页 |

| 私信 | `client.chat` | 会话列表、详情、免打扰、拦截、标记已读 |

| 空间 | `client.space` | 置顶视频、代表作、TAG、公告、隐私、头图 |

| 上传 | `client.upload` | 上传图片到 B 站（文件/base64/URL） |



---



## 登录



### Web 端扫码（推荐）



```ts

const result = await client.loginByQrcode({

  pollInterval: 2000,       // 轮询间隔（毫秒）

  timeout: 180_000,         // 超时（3分钟）

  onStatusChange: (status, msg, base64, terminal) => {

    // status: NOT_SCANNED → NOT_CONFIRMED → SUCCESS

    // base64: data:image/png;base64,

    // terminal: ANSI 终端二维码字符

    if (status === QrcodeStatus.NOT_SCANNED && terminal) {

      console.log(terminal);

    }

  },

});

```



### TV 端扫码（云视听小电视）



```ts

const result = await client.loginByTvQrcode({

  pollInterval: 2000,

  timeout: 180_000,

  onStatusChange: (status, msg) => console.log(msg),

  appKeyPair: KNOWN_APPKEYS.tv,  // 可换其他 APPKEY

});

```



### 自动登录



`ensureLogin()`



```ts

const result = await client.ensureLogin({

  onStatusChange: (status, msg, _, terminal) => {

    console.log(`[${status}] ${msg}`);

    if (terminal) console.log(terminal);

  },

});



// 1. cookie 有效 → 直接返回

// 2. cookie 过期但有 refresh_token → 刷新

// 3. 都没有 → 弹出二维码

```



### 检查登录状态



```ts

const { loggedIn, mid } = await client.isLoggedIn();

```



---



## 视频查询



```ts

const video = await client.video('BV1xx411c7mD').fetch();



console.log(video.title);       // 视频标题

console.log(video.owner.name);  // UP 主名字

console.log(video.stat.view);   // 播放量

console.log(video.stat.like);   // 点赞数

console.log(video.desc);        // 视频简介

```



`VideoResult` 还串联了评论和用户查询：



```ts

const video = await client.video('BV1xx411c7mD').fetch();



// 获取 UP 主信息

const up = await video.getUser();

console.log(up.name, up.fans, up.level_info.current_level);



// 获取视频评论区

const area = video.commentArea();

for await (const { comments } of area.list()) {

  comments.forEach(c => console.log(`${c.member.uname}: ${c.content.message}`));

}

```



---



## 评论



### 评论区翻页



```ts

import { CommentArea, ReplySort } from '@seiuna/bilibili-api';



const area = new CommentArea(client, 398870552, 11); // oid=动态ID, type=11(动态)

// 也可用 video.commentArea() 或 comment.commentArea() 自动创建



for await (const page of area.list(ReplySort.TIME)) {

  console.log(`--- 第 ${page.page} 页 ---`);

  for (const comment of page.comments) {

    console.log(`#${comment.rpid} ${comment.member.uname}: ${comment.content.message.slice(0, 50)}`);

  }

  if (page.hots) {

    console.log(`热评 ${page.hots.length} 条`);

  }

}

```



### 发表评论 / 回复



```ts

// 一级评论

const result = await area.add('这是评论内容');

console.log('评论成功, rpid:', result.data.rpid);



// 回复某条评论

const img = await client.upload.image('./cute-cat.png');

await area.add('好可爱的猫猫！', rootRpid, parentRpid, [img]);

```



### 点赞 / 点踩 / 置顶 / 举报 / 删除





```ts

for await (const { comments } of area.list()) {

  for (const comment of comments) {

    await comment.like();            // 点赞

    await comment.hate();            // 点踩

    await comment.top();             // 置顶

    await comment.delete();          // 删除

    await comment.report(ReplyReportReason.SPAM, '这是垃圾广告');



    // 快捷回复

    await comment.reply('喵~');

  }

}

```



### 懒加载排序（ReplyMode）



```ts

const api = client.comment;

for await (const { cursor, comments } of api.repliesWbi(oid, 1, ReplyMode.HEAT)) {

  console.log(`cursor=${cursor}, ${comments.length} 条`);

}

```



---



## 通知中心



```ts

const notify = client.notify;



// 未读计数

const unread = await notify.unreadCount();

console.log(`回复:${unread.data.recv_reply}  @我:${unread.data.at}  私信:${unread.data.chat}`);



// "回复我的" 翻页

for await (const item of notify.replyFeed()) {

  console.log(`${item.authorName()} 回复了: ${item.content()}`);

  // item.commentArea() 进入对应评论区

}



// "@我的" 翻页

for await (const item of notify.atFeed()) {

  console.log(`${item.authorName()} @了你: ${item.content()}`);

  for (const detail of item.atDetails()) {

    console.log(`  提到: ${detail.nickname} (mid=${detail.mid})`);

  }

}

```



---



## 私信（Chat）



```ts

const chat = client.chat;



// 获取会话列表

for await (const { sessions } of chat.sessions(SessionQueryType.ALL)) {

  for (const s of sessions) {

    console.log(`${s.talker_id} 未读:${s.unread_count} 最新:${s.last_msg?.content}`);

  }

}



// 标记已读

await chat.markRead(talkerId);



// 获取新会话（增量拉取）

for await (const { sessions } of chat.newSessions(lastTs)) {

  // 处理新会话...

}



// 免打扰 / 拦截 / 置顶

await chat.setDnd(ownUid, DndSetting.ON, targetUid);

await chat.setIntercept(talkerId, InterceptStatus.ON);

await chat.setTop(talkerId, SessionType.USER, TopOpType.TOP);



// 删除会话 / 清空垃圾箱

await chat.removeSession(talkerId);

await chat.batchRemoveDustbin();

```



---



## 用户空间



```ts

const space = client.space;



// 置顶视频

const topArc = await space.topArc(mid);

await space.setTopArc('BV1xx411c7mD', '这个视频真的很棒');

await space.cancelTopArc();



// 代表作

const masterpieces = await space.masterpieces(mid);

await space.addMasterpiece('BV1xx411c7mD');



// 个人 TAG

const tags = await space.tags(mid);

await space.setTags('Vue,TypeScript,前端');



// 空间公告

const notice = await space.notice(mid);

await space.setNotice('欢迎来到我的空间~');



// 空间设置

const settings = await space.getSettings(mid);

await space.setPrivacy({ fav_video: 0, tags: 1 });

await space.setToutu(photoId);



// 最近玩过的游戏

const games = await space.lastPlayGames(mid);



// 最近投币视频

const videos = await space.coinVideos(mid);

```



---



## 图片上传



```ts

const upload = client.upload;



// 上传本地文件

const result = await upload.image('./cute-cat.png');

console.log(result.data.image_url);



// 上传 base64

const base64 = 'data:image/png;base64,iVBORw0KGgo...';

const result2 = await upload.uploadFromBase64(base64);



// 从 URL 下载后上传

const result3 = await upload.uploadFromUrl('https://example.com/pic.jpg');

```



上传结果可直接传给评论区发表方法：



```ts

const img = await client.upload.image('./meme.png');

await area.add('配图评论', 0, 0, [img]);

```



---



## 链式查询



```ts

// 从视频出发

const video = await client.video('BV1xx411c7mD').fetch();



// 获取 UP 主信息

const up = await video.getUser();



// 获取评论

const comments = await video.getComment().fetch();



// 从评论出发 → 获取评论者

const commentQuery = video.getComment();

const user = await commentQuery.getUser().fetch();

```



---



## 进阶用法



### 自定义配置路径



```ts

const client = await BiliClient.create('./my-bili-config.json');

```



### 直接发包（绕过拦截器）



```ts

// 普通发包（自动附加 Cookie、自动刷新凭证）

const data = await client.request<ResponseType>(url, options);



// 发包 + 自动检查 code（非 0 抛 BiliApiError）

const data = await client.checkedRequest<ResponseType>(url, options);

```



### Token 签名



如果你需要对接需要签名的 B 站接口：



```ts

import { signParams, buildSignedQuery, KNOWN_APPKEYS } from '@seiuna/bilibili-api';



const query = buildSignedQuery(

  { local_id: 0, ts: Math.floor(Date.now() / 1000) },

  KNOWN_APPKEYS.tv.appkey,

  KNOWN_APPKEYS.tv.appsec,

);

// → "appkey=4409e2ce...&local_id=0&sign=abc123...&ts=1234567890"

```



---



## 🧪 开发



```bash

cd packages/bilibili-api



# 构建

pnpm build          # tsup → dist/



# 开发模式（watch）

pnpm dev



# 测试

pnpm test           # vitest run

pnpm test:watch     # vitest watch

```





## 配置持久化



登录后配置自动保存到 `bili-config.json`（可通过 `BiliClient.create(path)` 自定义路径）：



```json

{

  "cookie": "SESSDATA=xxx; bili_jct=yyy; ...",

  "refreshToken": "...",

  "accessToken": "...",

  "tvRefreshToken": "...",

  "mid": 123456

}

```



---



## 注意事项



- **不要泄露你的 cookie** — 尤其是 `bili_jct`（CSRF Token）和 `SESSDATA`，它们可以用来操控你的账号

- 遵守 Bilibili 的 API 使用规范，不要高频请求

- 登录信息存储在本地 JSON 文件中




<div align="center">



Made with ❤️ for @meowbot



</div>