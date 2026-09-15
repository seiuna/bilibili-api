import type { BiliClient } from '../core/client.js';

export abstract class BaseEntity<T> {
  constructor(
    protected client: BiliClient<any>,
    public readonly rawData: T,
  ) {}
}