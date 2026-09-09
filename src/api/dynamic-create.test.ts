import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DynamicAPI } from './dynamic.js';
import { BiliClient } from '../core/client.js';
import type { HasToken } from '../core/client.js';
import { UploadAPI } from './upload.js';

describe('DynamicAPI & Client Dynamic Creation', () => {
  let mockClient: BiliClient<HasToken>;
  let requestSpy: any;

  beforeEach(() => {
    mockClient = new BiliClient() as unknown as BiliClient<HasToken>;
    mockClient.config.data.cookie = 'DedeUserID=123456; SESSDATA=test_sess; bili_jct=test_csrf';
    mockClient.config.data.mid = 123456;

    requestSpy = vi.spyOn(mockClient, 'request').mockResolvedValue({
      code: 0,
      message: '0',
      ttl: 1,
      data: {},
    });
  });

  describe('createVote', () => {
    it('should throw error if less than 2 options provided', async () => {
      await expect(
        DynamicAPI.createVote(mockClient, {
          title: '投票标题',
          options: ['只有一项'],
        }),
      ).rejects.toThrow('投票选项至少需要 2 项');
    });

    it('should build urlencoded body and post to vote endpoint', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        message: '0',
        data: {
          vote_id: 889900,
          _gt_: 0,
        },
      });

      const res = await DynamicAPI.createVote(mockClient, {
        title: '你喜欢猫还是狗？',
        desc: '宠物小调查',
        type: 0,
        choiceCount: 1,
        duration: 86400,
        options: ['猫咪', { desc: '小狗', imgUrl: 'https://example.com/dog.png' }],
      });

      expect(res.code).toBe(0);
      expect(res.data.vote_id).toBe(889900);

      expect(requestSpy).toHaveBeenCalledWith(
        'https://api.bilibili.com/x/vote/create?csrf=test_csrf',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const callArgs = requestSpy.mock.calls[0];
      const parsedBody = JSON.parse(callArgs[1].body);
      expect(parsedBody.vote_info.title).toBe('你喜欢猫还是狗？');
      expect(parsedBody.vote_info.desc).toBe('宠物小调查');
      expect(parsedBody.vote_info.type).toBe(0);
      expect(parsedBody.vote_info.choice_cnt).toBe(1);
      expect(parsedBody.vote_info.duration).toBe(86400);
      expect(parsedBody.vote_info.options).toEqual([
        { opt_desc: '猫咪' },
        { opt_desc: '小狗', img_url: 'https://example.com/dog.png' },
      ]);
      expect(parsedBody.vote_info.vote_publisher).toBe(123456);
      expect(parsedBody.vote_info.release_scene).toBe('dynamic');
    });
  });

  describe('create dynamic with text, @ and options', () => {
    it('should create pure text dynamic with scene=1', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        message: '0',
        data: {
          dyn_id: 11223344,
          dyn_id_str: '11223344',
          dyn_type: 1,
        },
      });

      const res = await DynamicAPI.create(mockClient, '你好，Bilibili！');

      expect(res.code).toBe(0);
      expect(res.data.dyn_id_str).toBe('11223344');

      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://api.bilibili.com/x/dynamic/feed/create/dyn?csrf=test_csrf'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      expect(payload.dyn_req.scene).toBe(1);
      expect(payload.dyn_req.content.contents).toEqual([
        { raw_text: '你好，Bilibili！', type: 1, biz_id: '' },
      ]);
      expect(payload.dyn_req.upload_id).toMatch(/^123456_\d+_\d+$/);
    });

    it('should split inline @ mentions and attach them with type=2', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        data: { dyn_id_str: '998877' },
      });

      await DynamicAPI.create(mockClient, {
        content: '欢迎关注 @哔哩哔哩弹幕网 和 @小助手 哦',
        at: [
          { name: '哔哩哔哩弹幕网', mid: 208259 },
          { name: '小助手', mid: 99999 },
        ],
      });

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      const contents = payload.dyn_req.content.contents;

      expect(contents).toEqual([
        { raw_text: '欢迎关注 ', type: 1, biz_id: '' },
        { raw_text: '@哔哩哔哩弹幕网 ', type: 2, biz_id: '208259' },
        { raw_text: '和 ', type: 1, biz_id: '' },
        { raw_text: '@小助手 ', type: 2, biz_id: '99999' },
        { raw_text: '哦', type: 1, biz_id: '' },
      ]);
    });

    it('should append @ users to end if not present inline in text', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        data: { dyn_id_str: '998877' },
      });

      await DynamicAPI.create(mockClient, {
        content: '大家快来看！',
        at: [{ name: '粉丝团', mid: 654321 }],
      });

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      expect(payload.dyn_req.content.contents).toEqual([
        { raw_text: '大家快来看！', type: 1, biz_id: '' },
        { raw_text: '@粉丝团 ', type: 2, biz_id: '654321' },
      ]);
    });

    it('should support comment settings (closeComment / upChooseComment)', async () => {
      requestSpy.mockResolvedValueOnce({ code: 0, data: {} });

      await DynamicAPI.create(mockClient, {
        content: '禁止评论测试',
        closeComment: true,
      });

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      expect(payload.dyn_req.option).toEqual({
        close_comment: 1,
        up_choose_comment: 0,
      });
    });
  });

  describe('create dynamic with pictures', () => {
    it('should accept pre-uploaded DynamicPicture objects with scene=2', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        data: { dyn_id_str: '556677', dyn_type: 2 },
      });

      const res = await DynamicAPI.create(mockClient, {
        content: '带图动态',
        images: [
          {
            img_src: 'https://i0.hdslb.com/bfs/new_dyn/test1.png',
            img_width: 800,
            img_height: 600,
            img_size: 150.5,
          },
        ],
      });

      expect(res.code).toBe(0);
      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      expect(payload.dyn_req.scene).toBe(2);
      expect(payload.dyn_req.pics).toEqual([
        {
          img_src: 'https://i0.hdslb.com/bfs/new_dyn/test1.png',
          img_width: 800,
          img_height: 600,
          img_size: 150.5,
        },
      ]);
    });

    it('should upload Buffer data and attach to pics', async () => {
      vi.spyOn(UploadAPI, 'uploadBuffer').mockResolvedValueOnce({
        code: 0,
        message: '0',
        ttl: 1,
        data: {
          image_url: 'https://i0.hdslb.com/bfs/new_dyn/buffer_uploaded.png',
          image_width: 1024,
          image_height: 768,
          img_size: 200,
          ai_gen_pic: 0,
        },
      });

      requestSpy.mockResolvedValueOnce({ code: 0, data: { dyn_id_str: '777' } });

      const fakeBuffer = Buffer.from('fake-image-bytes');
      await DynamicAPI.create(mockClient, {
        content: '动态带Buffer图',
        images: [fakeBuffer],
      });

      expect(UploadAPI.uploadBuffer).toHaveBeenCalledWith(mockClient, fakeBuffer, 'dynamic.png');

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      expect(payload.dyn_req.pics).toEqual([
        {
          img_src: 'https://i0.hdslb.com/bfs/new_dyn/buffer_uploaded.png',
          img_width: 1024,
          img_height: 768,
          img_size: 200,
        },
      ]);
    });

    it('should throw error if more than 9 images provided', async () => {
      const tenImages = new Array(10).fill({ img_src: 'https://example.com/pic.png' });
      await expect(
        DynamicAPI.create(mockClient, {
          content: '十张图',
          images: tenImages,
        }),
      ).rejects.toThrow('动态最多支持携带 9 张图片');
    });
  });

  describe('create dynamic with vote', () => {
    it('should attach existing vote_id with type=4', async () => {
      requestSpy.mockResolvedValueOnce({
        code: 0,
        data: { dyn_id_str: '888' },
      });

      await DynamicAPI.create(mockClient, {
        content: '投票在此',
        vote: 654321,
      });

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      const contents = payload.dyn_req.content.contents;

      expect(contents).toEqual([
        { raw_text: '投票在此', type: 1, biz_id: '' },
        { raw_text: '投票', type: 4, biz_id: '654321' },
      ]);
    });

    it('should automatically create vote first when CreateVoteOptions is passed', async () => {
      vi.spyOn(DynamicAPI, 'createVote').mockResolvedValueOnce({
        code: 0,
        message: '0',
        ttl: 1,
        data: {
          vote_id: 998811,
          _gt_: 0,
        },
      });

      requestSpy.mockResolvedValueOnce({
        code: 0,
        data: { dyn_id_str: '999' },
      });

      await DynamicAPI.create(mockClient, {
        content: '大家来参与投票吧',
        vote: {
          title: '下期视频做什么',
          options: ['游戏解说', '技术分享'],
        },
      });

      expect(DynamicAPI.createVote).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({ title: '下期视频做什么' }),
      );

      const payload = JSON.parse(requestSpy.mock.calls[0][1].body);
      const contents = payload.dyn_req.content.contents;

      expect(contents).toEqual([
        { raw_text: '大家来参与投票吧', type: 1, biz_id: '' },
        { raw_text: '下期视频做什么', type: 4, biz_id: '998811' },
      ]);
    });
  });

  describe('Client createDynamic and createVote delegation', () => {
    it('should delegate client.createDynamic and client.createVote', async () => {
      const createSpy = vi.spyOn(DynamicAPI, 'create').mockResolvedValueOnce({
        code: 0,
        message: '0',
        ttl: 1,
        data: { result: 0, dyn_id: 1, dyn_id_str: '1', dyn_type: 1 },
      });

      const voteSpy = vi.spyOn(DynamicAPI, 'createVote').mockResolvedValueOnce({
        code: 0,
        message: '0',
        ttl: 1,
        data: { vote_id: 2, _gt_: 0 },
      });

      await mockClient.createDynamic('客户端发动态');
      expect(createSpy).toHaveBeenCalledWith(mockClient, '客户端发动态');

      await mockClient.createVote({
        title: '标题',
        options: ['A', 'B'],
      });
      expect(voteSpy).toHaveBeenCalledWith(mockClient, {
        title: '标题',
        options: ['A', 'B'],
      });
    });
  });
});
