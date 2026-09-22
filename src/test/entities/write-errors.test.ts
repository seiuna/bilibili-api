import { describe, expect, it } from 'vitest';
import { BiliClient, BiliApiError } from '../../core/client.js';
import { Video } from '../../entities/Video.js';
import { Dynamic } from '../../entities/Dynamic.js';
import { Article } from '../../entities/Article.js';
import { User } from '../../entities/User.js';
import { LiveRoom } from '../../entities/LiveRoom.js';
import { FavoriteFolder } from '../../entities/FavoriteFolder.js';
import { CommentArea } from '../../entities/CommentArea.js';
import type { VideoInfo } from '../../api/video.js';
import type { DynamicDetail } from '../../api/dynamic.js';
import type { ArticleInfo } from '../../api/article.js';
import type { UserInfo } from '../../api/user.js';
import type { LiveRoomInfo } from '../../api/live.js';
import type { FavoriteFolderData } from '../../api/favorite.js';

describe('Entity Write Operations & assertOk Test', () => {
  it('当服务端返回非 0 code 时，实体层写操作必须抛出 BiliApiError 且包含对应错误码与信息', async () => {
    let mockResponse = { code: -101, message: '账号未登录', data: null };

    const mockFetch = async () => new Response(JSON.stringify(mockResponse));
    const client = new BiliClient(undefined, mockFetch as typeof fetch);
    client.config.data.cookie = 'bili_jct=fake_csrf;';

    // 1. Video 写操作
    const video = new Video(client, { aid: 80433022, bvid: 'BV1GJ411x7h7' } as VideoInfo);
    await expect(video.like()).rejects.toThrow(BiliApiError);
    await expect(video.like()).rejects.toThrow('[-101] 账号未登录');
    await expect(video.coin(1)).rejects.toThrow(BiliApiError);
    await expect(video.favorite('123')).rejects.toThrow(BiliApiError);
    await expect(video.triple()).rejects.toThrow(BiliApiError);

    // 2. Dynamic 写操作
    const dynamic = new Dynamic(client, { id_str: '1245247779461136407' } as DynamicDetail['item']);
    mockResponse = { code: -400, message: '请求错误', data: null };
    await expect(dynamic.like()).rejects.toThrow(BiliApiError);
    await expect(dynamic.delete()).rejects.toThrow('[-400] 请求错误');
    await expect(dynamic.setTop()).rejects.toThrow(BiliApiError);

    // 3. Article 写操作
    const article = new Article(client, { _cvid: 170001, mid: 208259 } as unknown as ArticleInfo);
    mockResponse = { code: -111, message: 'csrf 校验失败', data: null };
    await expect(article.like()).rejects.toThrow(BiliApiError);
    await expect(article.coin(1)).rejects.toThrow('[-111] csrf 校验失败');
    await expect(article.favorite()).rejects.toThrow(BiliApiError);

    // 4. User 关系操作
    const user = new User(client, { mid: 208259 } as UserInfo);
    mockResponse = { code: 22001, message: '已在黑名单中', data: null };
    await expect(user.follow()).rejects.toThrow(BiliApiError);
    await expect(user.block()).rejects.toThrow('[22001] 已在黑名单中');

    // 5. LiveRoom 管理操作
    const liveRoom = new LiveRoom(client, { room_id: 7734200, short_id: 6 } as LiveRoomInfo);
    mockResponse = { code: -403, message: '无权限操作该房间', data: null };
    await expect(liveRoom.banUser(123)).rejects.toThrow(BiliApiError);
    await expect(liveRoom.banUser(123)).rejects.toThrow('[-403] 无权限操作该房间');

    // 6. FavoriteFolder 操作
    const folder = new FavoriteFolder(client, { id: 1000 } as FavoriteFolderData);
    mockResponse = { code: 11007, message: '收藏夹已被删除', data: null };
    await expect(folder.delete()).rejects.toThrow(BiliApiError);
    await expect(folder.delete()).rejects.toThrow('[11007] 收藏夹已被删除');

    // 7. CommentArea 写操作
    const area = new CommentArea(client, 408396462, 11);
    mockResponse = { code: 12002, message: '评论已被删除', data: null };
    await expect(area.like(316906966928)).rejects.toThrow(BiliApiError);
    await expect(area.like(316906966928)).rejects.toThrow('[12002] 评论已被删除');
    await expect(area.delete(316906966928)).rejects.toThrow(BiliApiError);
  });

  it('当服务端返回 code: 0 时，写操作正常完成且不抛错', async () => {
    const mockResponse = { code: 0, message: '0', data: { like: true, coin: true, fav: true, multiply: 1 } };
    const mockFetch = async () => new Response(JSON.stringify(mockResponse));
    const client = new BiliClient(undefined, mockFetch as typeof fetch);
    client.config.data.cookie = 'bili_jct=fake_csrf;';

    const video = new Video(client, { aid: 80433022, bvid: 'BV1GJ411x7h7' } as VideoInfo);
    await expect(video.like()).resolves.toBeUndefined();
    await expect(video.unlike()).resolves.toBeUndefined();
    await expect(video.triple()).resolves.toEqual({ like: true, coin: true, fav: true, multiply: 1 });
  });
});
