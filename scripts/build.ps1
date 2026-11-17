param([string]$OutputDirectory = (Join-Path $PSScriptRoot '..\dist'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src\reading-thoughts'))
$output = [IO.Path]::GetFullPath($OutputDirectory)
$manifest = Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Path $output -Force | Out-Null
$target = Join-Path $output ("03-reading-thoughts-{0}.xpi" -f $manifest.version)
$temporary = "$target.tmp"
$stream = [IO.File]::Open($temporary, [IO.FileMode]::Create, [IO.FileAccess]::ReadWrite)
$zip = $null
try {
    $zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
    foreach ($file in Get-ChildItem -LiteralPath $source -Recurse -File | Sort-Object FullName) {
        $relative = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
        $entry = $zip.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = [DateTimeOffset]::new(2026, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
        $inputStream = [IO.File]::OpenRead($file.FullName)
        $entryStream = $entry.Open()
        try { $inputStream.CopyTo($entryStream) }
        finally { $entryStream.Dispose(); $inputStream.Dispose() }
    }
}
finally { if ($zip) { $zip.Dispose() }; $stream.Dispose() }
Move-Item -LiteralPath $temporary -Destination $target -Force
Write-Host "Built $target"
Write-Host ("SHA256: " + (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant())
