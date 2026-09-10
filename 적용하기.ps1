$ErrorActionPreference = "Stop"

$target = Join-Path $PSScriptRoot "public\saju.html"
$scriptTag = '<script src="/auth-state-fix.js?v=20260910"></script>'

if (!(Test-Path $target)) {
  throw "public\saju.html 파일을 찾을 수 없습니다. 이 파일을 프로젝트 최상위 폴더에서 실행하세요."
}

$html = Get-Content $target -Raw -Encoding UTF8

if ($html -notmatch [regex]::Escape($scriptTag)) {
  if ($html -match '</body>') {
    $html = $html -replace '</body>', ($scriptTag + "`r`n</body>")
  } else {
    $html += "`r`n" + $scriptTag
  }
  Set-Content -Path $target -Value $html -Encoding UTF8
  Write-Host "saju.html에 로그인 상태 동기화 스크립트를 추가했습니다."
} else {
  Write-Host "이미 auth-state-fix.js가 연결되어 있습니다."
}

Write-Host ""
Write-Host "이제 아래 명령을 실행하세요:"
Write-Host 'git add .'
Write-Host 'git commit -m "fix login logout state"'
Write-Host 'git push'
