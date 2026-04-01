/**
 * Telegram Bot API 클라이언트
 * - 카드뉴스 이미지 전송
 * - 승인/거절 콜백 처리
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * 텍스트 메시지 전송
 */
export async function sendMessage(text, options = {}) {
  const body = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    ...options,
  };

  const res = await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage 실패: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * 사진 전송 (로컬 파일)
 */
export async function sendPhoto(filePath, caption = '') {
  const form = new FormData();
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'image/png' });

  form.append('chat_id', CHAT_ID);
  form.append('photo', blob, basename(filePath));
  if (caption) form.append('caption', caption);
  form.append('parse_mode', 'HTML');

  const res = await fetch(`${API_BASE}/sendPhoto`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendPhoto 실패: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * 미디어 그룹 전송 (여러 사진을 앨범으로)
 */
export async function sendMediaGroup(filePaths, caption = '') {
  const form = new FormData();
  form.append('chat_id', CHAT_ID);

  const media = filePaths.map((fp, i) => {
    const fileBuffer = readFileSync(fp);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const attachName = `photo${i}`;
    form.append(attachName, blob, basename(fp));
    return {
      type: 'photo',
      media: `attach://${attachName}`,
      ...(i === 0 && caption ? { caption, parse_mode: 'HTML' } : {}),
    };
  });

  form.append('media', JSON.stringify(media));

  const res = await fetch(`${API_BASE}/sendMediaGroup`, {
    method: 'POST',
    body: form,
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMediaGroup 실패: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * 인라인 키보드가 있는 메시지 전송 (승인/거절 버튼)
 */
export async function sendWithButtons(text, buttons) {
  return sendMessage(text, {
    reply_markup: {
      inline_keyboard: [buttons.map(b => ({
        text: b.text,
        callback_data: b.data,
      }))],
    },
  });
}

/**
 * 최신 업데이트 가져오기 (폴링)
 */
export async function getUpdates(offset = 0, timeout = 30) {
  const res = await fetch(
    `${API_BASE}/getUpdates?offset=${offset}&timeout=${timeout}&allowed_updates=["callback_query","message"]`
  );
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram getUpdates 실패: ${JSON.stringify(data)}`);
  return data.result;
}

/**
 * 콜백 쿼리 응답
 */
export async function answerCallbackQuery(callbackQueryId, text = '') {
  const res = await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
  return res.json();
}
