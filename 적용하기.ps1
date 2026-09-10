$ErrorActionPreference = "Stop"

$target = Join-Path $PSScriptRoot "public\saju.html"

if (!(Test-Path $target)) {
  throw "public\saju.html 파일을 찾을 수 없습니다. 프로젝트 최상위 폴더에서 실행하세요."
}

$html = Get-Content $target -Raw -Encoding UTF8

$old = @'
    const {data:calcData,error:calcError}=await familySupabase
      .from('saju_calculations')
      .insert(calcPayload)
      .select('id').single();
'@

$new = @'
    const {data:calcData,error:calcError}=await familySupabase
      .from('saju_calculations')
      .upsert(calcPayload,{
        onConflict:'birth_profile_id,engine_version,correction_policy'
      })
      .select('id').single();
'@

if ($html.Contains($old)) {
  $html = $html.Replace($old, $new)
  Set-Content -Path $target -Value $html -Encoding UTF8
  Write-Host "saju_calculations INSERT -> UPSERT 수정 완료"
} elseif ($html -match "onConflict:'birth_profile_id,engine_version,correction_policy'") {
  Write-Host "이미 UPSERT 수정이 적용되어 있습니다."
} else {
  throw "수정할 기존 INSERT 구문을 찾지 못했습니다. public\saju.html 현재 파일을 확인해야 합니다."
}

Write-Host ""
Write-Host "다음 명령을 실행하세요:"
Write-Host 'git add .'
Write-Host 'git commit -m "fix duplicate calculation save"'
Write-Host 'git push'
