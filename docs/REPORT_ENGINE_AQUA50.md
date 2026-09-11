# 종합사주 리포트 엔진 - AQUA 50 시스템

## 목적
기존 132개 짧은 카드형 구조를 폐기하고, 3 CHAPTER / 50 SECTION의 장문 개인맞춤 리포트로 생성한다.

## 핵심 원칙
- 사주 계산은 `lib/saju-engine.ts`의 deterministic engine만 수행한다.
- LLM은 계산하지 않고 해석만 한다.
- 주문당 `Person Narrative`를 한 번 생성한 뒤 50개 SECTION이 이를 공유한다.
- 각 SECTION에는 `report-spec.ts`에 정의된 필요한 계산 subset만 전달한다.
- SECTION은 일반 1,200~1,900자, deep 1,900~3,000자, critical 2,600~4,200자를 목표로 한다.
- 생성 결과는 중복/일반론/근거 부재/저밀도를 검사하고 실패 SECTION만 한 번 재작성한다.
- PDF는 SECTION마다 강제 페이지 나눔을 하지 않는다. CHAPTER 표지만 독립 페이지다.

## 주요 파일
- `lib/report-spec.ts`: 50 SECTION 설계도
- `lib/report-prompts.ts`: Narrative/SECTION/재작성 프롬프트
- `lib/report-quality.ts`: 중복·품질 검사
- `app/api/report/generate/route.ts`: 18 SECTION wave, 최대 6 worker 병렬 생성
- `lib/report-pdf.ts`: AQUA형 PDF HTML 렌더러
- `app/api/report/pdf/route.ts`: PDF 생성·Storage 저장·열람

## 진행률
실제 `report_sections` DB 개수 기준으로 0/50 ~ 50/50을 표시한다.

## 레거시 리포트
`prompt_version`이 `life-report-aqua-50-v1`이 아니면 기존 SECTION/PDF를 무효화하고 새 엔진으로 재생성한다.
