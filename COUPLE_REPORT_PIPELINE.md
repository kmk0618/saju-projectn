# COUPLE REPORT PIPELINE v3

## 목적
50 SECTION을 유지하면서 각 SECTION이 서로 다른 결론과 생활 장면을 전담하도록 하고, 최종 PDF를 100~120페이지 수준의 정보 밀도로 확장한다.

## 흐름
1. A/B 각각 calcSaju()
2. Couple Cross Facts
3. Person Relationship Meaning
4. Couple Narrative
5. Couple Concept Registry
6. Section Planner
7. Section Generator
8. Per-section Quality Gate
9. 50-section Semantic Duplicate Audit
10. 중복 SECTION만 자동 삭제/재생성 (최대 3회)
11. PDF Final Audit
12. PDF 생성

## 중복 방지 핵심
- lib/couple/couple-concept-registry.ts: 50 SECTION 전담 개념/장면/금지 재설명 정의
- lib/couple/couple-quality.ts: 본문/문장/생활장면/대화문/복구행동 의미 중복 검사
- app/api/report/generate/route.ts: 최종 감사 실패 SECTION 자동 재생성
- app/api/report/pdf/route.ts: 중복이 남아 있으면 PDF 생성 차단

## 분량
- S01: 900~1,500자
- normal: 1,700~2,600자
- deep: 2,400~3,600자
- critical: 3,200~4,800자
- S15/S35/S50: 2,600~3,900자
- 50 SECTION 최소 목표 총량: 약 145,500자

## 버전
couple-compatibility-aqua-50-v3-unique-depth
