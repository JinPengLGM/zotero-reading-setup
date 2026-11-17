param([switch]$IncludeOptional, [switch]$Offline, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # Avoid the slow per-packet console repaint in Windows PowerShell 5.
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = Join-Path $root 'dist'
$lock = Get-Content -LiteralPath (Join-Path $root 'dependencies.lock.json') -Raw -Encoding UTF8 | ConvertFrom-Json
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
& (Join-Path $PSScriptRoot 'build.ps1') -OutputDirectory $output
foreach ($addon in $lock.addons) {
    if ($addon.optional -and !$IncludeOptional) { continue }
    $target = Join-Path $output $addon.file
    $valid = (Test-Path -LiteralPath $target) -and ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $addon.sha256)
    if (!$valid) {
        if ($Offline) { throw "Missing or mismatched cached file: $($addon.file). Run without -Offline to download it." }
        Write-Host "Downloading $($addon.name) $($addon.version) from its official release..."
        $temporary = "$target.tmp"
        Invoke-WebRequest -Uri $addon.url -OutFile $temporary -UseBasicParsing -TimeoutSec 90
        $actual = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $addon.sha256) {
            Remove-Item -LiteralPath $temporary
            throw "SHA256 mismatch: $($addon.file). Nothing installed. The upstream URL may have changed; see docs/TROUBLESHOOTING.md."
        }
        Move-Item -LiteralPath $temporary -Destination $target -Force
    }
    Write-Host "Verified $($addon.file)"
}
$instructions = @'
1. Open Zotero 10: Tools -> Plugins.
2. Install core XPI files 01, 02 and 03 in order (drag them into Plugins, or use Install Plugin From File).
3. If requested, install optional XPI files 04 and 05.
4. Restart Zotero. The reading preset applies once and backs up the settings it changes.
5. Sign in to your own Codex account; see docs/INSTALL.md. Translation defaults to Google.
6. Select text, press Alt+Q, then choose a thought, chat quote or translation.
Rollback: Tools -> Reading configuration preset -> Restore previous settings (Chinese labels in this add-on).
This script only prepares files here. It does not modify your Zotero profile or library.
'@
[IO.File]::WriteAllText((Join-Path $output 'INSTALL.txt'), $instructions, [Text.UTF8Encoding]::new($false))
$checksums = Get-ChildItem -LiteralPath $output -Filter '*.xpi' | Sort-Object Name | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name
}
[IO.File]::WriteAllLines((Join-Path $output 'SHA256SUMS.txt'), [string[]]$checksums, [Text.UTF8Encoding]::new($false))
Write-Host "READY: $output"
if (!$NoOpen) { Start-Process explorer.exe -ArgumentList ('"{0}"' -f $output) -WindowStyle Hidden }
