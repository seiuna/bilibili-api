import { BiliClient } from './src/core/client.js';
import { Comment } from './src/entities/Comment.js';
import { ReplyNotifyItem, AtNotifyItem } from './src/entities/NotifyItem.js';
import { ReplySort, ReplyMode } from './src/api/comment.js';
import { UploadAPI } from './src/api/upload.js';
import { VideoAPI } from './src/api/video.js';
import { UserAPI } from './src/api/user.js';
import { ArticleAPI } from './src/api/article.js';
import { DynamicAPI } from './src/api/dynamic.js';
import { CommentAPI } from './src/api/comment.js';
import { MessageAPI } from './src/api/message.js';
import { SearchAPI } from './src/api/search.js';
import { HistoryAPI } from './src/api/history.js';
import { FavoriteAPI } from './src/api/favorite.js';
import { DanmakuAPI } from './src/api/danmaku.js';
import { EmojiAPI } from './src/api/emoji.js';
import { NoteAPI } from './src/api/note.js';
import { ElectricAPI } from './src/api/electric.js';
import { RankingAPI } from './src/api/ranking.js';
import { LiveAPI } from './src/api/live.js';
import { OpusAPI } from './src/api/opus.js';
import { CommonAPI, av2bv, bv2av, formatImageUrl } from './src/api/common.js';

// 测试用常量
const TEST_BVID = 'BV1GJ411x7h7';
const TEST_OPUS_ID = '1216412988246851587';

function log(section: string, msg: string) {
  console.log(`[${section}] ${msg}`);
}

