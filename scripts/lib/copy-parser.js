import { readFile } from 'node:fs/promises';

/**
 * 02_copy.md에서 해시태그와 게시글 캡션을 추출한다.
 * @param {string} filePath - 02_copy.md 파일 경로
 * @returns {Promise<{hashtags: string, caption: string, fullCaption: string}>}
 */
export async function parseCopyFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  let hashtags = '';
  let caption = '';
  let currentSection = null;

  for (const line of lines) {
    if (line.startsWith('## 해시태그')) {
      currentSection = 'hashtags';
      continue;
    }
    if (line.startsWith('## 게시글 캡션')) {
      currentSection = 'caption';
      continue;
    }
    if (line.startsWith('## ') && currentSection) {
      currentSection = null;
      continue;
    }

    if (currentSection === 'hashtags' && line.trim()) {
      hashtags += (hashtags ? ' ' : '') + line.trim();
    }
    if (currentSection === 'caption') {
      caption += line + '\n';
    }
  }

  caption = caption.trimEnd();

  return {
    hashtags: hashtags.trim(),
    caption,
    fullCaption: caption,
  };
}
