$ErrorActionPreference="Stop"
$target=Join-Path $PSScriptRoot "public\saju.html"
$tag='<script src="/my-report-live.js?v=20260911c"></script>'

if(!(Test-Path $target)){ throw "public\saju.html을 찾을 수 없습니다." }

$html=Get-Content $target -Raw -Encoding UTF8
if($html -notmatch [regex]::Escape($tag)){
  if($html -match '</body>'){
    $html=$html -replace '</body>',($tag+"`r`n</body>")
  }else{
    $html+="`r`n"+$tag
  }
  Set-Content -Path $target -Value $html -Encoding UTF8
}

Write-Host "적용 완료"
Write-Host 'git add .'
Write-Host 'git commit -m "fix live report progress and my report list"'
Write-Host 'git push'
