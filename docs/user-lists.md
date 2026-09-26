# 用户投稿与关注列表（Issue #14）

这两个 `UserAPI` 静态方法只读取一页，返回原始 `BiliApiResponse`，不创建实体、不自动遍历所有页、不发起业务写操作。

## 方法与参数

```ts
UserAPI.getSubmissions(client, mid, pn?, ps?)
// Promise<BiliApiResponse<UserSubmissionsData>>
UserAPI.getFollowings(client, vmid, pn?, ps?, order?)
// Promise<BiliApiResponse<UserFollowingsData>>
```

| 参数 | 类型 | 默认值 | 含义 |
| --- | --- | --- | --- |
| `client` | `BiliClient<any>` | 必填 | 统一请求客户端，使用其凭证、WBI 密钥、customFetch 和刷新机制 |
| `mid` / `vmid` | `number` | 必填 | 目标用户 UID，分别用于投稿 / 关注接口 |
| `pn` | `number` | `1` | 页码；注意在 `ps` **之前**，不同于现有 `getFans(client, vmid, ps, pn)` |
| `ps` | `number` | 投稿 `30`；关注 `50` | 每页条数 |
| `order` | `'asc' \| 'desc'` | `'desc'` | 仅关注接口，原样传递给上游的 `order` 查询参数 |

`getSubmissions` 使用 GET `https://api.bilibili.com/x/space/wbi/arc/search`，查询参数为 `mid`、`pn`、`ps`，调用 `client.request(url, { wbi: true })`。WBI 签名由客户端处理。

`getFollowings` 使用 GET `https://api.bilibili.com/x/relation/followings`，查询参数为 `vmid`、`pn`、`ps`、`order`，不启用 WBI。`order` 对应 issue 中现有消费者的调用约定；本仓库上游资料只明确记录 Web 接口的 `order_type`，因此 SDK 不保证服务端实际遵循 `order` 排序，也不会在本地重新排序。

参数直接序列化，不做分页范围校验或静默截断；显式 `0` 不会被默认值替换，但服务端可能拒绝无效参数。UID 使用现有 UserAPI 的数值类型；调用方应使用安全整数，不要先把超大字符串 ID 转成 `number`。

## 返回类型

以下四个类型定义在 `src/api/user.ts`，由包入口导出。这是常用字段的类型化子集，不是完整远端 schema；运行时不会过滤其他字段，也不进行 schema 校验。

### `UserSubmission`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `aid` | `number` | 视频 AV 号 |
| `bvid` | `string` | 视频 BV 号 |
| `title` | `string` | 标题 |
| `play` | `number` | 播放次数，动态统计 |
| `created` | `number` | 投稿时间，Unix 秒 |
| `length` | `string` | 上游格式化的视频时长字符串，不转换成秒 |
| `pic` | `string` | 封面 URL |

### `UserSubmissionsData`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `list` | `{ vlist: UserSubmission[] }` | 保留上游列表容器 |
| `list.vlist` | `UserSubmission[]` | 当前页投稿，可以为空 |
| `page` | `{ pn: number; ps: number; count: number }` | 上游分页对象 |
| `page.pn` | `number` | 当前页码 |
| `page.ps` | `number` | 每页条数 |
| `page.count` | `number` | 投稿总数，不是当前页长度 |

### `UserFollowing`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `mid` | `number` | 被关注用户 UID |
| `uname` | `string` | 昵称 |
| `sign` | `string` | 个性签名 |
| `face` | `string` | 头像 URL，保留原始字段名，不重命名为 `avatar` |

### `UserFollowingsData`

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `list` | `UserFollowing[]` | 当前页关注用户，可以为空 |
| `total` | `number` | 上游报告的关注总数，不保证这些条目全都可见 |
| `re_version` | `number`，可选 | 上游原始版本字段；具体业务语义未确认 |

其余上表字段在成功响应类型中均为必填、不声明 `null`。外层 `BiliApiResponse<T>` 为 `{ code: number; message: string; ttl: number; data: T }`。非零 `code` 的真实错误响应可能缺少 `data` 或返回 `null`，必须先检查 `code` 再访问数据。

## 使用示例

```ts
import { BiliClient, UserAPI, assertOk, type UserSubmission, type UserFollowing } from '@seiuna/bilibili-api';

// 显式选择已有 Profile；create 只加载配置，不自动扫码登录。
const client = await BiliClient.create('123456');
const submissions = assertOk(await UserAPI.getSubmissions(client, 123456, 1, 30));
const videos: UserSubmission[] = submissions.data.list.vlist;
console.log(submissions.data.page.count, videos.map(video => video.bvid));

const followings = assertOk(await UserAPI.getFollowings(client, 123456, 1, 50, 'desc'));
const users: UserFollowing[] = followings.data.list;
console.log(followings.data.total, users.map(user => user.uname));
```

替换示例 UID 为实际目标；此示例不承诺任意 UID 或匿名账号均可访问。关注列表受登录、隐私、请求头和服务端可见性限制；仓库上游资料指出其他用户的关注只能查看前 100 个。空列表不代表账号没有任何关注，`total` 也不能用来保证能够遍历全部数据。

两个方法保留统一客户端错误语义：不自动把非零业务 `code` 变成异常或空成功，调用方可用 `assertOk`；底层传出的网络/刷新异常继续拒绝 Promise。WBI 风控或权限失败不应解释成投稿/关注被删除。

## 资料与验证范围

- [功能请求 #14](https://github.com/seiuna/bilibili-api/issues/14)
- [仓库上游投稿接口资料](../api-doc/docs/user/space.md#查询用户投稿视频明细)
- [仓库上游关注接口资料](../api-doc/docs/user/relation.md#查询用户关注明细)
- [离线 transport 单元测试](../src/test/user/user-lists.test.ts)：通过真正的 `BiliClient` 和合成 `customFetch` 响应验证 URL、分页、WBI 参数、凭证注入、类型和响应透传；不是网络测试，不能证明远端接口当前可用。未运行真实写操作测试。
