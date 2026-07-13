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

- `bili-config.json` 存储真实 cookie / refresh_token；`.gitignore` 已忽略它，但它目前仍被 git tracking，**不要继续提交变更**。如需从版本控制移除：`git rm --cached bili-config.json`。
- `test-config.json` 是当前未使用的测试凭证占位文件。
- 任何调用写接口（发评、点赞、私信等）都需要有效的 `bili_jct`（CSRF token）。

## 发布

- `.github/workflows/publish-package.yml`：在 GitHub Release 发布时触发，`npm ci → npm run build → npm publish`，发布到 GitHub Packages（`@seiuna` scope）。
- `.github/release-drafter.yml` + workflow：向 `main` 分支 push 时自动更新 Release Draft。

## TypeScript / 构建

- ESM only，`"type": "module"`，import 路径带 `.js` 扩展名。
- `tsconfig.json` 开启 `strict`、`moduleResolution: bundler`。
- `tsup` 只打包 `index.ts`，`files` 只发布 `dist/`。
