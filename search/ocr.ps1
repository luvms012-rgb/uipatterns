# 화면 텍스트(OCR) 추출 — Windows 내장 OCR(한국어), 무료·오프라인
# 결과: search/ocr/{site}/w{N}.jsonl  한 줄 = {"p":"카테고리/파일.png","w":폭,"h":높이,"l":[[y(0~1000),"텍스트"],...]}
# 이미 처리한 파일은 건너뛰므로 언제 끊어도 다음 실행에서 이어진다.
param(
  [string[]]$Sites = @('mo', 'web'),
  [int]$Worker = 0,
  [int]$Workers = 1,
  [double]$Minutes = 0          # 0 = 끝날 때까지
)
$ErrorActionPreference = 'Stop'
$Sites = @($Sites -split ',' | Where-Object { $_ })   # -File 로 넘기면 'mo,web' 한 문자열로 들어온다
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(); $task.Result }

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('ko'))
if (-not $engine) { throw '한국어 OCR 엔진을 찾지 못했습니다 (Windows 설정 > 언어에 한국어 필요)' }

$TILE = 2400   # 세로로 긴 화면은 이 높이로 잘라서 인식 (긴 이미지는 인식률이 떨어짐)

function Read-Image([string]$full) {
  $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($full)) ([Windows.Storage.StorageFile])
  $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  try {
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $W = [int]$dec.PixelWidth; $H = [int]$dec.PixelHeight
    $lines = New-Object System.Collections.ArrayList
    for ($y0 = 0; $y0 -lt $H; $y0 += $TILE) {
      $th = [Math]::Min($TILE, $H - $y0)
      if ($th -lt 40) { break }
      $tf = New-Object Windows.Graphics.Imaging.BitmapTransform
      $b = New-Object Windows.Graphics.Imaging.BitmapBounds
      $b.X = 0; $b.Y = $y0; $b.Width = $W; $b.Height = $th
      $tf.Bounds = $b
      $bmp = Await ($dec.GetSoftwareBitmapAsync(
          [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
          [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tf,
          [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation,
          [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
      $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
      $bmp.Dispose()
      foreach ($ln in $res.Lines) {
        $ys = @($ln.Words | ForEach-Object { $_.BoundingRect.Y })
        $yy = if ($ys.Count) { ($ys | Measure-Object -Minimum).Minimum } else { 0 }
        [void]$lines.Add(@([int][Math]::Round(($y0 + $yy) * 1000 / $H), $ln.Text))
      }
    }
    return @{ w = $W; h = $H; l = @($lines | Sort-Object { $_[0] }) }
  } finally { $stream.Dispose() }
}

$deadline = if ($Minutes -gt 0) { (Get-Date).AddMinutes($Minutes) } else { [datetime]::MaxValue }
$total = 0
foreach ($site in $Sites) {
  $siteDir = Join-Path $root $site
  $outDir = Join-Path $root "search\ocr\$site"
  New-Item -ItemType Directory -Force $outDir | Out-Null
  $outFile = Join-Path $outDir ("w{0}.jsonl" -f $Worker)

  # 대상 = index.html DATA 의 path (사이트에 실제로 노출되는 화면만)
  $html = [IO.File]::ReadAllText((Join-Path $siteDir 'index.html'), $utf8)
  $paths = [regex]::Matches($html, '"path":\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value }

  $done = New-Object 'System.Collections.Generic.HashSet[string]'
  Get-ChildItem $outDir -Filter *.jsonl -ErrorAction SilentlyContinue | ForEach-Object {
    foreach ($row in [IO.File]::ReadLines($_.FullName, $utf8)) {
      $m = [regex]::Match($row, '^\{"p":"((?:[^"\\]|\\.)*)"')
      if ($m.Success) { [void]$done.Add(('"' + $m.Groups[1].Value + '"' | ConvertFrom-Json)) }
    }
  }

  $todo = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $paths.Count; $i++) {
    if (($i % $Workers) -ne $Worker) { continue }
    $pp = ('"' + $paths[$i] + '"' | ConvertFrom-Json)
    if (-not $done.Contains($pp)) { [void]$todo.Add($pp) }
  }
  Write-Host "[$site w$Worker] 대상 $($todo.Count)장"

  $buf = New-Object System.Text.StringBuilder
  $n = 0
  foreach ($p in $todo) {
    if ((Get-Date) -gt $deadline) { break }
    $full = Join-Path $siteDir ($p -replace '/', '\')
    if (-not (Test-Path -LiteralPath $full)) { continue }
    try {
      $r = Read-Image $full
      $obj = [ordered]@{ p = $p; w = $r.w; h = $r.h; l = @($r.l) }
    } catch {
      $obj = [ordered]@{ p = $p; err = $_.Exception.Message }
    }
    [void]$buf.AppendLine(($obj | ConvertTo-Json -Compress -Depth 4))
    $n++
    if ($n % 25 -eq 0) { [IO.File]::AppendAllText($outFile, $buf.ToString(), $utf8); [void]$buf.Clear() }
  }
  if ($buf.Length) { [IO.File]::AppendAllText($outFile, $buf.ToString(), $utf8) }
  Write-Host "[$site w$Worker] 처리 ${n}장"
  $total += $n
  if ((Get-Date) -gt $deadline) { Write-Host "[w$Worker] 시간 제한 도달 — 다음 실행 때 이어서 처리"; break }
}
Write-Host "[w$Worker] 완료: ${total}장"
