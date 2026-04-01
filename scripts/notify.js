#!/usr/bin/env node

/**
 * 카드뉴스 텔레그램 알림 스크립트
 *
 * 사용법:
 *   node scripts/notify.js <작업디렉토리>
 *
 * 렌더링된 카드 이미지를 텔레그램으로 전송합니다.
 * 05_images/ 디렉토리의 PNG 파일들을 앨범으로 보내고,
 * 02_copy.md의 캡션/해시태그를 함께 전송합니다.
 */

import 'dotenv/config';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { sendMessage, sendMediaGroup } from './lib/telegram-client.js';

const workDir = process.argv[2];
if (!workDir) {
  console.error('사용법: node scripts/notify.js <작업디렉토리>');
  process.exit(1);
}

const absDir = resolve(workDir);
const imagesDir = join(absDir, '05_images');
const copyFile = join(absDir, '02_copy.md');

if (!existsSync(imagesDir)) {
  console.error(`❌ 이미지 디렉토리 없음: ${imagesDir}`);
  console.error('   먼저 node scripts/render.js 로 렌더링하세요.');
  process.exit(1);
}

// 이미지 파일 수집
const images = readdirSync(imagesDir)
  .filter(f => f.endsWith('.png'))
  .sort()
  .map(f => join(imagesDir, f));

if (images.length === 0) {
  console.error('❌ PNG 파일이 없습니다.');
  process.exit(1);
}

// 캡션 추출
let caption = '';
if (existsSync(copyFile)) {
  const copy = readFileSync(copyFile, 'utf-8');
  const captionMatch = copy.match(/## 게시글 캡션\s*\n([\s\S]*?)(?=\n## |$)/);
  if (captionMatch) {
    caption = captionMatch[1].trim().slice(0, 1024); // Telegram 캡션 제한
  }
}

const dirName = workDir.split('/').pop();

console.log(`📱 텔레그램 전송 시작 (${images.length}장)`);

try {
  // 텔레그램은 미디어 그룹 최대 10장
  // 카드뉴스는 보통 6~8장이므로 한 번에 전송
  const albumCaption = `📋 <b>${dirName}</b>\n카드 ${images.length}장 검토 요청`;

  await sendMediaGroup(images, albumCaption);
  console.log(`  ✅ 이미지 ${images.length}장 전송 완료`);

  // 캡션과 해시태그 별도 전송
  if (caption) {
    await sendMessage(`📝 <b>게시글 캡션:</b>\n\n${caption}`);
    console.log('  ✅ 캡션 전송 완료');
  }

  // 안내 메시지
  await sendMessage(
    `✅ 검토 완료 후 게시하려면 Claude Code에서:\n<code>node scripts/pipeline.js ${workDir} --publish-only</code>`
  );

  console.log('\n✅ 텔레그램 알림 완료!');
} catch (err) {
  console.error('❌ 텔레그램 전송 실패:', err.message);
  process.exit(1);
}
