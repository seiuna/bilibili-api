import { BiliClient } from "..";

export abstract class BaseEntity<T> {
  constructor(
    protected client: BiliClient<any>,
    public readonly rawData: T,
  ) {}
}