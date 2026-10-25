# OCR 일괄 실행 — 작업자 여러 개를 동시에 띄운다. 끊겨도 다음 실행에서 이어짐.
param([int]$Workers = 12, [double]$Minutes = 0, [string[]]$Sites = @('mo', 'web'))
$ocr = Join-Path $PSScriptRoot 'ocr.ps1'
$logDir = Join-Path $PSScriptRoot 'ocr\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$procs = for ($w = 0; $w -lt $Workers; $w++) {
  Start-Process powershell -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "w$w.log") -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$ocr`"", '-Worker', $w, '-Workers', $Workers, '-Minutes', $Minutes, '-Sites', ($Sites -join ','))
}
Write-Host "작업자 $Workers개 시작 (제한: $(if ($Minutes) { "${Minutes}분" } else { '없음' }))"
$procs | Wait-Process
Write-Host "전체 종료"