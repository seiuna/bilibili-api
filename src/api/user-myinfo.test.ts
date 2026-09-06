import { describe, it, expect, vi } from 'vitest';
import { BiliClient } from '../core/client.js';
import type { HasToken } from '../core/client.js';
import { UserAPI } from './user.js';

describe('UserAPI & Client Current User Info', () => {
  it('should call getMyInfo API correctly', async () => {
    const mockData = {
      code: 0,
      message: '0',
      ttl: 1,
      data: {
        mid: 123456,
        name: '测试用户',
        sex: '男',
        face: 'https://example.com/face.jpg',
        sign: '个人签名',
        rank: 10000,
        level: 6,
        jointime: 0,
        moral: 70,
        silence: 0,
        email_status: 1,
        tel_status: 1,
        identification: 1,
        vip: {
          type: 2,
          status: 1,
          due_date: 1700000000000,
          vip_pay_type: 1,
          theme_type: 0,
          label: {
            path: '',
            text: '年度大会员',
            label_theme: 'annual_vip',
            text_color: '#FFFFFF',
            bg_style: 1,
            bg_color: '#FB7299',
            border_color: '',
          },
          avatar_subscript: 1,
          nickname_color: '#FB7299',
        },
        birthday: 1015257600,
        is_tourist: 0,
        is_fake_account: 0,
        pin_prompting: 0,
        is_deleted: 0,
        coins: 100,
        following: 50,
        follower: 1000,
      },
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/x/space/myinfo')) {
        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const client = new BiliClient<HasToken>(undefined, mockFetch as unknown as typeof fetch);
    const res = await UserAPI.getMyInfo(client);

    expect(res.code).toBe(0);
    expect(res.data.mid).toBe(123456);
    expect(res.data.name).toBe('测试用户');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.bilibili.com/x/space/myinfo',
      expect.anything(),
    );

    // 测试 HasToken client 门面方法 getMyInfo
    const myInfo = await client.getMyInfo();
    expect(myInfo.mid).toBe(123456);
    expect(myInfo.name).toBe('测试用户');
  });

  it('should call getNavInfo API correctly', async () => {
    const mockNavData = {
      code: 0,
      message: '0',
      ttl: 1,
      data: {
        isLogin: true,
        email_verified: 1,
        face: 'https://example.com/face.jpg',
        level_info: {
          current_level: 6,
          current_min: 28800,
          current_exp: 50000,
          next_exp: '--',
        },
        mid: 123456,
        mobile_verified: 1,
        money: 200,
        moral: 70,
        official: { role: 0, title: '', desc: '', type: -1 },
        officialVerify: { type: -1, desc: '' },
        pendant: { pid: 0, name: '', image: '', expire: 0 },
        scores: 0,
        uname: '测试用户',
        vipDueDate: 1700000000000,
        vipStatus: 1,
        vipType: 2,
        vip_pay_type: 0,
        vip_theme_type: 0,
        vip_label: { path: '', text: '年度大会员', label_theme: 'annual_vip' },
        vip_avatar_subscript: 1,
        vip_nickname_color: '#FB7299',
        is_senior_member: 1,
      },
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/x/web-interface/nav')) {
        return new Response(JSON.stringify(mockNavData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const client = new BiliClient<HasToken>(undefined, mockFetch as unknown as typeof fetch);
    const navInfo = await client.getNavInfo();

    expect(navInfo.isLogin).toBe(true);
    expect(navInfo.uname).toBe('测试用户');
    expect(navInfo.mid).toBe(123456);
    expect(navInfo.money).toBe(200);
  });

  it('should get current user entity via getCurrentUser', async () => {
    const mockMyInfo = {
      code: 0,
      message: '0',
      data: {
        mid: 666888,
        name: '当前用户',
        sex: '保密',
        face: 'https://example.com/face.jpg',
        sign: '签名',
        rank: 10000,
        level: 5,
        jointime: 0,
        moral: 70,
        silence: 0,
        email_status: 1,
        tel_status: 1,
        identification: 1,
        vip: { type: 0, status: 0, due_date: 0, vip_pay_type: 0, theme_type: 0, label: { path: '', text: '', label_theme: '', text_color: '', bg_style: 0, bg_color: '', border_color: '' }, avatar_subscript: 0, nickname_color: '' },
        birthday: 0,
        is_tourist: 0,
        is_fake_account: 0,
        pin_prompting: 0,
        is_deleted: 0,
        coins: 10,
        following: 1,
        follower: 1,
      },
    };

    const mockUserInfo = {
      code: 0,
      message: '0',
      data: {
        mid: 666888,
        name: '当前用户',
        sex: '保密',
        face: 'https://example.com/face.jpg',
        sign: '签名',
        rank: 10000,
        level: 5,
        jointime: 0,
        moral: 70,
        silence: 0,
        coins: 10,
        fans_badge: false,
        fans_medal: { show: false, wear: false, medal: null },
        official: { role: 0, title: '', desc: '', type: -1 },
        vip: { type: 0, status: 0, due_date: 0, vip_pay_type: 0, theme_type: 0, label: { path: '', text: '', label_theme: '', text_color: '', bg_style: 0, bg_color: '', border_color: '', use_img_label: false, img_label_uri_hans: '', img_label_uri_hant: '', img_label_uri_hans_static: '', img_label_uri_hant_static: '' }, avatar_subscript: 0, nickname_color: '', role: 0, avatar_subscript_url: '', tv_vip_status: 0, tv_vip_pay_type: 0, tv_due_date: 0, vipType: 0, vipStatus: 0 },
        pendant: { pid: 0, name: '', image: '', expire: 0, image_enhance: '', image_enhance_frame: '' },
        nameplate: { nid: 0, name: '', image: '', image_small: '', level: '', condition: '' },
        is_followed: false,
        top_photo: '',
        live_room: { roomStatus: 0, liveStatus: 0, url: '', title: '', cover: '', roomid: 0, broadcast_type: 0, online: 0 },
        birthday: '',
        school: null,
        profession: '',
        tags: [],
        is_senior_member: 0,
        elec: { ctime: 0, total: 0, show: 0, list: [] },
        contract: null,
        name_render: null,
      },
    };

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/x/space/myinfo')) {
        return new Response(JSON.stringify(mockMyInfo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/x/space/wbi/acc/info')) {
        return new Response(JSON.stringify(mockUserInfo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    const client = new BiliClient<HasToken>(undefined, mockFetch as unknown as typeof fetch);
    const user = await client.getCurrentUser();

    expect(user.mid).toBe(666888);
    expect(user.name).toBe('当前用户');
  });
});
