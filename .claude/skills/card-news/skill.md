---
name: card-news
description: "SNS 카드뉴스를 기획·작성·디자인·검증하는 풀 파이프라인 오케스트레이터. 주제나 소스 콘텐츠를 입력하면 HTML/CSS 기반 카드뉴스를 제작한다. '카드뉴스', '카드 뉴스', 'card news', 'SNS 콘텐츠 제작', '인스타그램 카드', '카드형 콘텐츠', '슬라이드 콘텐츠' 등을 언급하면 반드시 이 스킬을 사용할 것."
---

# Card News Orchestrator

@요즘뭔일 계정의 카드뉴스를 제작하는 에이전트 팀 오케스트레이터.

**브랜드:** @요즘뭔일 (2030 직장인 대상, 생활정보/종합 뉴스 큐레이션)
**브랜드 가이드:** `references/brand-guide.md` — 모든 에이전트가 작업 시작 전 필수 참조

## 실행 모드: 에이전트 팀

카피라이터와 디자이너가 텍스트 분량을 실시간 조율하고, 품질 검증자가 수정 피드백을 직접 전달해야 하므로 에이전트 팀 모드를 사용한다.

## 에이전트 구성

| 팀원 | 에이전트 타입 | 역할 | 출력 |
|------|-------------|------|------|
| strategist | content-strategist | 소스 분석, 카드 구조 기획 | `{작업디렉토리}/01_strategy.md` |
| copywriter | card-copywriter | 카드별 카피 작성 | `{작업디렉토리}/02_copy.md` |
| designer | card-designer | HTML/CSS 카드 비주얼 제작 | `{작업디렉토리}/03_design/*.html` |
| reviewer | quality-reviewer | 전체 품질 검증 | `{작업디렉토리}/04_review.md` |

## 워크플로우

### Phase 1: 준비
1. 사용자 입력 분석 — 주제/소스 콘텐츠, 대상 플랫폼, 톤앤매너 파악
2. 대상 플랫폼이 미지정이면 Instagram(정사각형 1080x1080)을 기본값으로 사용
3. 작업 디렉토리 생성 — `_workspace/{YYYY-MM-DD}_{주제}/` 형식으로 날짜별·주제별 디렉토리를 생성한다
   - 날짜: 작업 당일 날짜 (예: `2026-03-30`)
   - 주제: 핵심 키워드를 간결한 한글로 (예: `AI업무활용`, `연봉협상팁`)
   - 예시: `_workspace/2026-03-30_AI업무활용/`
4. 소스 콘텐츠를 `_workspace/{YYYY-MM-DD}_{주제}/00_input.md`에 저장
5. **이미지 처리** — 사용자가 이미지를 제공한 경우:
   - 이미지를 작업 디렉토리에 저장
   - 사용자에게 **"이미지 배경을 제거(누끼)해서 넣을까요?"** 라고 확인
   - 누끼 요청 시: `rembg` 라이브러리로 배경 제거 후 `{원본명}-cutout.png`로 저장
     ```python
     python3 -c "
     from rembg import remove
     from PIL import Image
     import io
     with open('원본.png', 'rb') as f:
         output = remove(f.read(), alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10, alpha_matting_erode_size=10)
     img = Image.open(io.BytesIO(output))
     bbox = img.getbbox()
     if bbox: img = img.crop(bbox)
     img.save('원본-cutout.png')
     "
     ```
   - designer에게 이미지 경로와 누끼 여부를 전달

### Phase 2: 팀 구성