async function main() {

  console.log('========== 0. 登录 ==========');
  const client = await BiliClient.create("default-test");
  const authed = await client.ensureLogin({
    onStatusChange: (status, msg, _base64, terminal) => {
      console.log(`[${status}] ${msg}`);
      if (terminal) console.log(terminal);
    },
  });
  log('Login', '成功');

  // ==========================================
  // 测试：获取评论 316912713104 并查找其上游类型
  // ==========================================
  console.log('\n========== 测试：获取评论及其上游类型 ==========');
  const TARGET_RPID = '316912713104';

  // 1. 根据 rpid 自动反查定位并获取评论实体
  log('Comment', `正在获取评论 ${TARGET_RPID}...`);
  const comment = await authed.resolveComment(TARGET_RPID);

  log('Comment', `评论获取成功！`);
  log('Comment', `  - 评论 ID (rpid): ${comment.rpid}`);
  log('Comment', `  - 评论区 ID (oid): ${comment.oid}`);
  log('Comment', `  - 发送者: ${comment.member?.uname} (UID: ${comment.mid})`);
  log('Comment', `  - 评论内容: ${comment.content?.message}`);
  log('Comment', `  - 发布时间: ${new Date(comment.ctime * 1000).toLocaleString()}`);
  log('Comment', `  - 根评论/父评论: root=${comment.root} parent=${comment.parent} (${comment.root === 0 ? '一级评论' : '楼中楼'})`);

  // 2. 查找并分析其上游类型
  log('Comment', `上游类型分析：`);
  log('Comment', `  - 上游业务类型代码 (type): ${comment.type}`);
  log('Comment', `  - 上游业务类型名称: ${comment.upstreamTypeName}`);

  switch (comment.type) {
    case 1:
      log('Comment', `  - 业务映射: 视频稿件 (Video), oid 即视频 avid (${comment.oid}), 对应 bvid: ${av2bv(comment.oid)}`);
      break;
    case 11:
      log('Comment', `  - 业务映射: 相簿/带图图文动态 (Opus / Dynamic), oid 即相簿/图文评论区 ID (${comment.oid})`);
      break;
    case 12:
      log('Comment', `  - 业务映射: 专栏文章 (Article), oid 即专栏 cvid (${comment.oid})`);
      break;
    case 14:
      log('Comment', `  - 业务映射: 音频 (Audio), oid 即音频 auid (${comment.oid})`);
      break;
    case 17:
      log('Comment', `  - 业务映射: 纯文字动态/分享 (Dynamic), oid 即动态 ID (${comment.oid})`);
      break;
    default:
      log('Comment', `  - 业务映射: 其他业务类型 (type=${comment.type})`);
      break;
  }

  // ==========================================
  // 持续轮询：reply 和 at 消息
  // 获取对应的父评论、回复的评论、评论区 ID 还有内容主体
  // ==========================================
  console.log('\n========== 启动消息轮询 (Reply & At) ==========');
  log('Poll', '开始持续轮询 @我的 和 回复我的 消息通知 (间隔 10 秒)...');

  /**
   * 自动获取内容主体详细信息：
   * - 如果是视频：获取视频标题 Title
   * - 如果是动态：获取动态完整内容 Full Content
   */
  async function fetchSubjectDetail(subjectInfo: {
    businessId: number;
    subjectId: number;
    uri: string;
    title?: string;
  }): Promise<{ type: string; title: string; fullContent?: string }> {
    // 1. 视频 (businessId === 1 或链接包含 /video/)
    if (subjectInfo.businessId === 1 || subjectInfo.uri.includes('/video/')) {
      const bvidMatch = subjectInfo.uri.match(/(BV[a-zA-Z0-9]+)/i);
      let videoTitle = subjectInfo.title || '';
      try {
        if (bvidMatch) {
          const video = await authed.getVideo(bvidMatch[1]);
          videoTitle = video.title;
        } else if (subjectInfo.subjectId) {
          const res = await VideoAPI.getInfoByAid(authed, subjectInfo.subjectId);
          videoTitle = res.data?.title || videoTitle;
        }
      } catch {
        // 保持兜底 title
      }
      return {
        type: '视频 (Video)',
        title: videoTitle,
      };
    }

    // 2. 动态/图文 (businessId === 11 / 17 或链接包含 /opus/ 或 t.bilibili.com)
    if (
      subjectInfo.businessId === 11 ||
      subjectInfo.businessId === 17 ||
      subjectInfo.uri.includes('/opus/') ||
      subjectInfo.uri.includes('t.bilibili.com')
    ) {
      const dynIdMatch = subjectInfo.uri.match(/(?:opus|detail|t\.bilibili\.com)\/([0-9]+)/);
      const dynId = dynIdMatch ? dynIdMatch[1] : (subjectInfo.subjectId ? String(subjectInfo.subjectId) : null);
      let dynTitle = subjectInfo.title || '';
      let dynContent = '';

      if (dynId) {
        try {
          const res = await DynamicAPI.getDetail(authed, dynId);
          const mods = (res.data?.item?.modules as any) ?? {};
          const dynMod = mods.module_dynamic ?? {};

          if (dynMod.desc?.text) {
            dynContent = dynMod.desc.text;
          } else if (dynMod.major?.opus?.summary?.text) {
            dynContent = dynMod.major.opus.summary.text;
          }

          if (dynMod.major?.opus?.title) {
            dynTitle = dynMod.major.opus.title;
          }
        } catch {
          // 备选：尝试 OpusAPI 解析更深层富文本段落
          try {
            const opRes = await OpusAPI.getDetail(authed, dynId);
            const modules = (opRes.data?.item?.modules as any[]) ?? [];
            for (const m of modules) {
              if (m.module_content?.paragraphs) {
                const lines: string[] = [];
                for (const p of m.module_content.paragraphs) {
                  if (p.text?.nodes) {
                    const text = p.text.nodes.map((n: any) => n.word?.words || n.rich?.text || '').join('');
                    if (text) lines.push(text);
                  }
                }
                if (lines.length) dynContent = lines.join('\n');
              }
            }
          } catch {}
        }
      }

      return {
        type: '动态/图文 (Dynamic / Opus)',
        title: dynTitle,
        fullContent: dynContent || subjectInfo.title || '(无正文)',
      };
    }

    return {
      type: `其他业务类型 (businessId: ${subjectInfo.businessId})`,
      title: subjectInfo.title || '(无标题)',
    };
  }

  const seenReplyIds = new Set<number>();
  const seenAtIds = new Set<number>();
  let isPolling = false;

  const pollMessages = async () => {
    if (isPolling) return;
    isPolling = true;

    try {
      const countRes = await MessageAPI.unreadCount(authed);
      const unreadAt = countRes.data?.at ?? 0;
      const unreadReply = countRes.data?.reply ?? 0;

      // 1. 轮询处理 "回复我的" (Reply)
      const replyRes = await MessageAPI.getReplyFeed(authed);
      const replyItems = replyRes.data?.items ?? [];

      for (const raw of replyItems) {
        if (seenReplyIds.has(raw.id)) continue;
        seenReplyIds.add(raw.id);

        const item = new ReplyNotifyItem(authed, raw);
        console.log('\n------------------------------------------------------------');
        log('ReplyNotify', `[收到新的回复] 通知ID: ${item.id}`);
        log('ReplyNotify', `  【回复的评论 (当前评论)】`);
        log('ReplyNotify', `    - 评论 ID (rpid): ${item.sourceId}`);
        log('ReplyNotify', `    - 发送者: ${item.authorName} (UID: ${item.authorMid})`);
        log('ReplyNotify', `    - 评论内容: ${item.content}`);
        log('ReplyNotify', `    - 发送时间: ${new Date(item.replyTime * 1000).toLocaleString()}`);

        log('ReplyNotify', `  【对应的父评论】`);
        log('ReplyNotify', `    - 父评论 ID: ${raw.item.target_id || 0} (${raw.item.target_id ? '楼中楼回复' : '直接回复根评论/主体'})`);
        if (raw.item.target_reply_content) {
          log('ReplyNotify', `    - 父评论内容: ${raw.item.target_reply_content}`);
        } else if (raw.item.target_id > 0) {
          try {
            const parentComment = await authed.getComment(item.subjectId, item.businessId, raw.item.target_id);
            log('ReplyNotify', `    - 父评论详情: [${parentComment.member?.uname}]: ${parentComment.content?.message}`);
          } catch {
            log('ReplyNotify', `    - 父评论内容: (无快照或已删除)`);
          }
        } else {
          log('ReplyNotify', `    - 父评论内容: (无，当前为一级评论)`);
        }

        if (item.rootId > 0 && item.rootId !== raw.item.target_id) {
          log('ReplyNotify', `  【所属根评论】`);
          log('ReplyNotify', `    - 根评论 ID: ${item.rootId}`);
          log('ReplyNotify', `    - 根评论内容: ${raw.item.root_reply_content || '(无)'}`);
        }

        log('ReplyNotify', `  【评论区信息】`);
        log('ReplyNotify', `    - 评论区 ID (oid/subjectId): ${item.subjectId}`);
        log('ReplyNotify', `    - 业务类型代码 (businessId): ${item.businessId}`);
        log('ReplyNotify', `    - 业务分类: ${item.business}`);

        // 获取内容主体详细信息
        const subject = await fetchSubjectDetail({
          businessId: item.businessId,
          subjectId: item.subjectId,
          uri: item.uri,
          title: item.title,
        });

        log('ReplyNotify', `  【内容主体】`);
        log('ReplyNotify', `    - 主体类型: ${subject.type}`);
        if (subject.type.startsWith('视频')) {
          log('ReplyNotify', `    - 视频标题 (Title): ${subject.title}`);
        } else if (subject.type.startsWith('动态')) {
          if (subject.title) {
            log('ReplyNotify', `    - 动态标题: ${subject.title}`);
          }
          log('ReplyNotify', `    - 动态完整内容 (Full Content): ${subject.fullContent}`);
        } else {
          log('ReplyNotify', `    - 主体内容: ${subject.title}`);
        }
        log('ReplyNotify', `    - 主体跳转链接: ${item.uri}`);
        console.log('------------------------------------------------------------');
      }

      // 2. 轮询处理 "@我的" (At)
      const atRes = await MessageAPI.getAtFeed(authed);
      const atItems = atRes.data?.items ?? [];

      for (const raw of atItems) {
        if (seenAtIds.has(raw.id)) continue;
        seenAtIds.add(raw.id);

        const item = new AtNotifyItem(authed, raw);
        console.log('\n------------------------------------------------------------');
        log('AtNotify', `[收到新的 @提及] 通知ID: ${item.id}`);
        log('AtNotify', `  【@ 来源评论 / 内容】`);
        log('AtNotify', `    - 评论 ID (rpid): ${item.sourceId || '(正文动态@，非评论)'}`);
        log('AtNotify', `    - 发送者: ${item.authorName} (UID: ${item.authorMid})`);
        log('AtNotify', `    - @ 内容: ${item.content}`);
        log('AtNotify', `    - 发生时间: ${new Date(item.atTime * 1000).toLocaleString()}`);

        if (raw.item.target_id > 0) {
          log('AtNotify', `  【对应的父评论】`);
          log('AtNotify', `    - 父评论 ID: ${raw.item.target_id}`);
          try {
            const parentComment = await authed.getComment(item.subjectId, item.businessId, raw.item.target_id);
            log('AtNotify', `    - 父评论详情: [${parentComment.member?.uname}]: ${parentComment.content?.message}`);
          } catch {
            // 忽略父评论获取错误
          }
        }

        log('AtNotify', `  【评论区信息】`);
        log('AtNotify', `    - 评论区 ID (oid/subjectId): ${item.subjectId}`);
        log('AtNotify', `    - 业务类型代码 (businessId): ${item.businessId}`);
        log('AtNotify', `    - 业务分类: ${item.business}`);

        // 获取内容主体详细信息
        const subject = await fetchSubjectDetail({
          businessId: item.businessId,
          subjectId: item.subjectId,
          uri: item.uri,
          title: item.title,
        });

        log('AtNotify', `  【内容主体】`);
        log('AtNotify', `    - 主体类型: ${subject.type}`);
        if (subject.type.startsWith('视频')) {
          log('AtNotify', `    - 视频标题 (Title): ${subject.title}`);
        } else if (subject.type.startsWith('动态')) {
          if (subject.title) {
            log('AtNotify', `    - 动态标题: ${subject.title}`);
          }
          log('AtNotify', `    - 动态完整内容 (Full Content): ${subject.fullContent}`);
        } else {
          log('AtNotify', `    - 主体内容: ${subject.title}`);
        }
        log('AtNotify', `    - 主体跳转链接: ${item.uri}`);
        console.log('------------------------------------------------------------');
      }

      if (unreadAt > 0 || unreadReply > 0) {
        log('Poll', `发现未读更新 - @我的: ${unreadAt}, 回复我的: ${unreadReply}`);
      }
    } catch (err: any) {
      log('Poll', `轮询出错: ${err.message}`);
    } finally {
      isPolling = false;
    }
  };

  // 立即触发首次扫描
  await pollMessages();

  // 开启持续轮询
  const interval = setInterval(pollMessages, 10000);

  // 保持进程运行
  await new Promise(() => {});
}

main().catch(console.error);