#!/usr/bin/env node
import { glob } from 'glob';
import { resolve } from 'node:path';
import { renderAllCards } from './lib/html-renderer.js';

const workDir = process.argv[2];
if (!workDir) {
  console.error('사용법: node scripts/render.js <작업디렉토리>');
  console.error('  예시: node scripts/render.js _workspace/2026-03-30_건보료연말정산');
  process.exit(1);
}

const designDir = resolve(workDir, '03_design');
const outputDir = resolve(workDir, '05_images');

const htmlFiles = (await glob(`${designDir}/card-*.html`)).sort();
if (htmlFiles.length === 0) {
  console.error(`HTML 파일을 찾을 수 없습니다: ${designDir}/card-*.html`);
  process.exit(1);
}

console.log(`\n🎨 카드뉴스 렌더링 시작 (${htmlFiles.length}장)`);
console.log(`  입력: ${designDir}`);
console.log(`  출력: ${outputDir}\n`);

const pngFiles = await renderAllCards(htmlFiles, outputDir);

console.log(`\n✅ 렌더링 완료! ${pngFiles.length}장의 PNG 파일 생성`);
pngFiles.forEach(f => console.log(`  ${f}`));
