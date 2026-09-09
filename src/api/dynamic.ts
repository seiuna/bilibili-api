import type { BiliClient } from '../core/client.js';
import type { BiliApiResponse } from '../core/types.js';
import { UploadAPI } from './upload.js';

export interface DynamicDetail {
  item: {
    basic: {
      comment_id_str: string;
      comment_type: number;
      rid_str: string;
      title?: string;
      uid: number;
    };
    id_str: string;
    modules: unknown[];
    type: string;
    visible: boolean;
  };
}

export interface DynamicFeedItem {
  basic: {
    comment_id_str: string;
    comment_type: number;
    jump_url?: string;
    rid_str: string;
  };
  id_str: string;
  modules: {
    module_author: unknown;
    module_dynamic: unknown;
    module_interaction?: unknown;
  };
}

export interface DynamicSpaceData {
  has_more: boolean;
  items: DynamicFeedItem[];
  offset?: string;
}

export interface VoteOptionItem {
  desc: string;
  imgUrl?: string;
}

export interface CreateVoteOptions {
  /** 投票标题 */
  title: string;
  /** 投票详细描述 */
  desc?: string;
  /** 投票类型: 0 为文字投票 (默认), 1 为图片投票 */
  type?: 0 | 1;
  /** 最多可选几项，默认为 1 */
  choiceCount?: number;
  /** 持续时间（秒），默认 7 天 (604800 秒) */
  duration?: number;
  /** 选项列表，最少 2 项 */
  options: (string | VoteOptionItem)[];
}

export interface CreateVoteResult {
  vote_id: number;
  _gt_: number;
}

export interface DynamicPicture {
  img_src: string;
  img_width?: number;
  img_height?: number;
  img_size?: number;
}

export interface DynamicAtUser {
  mid: number | string;
  name?: string;
}

export interface DynamicRichTextNode {
  raw_text: string;
  type?: number;
  biz_id?: string;
}

export interface CreateDynamicOptions {
  /** 动态文本内容 */
  content?: string;
  /** 自定义富文本节点列表 (若提供则优先/结合使用) */
  contents?: DynamicRichTextNode[];
  /** 需要 @ 的用户列表 (支持 mid 或 { mid, name }) */
  at?: (DynamicAtUser | number | string)[];
  /**
   * 图片列表：
   * - 本地文件路径 (如 './pic.jpg')
   * - Buffer 或 Uint8Array 二进制图片数据 (自动上传至 BFS)
   * - 已上传的 DynamicPicture 对象
   * - 网络图片 URL (支持外部链接自动下载转存，或直接引用 hdslb 链接)
   */
  images?: (string | Buffer | Uint8Array | DynamicPicture)[];
  /**
   * 关联投票：
   * - 可直接传入已创建的 vote_id (number | string)
   * - 也可直接传入 CreateVoteOptions 配置，发动态前会自动创建投票并关联
   */
  vote?: number | string | CreateVoteOptions;
  /** 是否关闭评论区 */
  closeComment?: boolean;
  /** 是否开启精选评论 */
  upChooseComment?: boolean;
}

export interface CreateDynamicResult {
  result: number;
  message?: string;
  dyn_id: number;
  dyn_id_str: string;
  dyn_type: number;
  dyn_rid?: number;
}

function buildDynamicContents(
  content = '',
  contentsInput?: DynamicRichTextNode[],
  atUsers?: (DynamicAtUser | number | string)[],
  voteNode?: DynamicRichTextNode,
): DynamicRichTextNode[] {
  const result: DynamicRichTextNode[] = [];

  if (contentsInput && contentsInput.length > 0) {
    result.push(...contentsInput);
  } else if (content) {
    const normalizedAts: { mid: string; name: string; tag: string }[] = [];
    if (atUsers && atUsers.length > 0) {
      for (const item of atUsers) {
        if (typeof item === 'object' && item !== null) {
          const mid = String(item.mid);
          const name = item.name ?? mid;
          normalizedAts.push({ mid, name, tag: `@${name}` });
        } else {
          const mid = String(item);
          normalizedAts.push({ mid, name: mid, tag: `@${mid}` });
        }
      }
    }

    let hasInlineAt = false;
    for (const at of normalizedAts) {
      if (content.includes(at.tag)) {
        hasInlineAt = true;
        break;
      }
    }

    if (!hasInlineAt) {
      result.push({ raw_text: content, type: 1, biz_id: '' });
      for (const at of normalizedAts) {
        result.push({ raw_text: `${at.tag} `, type: 2, biz_id: at.mid });
      }
    } else {
      const usedMids = new Set<string>();
      let cursor = 0;
      while (cursor < content.length) {
        let nearestIdx = -1;
        let matchedAt: (typeof normalizedAts)[0] | null = null;

        for (const at of normalizedAts) {
          const idx = content.indexOf(at.tag, cursor);
          if (idx !== -1 && (nearestIdx === -1 || idx < nearestIdx)) {
            nearestIdx = idx;
            matchedAt = at;
          }
        }

        if (nearestIdx === -1 || !matchedAt) {
          const tail = content.slice(cursor);
          if (tail) {
            result.push({ raw_text: tail, type: 1, biz_id: '' });
          }
          break;
        }

        if (nearestIdx > cursor) {
          result.push({ raw_text: content.slice(cursor, nearestIdx), type: 1, biz_id: '' });
        }

        result.push({ raw_text: `${matchedAt.tag} `, type: 2, biz_id: matchedAt.mid });
        usedMids.add(matchedAt.mid);

        cursor = nearestIdx + matchedAt.tag.length;
        if (content[cursor] === ' ') {
          cursor += 1;
        }
      }

      for (const at of normalizedAts) {
        if (!usedMids.has(at.mid)) {
          result.push({ raw_text: `${at.tag} `, type: 2, biz_id: at.mid });
        }
      }
    }
  } else if (atUsers && atUsers.length > 0) {
    for (const item of atUsers) {
      const mid = typeof item === 'object' ? String(item.mid) : String(item);
      const name = typeof item === 'object' && item.name ? item.name : mid;
      result.push({ raw_text: `@${name} `, type: 2, biz_id: mid });
    }
  }

  if (voteNode) {
    result.push(voteNode);
  }

  if (result.length === 0) {
    result.push({ raw_text: '', type: 1, biz_id: '' });
  }

  return result;
}

