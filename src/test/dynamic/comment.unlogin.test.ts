import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { BusinessType } from '../../api/comment.js';
import type { ReplyPicture } from '../../api/comment.js';
import type { ReplyFeedData } from '../../api/message.js';
import { Comment } from '../../entities/Comment.js';
import { ReplyFeedEntity } from '../../entities/ReplyFeedEntity.js';
import { ReplyNotifyItem } from '../../entities/NotifyItem.js';

const SUBJECT_ID = 408396462;
const TARGET_RPID = 316906966928;
const ROOT_RPID = 316767548832;
const SOURCE_RPID = 313596874209;

const simulationData: ReplyFeedData = {
  cursor: {
    is_end: false,
    id: 1154425133801481,
    time: 1788952600,
  },
  items: [
    {
      id: 1155685085945860,
      user: {
        mid: 390794259,
        fans: 0,
        nickname: 'iroha_daisuki',
        avatar: 'https://i0.hdslb.com/bfs/face/0385311b6db8ac4d5c937fd0c87049e2a8e1391d.jpg',
        mid_link: '',
        follow: false,
      },
      item: {
        subject_id: SUBJECT_ID,
        root_id: ROOT_RPID,
        source_id: SOURCE_RPID,
        target_id: TARGET_RPID,
        type: 'reply',
        business_id: BusinessType.Dynamic,
        business: '评论',
        title: '@iroha_daisuki 这是什么',
        desc: '',
        image: '',
        uri: 'https://www.bilibili.com/opus/1245247779461136407',
        native_uri: `bilibili://comment/detail/11/${SUBJECT_ID}/${ROOT_RPID}/?anchor=${SOURCE_RPID}`,
        detail_title: '',
        root_reply_content: '@iroha_daisuki 这是什么',
        source_content: '回复 @Wynncraft :meow',
        target_reply_content: '你是谁',
        at_details: [
          {
            mid: 258359712,
            fans: 0,
            nickname: 'Wynncraft',
            avatar: 'https://i0.hdslb.com/bfs/face/0dc617b6823a329c55ad45d04e706ec098023e9d.jpg',
            mid_link: '',
            follow: false,
          },
        ],
        topic_details: [],
        hide_reply_button: false,
        hide_like_button: false,
        like_state: 0,
        danmu: null,
        message: '',
      },
      counts: 1,
      is_multi: 0,
      reply_time: 1789102798,
    },
  ],
  last_view_at: 0,
};

/** 不加载 profiles / cookie，仅访问公开评论接口。 */
const client = new BiliClient<void>();
const rfe = new ReplyFeedEntity(client, simulationData);
const notify = rfe.items[0];

describe('Comment Unlogin Test', () => {
  describe('读取评论通知', () => {
    it('ReplyFeedEntity 应正确包装分页数据', () => {
      expect(rfe).toBeInstanceOf(ReplyFeedEntity);
      expect(rfe.isEnd).toBe(false);
      expect(rfe.cursor.id).toBe(1154425133801481);
      expect(rfe.cursor.time).toBe(1788952600);
      expect(rfe.lastViewAt).toBe(0);
      expect(rfe.items).toHaveLength(1);
      expect(notify).toBeInstanceOf(ReplyNotifyItem);
    });

    it('应通过通知实体暴露评论区和评论 ID', () => {
      expect(notify.businessId).toBe(BusinessType.Dynamic);
      expect(notify.sourceId).toBe(SOURCE_RPID);
      expect(notify.rootId).toBe(ROOT_RPID);
      expect(notify.subjectId).toBe(SUBJECT_ID);
      expect(notify.content).toBe('回复 @Wynncraft :meow');
      expect(notify.authorMid).toBe(390794259);
      expect(notify.authorName).toBe('iroha_daisuki');
      expect(notify.replyTime).toBe(1789102798);
    });
  });

  describe('访问公开评论接口', () => {
    it('client.resolveComment 应定位楼中楼评论', async () => {
      const comment = await client.resolveComment(TARGET_RPID, {
        oid: notify.subjectId,
        replyType: notify.businessId,
      });

      expect(comment).toBeInstanceOf(Comment);
      expect(comment.rpid).toBe(TARGET_RPID);
      expect(comment.message).toBe('你是谁');
      expect(comment.mid).toBe(258359712);
      expect(comment.member.mid).toBe('258359712');
      expect(comment.member.uname).toBe('Wynncraft');
      expect(comment.upstreamType).toBe(BusinessType.Dynamic);
      expect(comment.upstreamTypeName).toBe('相簿/图文动态 (Opus / Dynamic)');
      expect(comment.root).toBe(ROOT_RPID);
    }, 15_000);

    it('client.getComment 应获取根评论及图片', async () => {
      const comment = await client.getComment(
        notify.subjectId,
        notify.businessId,
        notify.rootId,
      );

      expect(comment).toBeInstanceOf(Comment);
      expect(comment.rpid).toBe(ROOT_RPID);
      expect(comment.message).toBe('@iroha_daisuki 这是什么');
      expect(comment.mid).toBe(258359712);
      expect(comment.member.mid).toBe('258359712');
      expect(comment.member.uname).toBe('Wynncraft');
      expect(comment.upstreamType).toBe(BusinessType.Dynamic);
      expect(comment.upstreamTypeName).toBe('相簿/图文动态 (Opus / Dynamic)');
      expect(comment.root).toBe(0);
      expect(comment.pictures).toHaveLength(1);

      const picture = comment.pictures?.[0] as ReplyPicture;
      expect(picture.img_src).toMatch(/^https?:\/\//);
      expect(picture.img_height).toBe(2121);
      expect(picture.img_size).toBe(1035.39);
    }, 15_000);
  });
});
