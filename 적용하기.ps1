$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$guest = Join-Path $root "public\guest-report.html"
$route = Join-Path $root "app\api\report\generate\route.ts"

if (!(Test-Path $guest)) {
  throw "public\guest-report.html 파일을 찾을 수 없습니다."
}
if (!(Test-Path $route)) {
  throw "app\api\report\generate\route.ts 파일을 찾을 수 없습니다."
}

# 1) guest-report 페이지에 자동 생성 엔진 연결
$html = Get-Content $guest -Raw -Encoding UTF8
$tag = '<script src="/report-autostart-fix.js?v=20260911a"></script>'

if ($html -notmatch [regex]::Escape($tag)) {
  if ($html -match '</body>') {
    $html = $html -replace '</body>', ($tag + "`r`n</body>")
  } else {
    $html += "`r`n" + $tag
  }
  Set-Content -Path $guest -Value $html -Encoding UTF8
  Write-Host "guest-report 자동 생성 연결 완료"
} else {
  Write-Host "guest-report 자동 생성 연결은 이미 적용되어 있습니다."
}

# 2) 회원 테스트 주문도 생성 결과가 회원 계정에 귀속되게 수정
$code = Get-Content $route -Raw -Encoding UTF8

# order 조회에 user_id 추가
$code = $code.Replace(
  '.select("id,product_id,birth_profile_id,question_id,status,payment_payload,guest_access_token,products(slug,name,report_type)")',
  '.select("id,user_id,product_id,birth_profile_id,question_id,status,payment_payload,guest_access_token,products(slug,name,report_type)")'
)

# ensureInitialized 내부의 신규 데이터 귀속
$code = $code.Replace('user_id: null,', 'user_id: order.user_id || null,')
$code = $code.Replace('label: "비회원 본인",', 'label: order.user_id ? "본인" : "비회원 본인",')

Set-Content -Path $route -Value $code -Encoding UTF8
Write-Host "회원 주문 리포트 귀속 수정 완료"

Write-Host ""
Write-Host "이제 실행:"
Write-Host 'git add .'
Write-Host 'git commit -m "fix member report autostart"'
Write-Host 'git push'
