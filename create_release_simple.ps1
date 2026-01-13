# Create GitHub Release vS0005
Set-Location $PSScriptRoot

$notesFile = "GITHUB_RELEASE_vS0005.md"

gh release create vS0005 `
    --title "vS0005 - Holding Cost Display Optimization & Welcome Guide Enhancement" `
    --notes-file $notesFile `
    --target main

if ($LASTEXITCODE -eq 0) {
    Write-Host "Release created successfully!" -ForegroundColor Green
    Write-Host "View at: https://github.com/icoolhome/stock/releases/tag/vS0005"
} else {
    Write-Host "Failed to create release" -ForegroundColor Red
}






