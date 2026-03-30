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

  // 캡션 본문에서 해시태그 줄 분리
  const captionLines = caption.split('\n');
  const hashtagLines = [];
  const bodyLines = [];
  for (const line of captionLines) {
    if (line.trim().startsWith('#') && line.includes(' #')) {
      hashtagLines.push(line.trim());
    } else {
      bodyLines.push(line);
    }
  }

  const captionBody = bodyLines.join('\n').trimEnd();
  const captionHashtags = hashtagLines.join(' ').trim() || hashtags;

  return {
    hashtags: captionHashtags || hashtags.trim(),
    caption: captionBody,
    fullCaption: caption,
  };
}