1. 팀 생성:
   ```
   TeamCreate(
     team_name: "card-news-team",
     members: [
       {
         name: "strategist",
         agent_type: "content-strategist",
         model: "opus",
         prompt: "카드뉴스 콘텐츠 전략을 수립하라. {작업디렉토리}/00_input.md를 읽고 분석한 뒤 {작업디렉토리}/01_strategy.md에 카드 구조와 핵심 메시지를 작성하라. 완료되면 copywriter와 designer에게 SendMessage로 알려라. 스킬 디렉토리의 references/platform-specs.md를 참고하여 플랫폼 사양을 반영하라. (작업디렉토리는 리더가 prompt에 실제 경로로 치환하여 전달한다)"
       },
       {
         name: "copywriter",
         agent_type: "card-copywriter",
         model: "opus",
         prompt: "카드뉴스 카피를 작성하라. strategist가 알림을 보내면 {작업디렉토리}/01_strategy.md를 읽고 {작업디렉토리}/02_copy.md에 카드별 카피를 작성하라. 완료되면 designer에게 SendMessage로 알려라. designer가 텍스트 수정 요청을 보내면 조정하라. (작업디렉토리는 리더가 prompt에 실제 경로로 치환하여 전달한다)"
       },
       {
         name: "designer",
         agent_type: "card-designer",
         model: "opus",
         prompt: "카드뉴스 비주얼을 HTML/CSS로 제작하라. copywriter가 알림을 보내면 {작업디렉토리}/01_strategy.md와 {작업디렉토리}/02_copy.md를 읽고 {작업디렉토리}/03_design/ 디렉토리에 카드별 HTML 파일을 생성하라. 스킬 디렉토리의 references/design-system.md를 읽고 디자인 원칙을 따르라. 완료되면 reviewer에게 SendMessage로 알려라. (작업디렉토리는 리더가 prompt에 실제 경로로 치환하여 전달한다)"
       },
       {
         name: "reviewer",
         agent_type: "quality-reviewer",
         model: "opus",
         prompt: "카드뉴스 품질을 검증하라. designer가 알림을 보내면 {작업디렉토리}/의 전략·카피·디자인 산출물을 모두 읽고 교차 검증하라. 검증 결과를 {작업디렉토리}/04_review.md에 작성하라. FIX가 필요한 항목이 있으면 copywriter나 designer에게 SendMessage로 구체적 수정 지시를 보내라. 모든 카드가 PASS이면 리더에게 완료 보고하라. (작업디렉토리는 리더가 prompt에 실제 경로로 치환하여 전달한다)"
       }
     ]
   )
   ```

2. 작업 등록:
   ```
   TaskCreate(tasks: [
     { title: "콘텐츠 전략 수립", description: "소스 분석, 카드 구조 설계, 핵심 메시지 추출", assignee: "strategist" },
     { title: "카드별 카피 작성", description: "전략 기반 카드별 텍스트 작성", assignee: "copywriter", depends_on: ["콘텐츠 전략 수립"] },
     { title: "카드 비주얼 디자인", description: "HTML/CSS 카드 제작", assignee: "designer", depends_on: ["카드별 카피 작성"] },
     { title: "품질 검증", description: "카피-디자인 정합성, 일관성, 플랫폼 적합성 검증", assignee: "reviewer", depends_on: ["카드 비주얼 디자인"] }
   ])
   ```

### Phase 3: 제작

**실행 방식:** 파이프라인 + 실시간 피드백

팀원들은 의존성 순서대로 작업을 수행하되, 필요 시 SendMessage로 실시간 조율한다.

**통신 흐름:**
```
strategist ──완료 알림──→ copywriter, designer
copywriter ──완료 알림──→ designer
designer ──텍스트 수정 요청──→ copywriter (필요 시)
designer ──완료 알림──→ reviewer
reviewer ──수정 지시──→ copywriter, designer (필요 시)
```

**산출물 저장:**

| 팀원 | 출력 경로 |
|------|----------|
| strategist | `{작업디렉토리}/01_strategy.md` |
| copywriter | `{작업디렉토리}/02_copy.md` |
| designer | `{작업디렉토리}/03_design/card-01.html` ~ `card-NN.html` |
| reviewer | `{작업디렉토리}/04_review.md` |

**리더 모니터링:**
- TaskGet으로 전체 진행률 확인
- 팀원이 유휴 상태가 되면 자동 알림 수신
- reviewer의 최종 판정 결과를 확인

### Phase 4: 수정 루프 (조건부)

reviewer가 FIX/REDO 판정을 내린 경우:
1. reviewer가 해당 팀원에게 SendMessage로 수정 지시
2. copywriter/designer가 수정 작업 수행
3. reviewer가 수정된 산출물을 재검증
4. 최대 2회 반복. 2회 후에도 PASS가 아닌 항목은 조건부 PASS 처리

### Phase 5: 최종 산출물 정리

1. 모든 카드가 PASS 판정을 받으면:
   - `{작업디렉토리}/03_design/` 디렉토리의 HTML 파일들이 최종 산출물
   - `{작업디렉토리}/02_copy.md`의 해시태그/캡션이 게시용 텍스트
