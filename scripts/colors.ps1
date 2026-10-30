# 화면 대표 색 뽑기 — 사이드바 "컬러" 필터용. Windows 내장 그리기 기능만 쓴다 (무료, 오프라인)
# 결과: {site}/colors.json  { "카테고리/파일.png": "블루", ... } → scripts/update-index.js 가 data.js 의 color 로 합친다
# 이미 뽑은 화면은 건너뛰고, 지워진 화면은 뺀다. 언제 끊어도 다음 실행에서 이어진다 (500장마다 저장)
# 사용: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\colors.ps1 [-Sites mo,web]
param([string[]]$Sites = @('mo', 'web'))
$ErrorActionPreference = 'Stop'
$Sites = @($Sites -split ',' | Where-Object { $_ })
$root = Split-Path $PSScriptRoot -Parent
$utf8 = New-Object System.Text.UTF8Encoding($false)

# 색 이름 (사이드바 순서와 같게). 번호는 아래 C# 이 돌려주는 값
$NAMES = @('그레이', '블랙', '레드', '오렌지', '옐로', '그린', '블루', '퍼플', '핑크')

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;

public static class ScreenColor {
  // 0 그레이 1 블랙 2 레드 3 오렌지 4 옐로 5 그린 6 블루 7 퍼플 8 핑크, -1 읽기 실패
  // 화면을 가로 48칸으로 줄여 본다: 어두운 칸이 절반을 넘으면 블랙, 진한 색 칸이 3% 안 되면 그레이,
  // 나머지는 진한 색 칸이 가장 많은 색
  public static int Classify(string path) {
    try {
      using (var fs = File.OpenRead(path))
      using (var src = Image.FromStream(fs, false, false)) {
        int w = 48, h = (int)Math.Max(1, Math.Min(480, (long)src.Height * w / src.Width));
        using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
          using (var g = Graphics.FromImage(bmp)) { g.InterpolationMode = InterpolationMode.Bilinear; g.DrawImage(src, 0, 0, w, h); }
          var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
          var buf = new byte[d.Stride * h];
          Marshal.Copy(d.Scan0, buf, 0, buf.Length);
          bmp.UnlockBits(d);
          int total = w * h, dark = 0, sat = 0;
          var bins = new int[9];
          for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int i = y * d.Stride + x * 4;
            if (buf[i + 3] < 128) continue;
            double b = buf[i] / 255.0, gr = buf[i + 1] / 255.0, r = buf[i + 2] / 255.0;
            double mx = Math.Max(r, Math.Max(gr, b)), mn = Math.Min(r, Math.Min(gr, b));
            if (mx < 0.22) { dark++; continue; }
            double s = (mx - mn) / mx;
            if (s < 0.35 || mx < 0.35) continue;
            sat++;
            double c = mx - mn, hue;
            if (mx == r) hue = 60 * (((gr - b) / c) % 6);
            else if (mx == gr) hue = 60 * ((b - r) / c + 2);
            else hue = 60 * ((r - gr) / c + 4);
            if (hue < 0) hue += 360;
            double l = (mx + mn) / 2;
            int k;
            if (hue < 15 || hue >= 345) k = l > 0.7 ? 8 : 2;
            else if (hue < 40) k = 3;
            else if (hue < 70) k = 4;
            else if (hue < 170) k = 5;
            else if (hue < 255) k = 6;
            else if (hue < 290) k = 7;
            else k = 8;
            bins[k]++;
          }
          if (dark * 2 > total) return 1;
          if (sat < total * 0.03) return 0;
          int best = 2;
          for (int k = 3; k < 9; k++) if (bins[k] > bins[best]) best = k;
          return best;
        }
      }
    } catch { return -1; }
  }

  public static int[] ClassifyAll(string[] paths) {
    var res = new int[paths.Length];
    Parallel.For(0, paths.Length, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount }, i => { res[i] = Classify(paths[i]); });
    return res;
  }
}
'@

function Save-Colors($file, $map) {
  $keys = [string[]]@($map.Keys); [Array]::Sort($keys, [StringComparer]::Ordinal)
  $lines = foreach ($k in $keys) { '  "' + $k.Replace('\', '\\').Replace('"', '\"') + '": "' + $map[$k] + '"' }
  [IO.File]::WriteAllText($file, "{`n" + ($lines -join ",`n") + "`n}`n", $utf8)
}

foreach ($site in $Sites) {
  $base = Join-Path $root $site
  $file = Join-Path $base 'colors.json'
  $map = @{}
  if (Test-Path $file) { (Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value } }

  # 지금 있는 화면 (update-index.js 의 scanImages 와 같은 규칙)
  $skip = @('node_modules', '.git', 'images', '$RECYCLE.BIN', '(업데이트)', '(업로드)', 'icons', 'backups')
  $now = @{}
  Get-ChildItem $base -Directory | Where-Object { $_.Name -notin $skip -and -not $_.Name.StartsWith('.') } | ForEach-Object {
    $cat = $_.Name.Normalize([Text.NormalizationForm]::FormC)
    Get-ChildItem $_.FullName -File | Where-Object { $_.Name -match '\.(png|jpg|jpeg|webp|gif|avif)$' } | ForEach-Object {
      $now[$cat + '/' + $_.Name.Normalize([Text.NormalizationForm]::FormC)] = $_.FullName
    }
  }
  $gone = @($map.Keys | Where-Object { -not $now.ContainsKey($_) })
  foreach ($k in $gone) { $map.Remove($k) }
  $todo = @($now.Keys | Where-Object { -not $map.ContainsKey($_) })
  Write-Host "$site : 화면 $($now.Count)장, 새로 뽑을 것 $($todo.Count)장, 빠진 것 $($gone.Count)장"

  $sw = [Diagnostics.Stopwatch]::StartNew(); $fail = 0
  for ($i = 0; $i -lt $todo.Count; $i += 500) {
    $part = $todo[$i..([math]::Min($i + 499, $todo.Count - 1))]
    $res = [ScreenColor]::ClassifyAll([string[]]@($part | ForEach-Object { $now[$_] }))
    for ($j = 0; $j -lt $part.Count; $j++) { if ($res[$j] -ge 0) { $map[$part[$j]] = $NAMES[$res[$j]] } else { $fail++ } }
    Save-Colors $file $map
    Write-Host ("  {0} / {1}  ({2:N0}초)" -f [math]::Min($i + 500, $todo.Count), $todo.Count, $sw.Elapsed.TotalSeconds)
  }
  if ($gone.Count -and -not $todo.Count) { Save-Colors $file $map }
  if ($fail) { Write-Host "  읽지 못한 화면 $fail 장 (다음 실행에서 다시 시도)" }
}
