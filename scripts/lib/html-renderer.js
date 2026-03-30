import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * HTML 카드 파일을 PNG로 렌더링한다.
 * @param {import('puppeteer').Browser} browser - Puppeteer 브라우저 인스턴스
 * @param {string} htmlPath - HTML 파일 절대 경로
 * @param {string} outputPath - 출력 PNG 파일 경로
 * @returns {Promise<string>} 출력 파일 경로
 */
export async function renderCard(browser, htmlPath, outputPath) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 1280, height: 1280, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.waitForFunction(() => document.fonts.ready, { timeout: 10_000 });

    const card = await page.$('.card');
    if (!card) {
      throw new Error(`.card 요소를 찾을 수 없습니다: ${htmlPath}`);
    }
    await card.screenshot({ path: outputPath, type: 'png' });
    return outputPath;
  } finally {
    await page.close();
  }
}

/**
 * 디렉토리의 모든 카드 HTML을 PNG로 렌더링한다.
 * @param {string[]} htmlFiles - HTML 파일 경로 배열 (정렬된 상태)
 * @param {string} outputDir - 출력 디렉토리
 * @returns {Promise<string[]>} 생성된 PNG 파일 경로 배열
 */
export async function renderAllCards(htmlFiles, outputDir) {
  await mkdir(outputDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 120_000,
    protocolTimeout: 120_000,
  });

  try {
    const results = [];
    for (const htmlPath of htmlFiles) {
      const filename = htmlPath.split('/').pop().replace('.html', '.png');
      const outputPath = resolve(outputDir, filename);
      console.log(`  렌더링: ${htmlPath.split('/').pop()} → ${filename}`);
      await renderCard(browser, htmlPath, outputPath);
      results.push(outputPath);
    }
    return results;
  } finally {
    await browser.close();
  }
}
