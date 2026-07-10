$ErrorActionPreference = "Stop"

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$extension = Join-Path $PSScriptRoot "gw-approval-extension"
$profile = Join-Path $PSScriptRoot "디케이 자동화 로컬저장소"
$url = "http://gw.e-dk.co.kr/"

if (-not (Test-Path -LiteralPath $edge)) {
  throw "Microsoft Edge를 찾지 못했습니다: $edge"
}

if (-not (Test-Path -LiteralPath (Join-Path $extension "manifest.json"))) {
  throw "확장 프로그램 manifest.json을 찾지 못했습니다: $extension"
}

$arguments = @(
  ('--user-data-dir="{0}"' -f $profile),
  ('--load-extension="{0}"' -f $extension),
  "--no-first-run",
  "--new-window",
  $url
)

Start-Process -FilePath $edge -ArgumentList $arguments
