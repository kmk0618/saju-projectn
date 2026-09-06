# 나의사주 Next.js v1

현재 승인된 HTML 디자인과 만세력 계산 엔진을 그대로 보존하면서,
Vercel + Supabase + 결제 + AI 리포트로 확장하기 위한 운영용 Next.js 뼈대입니다.

## 왜 첫 단계는 iframe 방식인가?
기존 `index.html` 안에 이미 큰 만세력 계산 엔진과 화면 동작이 들어 있습니다.
한 번에 React로 전부 다시 쓰면 계산 로직이나 UI가 달라질 위험이 있어,
1차 배포에서는 `public/saju.html`을 그대로 유지해 현재 동작을 보존했습니다.

그 다음 단계에서 아래 기능부터 Next.js 네이티브 화면으로 교체합니다.
1. 회원가입 / 로그인
2. 출생정보 저장
3. 무료 질문 저장
4. 결제
5. 결제 검증
6. AI 리포트 생성
7. MY REPORT
8. PDF 저장

## VS Code에서 실행
1. 이 폴더를 VS Code로 엽니다.
2. 터미널에서:
   npm install
   npm run dev
3. 브라우저:
   http://localhost:3000

## Supabase 연결
`.env.example`을 복사해서 `.env.local`을 만든 뒤:

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

중요:
OpenAI API Key, Supabase Service Role Key, PG Secret Key는
절대 브라우저 코드나 public 폴더에 넣지 않습니다.

## Vercel 배포
GitHub에 이 폴더를 올리고 Vercel에서 Import Project를 누르면 됩니다.
환경변수는 Vercel > Project Settings > Environment Variables에 입력합니다.

## 현재 상태
- Next.js 운영 프로젝트 구조: 완료
- 현재 사이트 디자인/계산 엔진 보존: 완료
- Vercel 배포 가능 구조: 완료
- Supabase 클라이언트 준비: 완료
- 로그인/회원가입: 다음 단계
- 결제: 다음 단계
- AI 리포트 자동생성: 다음 단계
