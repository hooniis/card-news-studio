#!/usr/bin/env node
import 'dotenv/config';
import { glob } from 'glob';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseCopyFile } from './lib/copy-parser.js';
import { postThreadsCarousel, uploadImagesToMeta } from './lib/threads-client.js';

const workDir = process.argv[2];
if (!workDir) {
  console.error('사용법: node scripts/publish-threads.js <작업디렉토리>');
  console.error('  예시: node scripts/publish-threads.js _workspace/2026-03-30_스타벅스KBO콜라보');
  process.exit(1);
}

const requiredEnvVars = [
  'THREADS_ACCESS_TOKEN',
  'THREADS_USER_ID',
  'FACEBOOK_PAGE_ID',
  'FACEBOOK_PAGE_TOKEN',
];
const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`.env에 다음 값이 필요합니다: ${missing.join(', ')}`);
  console.error('.env.example을 참고하여 .env 파일을 생성하세요.');
  process.exit(1);
}

const imagesDir = resolve(workDir, '05_images');
const copyPath = resolve(workDir, '02_copy.md');

const pngFiles = (await glob(`${imagesDir}/card-*.png`)).sort();
if (pngFiles.length === 0) {
  console.error(`PNG 파일을 찾을 수 없습니다: ${imagesDir}/card-*.png`);
  console.error('먼저 npm run render를 실행하세요.');
  process.exit(1);
}

console.log(`\n🧵 Threads 게시 준비 (${pngFiles.length}장)`);

const { fullCaption } = await parseCopyFile(copyPath);
console.log('\n📝 캡션 미리보기:');
console.log('─'.repeat(40));
console.log(fullCaption);
console.log('─'.repeat(40));

// Step 1: Facebook 페이지에 이미지 업로드 (공개 URL 획득)
console.log('\n📤 이미지 업로드 중...');
const imageUrls = await uploadImagesToMeta(
  pngFiles,
  process.env.FACEBOOK_PAGE_TOKEN,
  process.env.FACEBOOK_PAGE_ID
);

// Step 2: Threads 캐러셀 게시
const result = await postThreadsCarousel(imageUrls, fullCaption, {
  threadsAccessToken: process.env.THREADS_ACCESS_TOKEN,
  threadsUserId: process.env.THREADS_USER_ID,
});

console.log(`\n✅ Threads 게시 완료!`);
console.log(`  게시물 ID: ${result.id}`);
console.log(`  URL: ${result.permalink}`);

// 결과 저장
const resultPath = resolve(workDir, '07_threads-result.json');
await writeFile(resultPath, JSON.stringify({
  publishedAt: new Date().toISOString(),
  platform: 'threads',
  mediaId: result.id,
  permalink: result.permalink,
  cardCount: pngFiles.length,
}, null, 2));
console.log(`  결과 저장: ${resultPath}`);
