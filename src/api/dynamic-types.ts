// 动态详情 API 的极简类型（仅暴露常用字段）

export interface DynamicDetail {
  card: {
    desc: {
      dynamic_id: number;
      type: number;
      uid: number;
      timestamp: number;
      orig_dy_id?: number;
      orig_type?: number;
      [key: string]: unknown;
    };
    item?: Record<string, unknown>;
    [key: string]: unknown;
  };
}
