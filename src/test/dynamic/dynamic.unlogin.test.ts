import { describe, expect, it } from 'vitest';
import { BiliClient } from '../../core/client.js';
import { BusinessType } from '../../api/comment.js';
import { DynamicAPI } from '../../api/dynamic.js';
import type { ReplyFeedData } from '../../api/message.js';
import { Dynamic } from '../../entities/Dynamic.js';
import { ReplyFeedEntity } from '../../entities/ReplyFeedEntity.js';
import { ReplyNotifyItem } from '../../entities/NotifyItem.js';

const DYNAMIC_ID = '1245247779461136407';
const DYNAMIC_CONTENT = 'meow testmeow';
const DYNAMIC_IMAGE_URL = 'http://i0.hdslb.com/bfs/new_dyn/6693f9f72aab5ccff71ed442258f476d390794259.jpg';

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
        subject_id: 408396462,
        root_id: 316767548832,
        source_id: 313596874209,
        target_id: 316906966928,
        type: 'reply',
        business_id: BusinessType.Dynamic,
        business: '评论',
        title: '@iroha_daisuki 这是什么',
        desc: '',
        image: '',
        uri: `https://www.bilibili.com/opus/${DYNAMIC_ID}`,
        native_uri: `bilibili://comment/detail/11/408396462/316767548832/?enterUri=bilibili://opus/detail/${DYNAMIC_ID}`,
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

/** 不加载 profiles / cookie，仅访问公开动态接口。 */
const client = new BiliClient<void>();
const rfe = new ReplyFeedEntity(client, simulationData);
const notify = rfe.items[0];

describe('Dynamic Unlogin Test', () => {
  describe('读取动态通知', () => {
    it('ReplyFeedEntity 应正确包装分页与通知数据', () => {
      expect(rfe).toBeInstanceOf(ReplyFeedEntity);
      expect(rfe.isEnd).toBe(false);
      expect(rfe.cursor.id).toBe(1154425133801481);
      expect(rfe.cursor.time).toBe(1788952600);
      expect(rfe.lastViewAt).toBe(0);
      expect(rfe.items).toHaveLength(1);

      expect(notify).toBeInstanceOf(ReplyNotifyItem);
      expect(notify.businessId).toBe(BusinessType.Dynamic);
      expect(notify.subjectId).toBe(408396462);
      expect(notify.rootId).toBe(316767548832);
      expect(notify.sourceId).toBe(313596874209);
      expect(notify.content).toBe('回复 @Wynncraft :meow');
      expect(notify.authorMid).toBe(390794259);
      expect(notify.authorName).toBe('iroha_daisuki');
    });

    it('NotifyURIHelper 应解析动态 ID 并保留原始 URI', () => {
      expect(notify.uri.dynamicId).toBe(DYNAMIC_ID);
      expect(notify.uri.videoId).toBeNull();
      expect(notify.uri.raw).toBe(`https://www.bilibili.com/opus/${DYNAMIC_ID}`);
    });

    it('NotifyURIHelper 应解析 BV ID，且非目标类型返回 null', () => {
      const videoFeed: ReplyFeedData = {
        ...simulationData,
        items: [
          {
            ...simulationData.items[0],
            item: {
              ...simulationData.items[0].item,
              uri: 'https://www.bilibili.com/video/BV1xx411c7mD',
              business_id: BusinessType.Video,
            },
          },
        ],
      };
      const videoNotify = new ReplyFeedEntity(client, videoFeed).items[0];

      expect(videoNotify.uri.videoId).toBe('BV1xx411c7mD');
      expect(videoNotify.uri.dynamicId).toBeNull();
      expect(videoNotify.uri.raw).toBe('https://www.bilibili.com/video/BV1xx411c7mD');
    });
  });

  describe('访问公开动态接口', () => {
    it('DynamicAPI.getDetail 应返回目标动态的正文和配图', async () => {
      const result = await DynamicAPI.getDetail(client, DYNAMIC_ID);

      expect(result.code).toBe(0);
      expect(result.data.item.id_str).toBe(DYNAMIC_ID);
      expect(result.data.item.type).toBe('DYNAMIC_TYPE_DRAW');
      expect(result.data.item.visible).toBe(true);
      expect(result.data.item.basic.comment_type).toBe(BusinessType.Dynamic);
      expect(result.data.item.basic.rid_str).toBe('408396462');

      const modules = Array.isArray(result.data.item.modules)
        ? result.data.item.modules
        : [result.data.item.modules];
      const opus = modules[0].module_dynamic?.major?.opus;

      expect(modules).toHaveLength(1);
      expect(opus?.summary?.text).toBe(DYNAMIC_CONTENT);
      expect(opus?.pics).toHaveLength(1);
      expect(opus?.pics?.[0]).toMatchObject({
        url: DYNAMIC_IMAGE_URL,
        width: 1000,
        height: 1000,
        size: 95.375,
      });
    });

    it('client.getDynamic 应返回 Dynamic 实体', async () => {
      const dynamic = await client.getDynamic(DYNAMIC_ID);

      expect(dynamic).toBeInstanceOf(Dynamic);
      expect(dynamic.id).toBe(DYNAMIC_ID);
      expect(dynamic.type).toBe('DYNAMIC_TYPE_DRAW');
      expect(dynamic.visible).toBe(true);
      expect(dynamic.moduleList).toHaveLength(1);
      expect(dynamic.content).toBe(DYNAMIC_CONTENT);
      expect(dynamic.pictures).toHaveLength(1);
      expect(dynamic.pictures[0]).toMatchObject({
        url: DYNAMIC_IMAGE_URL,
        width: 1000,
        height: 1000,
        size: 95.375,
      });

      const commentArea = dynamic.commentArea();
      expect(commentArea.getOid).toBe(notify.subjectId);
      expect(commentArea.getReplyType).toBe(notify.businessId);
    });
  });
});
