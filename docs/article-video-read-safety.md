# Article 标识与 Video / Article 读取错误

## Article 构造与标识

```ts
new Article(client: BiliClient<any>, rawData: ArticleInfo, cvid?: number)
```

- `client`、`rawData` 必填，`cvid` 应传入请求所用的明确 CVID。
- 为兼容旧调用，仅当 `cvid === undefined` 时尝试读取旧版原始数据中的 `_cvid`。`_cvid` 不是 `ArticleInfo` 的公开字段，不建议新代码依赖它。
- 显式 CVID 或兼容值必须是正的安全整数 `number`。缺失、字符串、零、负数、小数、NaN、Infinity 或不安全整数抛出 `RangeError`，在任何实体请求之前失败。
- 显式无效值不会退回 `_cvid`。不会根据相邻文章 `pre` / `next` 推断，也不会以 `0` 代替缺失值。
- `Article.cvid: number` 与 `Article.id: number` 返回构造时保存的同一标识；不修改 `rawData`，之后修改 `_cvid` 也不会改变实体请求目标。

```ts
import { Article, ArticleAPI, BiliClient, assertOk } from '@seiuna/bilibili-api';

const client = await BiliClient.create('123456');
const cvid = 123456;
const response = assertOk(await ArticleAPI.getInfo(client, cvid));
const article = new Article(client, response.data, cvid);
console.log(article.id); // 123456，不使用 response.data.pre + 1
```

## 高层读取方法的业务错误

以下方法先调用 `assertOk` 再提取响应 `data`，非零 `code` 抛出 `BiliApiError`（包含原始 `code`），不返回由错误数据构造的实体，也不伪装为空列表。统一客户端抛出的传输/认证异常继续向上传播。低层 `ArticleAPI` / `VideoAPI` 的原始响应约定不变。

| 方法 | 返回值 |
| --- | --- |
| `Article.getAuthor()` | `Promise<User>` |
| `Article.getView()` | `Promise<ArticleViewEntity>` |
| `Video.getAuthor()` | `Promise<User>` |
| `Video.getStat()` | `Promise<VideoStatEntity>` |
| `Video.getPlayUrl(options?)` | `Promise<PlayUrlEntity>` |
| `Video.getOnlineCount()` | `Promise<OnlineCountEntity>` |
| `Video.getAiSummary()` | `Promise<AiSummaryEntity>` |
| `Video.getSnapshot(index = 0)` | `Promise<VideoSnapshotEntity>` |
| `Video.getRecommend()` | `Promise<RecommendVideoEntity[]>` |
| `Video.getTags()` | `Promise<VideoTagEntity[]>` |

`getPlayUrl` 的可选 `options` 默认 `{}`，保留现有字段：`qn?: number`、`fnval?: number`、`fnver?: number`、`fourk?: 0 | 1`、`platform?: string`；`getSnapshot` 的 `index` 为 `number`。其余表中方法无参数。

`getRecommend` / `getTags` 只把真正的成功数组映射为实体：成功 `data: []` 返回 `[]`，成功但畸形的 `data: null` / 缺少 `data` 不再静默返回空列表（当前数组映射会抛 `TypeError`）。这不是完整运行时 schema 校验。

`Video.getPbp()` 返回的高能进度条数据不是 `BiliApiResponse` 包装，此次不对它套用 `assertOk`。

验证见 [离线回归测试](../src/test/entities/article-video-reads.test.ts)。这些是合成响应驱动的 transport 单元测试，不是网络可用性证明；没有发起真实业务写操作。
