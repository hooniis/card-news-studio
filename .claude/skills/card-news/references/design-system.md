# 카드뉴스 디자인 시스템

card-designer 에이전트가 참조하는 디자인 원칙과 CSS 패턴.

## 목차
1. [레이아웃 원칙](#1-레이아웃-원칙)
2. [타이포그래피](#2-타이포그래피)
3. [컬러 시스템](#3-컬러-시스템)
4. [카드 유형별 레이아웃](#4-카드-유형별-레이아웃)
5. [시각 요소](#5-시각-요소)
6. [CSS 베이스 템플릿](#6-css-베이스-템플릿)

---

## 1. 레이아웃 원칙

- **안전 영역(Safe Area)**: 상하좌우 80px 이상 여백. SNS 앱이 UI 요소(좋아요, 댓글 등)를 오버레이하는 영역을 피한다
- **정렬**: 좌측 정렬 기본. 커버 카드는 중앙 정렬도 가능
- **여백 계층**: 섹션 간 40px, 요소 간 20px, 텍스트 행간 1.6
- **그리드**: 콘텐츠 영역을 상단(제목) / 중앙(본문) / 하단(페이지 표시) 3분할

## 2. 타이포그래피

| 요소 | 크기 | 굵기 | 행간 |
|------|------|------|------|
| 커버 제목 | 72~84px | 800 (ExtraBold) | 1.2 |
| 본문 제목 | 52~60px | 700 (Bold) | 1.3 |
| 본문 텍스트 | 36~40px | 400 (Regular) | 1.6 |
| 강조 텍스트 | 36~40px | 700 (Bold) | 1.6 |
| 보조 텍스트 | 28~32px | 400 (Regular) | 1.5 |
| 페이지 표시 | 24px | 500 (Medium) | 1.0 |
| CTA 버튼 | 38px | 700 (Bold) | 1.0 |

**폰트 스택:**
```css
font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Google Fonts CDN 사용:
```html
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
```

## 3. 컬러 시스템

### 기본 팔레트 (주제별로 변경 가능)

```css
:root {
  /* 프로페셔널/비즈니스 */
  --primary: #2563EB;
  --primary-light: #DBEAFE;
  --accent: #F59E0B;
  --bg-light: #F8FAFC;
  --bg-dark: #1E293B;
  --text-dark: #1E293B;
  --text-light: #FFFFFF;
  --text-muted: #64748B;
}
```

### 주제별 추천 팔레트

| 주제 | Primary | Accent | 분위기 |
|------|---------|--------|--------|
| 비즈니스/IT | `#2563EB` | `#F59E0B` | 신뢰, 전문성 |
| 건강/웰빙 | `#059669` | `#F472B6` | 자연, 활력 |
| 교육/학습 | `#7C3AED` | `#34D399` | 창의, 성장 |
| 라이프스타일 | `#EC4899` | `#8B5CF6` | 감성, 트렌디 |
| 금융/경제 | `#0F766E` | `#EAB308` | 안정, 신뢰 |

### 명도 대비 규칙
- 밝은 배경 위 텍스트: `#1E293B` 이상 어두운 색
- 어두운 배경 위 텍스트: `#FFFFFF` 또는 `#F1F5F9`
- 최소 대비비 4.5:1 (WCAG AA 기준)

## 4. 카드 유형별 레이아웃

### 커버 카드
- 배경: 그래디언트, 단색, 또는 **이미지 배경** (어두운 배경 + 밝은 텍스트 권장)
- 제목: 중앙 배치, 72~84px
- 서브 제목: 제목 아래, 28~32px
- 장식: 주제를 암시하는 이모지 또는 기하학적 요소

#### 커버 이미지 배경 옵션
소스 이미지가 제공된 경우, 커버 카드에 이미지 배경을 사용할 수 있다:
- 이미지를 `background-image`로 전체 커버에 채우고 `object-fit: cover` 처리
- 반드시 어두운 그래디언트 오버레이를 씌워 텍스트 가독성 확보
- 오버레이: `linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)`
- 텍스트는 하단 정렬하여 오버레이가 짙은 영역 위에 배치
- 이미지가 없으면 기존 그래디언트 배경 사용

```css
/* 커버 이미지 배경 */
.card.cover-image {
  background-image: url('이미지경로');
  background-size: cover;
  background-position: center;
}
.card.cover-image .overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.75) 100%);
}
.card.cover-image .card-content {
  justify-content: flex-end;
  z-index: 1;
}
```

### 본문 카드
- 배경: 밝은 단색 (`--bg-light`)
- 제목: 상단 좌측, 40~48px
- 본문: 제목 아래, 28~32px, 최대 3줄
- 강조: primary 컬러로 핵심 구문 하이라이트
- 번호/아이콘: 좌측 또는 상단에 배치

### CTA 카드
- 배경: primary 컬러 또는 그래디언트
- 제목: 행동 유도 문구, 40~48px
- 버튼: 중앙, 둥근 모서리(border-radius: 12px), 대비 컬러
- 부가 정보: 버튼 아래 작은 텍스트

## 5. 시각 요소

### 이모지 활용
- 각 카드의 주제를 나타내는 이모지를 제목 옆이나 상단에 배치
- 이모지 크기: 48~64px
- 남용 금지 — 카드당 1~2개

### 구분선
```css
.divider {
  width: 60px;
  height: 4px;
  background: var(--primary);
  border-radius: 2px;
  margin: 20px 0;
}
```

### 번호 표시 (리스트형 카드)
```css
.number {
  font-size: 64px;
  font-weight: 800;
  color: var(--primary);
  opacity: 0.15;
  position: absolute;
  top: 60px;
  right: 80px;
}
```

### 페이지 인디케이터
```css
.page-indicator {
  position: absolute;
  bottom: 40px;
  right: 80px;
  font-size: 20px;
  color: var(--text-muted);
  font-weight: 500;
}
```

## 6. CSS 베이스 템플릿

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: #e2e8f0;
}

.card {
  width: 1080px;
  height: 1080px;
  position: relative;
  overflow: hidden;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
}

.card-content {
  position: absolute;
  top: 80px;
  left: 80px;
  right: 80px;
  bottom: 80px;
  display: flex;
  flex-direction: column;
}

.card-header {
  /* 상단 영역: 제목 */
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  /* 중앙 영역: 본문 */
}

.card-footer {
  /* 하단 영역: 페이지 표시 */
}
```

이 템플릿을 기반으로 카드 유형에 따라 스타일을 확장한다. CSS 변수를 사용하여 테마 변경이 용이하게 한다.