2. 리더가 결과를 사용자에게 요약 보고:
   - 총 카드 수
   - HTML 파일 목록
   - 해시태그
   - 게시글 캡션
   - 검증 결과 요약

### Phase 5.5: 이미지 변환 및 게시 (선택)

사용자가 "게시", "인스타", "업로드", "publish" 등을 언급한 경우에만 실행한다.

1. HTML → PNG 렌더링:
   ```bash
   node scripts/render.js {작업디렉토리}
   ```
   - 산출물: `{작업디렉토리}/05_images/card-01.png` ~ `card-NN.png`
   - 렌더링 결과를 사용자에게 보여주고 확인 받기

2. Instagram 게시 (사용자 확인 후):
   ```bash
   node scripts/publish.js {작업디렉토리}
   ```
   - `.env`에 토큰이 설정되어 있어야 함
   - 게시 전 캡션+해시태그를 사용자에게 미리보기로 보여주기
   - 사용자가 "게시해줘"를 명시적으로 승인한 후 실행
   - 산출물: `{작업디렉토리}/06_publish-result.json`

3. 통합 실행 (렌더링+게시 원스톱):
   ```bash
   node scripts/pipeline.js {작업디렉토리}            # 풀 파이프라인
   node scripts/pipeline.js {작업디렉토리} --dry-run   # 렌더링만 (미리보기)
   ```

### Phase 6: 정리

1. 팀원들에게 종료 요청 (SendMessage)
2. `{작업디렉토리}/` 보존 (사후 검증·감사 추적용)
3. 사용자에게 최종 산출물 경로 안내

## 데이터 흐름

```
[사용자 입력]
     ↓
[리더] → _workspace/{YYYY-MM-DD}_{주제}/ 디렉토리 생성
     ↓
[strategist] → {작업디렉토리}/01_strategy.md
     ↓ (SendMessage)
[copywriter] → {작업디렉토리}/02_copy.md
     ↓ (SendMessage)          ↑ (텍스트 수정 요청)
[designer]   → {작업디렉토리}/03_design/*.html
     ↓ (SendMessage)          ↑ (수정 지시)
[reviewer]   → {작업디렉토리}/04_review.md
     ↓
[리더: 최종 보고]
```

> **참고:** `{작업디렉토리}`는 `_workspace/{YYYY-MM-DD}_{주제}`의 약칭이다. 리더가 Phase 1에서 실제 경로를 결정하고, 각 에이전트의 prompt에 실제 경로로 치환하여 전달한다.

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| 팀원 1명 실패/중지 | 리더가 감지 → SendMessage로 상태 확인 → 재시작 시도 |
| strategist 실패 | 전체 파이프라인 중단, 사용자에게 소스 콘텐츠 확인 요청 |
| copywriter/designer 실패 | 1회 재시작 후 재실패 시 리더가 해당 작업을 직접 수행 |
| reviewer 2회 FIX 후 미해결 | 해당 항목 조건부 PASS, 보고서에 미해결 이슈 명시 |
| 팀원 간 데이터 충돌 | 출처 명시 후 병기, 삭제하지 않음 |

## 테스트 시나리오

### 정상 흐름
1. 사용자가 "AI 업무 활용법 5가지를 카드뉴스로 만들어줘"를 입력
2. Phase 1에서 주제 분석 → `_workspace/2026-03-30_AI업무활용/` 디렉토리 생성
3. Phase 2에서 팀 구성 (4명 팀원, 4개 작업, 각 에이전트에 작업디렉토리 경로 전달)
4. Phase 3에서 순차 제작: 전략(7장 구성) → 카피 → HTML 디자인 → 검증
5. Phase 4에서 reviewer가 전체 PASS 판정
6. Phase 5에서 최종 산출물 보고 (7개 HTML 파일 + 해시태그 + 캡션)

### 에러 흐름
1. Phase 3에서 designer가 "카드 3 본문이 4줄이라 레이아웃 초과"를 copywriter에게 SendMessage
2. copywriter가 카드 3 본문을 3줄로 축약하여 02_copy.md 업데이트
3. designer가 수정된 카피로 카드 3 HTML 재생성
4. reviewer가 검증 후 전체 PASS 판정
5. 최종 산출물 정상 생성
