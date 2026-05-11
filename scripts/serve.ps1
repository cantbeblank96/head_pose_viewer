param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Prefix = "http://localhost:$Port/"

$contentTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".js"   = "text/javascript; charset=utf-8"
    ".mjs"  = "text/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".glb"  = "model/gltf-binary"
    ".gltf" = "model/gltf+json"
    ".bin"  = "application/octet-stream"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".csv"  = "text/csv; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
}

function Get-LocalPath {
    param([string]$UrlPath)

    $path = [Uri]::UnescapeDataString($UrlPath.Split("?")[0])
    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") {
        $path = "/index.html"
    }

    $relative = $path.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
    $fullPath = [IO.Path]::GetFullPath((Join-Path $Root $relative))

    if (-not $fullPath.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }
    return $fullPath
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Failed to start server on $Prefix"
    Write-Host "If the port is occupied, try: run_windows.bat 8001"
    throw
}

Write-Host "Head Pose Viewer is running at $Prefix"
Write-Host "Project root: $Root"
Write-Host "Press Ctrl+C to stop."
Start-Process $Prefix

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $filePath = Get-LocalPath $request.Url.AbsolutePath
            if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $response.StatusCode = 404
                $body = [Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $response.OutputStream.Write($body, 0, $body.Length)
                continue
            }

            $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
            if ($contentTypes.ContainsKey($extension)) {
                $response.ContentType = $contentTypes[$extension]
            } else {
                $response.ContentType = "application/octet-stream"
            }

            $bytes = [IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $response.StatusCode = 500
            $body = [Text.Encoding]::UTF8.GetBytes($_.Exception.Message)
            $response.OutputStream.Write($body, 0, $body.Length)
        } finally {
            $response.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
