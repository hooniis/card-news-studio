#!/usr/bin/env node
import 'dotenv/config';
import { glob } from 'glob';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { renderAllCards } from './lib/html-renderer.js';
import { parseCopyFile } from './lib/copy-parser.js';
import { postCarousel } from './lib/instagram-client.js';
import { postThreadsCarousel, uploadImagesToMeta } from './lib/threads-client.js';

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const workDir = args.find(a => !a.startsWith('--'));

if (!workDir) {
  console.error('사용법: node scripts/pipeline.js <작업디렉토리> [옵션]');
  console.error('  옵션:');
  console.error('    --dry-run       렌더링만 수행, 게시 건너뛰기');
  console.error('    --render-only   렌더링만 수행');
  console.error('    --publish-only  기존 이미지로 게시만 수행
    --threads       Threads에도 동시 게시');
  console.error('');
  console.error('  예시: node scripts/pipeline.js _workspace/2026-03-30_건보료연말정산');
  process.exit(1);
}

const dryRun = flags.includes('--dry-run');
const renderOnly = flags.includes('--render-only');
const publishOnly = flags.includes('--publish-only');
const includeThreads = flags.includes('--threads');

const designDir = resolve(workDir, '03_design');
const imagesDir = resolve(workDir, '05_images');
const copyPath = resolve(workDir, '02_copy.md');

// 유효성 검증
if (!existsSync(copyPath)) {
  console.error(`카피 파일을 찾을 수 없습니다: ${copyPath}`);
  process.exit(1);
}

console.log('═'.repeat(50));
console.log('  카드뉴스 파이프라인');
console.log('═'.repeat(50));
console.log(`  작업 디렉토리: ${workDir}`);
console.log(`  모드: ${dryRun ? 'Dry Run (렌더링만)' : renderOnly ? '렌더링만' : publishOnly ? '게시만' : '풀 파이프라인'}`);

let pngFiles;

// Step 1: 렌더링
if (!publishOnly) {
  const htmlFiles = (await glob(`${designDir}/card-*.html`)).sort();
  if (htmlFiles.length === 0) {
    console.error(`HTML 파일을 찾을 수 없습니다: ${designDir}/card-*.html`);
    process.exit(1);
  }

  console.log(`\n[1/2] 🎨 렌더링 (${htmlFiles.length}장)`);
  pngFiles = await renderAllCards(htmlFiles, imagesDir);
  console.log(`  ✅ ${pngFiles.length}장 렌더링 완료`);
} else {
  pngFiles = (await glob(`${imagesDir}/card-*.png`)).sort();
  if (pngFiles.length === 0) {
    console.error(`PNG 파일을 찾을 수 없습니다. 먼저 렌더링을 실행하세요.`);
    process.exit(1);
  }
  console.log(`\n[1/2] 🎨 렌더링 건너뛰기 (기존 이미지 ${pngFiles.length}장 사용)`);
}

// Step 2: 게시
if (!dryRun && !renderOnly) {
  const requiredEnvVars = [
    'INSTAGRAM_ACCESS_TOKEN',
    'INSTAGRAM_ACCOUNT_ID',
    'FACEBOOK_PAGE_ID',
    'FACEBOOK_PAGE_TOKEN',
  ];
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`\n.env에 다음 값이 필요합니다: ${missing.join(', ')}`);
    process.exit(1);
  }

  const { fullCaption } = await parseCopyFile(copyPath);
  console.log('\n[2/2] 📱 Instagram 게시');
  console.log('  📝 캡션:');
  fullCaption.split('\n').slice(0, 3).forEach(l => console.log(`    ${l}`));
  console.log('    ...');

  const result = await postCarousel(pngFiles, fullCaption, {
    igAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    igAccountId: process.env.INSTAGRAM_ACCOUNT_ID,
    fbPageToken: process.env.FACEBOOK_PAGE_TOKEN,
    fbPageId: process.env.FACEBOOK_PAGE_ID,
  });

  await writeFile(resolve(workDir, '06_publish-result.json'), JSON.stringify({
    publishedAt: new Date().toISOString(),
    mediaId: result.id,
    permalink: result.permalink,
    cardCount: pngFiles.length,
  }, null, 2));

  console.log(`\n  ✅ Instagram 게시 완료: ${result.permalink}`);

  // Threads 게시
  if (includeThreads) {
    const threadsMissing = ['THREADS_ACCESS_TOKEN', 'THREADS_USER_ID'].filter(v => !process.env[v]);
    if (threadsMissing.length > 0) {
      console.error(`\n  ⚠️ Threads 게시 건너뛰기 (.env에 ${threadsMissing.join(', ')} 필요)`);
    } else {
      console.log('\n🧵 Threads 게시');
      // Instagram 게시 시 이미 업로드된 이미지 URL을 재활용할 수 없으므로 재업로드
      const imageUrls = await uploadImagesToMeta(
        pngFiles,
        process.env.FACEBOOK_PAGE_TOKEN,
        process.env.FACEBOOK_PAGE_ID
      );
      const threadsResult = await postThreadsCarousel(imageUrls, fullCaption, {
        threadsAccessToken: process.env.THREADS_ACCESS_TOKEN,
        threadsUserId: process.env.THREADS_USER_ID,
      });

      await writeFile(resolve(workDir, '07_threads-result.json'), JSON.stringify({
        publishedAt: new Date().toISOString(),
        platform: 'threads',
        mediaId: threadsResult.id,
        permalink: threadsResult.permalink,
        cardCount: pngFiles.length,
      }, null, 2));

      console.log(`\n  ✅ Threads 게시 완료: ${threadsResult.permalink}`);
    }
  }
} else {
  console.log(`\n[2/2] 📱 게시 건너뛰기 (${dryRun ? 'dry-run' : 'render-only'} 모드)`);
}

console.log('\n' + '═'.repeat(50));
console.log('  파이프라인 완료');
console.log('═'.repeat(50));
