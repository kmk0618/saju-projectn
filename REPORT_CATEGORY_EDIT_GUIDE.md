# 리포트 카테고리 편집 가이드

카테고리별 목차/분량/레이아웃은 `lib/report-categories.ts`에서 수정합니다.

## 상품별 구조
- `life`: 종합 인생 리포트 — 기존 `lib/report-spec.ts`의 50 SECTION을 그대로 사용
- `child`: 자녀 사주 리포트 — 30 SECTION
- `couple`: 커플·부부 궁합 — 30 SECTION
- `parent_child`: 부모·자녀 궁합 — 30 SECTION
- `new_year`: 신년 운세 — 24 SECTION

## 수정 가능한 항목
각 SECTION의 배열은 다음 순서입니다.

`[번호, 챕터번호, 제목, 작성목적, 사용가능근거, 깊이, 레이아웃]`

깊이: `normal | deep | critical`

레이아웃: `prose | prose_callout | table | comparison | timeline | checklist | strategy | qa | mixed`

카테고리 제목/부제/버전/편집방향은 파일 하단의 `REPORT_CATEGORY_CONFIGS`에서 수정합니다.

## 중요
종합 인생 리포트는 기존 50 SECTION을 그대로 유지합니다.
PDF 디자인은 모든 카테고리가 `lib/report-pdf.ts`의 AQUA 렌더러를 공통 사용합니다.
커플·부부 궁합과 부모·자녀 궁합은 실제 생성 전에 두 번째 사람의 프로필/출생정보를 주문 데이터에 연결해야 완전한 2인 분석이 가능합니다.
