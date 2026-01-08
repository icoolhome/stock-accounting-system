# Create GitHub Release vS0005 with UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = "Stop"

Write-Host "Creating GitHub Release: vS0005" -ForegroundColor Green

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Read release notes file with UTF-8 encoding
$notesFile = "GITHUB_RELEASE_vS0005.md"
if (-not (Test-Path $notesFile)) {
    Write-Host "[ERROR] File not found: $notesFile" -ForegroundColor Red
    exit 1
}

# Read content with UTF-8 encoding
$releaseNotes = Get-Content $notesFile -Raw -Encoding UTF8

Write-Host "[OK] Read release notes file" -ForegroundColor Green

# Create release using GitHub CLI
Write-Host ""
Write-Host "Creating release..." -ForegroundColor Yellow

try {
    # Create release with title and notes
    $releaseNotes | gh release create vS0005 `
        --title "vS0005 - 持有成本顯示優化與使用指南增強" `
        --notes - `
        --target master
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[SUCCESS] Release vS0005 created successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "View release: https://github.com/icoolhome/stock/releases/tag/vS0005" -ForegroundColor Cyan
    } else {
        Write-Host "[ERROR] Failed to create release" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[ERROR] Error occurred: $_" -ForegroundColor Red
    exit 1
}


