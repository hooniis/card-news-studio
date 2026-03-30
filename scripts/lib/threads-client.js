import { basename } from 'node:path';

const THREADS_API = 'https://graph.threads.net/v1.0';
const GRAPH_API = 'https://graph.facebook.com/v22.0';

/**
 * 재시도 로직이 포함된 fetch 래퍼
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    const err = await res.json();
    if (i === maxRetries - 1) {
      throw new Error(`Threads API 호출 실패: ${JSON.stringify(err.error)}`);
    }
    const delay = Math.pow(2, i) * 1000;
    console.log(`  재시도 ${i + 1}/${maxRetries} (${delay}ms 후)...`);
    await new Promise(r => setTimeout(r, delay));
  }
}

/**
 * 컨테이너 상태가 FINISHED가 될 때까지 폴링
 */
async function waitForContainer(containerId, accessToken, maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(
      `${THREADS_API}/${containerId}?fields=status,error_message&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.status === 'FINISHED') return;
    if (data.status === 'ERROR') {
      throw new Error(`컨테이너 처리 실패: ${data.error_message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('컨테이너 처리 시간 초과');
}

/**
 * Threads 캐러셀 포스트를 게시한다.
 * @param {string[]} imageUrls - 공개 이미지 URL 배열 (Facebook에 업로드된)
 * @param {string} text - 게시글 텍스트
 * @param {Object} config - API 설정
 * @param {string} config.threadsAccessToken - Threads 액세스 토큰
 * @param {string} config.threadsUserId - Threads 사용자 ID
 * @returns {Promise<{id: string, permalink: string}>}
 */
export async function postThreadsCarousel(imageUrls, text, config) {
  const { threadsAccessToken, threadsUserId } = config;

  if (imageUrls.length > 20) {
    throw new Error(`Threads 캐러셀은 최대 20장입니다. (현재: ${imageUrls.length}장)`);
  }

  // Step 1: 개별 이미지 컨테이너 생성
  console.log('\n📦 Threads 컨테이너 생성 중...');
  const containerIds = [];
  for (const imageUrl of imageUrls) {
    const params = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: threadsAccessToken,
    });
    const data = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    containerIds.push(data.id);
    console.log(`  컨테이너 생성: ${data.id}`);
    // 컨테이너 처리 대기
    await waitForContainer(data.id, threadsAccessToken);
  }

  // Step 2: 캐러셀 컨테이너 생성
  console.log('\n🎠 Threads 캐러셀 생성 중...');
  const carouselParams = new URLSearchParams({
    media_type: 'CAROUSEL',
    text,
    children: containerIds.join(','),
    access_token: threadsAccessToken,
  });

  const carousel = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: carouselParams.toString(),
  });
  console.log(`  캐러셀 ID: ${carousel.id}`);

  // 캐러셀 컨테이너 처리 대기
  await waitForContainer(carousel.id, threadsAccessToken);

  // Step 3: 게시
  console.log('\n🚀 Threads 게시 중...');
  const publishParams = new URLSearchParams({
    creation_id: carousel.id,
    access_token: threadsAccessToken,
  });
  const published = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: publishParams.toString(),
  });

  // permalink 조회
  const mediaRes = await fetch(
    `${THREADS_API}/${published.id}?fields=permalink&access_token=${threadsAccessToken}`
  );
  const mediaData = await mediaRes.json();

  return {
    id: published.id,
    permalink: mediaData.permalink || `https://www.threads.net/@/post/${published.id}`,
  };
}

/**
 * Threads 스레드 체인을 게시한다. (각 카드가 답글로 연결되는 방식)
 * @param {string[]} imageUrls - 공개 이미지 URL 배열
 * @param {string} text - 첫 번째 게시글 텍스트 (캡션)
 * @param {Object} config - API 설정
 * @param {string} config.threadsAccessToken - Threads 액세스 토큰
 * @param {string} config.threadsUserId - Threads 사용자 ID
 * @returns {Promise<{id: string, permalink: string, threadIds: string[]}>}
 */
