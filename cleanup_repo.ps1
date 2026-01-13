# Cleanup GitHub repository - Remove temporary/test files
# This script will remove files from both local filesystem and git tracking

$ErrorActionPreference = "Continue"

Write-Host "開始清理 GitHub 倉庫..." -ForegroundColor Green
Write-Host ""

# Files to remove from git repository
$filesToRemove = @(
    # Temporary test files
    "DEBUG_START.bat",
    "start_debug.bat",
    "start_new.bat",
    "start_test_ansi.bat",
    "test_check.bat",
    "test_encoding.bat",
    "test_utf8.bat",
    
    # Backup files
    "start_backup_20260105_213818.bat",
    
    # Obsolete start scripts (keeping only start-node.bat)
    "start-backend.bat",
    "start-background.bat",
    "start-fixed.bat",
    "start-server-only.bat",
    "start-simple.bat",
    
    # VBS files
    "!VBS_BACKEND!",
    "!VBS_FRONTEND!",
    
    # Language/batch files
    "batch_language_env.bat",
    "batch_language.json",
    "load_language.bat",
    
    # Translation files
    "holdings-translations-to-add.json",
    
    # Temporary commit files
    "COMMIT_MSG.txt",
    
    # Obsolete release scripts (keeping create_release.py)
    "create_release.ps1",
    "create_release_simple.ps1",
    "create_release_utf8.ps1",
    "create_release_vS0005.ps1",
    
    # Utility scripts
    "convert_to_utf8.ps1",
    
    # Obsolete documentation
    "GITHUB_PUSH.md",
    "GITHUB_RELEASE_GUIDE.md",
    "GITHUB_RELEASE_vS0005_指南.md",
    "PUSH_TO_GITHUB.md",
    "README_START.md",
    "README_VERSION.md",
    "START_BAT_CHECK.md",
    "CREATE_GITHUB_RELEASE.md",
    "FIX_ENCODING.md",
    "FIX_START_BAT.md",
    "BATCH_FILE_ENCODING_GUIDE.md"
)

# Change to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$removedCount = 0
$notFoundCount = 0

foreach ($file in $filesToRemove) {
    $filePath = Join-Path $scriptDir $file
    
    # Check if file exists in git
    $gitFile = git ls-files $file 2>$null
    if ($gitFile) {
        Write-Host "刪除: $file" -ForegroundColor Yellow
        try {
            # Remove from git index (but keep local file for now)
            git rm --cached $file 2>$null
            if ($LASTEXITCODE -eq 0) {
                $removedCount++
                Write-Host "  ✓ 已從 git 追蹤中移除" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ✗ 移除失敗: $_" -ForegroundColor Red
        }
    } else {
        # File might exist locally but not in git
        if (Test-Path $filePath) {
            Write-Host "跳過 (不在 git 中): $file" -ForegroundColor Gray
            $notFoundCount++
        } else {
            Write-Host "跳過 (不存在): $file" -ForegroundColor Gray
            $notFoundCount++
        }
    }
}

Write-Host ""
Write-Host "清理完成！" -ForegroundColor Green
Write-Host "已移除 $removedCount 個文件" -ForegroundColor Cyan
Write-Host "跳過 $notFoundCount 個文件" -ForegroundColor Gray
Write-Host ""
Write-Host "下一步：" -ForegroundColor Yellow
Write-Host "1. 檢查變更: git status" -ForegroundColor White
Write-Host "2. 提交變更: git commit -m 'chore: Remove temporary and obsolete files'" -ForegroundColor White
Write-Host "3. 推送到 GitHub: git push origin master" -ForegroundColor White






