# 검색 결과를 번호 붙은 모아보기 이미지로 묶는다 (Claude 가 결과를 눈으로 확인할 때 사용)
# 한 장에 모바일 10개(5x2) / 웹 6개(3x2). 출력: {Out}_1.png, {Out}_2.png ...
param([string]$ListFile, [string]$Out, [string]$Web = '0')
Add-Type -AssemblyName System.Drawing
$files = @(Get-Content -LiteralPath $ListFile -Encoding UTF8 | Where-Object { $_ })
if ($Web -eq '1') { $tw = 560; $th = 360; $cols = 3; $rows = 2 } else { $tw = 300; $th = 650; $cols = 5; $rows = 2 }
$per = $cols * $rows
$font = New-Object System.Drawing.Font('Malgun Gothic', 16, [System.Drawing.FontStyle]::Bold)
for ($s = 0; $s * $per -lt $files.Count; $s++) {
  $canvas = New-Object System.Drawing.Bitmap ($cols * ($tw + 8) + 8), ($rows * ($th + 8) + 8)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::FromArgb(40, 40, 46))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($k = 0; $k -lt $per; $k++) {
    $i = $s * $per + $k
    if ($i -ge $files.Count) { break }
    $x = 8 + ($k % $cols) * ($tw + 8); $y = 8 + [Math]::Floor($k / $cols) * ($th + 8)
    try {
      $img = [System.Drawing.Image]::FromFile($files[$i])
      # 위쪽 기준으로 폭에 맞춘다 (긴 화면은 아래가 잘림)
      $scale = $tw / $img.Width
      $srcH = [Math]::Min($img.Height, [int]($th / $scale))
      $g.DrawImage($img, (New-Object System.Drawing.Rectangle $x, $y, $tw, ([int]($srcH * $scale))), (New-Object System.Drawing.Rectangle 0, 0, $img.Width, $srcH), [System.Drawing.GraphicsUnit]::Pixel)
      $img.Dispose()
    } catch { }
    $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, 58, 30)
    $g.DrawString("#$($i + 1)", $font, [System.Drawing.Brushes]::Yellow, $x + 4, $y + 2)
  }
  $g.Dispose()
  $file = "{0}_{1}.png" -f $Out, ($s + 1)
  $canvas.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  $file
}
