import { BiliClient } from '../index.js';
import type { BiliApiResponse } from '../core/types.js';

export interface SearchResult {
  result_type: string;
  data: Record<string, unknown>[];
}

export interface SearchAllData {
  seid: string;
  page: number;
  page_size: number;
  numResults: number;
  numPages: number;
  pageinfo: Record<string, { numResults: number; total: number; pages: number }>;
  top_tlist: Record<string, number>;
  show_module_list: string[];
  result: SearchResult[];
}

export interface HotSearchItem {
  keyword: string;
  show_name: string;
  icon: string;
  uri: string;
  goto: string;
}

export interface HotSearchData {
  title: string;
  trackid: string;
  list: HotSearchItem[];
}

export interface DefaultSearchData {
  seid: string;
  id: number;
  type: number;
  show_name: string;
  name: string;
  goto_type: number;
  goto_value: string;
  url: string;
}

export interface SuggestItem {
  value: string;
  term: string;
  name: string;
  type: string;
}

export class SearchAPI {
  /** 综合搜索 */
  static async searchAll(
    client: BiliClient<any>,
    keyword: string,
  ): Promise<BiliApiResponse<SearchAllData>> {
    return client.request(
      `https://api.bilibili.com/x/web-interface/wbi/search/all/v2?keyword=${encodeURIComponent(keyword)}`,
      { wbi: true },
    );
  }

  /** 获取默认搜索内容 */
  static async getDefaultSearch(client: BiliClient<any>): Promise<BiliApiResponse<DefaultSearchData>> {
    return client.request('https://api.bilibili.com/x/web-interface/wbi/search/default', { wbi: true });
  }

  /** 获取热搜列表 */
  static async getHotSearch(
    client: BiliClient<any>,
    limit = 50,
  ): Promise<BiliApiResponse<HotSearchData>> {
    return client.request(
      `https://api.bilibili.com/x/web-interface/wbi/search/square?limit=${limit}`,
      { wbi: true },
    );
  }

  /** 获取搜索建议 */
  static async getSuggest(
    client: BiliClient<any>,
    term: string,
  ): Promise<{ code: number; result: { tag: SuggestItem[] } }> {
    return client.request(
      `https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(term)}&main_ver=v1&func=suggest&suggest_type=accurate&sub_type=tag`,
    );
  }
}
