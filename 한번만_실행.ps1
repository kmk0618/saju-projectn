$ErrorActionPreference = "Stop"
Write-Host "1/3 PDF 서버 패키지 설치 중..."
npm install puppeteer-core @sparticuz/chromium

Write-Host "2/3 Git 반영 중..."
git add .
git commit -m "finish automatic personalized pdf pipeline"

Write-Host "3/3 GitHub push..."
git push

Write-Host ""
Write-Host "완료. Vercel 배포가 Ready가 되면 기존 guest-report 링크를 다시 여세요."
