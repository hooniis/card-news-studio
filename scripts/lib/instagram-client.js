import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const GRAPH_API = 'https://graph.facebook.com/v22.0';
const IG_API = 'https://graph.facebook.com/v22.0';

/**
 * Facebook 페이지에 이미지를 비공개 업로드하고 공개 URL을 반환한다.
 * @param {string} localPath - 로컬 PNG 파일 경로
 * @param {string} pageToken - Facebook 페이지 액세스 토큰
 * @param {string} pageId - Facebook 페이지 ID
 * @returns {Promise<string>} 공개 이미지 URL
 */
async function uploadImageToMeta(localPath, pageToken, pageId) {
  const imageBuffer = await readFile(localPath);
  const formData = new FormData();
  formData.append('source', new Blob([imageBuffer], { type: 'image/png' }), basename(localPath));
  formData.append('published', 'false');
  formData.append('access_token', pageToken);

  const res = await fetch(`${GRAPH_API}/${pageId}/photos`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`이미지 업로드 실패 (${basename(localPath)}): ${JSON.stringify(err.error)}`);
  }

  const { id: photoId } = await res.json();

  // 업로드된 사진의 공개 URL 조회
  const urlRes = await fetch(`${GRAPH_API}/${photoId}?fields=images&access_token=${pageToken}`);
  const urlData = await urlRes.json();
  return urlData.images[0].source;
}

/**
 * 재시도 로직이 포함된 fetch 래퍼
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    const err = await res.json();
    if (i === maxRetries - 1) {
      throw new Error(`API 호출 실패: ${JSON.stringify(err.error)}`);
    }
    const delay = Math.pow(2, i) * 1000;
    console.log(`  재시도 ${i + 1}/${maxRetries} (${delay}ms 후)...`);
    await new Promise(r => setTimeout(r, delay));
  }
}

/**
 * Instagram 캐러셀 포스트를 게시한다.
 * @param {string[]} imagePaths - 로컬 PNG 파일 경로 배열
 * @param {string} caption - 캡션 (해시태그 포함)
 * @param {Object} config - API 설정
 * @param {string} config.igAccessToken - Instagram 액세스 토큰
 * @param {string} config.igAccountId - Instagram 비즈니스 계정 ID
 * @param {string} config.fbPageToken - Facebook 페이지 토큰
 * @param {string} config.fbPageId - Facebook 페이지 ID
 * @returns {Promise<{id: string, permalink: string}>}
 */
export async function postCarousel(imagePaths, caption, config) {
  const { igAccessToken, igAccountId, fbPageToken, fbPageId } = config;

  if (imagePaths.length > 10) {
    throw new Error(`Instagram 캐러셀은 최대 10장입니다. (현재: ${imagePaths.length}장)`);
  }

  // Step 0: 이미지를 Meta에 업로드하여 공개 URL 획득
  console.log('\n📤 이미지 업로드 중...');
  const imageUrls = [];
  for (const imgPath of imagePaths) {
    console.log(`  업로드: ${basename(imgPath)}`);
    const url = await uploadImageToMeta(imgPath, fbPageToken, fbPageId);
    imageUrls.push(url);
  }

  // Step 1: 개별 이미지 컨테이너 생성
  console.log('\n📦 Instagram 컨테이너 생성 중...');
  const containerIds = [];
  for (const imageUrl of imageUrls) {
    const params = new URLSearchParams({
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: igAccessToken,
    });
    const data = await fetchWithRetry(`${IG_API}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    containerIds.push(data.id);
    console.log(`  컨테이너 생성: ${data.id}`);
  }

  // Step 2: 캐러셀 컨테이너 생성
  console.log('\n🎠 캐러셀 생성 중...');
  const carouselParams = new URLSearchParams({
    media_type: 'CAROUSEL',
    caption,
    children: containerIds.join(','),
    access_token: igAccessToken,
  });

  const carousel = await fetchWithRetry(`${IG_API}/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: carouselParams.toString(),
  });
  console.log(`  캐러셀 ID: ${carousel.id}`);

  // Step 3: 게시
  console.log('\n🚀 게시 중...');
  const publishParams = new URLSearchParams({
    creation_id: carousel.id,
    access_token: igAccessToken,
  });
  const published = await fetchWithRetry(`${IG_API}/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams.toString(),
  });

  // 게시물 permalink 조회
  const mediaRes = await fetch(`${IG_API}/${published.id}?fields=permalink&access_token=${igAccessToken}`);
  const mediaData = await mediaRes.json();

  return {
    id: published.id,
    permalink: mediaData.permalink || `https://www.instagram.com/p/${published.id}`,
  };
}
