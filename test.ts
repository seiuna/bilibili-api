import { BiliClient } from './src/core/client.js';
import { Comment } from './src/entities/Comment.js';
import { ReplySort } from './src/api/comment.js';
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
  // ========================
  // 0. 登录
  // ========================
  console.log('========== 0. 登录 ==========');
  const client = await BiliClient.create("default-test");
  const authed = await client.ensureLogin({
    onStatusChange: (status, msg, _base64, terminal) => {
      console.log(`[${status}] ${msg}`);
      if (terminal) console.log(terminal);
    },
  });
  log('Login', '成功');
  
  // ========================
  // 1. CommonAPI — 公共工具
  // ========================
  console.log('\n========== 1. CommonAPI ==========');
  log('Common', `当前时间戳: ${CommonAPI.getCurrentTimestamp()}`);
  const serverTs = await CommonAPI.getServerTimestamp(authed);
  log('Common', `服务器时间戳: ${serverTs}`);
  const testAid = 170001;
  const testBvid = av2bv(testAid);
  log('Common', `av2bv(${testAid}) = ${testBvid}`);
  log('Common', `bv2av(${testBvid}) = ${bv2av(testBvid)}`);
  const formattedUrl = formatImageUrl('https://i0.hdslb.com/bfs/face/test.jpg', { width: 100, height: 100, format: 'webp' });
  log('Common', `formatImageUrl: ${formattedUrl}`);

  // ========================
  // 2. VideoAPI — 视频
  // ========================
  console.log('\n========== 2. VideoAPI ==========');
  const videoInfo = await VideoAPI.getInfo(authed, TEST_BVID);
  log('Video', `getInfo: ${videoInfo.data.title} (aid=${videoInfo.data.aid}, cid=${videoInfo.data.cid})`);

  // getStat 接口已废弃，从 getInfo 的 data.stat 获取
  log('Video', `getStat (from getInfo): view=${videoInfo.data.stat.view} like=${videoInfo.data.stat.like} coin=${videoInfo.data.stat.coin}`);

  const playUrl = await VideoAPI.getPlayUrl(authed, videoInfo.data.cid, { avid: videoInfo.data.aid, bvid: TEST_BVID, qn: 32, fnval: 16 });
  log('Video', `getPlayUrl: quality=${playUrl.data.quality} format=${playUrl.data.format} timelength=${playUrl.data.timelength}`);

  const onlineCount = await VideoAPI.getOnlineCount(authed, videoInfo.data.cid, videoInfo.data.aid, TEST_BVID);
  log('Video', `getOnlineCount: total=${onlineCount.data.total} count=${onlineCount.data.count}`);

  const aiSummary = await VideoAPI.getAiSummary(authed, videoInfo.data.cid, videoInfo.data.aid, TEST_BVID, videoInfo.data.owner.mid);
  log('Video', `getAiSummary: code=${aiSummary.code} summary=${(aiSummary.data as any)?.model_result?.summary?.slice(0, 50) ?? 'N/A'}`);

  const snapshot = await VideoAPI.getSnapshot(authed, videoInfo.data.cid, videoInfo.data.aid, TEST_BVID);
  log('Video', `getSnapshot: image count=${snapshot.data.image?.length ?? 0}`);

  const pbp = await VideoAPI.getPbp(authed, videoInfo.data.cid, videoInfo.data.aid, TEST_BVID);
  log('Video', `getPbp: step_sec=${pbp.step_sec} events.default.length=${pbp.events?.default?.length ?? 0}`);

  const recommend = await VideoAPI.getRecommend(authed, videoInfo.data.aid, TEST_BVID);
  log('Video', `getRecommend: ${recommend.data.length} 条推荐`);

  const tags = await VideoAPI.getTags(authed, videoInfo.data.aid, TEST_BVID, videoInfo.data.cid);
  log('Video', `getTags: ${tags.data.length} 个标签`);

  // 视频互动操作
  const likeRes = await VideoAPI.like(authed, videoInfo.data.aid, 1);
  log('Video', `like: code=${likeRes.code}`);
  const hasLiked = await VideoAPI.hasLiked(authed, videoInfo.data.aid);
  log('Video', `hasLiked: ${hasLiked.data}`);
  const unlikeRes = await VideoAPI.like(authed, videoInfo.data.aid, 2);
  log('Video', `unlike: code=${unlikeRes.code}`);

  const hasCoined = await VideoAPI.hasCoined(authed, videoInfo.data.aid);
  log('Video', `hasCoined: multiply=${hasCoined.data.multiply}`);

  const hasFav = await VideoAPI.hasFavorited(authed, videoInfo.data.aid);
  log('Video', `hasFavorited: ${hasFav.data.favoured}`);

  const shareRes = await VideoAPI.share(authed, videoInfo.data.aid);
  log('Video', `share: code=${shareRes.code} data=${shareRes.data}`);

  // ========================
  // 3. Video Entity — 视频实体
  // ========================
  console.log('\n========== 3. Video Entity ==========');
  const video = await authed.getVideo(TEST_BVID);
  log('VideoEntity', `title=${video.title} bvid=${video.bvid} aid=${video.aid}`);
  log('VideoEntity', `owner=${video.owner.name} (mid=${video.owner.mid})`);
  log('VideoEntity', `stat: view=${video.stat.view} like=${video.stat.like} coin=${video.stat.coin}`);
  const videoAuthor = await video.getAuthor();
  log('VideoEntity', `getAuthor: ${videoAuthor.name} (mid=${videoAuthor.mid})`);
  const videoArea = video.commentArea();
  const videoAreaCount = await videoArea.count();
  log('VideoEntity', `commentArea count: ${videoAreaCount.data.count}`);

  // ========================
  // 4. UserAPI — 用户
  // ========================
  console.log('\n========== 4. UserAPI ==========');
  const userInfo = await UserAPI.getInfo(authed, videoInfo.data.owner.mid);
  log('User', `getInfo: ${userInfo.data.name} (mid=${userInfo.data.mid}) sign=${userInfo.data.sign?.slice(0, 30)}`);

  const userStat = await UserAPI.getRelationStat(authed, videoInfo.data.owner.mid);
  log('User', `getRelationStat: following=${userStat.data.following} follower=${userStat.data.follower}`);

  const upStat = await UserAPI.getUpStat(authed, videoInfo.data.owner.mid);
  log('User', `getUpStat: archive.view=${upStat.data.archive.view} likes=${upStat.data.likes}`);

  try {
    const navNum = await UserAPI.getNavNum(authed, videoInfo.data.owner.mid);
    log('User', `getNavNum: video=${navNum.data?.video ?? 'N/A'} article=${navNum.data?.article ?? 'N/A'}`);
  } catch (e: any) { log('User', `getNavNum 失败: ${e.message}`); }

  try {
    const medalWall = await UserAPI.getMedalWall(authed, videoInfo.data.owner.mid);
    log('User', `getMedalWall: ${medalWall.data?.list?.length ?? 0} 个勋章`);
  } catch (e: any) { log('User', `getMedalWall 失败: ${e.message}`); }

  try {
    const navInfo = await UserAPI.getNavInfo(authed);
    log('User', `getNavInfo: code=${navInfo.code} uname=${navInfo.data?.uname}`);
  } catch (e: any) { log('User', `getNavInfo 失败: ${e.message}`); }

  try {
    const myInfoRes = await UserAPI.getMyInfo(authed);
    log('User', `UserAPI.getMyInfo: code=${myInfoRes.code} name=${myInfoRes.data?.name} mid=${myInfoRes.data?.mid}`);
  } catch (e: any) { log('User', `UserAPI.getMyInfo 失败: ${e.message}`); }

  try {
    const memberAccount = await UserAPI.getMemberAccount(authed);
    log('User', `getMemberAccount: code=${memberAccount.code} uname=${memberAccount.data?.uname ?? 'N/A'}`);
  } catch (e: any) { log('User', `getMemberAccount 失败: ${e.message}`); }

  try {
    const rewardStatus = await UserAPI.getRewardStatus(authed);
    log('User', `getRewardStatus: login=${rewardStatus.data?.login} watch=${rewardStatus.data?.watch} coins=${rewardStatus.data?.coins}`);
  } catch (e: any) { log('User', `getRewardStatus 失败: ${e.message}`); }

  try {
    const todayCoinExp = await UserAPI.getTodayCoinExp(authed);
    log('User', `getTodayCoinExp: ${todayCoinExp.data}`);
  } catch (e: any) { log('User', `getTodayCoinExp 失败: ${e.message}`); }

  try {
    const loginLog = await UserAPI.getLoginLog(authed);
    log('User', `getLoginLog: ${loginLog.data?.list?.length ?? 0} 条记录`);
  } catch (e: any) { log('User', `getLoginLog 失败: ${e.message}`); }

  try {
    const nameToUid = await UserAPI.nameToUid(authed, 'bilibili');
    log('User', `nameToUid: ${nameToUid.data?.uid_list?.length ?? 0} 条结果`);
  } catch (e: any) { log('User', `nameToUid 失败: ${e.message}`); }

  // ========================
  // 5. User Entity — 用户实体
  // ========================
  console.log('\n========== 5. User Entity ==========');
  const user = await authed.getUser(videoInfo.data.owner.mid);
  log('UserEntity', `name=${user.name} level=${user.level}`);
  log('UserEntity', `official: role=${user.official.role} title=${user.official.title}`);
  log('UserEntity', `vip: type=${user.vip.type} status=${user.vip.status}`);
  const userStatEntity = await user.getStat();
  log('UserEntity', `getStat: following=${userStatEntity.following} follower=${userStatEntity.follower}`);

  // ========================
  // 6. CommentAPI — 评论
  // ========================
  console.log('\n========== 6. CommentAPI ==========');
  try {
    const commentCount = await CommentAPI.replyCount(authed, videoInfo.data.aid, 1);
    log('Comment', `replyCount: ${commentCount.data?.count ?? 0}`);
  } catch (e: any) { log('Comment', `replyCount 失败: ${e.message}`); }

  // 翻页测试
  try {
    let commentPages = 0;
    for await (const page of CommentAPI.replies(authed, videoInfo.data.aid, 1, ReplySort.TIME, 0, 5)) {
      commentPages++;
      log('Comment', `replies 第${page.page}页: ${page.comments.length} 条`);
      if (commentPages >= 1) break;
    }
  } catch (e: any) { log('Comment', `replies 失败: ${e.message}`); }

  // WBI 翻页
  try {
    let wbiPages = 0;
    for await (const page of CommentAPI.repliesWbi(authed, videoInfo.data.aid, 1)) {
      wbiPages++;
      log('Comment', `repliesWbi: ${page.comments.length} 条, cursor.next=${page.cursor}`);
      if (wbiPages >= 1) break;
    }
  } catch (e: any) { log('Comment', `repliesWbi 失败: ${e.message}`); }

  // 热评
  try {
    let hotPages = 0;
    for await (const page of CommentAPI.hotReplies(authed, videoInfo.data.aid, 1, 5)) {
      hotPages++;
      log('Comment', `hotReplies 第${page.page}页: ${page.comments.length} 条`);
      if (hotPages >= 1) break;
    }
  } catch (e: any) { log('Comment', `hotReplies 失败: ${e.message}`); }

  // ========================
  // 7. CommentArea + Comment Entity — 评论区操作
  // ========================
  console.log('\n========== 7. CommentArea + Comment ==========');
  try {
    const opus = await authed.getOpus(TEST_OPUS_ID);
    log('CommentArea', `Opus: ${opus.title ?? '(无标题)'}  rid=${opus.rid}  commentType=${opus.commentType}`);
    const opusArea = opus.commentArea();

    // 获取第一条评论
    let targetComment: Comment | null = null;
    for await (const page of opusArea.list(ReplySort.TIME, 20)) {
      if (page.comments.length > 0) {
        targetComment = new Comment(authed, page.comments[0], Number(opus.rid));
        break;
      }
    }

    if (targetComment) {
      log('Comment', `目标评论 #${targetComment.rpid} by ${targetComment.member.uname}: ${targetComment.content.message.slice(0, 40)}`);

      log('Comment', `like: code=${(await targetComment.like()).code}`);
      log('Comment', `unlike: code=${(await targetComment.like(true)).code}`);
      log('Comment', `hate: code=${(await targetComment.hate()).code}`);
      log('Comment', `unhate: code=${(await targetComment.hate(true)).code}`);

      const addRes = await opusArea.add('meow~ 测试评论');
      log('Comment', `add: code=${addRes.code} rpid=${addRes.data?.rpid ?? 'N/A'}`);
      const replyRes = await targetComment.reply('meow reply');
      log('Comment', `reply: code=${replyRes.code} rpid=${replyRes.data?.rpid ?? 'N/A'}`);

      // 带图评论
      try {
        const imgRes = await UploadAPI.image(authed, './image.png');
        if (imgRes.code === 0 && imgRes.data) {
          log('Comment', `图片上传: url=${imgRes.data.image_url}`);
          const picAddRes = await opusArea.add('带图评论 meow~', 0, 0, [imgRes.data]);
          log('Comment', `带图评论: code=${picAddRes.code} rpid=${picAddRes.data?.rpid ?? 'N/A'}`);
          if (picAddRes.code === 0 && picAddRes.data?.rpid) await opusArea.delete(picAddRes.data.rpid);
        }
      } catch (e: any) { log('Comment', `图片上传失败: ${e.message}`); }

      // base64 上传测试
      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      try {
        const b64Res = await UploadAPI.uploadFromBase64(authed, tinyPng, 'test.png');
        if (b64Res.code === 0 && b64Res.data) {
          log('Comment', `base64图上传: url=${b64Res.data.image_url}`);
          const picAddRes2 = await opusArea.add('base64带图评论~', 0, 0, [b64Res.data]);
          log('Comment', `base64带图评论: code=${picAddRes2.code} rpid=${picAddRes2.data?.rpid ?? 'N/A'}`);
          if (picAddRes2.code === 0 && picAddRes2.data?.rpid) await opusArea.delete(picAddRes2.data.rpid);
        }
      } catch (e: any) { log('Comment', `base64上传失败: ${e.message}`); }

      if (addRes.code === 0 && addRes.data?.rpid) {
        log('Comment', `delete #${addRes.data.rpid}: code=${(await opusArea.delete(addRes.data.rpid)).code}`);
      }
    }
  } catch (e: any) { log('CommentArea', `评论区操作失败: ${e.message}`); }

  // ========================
  // 8. DynamicAPI — 动态
  // ========================
  console.log('\n========== 8. DynamicAPI ==========');
  let dynamicSpace: Awaited<ReturnType<typeof DynamicAPI['getSpace']>>;
  try {
    dynamicSpace = await DynamicAPI.getSpace(authed, videoInfo.data.owner.mid);
    log('Dynamic', `getSpace: has_more=${dynamicSpace.data.has_more} items=${dynamicSpace.data.items?.length ?? 0}`);
    if (dynamicSpace.data.items?.length) {
      log('Dynamic', `first dynamic: id_str=${dynamicSpace.data.items[0].id_str}`);
    }
  } catch (e: any) {
    log('Dynamic', `getSpace 失败: ${e.message}`);
    dynamicSpace = { code: -1, message: e.message, ttl: 0, data: { has_more: false, items: [] } } as any;
  }

  // ========================
  // 9. ArticleAPI — 专栏
  // ========================
  console.log('\n========== 9. ArticleAPI ==========');
  try {
    const articleCards = await ArticleAPI.getCards(authed, TEST_BVID);
    log('Article', `getCards: code=${articleCards.code} keys=${Object.keys(articleCards.data ?? {}).join(',')}`);
  } catch (e: any) {
    log('Article', `getCards error: ${e.message}`);
  }

  // ========================
  // 10. MessageAPI — 消息与私信
  // ========================
  console.log('\n========== 10. MessageAPI ==========');
  try {
    const unreadCount = await MessageAPI.unreadCount(authed);
    log('Message', `unreadCount: at=${unreadCount.data?.at ?? 0} reply=${unreadCount.data?.reply ?? 0} like=${unreadCount.data?.like ?? 0}`);
  } catch (e: any) { log('Message', `unreadCount 失败: ${e.message}`); }

  try {
    const singleUnread = await MessageAPI.singleUnread(authed);
    log('Message', `singleUnread: follow=${singleUnread.data?.follow_unread ?? 0} unfollow=${singleUnread.data?.unfollow_unread ?? 0}`);
  } catch (e: any) { log('Message', `singleUnread 失败: ${e.message}`); }

  try {
    const groupUnread = await MessageAPI.groupUnread(authed);
    log('Message', `groupUnread: ${groupUnread.data?.unread_count ?? 0}`);
  } catch (e: any) { log('Message', `groupUnread 失败: ${e.message}`); }

  // replyFeed 翻页
  try {
    let replyCount = 0;
    for await (const item of MessageAPI.replyFeed(authed)) {
      replyCount++;
      log('Message', `replyFeed #${item.id}: ${item.user.nickname} - ${item.item.title?.slice(0, 30)}`);
      if (replyCount >= 1) break;
    }
    if (replyCount === 0) log('Message', 'replyFeed: 无数据');
  } catch (e: any) { log('Message', `replyFeed 失败: ${e.message}`); }

  // atFeed 翻页
  try {
    let atCount = 0;
    for await (const item of MessageAPI.atFeed(authed)) {
      atCount++;
      log('Message', `atFeed #${item.id}: ${item.user.nickname} - ${item.item.title?.slice(0, 30)}`);
      if (atCount >= 1) break;
    }
    if (atCount === 0) log('Message', 'atFeed: 无数据');
  } catch (e: any) { log('Message', `atFeed 失败: ${e.message}`); }

  // sessions 翻页
  try {
    let sessionCount = 0;
    for await (const { sessions, hasMore } of MessageAPI.sessions(authed)) {
      sessionCount++;
      log('Message', `sessions: ${sessions.length} 条, hasMore=${hasMore}`);
      if (sessions.length > 0) {
        log('Message', `  first: talker_id=${sessions[0].talker_id} unread=${sessions[0].unread_count}`);
      }
      if (sessionCount >= 1) break;
    }
    if (sessionCount === 0) log('Message', 'sessions: 无数据');
  } catch (e: any) { log('Message', `sessions 失败: ${e.message}`); }

  // 消息设置
  try {
    const msgSettings = await MessageAPI.getSettings(authed);
    log('Message', `getSettings: msg_notify=${msgSettings.data?.msg_notify} set_like=${msgSettings.data?.set_like}`);
  } catch (e: any) { log('Message', `getSettings 失败: ${e.message}`); }

  // ========================
  // 11. SearchAPI — 搜索
  // ========================
  console.log('\n========== 11. SearchAPI ==========');
  try {
    const defaultSearch = await SearchAPI.getDefaultSearch(authed);
    log('Search', `getDefaultSearch: ${defaultSearch.data?.show_name ?? defaultSearch.data?.name ?? 'N/A'}`);
  } catch (e: any) { log('Search', `getDefaultSearch 失败: ${e.message}`); }

  try {
    const hotSearch = await SearchAPI.getHotSearch(authed, 10);
    log('Search', `getHotSearch: ${hotSearch.data?.list?.length ?? 0} 条热搜`);
    if (hotSearch.data?.list?.length) {
      log('Search', `  top1: ${hotSearch.data.list[0].keyword}`);
    }
  } catch (e: any) { log('Search', `getHotSearch 失败: ${e.message}`); }

  try {
    const suggest = await SearchAPI.getSuggest(authed, 'bilibili');
    log('Search', `getSuggest: ${suggest.result?.tag?.length ?? 0} 条建议`);
  } catch (e: any) { log('Search', `getSuggest 失败: ${e.message}`); }

  try {
    const searchAll = await SearchAPI.searchAll(authed, '猫咪');
    log('Search', `searchAll: numResults=${searchAll.data?.numResults ?? 'N/A'}`);
  } catch (e: any) { log('Search', `searchAll 失败: ${e.message}`); }

  // ========================
  // 12. HistoryAPI — 历史与稍后再看
  // ========================
  console.log('\n========== 12. HistoryAPI ==========');
  try {
    let historyCount = 0;
    for await (const item of HistoryAPI.history(authed, 5)) {
      historyCount++;
      log('History', `history #${historyCount}: ${item.title?.slice(0, 30)} progress=${item.progress}`);
      if (historyCount >= 2) break;
    }
    if (historyCount === 0) log('History', 'history: 无数据');
  } catch (e: any) { log('History', `history 失败: ${e.message}`); }

  try {
    const toViewList = await HistoryAPI.getToViewList(authed);
    log('History', `getToViewList: count=${toViewList.data?.count ?? 0} list=${toViewList.data?.list?.length ?? 0}`);
  } catch (e: any) { log('History', `getToViewList 失败: ${e.message}`); }

  try {
    const addToViewRes = await HistoryAPI.addToView(authed, videoInfo.data.aid);
    log('History', `addToView: code=${addToViewRes.code}`);
    if (addToViewRes.code === 0) {
      const removeRes = await HistoryAPI.removeFromView(authed, videoInfo.data.aid);
      log('History', `removeFromView: code=${removeRes.code}`);
    }
  } catch (e: any) { log('History', `addToView 失败: ${e.message}`); }

  // ========================
  // 13. FavoriteAPI — 收藏夹
  // ========================
  console.log('\n========== 13. FavoriteAPI ==========');
  try {
    const createdFolders = await FavoriteAPI.getCreatedFolders(authed, authed.config.data.mid!, 0);
    log('Favorite', `getCreatedFolders: ${createdFolders.data?.list?.length ?? 0} 个收藏夹`);
    if (createdFolders.data?.list?.length) {
      const folderId = createdFolders.data.list[0].id;
      log('Favorite', `  first: id=${folderId} title=${createdFolders.data.list[0].title} count=${createdFolders.data.list[0].media_count}`);

      const folderInfo = await FavoriteAPI.getFolderInfo(authed, folderId);
      log('Favorite', `getFolderInfo: ${folderInfo.data?.title ?? 'N/A'} media_count=${folderInfo.data?.media_count ?? 0}`);

      const folderList = await FavoriteAPI.getFolderList(authed, folderId, 5, 1);
      log('Favorite', `getFolderList: ${folderList.data?.medias?.length ?? 0} 条内容 has_more=${folderList.data?.has_more}`);
    }
    
  } catch (e: any) { log('Favorite', `失败: ${e.message}`); }

  // ========================
  // 14. DanmakuAPI — 弹幕
  // ========================
  console.log('\n========== 14. DanmakuAPI ==========');
  try {
    const historyDates = await DanmakuAPI.getHistoryDates(authed, videoInfo.data.cid, '2025-07');
    log('Danmaku', `getHistoryDates: ${historyDates.data?.length ?? 0} 个日期`);
  } catch (e: any) { log('Danmaku', `getHistoryDates 失败: ${e.message}`); }

  // ========================
  // 15. EmojiAPI — 表情
  // ========================
  console.log('\n========== 15. EmojiAPI ==========');
  try {
    const emojiPanel = await EmojiAPI.getPanel(authed, 'reply');
    log('Emoji', `getPanel: ${emojiPanel.data?.packages?.length ?? 0} 个表情包`);
    if (emojiPanel.data?.packages?.length) {
      const pkg = emojiPanel.data.packages[0];
      log('Emoji', `  first: ${pkg.text} (${pkg.emote?.length ?? 0} 个表情)`);
    }
  } catch (e: any) { log('Emoji', `getPanel 失败: ${e.message}`); }

  // ========================
  // 16. NoteAPI — 笔记
  // ========================
  console.log('\n========== 16. NoteAPI ==========');
  try {
    const noteForbid = await NoteAPI.isForbid(authed, videoInfo.data.aid);
    log('Note', `isForbid: ${noteForbid.data?.forbid_note_entrance}`);
  } catch (e: any) { log('Note', `isForbid 失败: ${e.message}`); }

  try {
    const userNotes = await NoteAPI.getUserNotes(authed, 5, 1);
    log('Note', `getUserNotes: ${userNotes.data?.list?.length ?? 0} 条笔记 total=${userNotes.data?.page?.total ?? 0}`);
  } catch (e: any) { log('Note', `getUserNotes 失败: ${e.message}`); }

  // ========================
  // 17. ElectricAPI — 充电
  // ========================
  console.log('\n========== 17. ElectricAPI ==========');
  try {
    const chargeList = await ElectricAPI.getMonthlyChargeList(authed, videoInfo.data.owner.mid);
    log('Electric', `getMonthlyChargeList: code=${chargeList.code} count=${chargeList.data?.count ?? 0}`);
  } catch (e: any) { log('Electric', `getMonthlyChargeList 失败: ${e.message}`); }

  try {
    const chargeShow = await ElectricAPI.getVideoChargeShow(authed, videoInfo.data.owner.mid, videoInfo.data.aid);
    log('Electric', `getVideoChargeShow: code=${chargeShow.code} count=${chargeShow.data?.count ?? 0}`);
  } catch (e: any) { log('Electric', `getVideoChargeShow 失败: ${e.message}`); }

  // ========================
  // 18. RankingAPI — 排行
  // ========================
  console.log('\n========== 18. RankingAPI ==========');
  try {
    const popular = await RankingAPI.getPopular(authed, 1, 5);
    log('Ranking', `getPopular: ${popular.data?.list?.length ?? 0} 条 no_more=${popular.data?.no_more}`);
  } catch (e: any) { log('Ranking', `getPopular 失败: ${e.message}`); }

  try {
    const ranking = await RankingAPI.getRanking(authed, 0, 'all');
    log('Ranking', `getRanking: ${ranking.data?.list?.length ?? 0} 条`);
  } catch (e: any) { log('Ranking', `getRanking 失败: ${e.message}`); }

  try {
    const precious = await RankingAPI.getPreciousVideos(authed);
    log('Ranking', `getPreciousVideos: ${precious.data?.list?.length ?? 0} 条`);
  } catch (e: any) { log('Ranking', `getPreciousVideos 失败: ${e.message}`); }

  // ========================
  // 19. LiveAPI — 直播
  // ========================
  console.log('\n========== 19. LiveAPI ==========');
  try {
    const roomInfo = await LiveAPI.getRoomInfo(authed, 21452505);
    log('Live', `getRoomInfo: ${roomInfo.data.title} status=${roomInfo.data.live_status} online=${roomInfo.data.online}`);
  } catch (e: any) {
    log('Live', `getRoomInfo error: ${e.message}`);
  }

  // ========================
  // 20. OpusAPI — 图文
  // ========================
  console.log('\n========== 20. OpusAPI ==========');
  try {
    const opusDetail = await OpusAPI.getDetail(authed, TEST_OPUS_ID);
    log('Opus', `getDetail: ${opusDetail.data?.item?.basic?.title ?? 'N/A'} rid=${opusDetail.data?.item?.basic?.rid_str}`);
  } catch (e: any) { log('Opus', `getDetail 失败: ${e.message}`); }

  try {
    const opusSpace = await OpusAPI.getSpace(authed, videoInfo.data.owner.mid);
    log('Opus', `getSpace: ${opusSpace.data?.items?.length ?? 0} 条 has_more=${opusSpace.data?.has_more}`);
  } catch (e: any) { log('Opus', `getSpace 失败: ${e.message}`); }

  // ========================
  // 21. UploadAPI — 上传
  // ========================
  console.log('\n========== 21. UploadAPI ==========');
  try {
    const imgRes = await UploadAPI.image(authed, './image.png');
    log('Upload', `image: code=${imgRes.code} url=${imgRes.data?.image_url ?? 'N/A'}`);
  } catch (e: any) {
    log('Upload', `image 失败（无 image.png）: ${e.message}`);
  }

  // ========================
  // 22. Entity 门面方法
  // ========================
  console.log('\n========== 22. Entity 门面方法 ==========');
  try {
    const myInfo = await authed.getMyInfo();
    log('Facade', `getMyInfo: name=${myInfo.name} mid=${myInfo.mid} coins=${myInfo.coins}`);
  } catch (e: any) { log('Facade', `getMyInfo 失败: ${e.message}`); }

  try {
    const navInfo = await authed.getNavInfo();
    log('Facade', `getNavInfo: uname=${navInfo.uname} isLogin=${navInfo.isLogin}`);
  } catch (e: any) { log('Facade', `getNavInfo 失败: ${e.message}`); }

  try {
    const currentUser = await authed.getCurrentUser();
    log('Facade', `getCurrentUser: name=${currentUser.name} mid=${currentUser.mid} level=${currentUser.level}`);
  } catch (e: any) { log('Facade', `getCurrentUser 失败: ${e.message}`); }

  try {
    const facadeVideo = await authed.getVideo(TEST_BVID);
    log('Facade', `getVideo: ${facadeVideo.title}`);
  } catch (e: any) { log('Facade', `getVideo 失败: ${e.message}`); }

  try {
    const facadeUser = await authed.getUser(videoInfo.data.owner.mid);
    log('Facade', `getUser: ${facadeUser.name}`);
  } catch (e: any) { log('Facade', `getUser 失败: ${e.message}`); }

  try {
    const facadeDynamic = await authed.getDynamic(dynamicSpace.data.items?.[0]?.id_str ?? '0');
    log('Facade', `getDynamic: type=${facadeDynamic.type} visible=${facadeDynamic.visible}`);
  } catch (e: any) { log('Facade', `getDynamic 失败: ${e.message}`); }

  try {
    const facadeOpus = await authed.getOpus(TEST_OPUS_ID);
    log('Facade', `getOpus: ${facadeOpus.title ?? 'N/A'}`);
  } catch (e: any) { log('Facade', `getOpus 失败: ${e.message}`); }

  console.log('\n========== 全部 API 测试完成 ==========');
}

main().catch(console.error);