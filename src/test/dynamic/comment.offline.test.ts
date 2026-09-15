import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiliClient, HasToken } from '../../core/client';
import { CommentAPI, ReplyEntry, ReplyPicture, BusinessType } from '../../api/comment';
import { MessageAPI, ReplyFeedData } from '../../api/message';
import { DynamicAPI } from '../../api/dynamic';
import { ReplyFeedEntity } from '../../entities/ReplyFeedEntity';
import { ReplyNotifyItem } from '../../entities/NotifyItem';
import { log } from 'console';


describe('MessageApi Offline Test', () => {
  let mockClient: BiliClient<void>;
  const simulation_data: ReplyFeedData = {
    "cursor": {
      "is_end": false,
      "id": 1154425133801481,
      "time": 1788952600
    },
    "items": [
      {
        "id": 1155685085945860,
        "user": {
          "mid": 390794259,
          "fans": 0,
          "nickname": "iroha_daisuki",
          "avatar": "https://i0.hdslb.com/bfs/face/0385311b6db8ac4d5c937fd0c87049e2a8e1391d.jpg",
          "mid_link": "",
          "follow": false
        },
        "item": {
          "subject_id": 408396462,
          "root_id": 316767548832,
          "source_id": 313596874209,
          "target_id": 316906966928,
          "type": "reply",
          "business_id": 11,
          "business": "评论",
          "title": "@iroha_daisuki 这是什么",
          "desc": "",
          "image": "",
          "uri": "https://www.bilibili.com/opus/1245247779461136407",
          "native_uri": "bilibili://comment/detail/11/408396462/316767548832/?subType=0\u0026anchor=313596874209\u0026showEnter=1\u0026extraIntentId=0\u0026scene=1\u0026enterName=查看动态详情\u0026title=评论详情\u0026enterUri=bilibili://opus/detail/1245247779461136407",
          "detail_title": "",
          "root_reply_content": "@iroha_daisuki 这是什么",
          "source_content": "回复 @Wynncraft :meow",
          "target_reply_content": "你是谁",
          "at_details": [
            {
              "mid": 258359712,
              "fans": 0,
              "nickname": "Wynncraft",
              "avatar": "https://i0.hdslb.com/bfs/face/0dc617b6823a329c55ad45d04e706ec098023e9d.jpg",
              "mid_link": "",
              "follow": false
            }
          ],
          "topic_details": [],
          "hide_reply_button": false,
          "hide_like_button": false,
          "like_state": 0,
          "danmu": null,
          "message": ""
        },
        "counts": 1,
        "is_multi": 0,
        "reply_time": 1789102798
      }
    ],
    last_view_at: 0
  }

  beforeEach(() => {

    mockClient = new BiliClient();

  });

  describe('读取评论树', () => {

    const rfe = new ReplyFeedEntity(mockClient, simulation_data);
    const notify = rfe.items[0];
    it('ReplyFeedEntity 应正确包装分页数据', () => {
      expect(rfe).toBeInstanceOf(ReplyFeedEntity);
      expect(rfe.isEnd).toBe(false);
      expect(rfe.cursor.id).toBe(1154425133801481);
      expect(rfe.cursor.time).toBe(1788952600);
      expect(rfe.lastViewAt).toBe(0);
      expect(rfe.items).toHaveLength(1);
      expect(notify).toBeInstanceOf(ReplyNotifyItem);
    });

    it('检查测试数据是否正确', async () => {
      expect(notify.businessId).toBe(BusinessType.Dynamic);
      expect(notify.sourceId).toBe(313596874209);
      expect(notify.rootId).toBe(316767548832);
      expect(notify.subjectId).toBe(408396462);
      expect(notify.content).toBe("回复 @Wynncraft :meow");
      expect(notify.authorMid).toBe(390794259);
      expect(notify.authorName).toBe('iroha_daisuki');
      expect(notify.replyTime).toBe(1789102798);
    });

    describe('获取评论信息', () => {
      it('获取评论的完整信息 (通过 client.resolveComment)', async () => {
        const comment = await mockClient.resolveComment('316906966928', {
          oid: notify.subjectId,
          replyType: notify.businessId,
        });
        expect(comment.rpid).toBe(316906966928);
        expect(comment.message).toBe('你是谁');
        expect(comment.mid).toBe(258359712);
        expect(comment.member.mid).toBe('258359712');
        expect(comment.member.uname).toBe('Wynncraft');
        expect(comment.upstreamType).toBe(11);
        expect(comment.upstreamTypeName).toBe('相簿/图文动态 (Opus / Dynamic)');
        expect(comment.root).toBe(316767548832);
      });

      it('获取根评论的完整信息 (通过 client.getComment)', async () => {
        const comment = await mockClient.getComment(notify.subjectId, notify.businessId, notify.rootId);
        expect(comment.rpid).toBe(316767548832);
        expect(comment.message).toBe('@iroha_daisuki 这是什么');
        expect(comment.mid).toBe(258359712);
        expect(comment.member.mid).toBe('258359712');
        expect(comment.member.uname).toBe('Wynncraft');
        expect(comment.upstreamType).toBe(11);
        expect(comment.upstreamTypeName).toBe('相簿/图文动态 (Opus / Dynamic)');
        expect(comment.root).toBe(0);
        const pic = comment.pictures?.[0] as unknown as ReplyPicture;
        expect(pic.img_height).toBe(2121);
        expect(pic.img_size).toBe(1035.39);
      });

    });


  });
});