export async function postThreadsChain(imageUrls, text, config) {
  const { threadsAccessToken, threadsUserId } = config;

  const threadIds = [];

  // Step 1: 첫 번째 카드 (캡션 포함)
  console.log('\n🧵 스레드 체인 생성 중...');
  console.log(`  [1/${imageUrls.length}] 첫 번째 게시물 생성...`);

  const firstParams = new URLSearchParams({
    media_type: 'IMAGE',
    image_url: imageUrls[0],
    text,
    access_token: threadsAccessToken,
  });

  const firstContainer = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: firstParams.toString(),
  });
  await waitForContainer(firstContainer.id, threadsAccessToken);

  const firstPublished = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: firstContainer.id,
      access_token: threadsAccessToken,
    }).toString(),
  });
  threadIds.push(firstPublished.id);
  console.log(`  ✅ 게시 완료: ${firstPublished.id}`);

  // Step 2: 나머지 카드를 reply_to_id로 연결
  let previousId = firstPublished.id;
  for (let i = 1; i < imageUrls.length; i++) {
    console.log(`  [${i + 1}/${imageUrls.length}] 답글 생성...`);

    const replyParams = new URLSearchParams({
      media_type: 'IMAGE',
      image_url: imageUrls[i],
      reply_to_id: previousId,
      access_token: threadsAccessToken,
    });

    const replyContainer = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: replyParams.toString(),
    });
    await waitForContainer(replyContainer.id, threadsAccessToken);

    const replyPublished = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: replyContainer.id,
        access_token: threadsAccessToken,
      }).toString(),
    });
    threadIds.push(replyPublished.id);
    previousId = replyPublished.id;
    console.log(`  ✅ 답글 게시 완료: ${replyPublished.id}`);

    // 스팸 방지 딜레이 (3초)
    if (i < imageUrls.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Step 3: 해시태그 댓글 (옵션)
  if (config.hashtags) {
    console.log(`  [댓글] 해시태그 게시...`);
    const hashtagParams = new URLSearchParams({
      media_type: 'TEXT',
      text: config.hashtags,
      reply_to_id: threadIds[0],
      access_token: threadsAccessToken,
    });

    const hashtagContainer = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: hashtagParams.toString(),
    });
    await waitForContainer(hashtagContainer.id, threadsAccessToken);

    const hashtagPublished = await fetchWithRetry(`${THREADS_API}/${threadsUserId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        creation_id: hashtagContainer.id,
        access_token: threadsAccessToken,
      }).toString(),
    });
    console.log(`  ✅ 해시태그 댓글 완료: ${hashtagPublished.id}`);
  }

  // permalink 조회 (첫 번째 게시물)
  const mediaRes = await fetch(
    `${THREADS_API}/${threadIds[0]}?fields=permalink&access_token=${threadsAccessToken}`
  );
  const mediaData = await mediaRes.json();

  return {
    id: threadIds[0],
    permalink: mediaData.permalink || `https://www.threads.net/@/post/${threadIds[0]}`,
    threadIds,
  };
}

/**
 * Facebook 페이지에 이미지를 업로드하고 공개 URL 배열을 반환한다.
 * (Instagram 클라이언트의 uploadImageToMeta와 동일한 로직)
 */
export async function uploadImagesToMeta(imagePaths, fbPageToken, fbPageId) {
  const { readFile } = await import('node:fs/promises');
  const imageUrls = [];

  for (const imgPath of imagePaths) {
    const imageBuffer = await readFile(imgPath);
    const formData = new FormData();
    formData.append('source', new Blob([imageBuffer], { type: 'image/png' }), basename(imgPath));
    formData.append('published', 'false');
    formData.append('access_token', fbPageToken);

    const res = await fetch(`${GRAPH_API}/${fbPageId}/photos`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(`이미지 업로드 실패 (${basename(imgPath)}): ${JSON.stringify(err.error)}`);
    }

    const { id: photoId } = await res.json();
    const urlRes = await fetch(`${GRAPH_API}/${photoId}?fields=images&access_token=${fbPageToken}`);
    const urlData = await urlRes.json();
    imageUrls.push(urlData.images[0].source);
    console.log(`  업로드: ${basename(imgPath)}`);
  }

  return imageUrls;
}
