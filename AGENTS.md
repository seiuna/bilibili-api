# Agent Notes — `@seiuna/bilibili-api`

## Commands

- `npm run build` — `tsup index.ts --format esm --dts`，产物在 `dist/`。
- `npm run dev` — build 的 watch 模式。
- `npm run demo` — 运行 `scripts/auto-reply.ts`，会**登录真实账号并自动发评论**。只在明确想跑 demo 时使用。
- `npm test` — vitest，运行 `src/*.test.ts`。无需登录的测试默认会跑；需要登录的测试在 `bili-config.json` 有效时才会执行。写操作测试默认跳过，需 `ENABLE_WRITE_TESTS=1 npm test` 才会执行。
- `npx vitest run src/all-features.test.ts` — 完整集成测试（读操作），会走一遍视频/评论/用户空间/通知等接口。
- `npx tsc --noEmit` — 类型检查。

## 入口与脚本

- 根目录 `index.ts` 是**纯库入口**，只 `export * from './src/index.js'`。
- 以前写在根 `index.ts` 里的自动回复 bot 已移到 `scripts/auto-reply.ts`。
- 不要往根 `index.ts` 里加顶层副作用代码，否则 `dist/index.js` 被 import 时就会执行登录/轮询。

## 架构边界

- `src/client.ts`：`BiliClient` 是统一客户端，所有子 API 通过懒加载 getter 访问（`client.comment`、`client.chat`、`client.space`、`client.upload`、`client.notify`）。
- `src/api/comment.ts`：`CommentAPI` 是**底层原始 API 封装**，方法需要显式传入 `oid / type / rpid`，返回原始 `BiliApiResponse`。
- `src/api/comment-area.ts`：`CommentArea` 是**高层封装**，绑定到具体评论区 `(oid, replyType)`，默认把操作委托给 `CommentAPI`；只有 `add()` 自己实现，因为需要支持图片。
- `CommentArea` 构造时必须显式传入 `replyType`，不再有默认 `11`。
- `CommentResult.commentArea()` 使用评论原始 `type`，不再硬编码为 `1`。
- `src/queries/` 里的 `VideoQuery` / `CommentQuery` / `UserQuery` / `*Result` 负责链式查询；`VideoQuery.getComment()` 已删除（会把 `bvid` 错当成 `oid`）。

## 凭证与配置文件

- 账号凭证默认保存在 `profiles/<userid>.json`（`<userid>` 为数字 UID），登录成功后会自动建档。
- `profiles/` 目录已被 `.gitignore` 忽略，不得提交真实账号凭证。
- 多账号或并发初始化场景，强烈推荐显式指定 UID 或 Profile 别名，避免无参自动探测导致的实例竞态。
- 旧根目录 `bili-config.json` 会在无 profiles 时自动平滑迁移至 `profiles/<userid>.json` 并备份为 `bili-config.json.bak`。
- `test-config.json` 是当前未使用的测试凭证占位文件。
- 任何调用写接口（发评、点赞、私信等）都需要有效的 `bili_jct`（CSRF token）。

## 发布

- `.github/workflows/publish-package.yml`：在 GitHub Release 发布时触发，`npm ci → npm run build → npm publish --access public`，发布到 npm（`@seiuna` scope）。
- `.github/release-drafter.yml` + workflow：向 `main` 分支 push 时自动更新 Release Draft。

## TypeScript / 构建

- ESM only，`"type": "module"`，import 路径带 `.js` 扩展名。
- `tsconfig.json` 开启 `strict`、`moduleResolution: bundler`。
- `tsup` 只打包 `index.ts`，`files` 只发布 `dist/`。

## 开发与 Code Review 注意事项

- 提交前应在干净安装环境执行 `npm ci`、`npm run build`、`npx tsc --noEmit` 和 `npm test`；不要因为本地缺少依赖而忽略构建或类型错误。
- 内部模块引用 `BiliClient` 时优先从 `src/core/client.ts` 使用 `import type`，不要从 `src/index.ts` 或根入口引入，以避免 ESM 循环依赖。
- 所有网络请求都应使用 `BiliClient` 的统一请求通道和 `customFetch`；上传、下载等功能不得直接调用全局 `fetch`，否则会绕过测试替身、Cookie、Authorization 和凭证刷新逻辑。
- 处理 `Set-Cookie` 时不得简单按逗号或分号拆分完整头部；必须正确处理多个 Cookie 以及 `Expires` 属性，避免破坏登录凭证。
- 动态 ID、评论 ID 等服务端字符串 ID 不得无必要地转换为 `number`；可能超过 `Number.MAX_SAFE_INTEGER` 的 ID 应保持为字符串传输。
- URL 编码请求体的 `Content-Type` 必须是 `application/x-www-form-urlencoded`；只有真正构造 multipart 边界和分段时才能声明 `multipart/form-data`。
- 公开 API 的写操作应统一错误语义：要么使用 `checkedRequest()` 抛出业务错误，要么明确保持原始 `BiliApiResponse`，不要让实体方法静默吞掉非零 `code`。
- 可选数值参数应使用 `!== undefined` 判断，不要用 truthiness 判断，以免意外丢失合法的 `0` 值。
- `ensureLogin()` 只应在凭证明确失效时回退到二维码登录；网络错误、响应解析错误和程序错误应继续抛出，避免意外阻塞式登录。
- 文章实体的 `id` 必须来自可靠的 CVID 数据；不得使用 `pre + 1` 或恒定 `0` 等推导作为文章标识。
- WBI 签名和 URL 重建应保留重复查询参数及其语义；将查询参数压成普通对象会丢失重复键。
