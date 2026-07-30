import { BiliClient } from '../src/core/client.js';
import { MessageAPI } from '../src/api/message.js';
import { AtNotifyItem } from '../src/entities/NotifyItem.js';

const client = await BiliClient.create();

const authedClient = await client.ensureLogin({
  onStatusChange: (status, msg, _qrcodeBase64, qrcodeTerminal) => {
    console.log(`[${status}] ${msg}`);
    if (qrcodeTerminal) console.log(qrcodeTerminal);
  },
});

const interval = setInterval(async () => {
  const count = await MessageAPI.unreadCount(authedClient);
  if (count.data.at) {
    let atCount = count.data.at;
    for await (const rawItem of MessageAPI.atFeed(authedClient)) {
      if (atCount-- <= 0) break;
      const atItem = new AtNotifyItem(authedClient, rawItem);
      console.log(`#${atItem.sourceId} [${atItem.businessId}]: ${atItem.content}`);
      await atItem.reply(atItem.content);
    }
    console.log('未读消息数:', count.data.at);
  }
}, 10000);

console.log('完成');
