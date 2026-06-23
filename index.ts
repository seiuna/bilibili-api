export * from './src/index.js';

import { BiliClient, BiliApiError } from './src/client.js';
import { CommentArea } from './src/api/comment-area.js';

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

const dynArea = new CommentArea(client, 398870552, 11);
const img = await client.upload.image('image.png');

for await (const { comments } of dynArea.list()) {
  const first = comments[0];
  if (!first) break;
  console.log(`#${first.rpid} [${first.member.uname}]: ${first.content.message.slice(0, 50)}`);
  const replyResult = await first.reply('meow');
  console.log('回复结果:', replyResult);
  break;
}

console.log('完成');
