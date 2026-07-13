import { BiliClient } from '../src/client.js';

const client = await BiliClient.create();

const loginResult = await client.ensureLogin({
  onStatusChange: (status, msg, _, qrcodeTerminal) => {
    console.log(`[${status}] ${msg}`);
    if (qrcodeTerminal) console.log(qrcodeTerminal);
  },
});

if (!loginResult.success) {
  console.error('登录失败:', loginResult.message);
  process.exit(1);
}

const interval = setInterval(async () => {
  const count = await client.notify.unreadCount();
  if (count.data.at) {
    let atCount = count.data.at;
    for await (const atItem of client.notify.atFeed()) {
      if (atCount-- <= 0) break;
      atItem.id();
      console.log(`#${atItem.sourceId()} [${atItem.businessId()}]: ${atItem.content()}`);
      await atItem.commentArea().add(atItem.content(), atItem.sourceId(), atItem.sourceId());
    }
    console.log('未读消息数:', count.data.at);
  }
}, 10000);

console.log('完成');
