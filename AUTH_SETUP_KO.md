# 나의사주 간편 로그인 설정

## 1. .env.local
프로젝트 루트에 `.env.local` 파일을 만들고 `.env.local.example` 내용을 그대로 복사합니다.

## 2. Supabase URL Configuration
Supabase Dashboard → Authentication → URL Configuration

- Site URL: `http://localhost:3000`
- Redirect URLs에 추가: `http://localhost:3000/auth/callback`

실제 도메인 연결 후에는 아래도 추가합니다.
- `https://내도메인/auth/callback`

## 3. Google
Google Cloud / Google Auth Platform에서 OAuth Client를 Web application으로 생성합니다.

- Authorized JavaScript origins: `http://localhost:3000`
- Authorized redirect URI: `https://scmskjvhejnchhyufyfa.supabase.co/auth/v1/callback`

생성된 Client ID와 Client Secret을 Supabase → Authentication → Providers → Google에 입력하고 Enable 합니다.

## 4. Kakao
Kakao Developers에서 앱을 만든 뒤 카카오 로그인을 ON으로 설정합니다.

- REST API Key = Supabase의 Kakao Client ID
- Kakao Login Redirect URI: `https://scmskjvhejnchhyufyfa.supabase.co/auth/v1/callback`
- Client Secret을 발급/활성화한 뒤 Supabase Kakao Client Secret에 입력

Supabase → Authentication → Providers → Kakao에서 Enable 후 저장합니다.

카카오 이메일 동의 항목을 받을 수 없다면 Supabase Kakao Provider에서 `Allow users without an email` 옵션을 켜야 할 수 있습니다.

## 5. 실행
`npm run dev` 상태에서 `http://localhost:3000/login` 접속 후 테스트합니다.
