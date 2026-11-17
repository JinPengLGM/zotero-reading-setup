$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$output = Join-Path $root 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $root 'src\reading-thoughts\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
& (Join-Path $PSScriptRoot 'build.ps1') -OutputDirectory $output
$files = @(git -C $root -c core.quotepath=false ls-files)
if ($LASTEXITCODE -ne 0 -or !$files.Count) { throw 'Packaging requires a Git checkout with tracked files.' }
$name = "zotero-reading-setup-$($manifest.version)"
$target = Join-Path $output "$name.zip"
$stream = [IO.File]::Open($target, [IO.FileMode]::Create, [IO.FileAccess]::ReadWrite)
$zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
function Add-PackageFile([string]$path, [string]$relative) {
    $entry = $zip.CreateEntry("$name/$relative", [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
    $inputStream = [IO.File]::OpenRead($path)
    $entryStream = $entry.Open()
    try { $inputStream.CopyTo($entryStream) }
    finally { $entryStream.Dispose(); $inputStream.Dispose() }
}
try {
    foreach ($relative in $files) { Add-PackageFile (Join-Path $root $relative) $relative }
    $xpi = "03-reading-thoughts-$($manifest.version).xpi"
    Add-PackageFile (Join-Path $output $xpi) "dist/$xpi"
}
finally { $zip.Dispose(); $stream.Dispose() }
$checksums = @($xpi, "$name.zip") | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash -LiteralPath (Join-Path $output $_) -Algorithm SHA256).Hash.ToLowerInvariant(), $_
}
[IO.File]::WriteAllLines((Join-Path $output 'SHA256SUMS.txt'), [string[]]$checksums, [Text.UTF8Encoding]::new($false))
Write-Host "Packaged $target (original extension only; upstream dependencies are downloaded by prepare.ps1)"
