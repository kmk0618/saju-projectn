# 자녀사주 중간 해석층 v4

## 목적
자녀사주가 `만세력 계산값 -> 바로 본문`으로 생성되지 않도록 하고, 실제 생활 장면과 부모 행동까지 내려가는 중간 해석층을 강제한다.

## 생성 순서
1. `calcSaju()` — deterministic 만세력 계산. 기존 엔진 유지.
2. `child-meaning-map.ts` — 십성/신강약/용신을 아동 발달 의미로 내부 변환.
3. `child-narrative.ts` — 아이 전체 서사 1회 생성.
4. `child-section-planner.ts` — SECTION별 `사주 근거 -> 아이 마음 -> 겉행동 -> 생활장면 -> 부모 오해 -> 부모 행동 -> 말 스크립트 -> 강점 리프레이밍` 설계.
5. `child-section-generator.ts` — 설계안을 고객용 완성 본문으로 작성.
6. `child-quality.ts` — 깊이/메타문구/생활장면/부모행동/스크립트/리프레이밍 검사. 실패 시 자동 재작성.
7. PDF 직전 전체 50SECTION 재검사. 하나라도 실패하면 PDF 완료 처리 금지.

## SECTION 20 차단 규칙
`관계 종류 / 사주 구조 / 참고 방법 / 구조 확인` 같은 검산표는 실패 처리한다.
관계 데이터는 `아이에게 보이는 반응 / 실제 생활 장면 / 부모 대응`까지 해석되어야 통과한다.

## 고객 본문 금지
- 지침/번역 규칙/프롬프트/스키마
- calc/subset/JSON/필드명/내부 데이터
- 만세력 엔진/엔진값/제공된 계산값
- "이 섹션에서는" 같은 작성자 시점
- 아이 낙인/또래 비교/진단성 표현

## 버전
`child-report-aqua-50-v4-midlayer`

## 사전 점검
```powershell
npm run check:child
npx tsc --noEmit
npm run build
```
