# GitHub Release vS0005 創建腳本
# 使用 UTF-8 編碼

$ErrorActionPreference = "Stop"

Write-Host "正在創建 GitHub Release: vS0005" -ForegroundColor Green

# 切換到腳本所在目錄
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# 檢查文件是否存在
$notesFile = "GITHUB_RELEASE_vS0005.md"
if (-not (Test-Path $notesFile)) {
    Write-Host "[錯誤] 文件不存在: $notesFile" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] 找到文件: $notesFile" -ForegroundColor Green

# 檢查 GitHub CLI
try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "[OK] GitHub CLI 已安裝" -ForegroundColor Green
} catch {
    Write-Host "[錯誤] GitHub CLI 未安裝" -ForegroundColor Red
    exit 1
}

# 檢查登錄狀態
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[錯誤] 未登錄 GitHub CLI" -ForegroundColor Red
        Write-Host "請執行: gh auth login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] GitHub CLI 已登錄" -ForegroundColor Green
} catch {
    Write-Host "[錯誤] 無法檢查登錄狀態" -ForegroundColor Red
    exit 1
}

# 創建 Release
Write-Host ""
Write-Host "正在創建 Release..." -ForegroundColor Yellow
Write-Host "標籤: vS0005" -ForegroundColor Cyan
Write-Host "標題: vS0005 - 持有成本顯示優化與使用指南增強" -ForegroundColor Cyan
Write-Host ""

try {
    gh release create vS0005 `
        --title "vS0005 - 持有成本顯示優化與使用指南增強" `
        --notes-file $notesFile `
        --target main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[成功] Release vS0005 創建成功！" -ForegroundColor Green
        Write-Host ""
        Write-Host "查看 Release: https://github.com/icoolhome/stock/releases/tag/vS0005" -ForegroundColor Cyan
    } else {
        Write-Host "[錯誤] Release 創建失敗" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[錯誤] 發生錯誤: $_" -ForegroundColor Red
    exit 1
}


