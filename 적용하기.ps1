$ErrorActionPreference = "Stop"

$target = Join-Path $PSScriptRoot "public\saju.html"
$tag = '<script src="/member-test-checkout.js?v=20260910b"></script>'

if (!(Test-Path $target)) {
  throw "public\saju.html을 찾을 수 없습니다. 프로젝트 최상위 폴더에서 실행하세요."
}

$html = Get-Content $target -Raw -Encoding UTF8

if ($html -notmatch [regex]::Escape($tag)) {
  if ($html -match '</body>') {
    $html = $html -replace '</body>', ($tag + "`r`n</body>")
  } else {
    $html += "`r`n" + $tag
  }

  Set-Content -Path $target -Value $html -Encoding UTF8
  Write-Host "saju.html에 카카오 회원 0원 테스트 연결을 추가했습니다."
} else {
  Write-Host "이미 연결되어 있습니다."
}

Write-Host ""
Write-Host "다음 명령:"
Write-Host 'git add .'
Write-Host 'git commit -m "add kakao member free test flow"'
Write-Host 'git push'
