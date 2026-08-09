# run-sql.ps1 — jalankan migration/SQL ke Supabase project dari lokal.
#
# Cara pakai (dari root repo):
#   powershell -ExecutionPolicy Bypass -File scripts\run-sql.ps1 supabase\migrations\<file>.sql
#
# Membaca token dari .env.local (SUPABASE_ACCESS_TOKEN), eksekusi via Management API
# (POST /v1/projects/{ref}/database/query). SQL dibungkus BEGIN/COMMIT agar atomic:
# kalau ada error di tengah, semua perubahan di-rollback.
#
# Cek error: script exit code 0 = sukses (HTTP 201); selain itu = gagal.

param(
  [Parameter(Mandatory = $true)]
  [string]$SqlFile,
  [string]$ProjectRef = "snixmtiahvfuqxnokhkf"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path -LiteralPath $SqlFile)) {
  Write-Host "ERROR: file SQL tidak ditemukan: $SqlFile" -ForegroundColor Red
  exit 1
}
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Host "ERROR: .env.local tidak ditemukan (butuh SUPABASE_ACCESS_TOKEN)" -ForegroundColor Red
  exit 1
}

$match = [regex]::Match([System.IO.File]::ReadAllText($envFile), "SUPABASE_ACCESS_TOKEN=([^\r\n]+)")
if (-not $match.Success) {
  Write-Host "ERROR: SUPABASE_ACCESS_TOKEN tidak ada di .env.local" -ForegroundColor Red
  exit 1
}
$token = $match.Groups[1].Value.Trim()
$env:SB_TOKEN = $token

$sql = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $SqlFile))
$body = @{ query = ("begin;" + $sql + "commit;") } | ConvertTo-Json
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("sbq-" + [guid]::NewGuid().ToString("N") + ".json")
[System.IO.File]::WriteAllText($tmp, $body)

$url = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
Write-Host "Menjalankan $SqlFile ke project $ProjectRef ..."
$output = & curl.exe -s -w "`nHTTP %{http_code}" -X POST $url `
  -H "Authorization: Bearer $env:SB_TOKEN" `
  -H "Content-Type: application/json" `
  --data-binary "@$tmp"
Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue

$lines = $output -split "`n"
$http = (($lines | Where-Object { $_ -match "^HTTP \d" }) -replace "HTTP ", "").Trim()
Write-Host ($lines -join "`n")

if ($http -eq "201") {
  Write-Host "SUKSES." -ForegroundColor Green
  exit 0
} else {
  Write-Host "GAGAL (HTTP $http)." -ForegroundColor Red
  exit 1
}
