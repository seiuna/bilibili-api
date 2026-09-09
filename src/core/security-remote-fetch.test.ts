import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiliClient } from './client.js';
import { UploadAPI } from '../api/upload.js';
import { CommentAPI, ReplySort, ReplyMode } from '../api/comment.js';

describe('Security: Remote Fetch Credentials & Raw Comment Methods', () => {
  let client: BiliClient<any>;

  beforeEach(() => {
    client = new BiliClient();
    client.config.data.cookie = 'DedeUserID=123456; SESSDATA=sensitive_token; bili_jct=csrf_token';
    client.config.data.accessToken = 'sensitive_access_token';
  });

  describe('Anonymous Remote Downloads', () => {
    it('should NOT attach Cookie or Authorization when fetching external URLs', async () => {
      let capturedHeaders: Headers | null = null;
      const customFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedHeaders = new Headers(init.headers);
        return new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: {
            'Content-Type': 'image/png',
            'Set-Cookie': 'malicious_cookie=evil_value; Path=/',
          },
        });
      });

      (client as any).customFetch = customFetch;

      const res = await client.rawRequest('https://external-image-host.com/avatar.png');
      expect(res.status).toBe(200);

      // Verify no Bilibili credentials were sent
      expect(capturedHeaders!.get('Cookie')).toBeNull();
      expect(capturedHeaders!.get('Authorization')).toBeNull();

      // Verify external Set-Cookie was NOT merged into client config
      expect(client.config.data.cookie).not.toContain('malicious_cookie');
      expect(client.config.data.cookie).toContain('SESSDATA=sensitive_token');
    });

    it('should NOT attach Cookie when options.anonymous is true even on Bilibili host', async () => {
      let capturedHeaders: Headers | null = null;
      const customFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedHeaders = new Headers(init.headers);
        return new Response('ok', {
          status: 200,
          headers: { 'Set-Cookie': 'test_anon=1; Path=/' },
        });
      });

      (client as any).customFetch = customFetch;

      await client.rawRequest('https://api.bilibili.com/x/test', { anonymous: true });
      expect(capturedHeaders!.get('Cookie')).toBeNull();
      expect(client.config.data.cookie).not.toContain('test_anon');
    });

    it('UploadAPI.uploadFromUrl should pass anonymous: true to rawRequest', async () => {
      const rawRequestSpy = vi.spyOn(client, 'rawRequest').mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'Content-Type': 'image/png' },
        }),
      );

      vi.spyOn(UploadAPI, 'uploadBuffer').mockResolvedValueOnce({
        code: 0,
        message: '0',
        ttl: 1,
        data: {
          image_url: 'https://i0.hdslb.com/bfs/new_dyn/uploaded.png',
          image_width: 100,
          image_height: 100,
          img_size: 10,
          ai_gen_pic: 0,
        },
      });

      await UploadAPI.uploadFromUrl(client, 'https://example.com/external.png');

      expect(rawRequestSpy).toHaveBeenCalledWith(
        'https://example.com/external.png',
        expect.objectContaining({ anonymous: true }),
      );
    });
  });

  describe('CommentAPI Raw Methods Require replyType', () => {
    it('should require replyType as a required parameter on getReplies and getRepliesWbi', () => {
      expect(CommentAPI.getReplies.length).toBeGreaterThanOrEqual(3);
      expect(CommentAPI.getRepliesWbi.length).toBeGreaterThanOrEqual(3);
      expect(CommentAPI.getReplyDialog.length).toBeGreaterThanOrEqual(4);
      expect(CommentAPI.getHotReplies.length).toBeGreaterThanOrEqual(3);
      expect(CommentAPI.getReply.length).toBeGreaterThanOrEqual(4);
      expect(CommentAPI.delete.length).toBeGreaterThanOrEqual(4);
      expect(CommentAPI.like.length).toBeGreaterThanOrEqual(4);
    });

    it('should correctly send provided replyType without fallback to 1', async () => {
      const requestSpy = vi.spyOn(client, 'request').mockResolvedValue({
        code: 0,
        message: '0',
        data: {},
      });

      await CommentAPI.getReplies(client, 1001, 11, ReplySort.TIME);
      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringContaining('type=11'),
      );

      await CommentAPI.getRepliesWbi(client, 1001, 12, ReplyMode.HEAT);
      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringContaining('type=12'),
      );

      await CommentAPI.getReply(client, 1001, 14, 55555);
      expect(requestSpy).toHaveBeenCalledWith(
        expect.stringContaining('type=14'),
      );
    });
  });
});