export class DynamicAPI {
  /** 获取动态详情*/
  static async getDetail(client: BiliClient<any>, id: string): Promise<BiliApiResponse<DynamicDetail>> {
    const features = 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote';
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${id}&features=${features}`,
    );
  }

  /** 获取用户空间动态（单页） */
  static async getSpace(
    client: BiliClient<any>,
    hostMid: number,
    offset?: string,
  ): Promise<BiliApiResponse<DynamicSpaceData>> {
    const params = new URLSearchParams({ host_mid: String(hostMid) });
    if (offset) params.set('offset', offset);
    return client.request(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${params}`,
    );
  }

  /** 获取用户空间动态列表 — async generator 翻页 */
  static async *space(
    client: BiliClient<any>,
    hostMid: number,
  ): AsyncGenerator<DynamicFeedItem> {
    let offset: string | undefined;
    while (true) {
      const res = await this.getSpace(client, hostMid, offset);
      if (res.code !== 0 || !res.data?.items?.length) break;

      for (const item of res.data.items) yield item;

      if (!res.data.has_more || !res.data.offset) break;
      offset = res.data.offset;
    }
  }

  /** 点赞动�?*/
  static async like(
    client: BiliClient<any>,
    dynIdStr: string,
    up: 0 | 1 | 2 = 1,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/dyn/thumb?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_id_str: dynIdStr, up }),
    });
  }

  /** 删除动�?*/
  static async delete(
    client: BiliClient<any>,
    dynamicId: string | number,
  ): Promise<BiliApiResponse<unknown>> {
    const idStr = String(dynamicId).trim();
    const csrf = client.config.getCsrf();
    return client.request('https://api.vc.bilibili.com/dynamic_svr/v1/dynamic_svr/rm_dynamic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        dynamic_id: idStr,
        csrf_token: csrf,
        csrf,
      }).toString(),
    });
  }

  /**
   * 发起/创建投票
   */
  static async createVote(
    client: BiliClient<any>,
    options: CreateVoteOptions,
  ): Promise<BiliApiResponse<CreateVoteResult>> {
    if (!options.options || options.options.length < 2) {
      throw new Error('投票选项至少需要 2 项');
    }

    const csrf = client.config.getCsrf();
    const mid = Number(client.config.data.mid || client.config.extractUserId() || 0);

    const voteInfo = {
      title: options.title,
      desc: options.desc ?? '',
      type: options.type ?? 0,
      choice_cnt: options.choiceCount ?? 1,
      duration: options.duration ?? 604800, // 默认 7 天
      options: options.options.map((opt) => {
        if (typeof opt === 'string') {
          return { opt_desc: opt };
        }
        return {
          opt_desc: opt.desc,
          img_url: opt.imgUrl,
        };
      }),
      only_fans_level: 0,
      vote_publisher: mid,
      release_scene: 'dynamic',
    };

    return client.request(`https://api.bilibili.com/x/vote/create?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote_info: voteInfo }),
    });
  }

  /**
   * 发布动态（支持富文本、图片上传、@ 用户以及发起投票）
   */
  static async create(
    client: BiliClient<any>,
    contentOrOptions: string | CreateDynamicOptions,
  ): Promise<BiliApiResponse<CreateDynamicResult>> {
    const options: CreateDynamicOptions =
      typeof contentOrOptions === 'string'
        ? { content: contentOrOptions }
        : contentOrOptions;

    // 1. 处理投票 (若为配置项则先调用接口创建投票)
    let voteNode: DynamicRichTextNode | undefined;
    if (options.vote !== undefined && options.vote !== null) {
      if (typeof options.vote === 'object') {
        const voteRes = await DynamicAPI.createVote(client, options.vote);
        if (voteRes.code !== 0) {
          return {
            code: voteRes.code,
            message: `创建投票失败: ${voteRes.message}`,
            ttl: 1,
            data: null as any,
          };
        }
        voteNode = {
          raw_text: options.vote.title,
          type: 4,
          biz_id: String(voteRes.data.vote_id),
        };
      } else {
        voteNode = {
          raw_text: '投票',
          type: 4,
          biz_id: String(options.vote),
        };
      }
    }

    // 2. 处理图片列表 (支持 URL、本地文件、Buffer 以及已上传图片)
    const pics: DynamicPicture[] = [];
    if (options.images && options.images.length > 0) {
      if (options.images.length > 9) {
        throw new Error('动态最多支持携带 9 张图片');
      }

      for (const img of options.images) {
        if (typeof img === 'object' && img !== null && 'img_src' in img) {
          pics.push({
            img_src: img.img_src,
            img_width: img.img_width ?? 1000,
            img_height: img.img_height ?? 1000,
            img_size: img.img_size ?? 100,
          });
        } else if (typeof img === 'string') {
          if (img.startsWith('http://') || img.startsWith('https://')) {
            if (img.includes('hdslb.com/bfs/')) {
              pics.push({
                img_src: img,
                img_width: 1000,
                img_height: 1000,
                img_size: 100,
              });
            } else {
              const uploadRes = await UploadAPI.uploadFromUrl(client, img);
              if (uploadRes.code !== 0) {
                return {
                  code: uploadRes.code,
                  message: `上传图片失败: ${uploadRes.message}`,
                  ttl: 1,
                  data: null as any,
                };
              }
              pics.push({
                img_src: uploadRes.data.image_url,
                img_width: uploadRes.data.image_width,
                img_height: uploadRes.data.image_height,
                img_size: uploadRes.data.img_size,
              });
            }
          } else {
            const uploadRes = await UploadAPI.image(client, img);
            if (uploadRes.code !== 0) {
              return {
                code: uploadRes.code,
                message: `上传本地图片失败: ${uploadRes.message}`,
                ttl: 1,
                data: null as any,
              };
            }
            pics.push({
              img_src: uploadRes.data.image_url,
              img_width: uploadRes.data.image_width,
              img_height: uploadRes.data.image_height,
              img_size: uploadRes.data.img_size,
            });
          }
        } else if (Buffer.isBuffer(img) || img instanceof Uint8Array) {
          const buffer = Buffer.isBuffer(img) ? img : Buffer.from(img);
          const uploadRes = await UploadAPI.uploadBuffer(client, buffer, 'dynamic.png');
          if (uploadRes.code !== 0) {
            return {
              code: uploadRes.code,
              message: `上传图片 Buffer 失败: ${uploadRes.message}`,
              ttl: 1,
              data: null as any,
            };
          }
          pics.push({
            img_src: uploadRes.data.image_url,
            img_width: uploadRes.data.image_width,
            img_height: uploadRes.data.image_height,
            img_size: uploadRes.data.img_size,
          });
        }
      }
    }

    // 3. 构建 contents
    const contents = buildDynamicContents(
      options.content,
      options.contents,
      options.at,
      voteNode,
    );

    // 4. 生成 upload_id
    const mid = client.config.data.mid || client.config.extractUserId() || '0';
    const timestamp = Math.floor(Date.now() / 1000);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const uploadId = `${mid}_${timestamp}_${rand}`;

    const csrf = client.config.getCsrf();
    const dynReq: Record<string, any> = {
      content: {
        contents,
      },
      scene: pics.length > 0 ? 2 : 1,
      meta: {
        app_meta: {
          from: 'create.dynamic.web',
          mobi_app: 'web',
        },
      },
      upload_id: uploadId,
    };

    if (pics.length > 0) {
      dynReq.pics = pics;
    }

    if (options.closeComment || options.upChooseComment) {
      dynReq.option = {
        close_comment: options.closeComment ? 1 : 0,
        up_choose_comment: options.upChooseComment ? 1 : 0,
      };
    }

    return client.request(`https://api.bilibili.com/x/dynamic/feed/create/dyn?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_req: dynReq }),
    });
  }

  /** 设置置顶动�?*/
  static async setTop(
    client: BiliClient<any>,
    dynStr: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/space/set_top?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_str: dynStr }),
    });
  }

  /** 取消置顶动�?*/
  static async removeTop(
    client: BiliClient<any>,
    dynStr: string,
  ): Promise<BiliApiResponse<unknown>> {
    const csrf = client.config.getCsrf();
    return client.request(`https://api.bilibili.com/x/dynamic/feed/space/rm_top?csrf=${csrf}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dyn_str: dynStr }),
    });
  }
}
