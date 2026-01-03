# GitHub Release 創建腳本
# 使用方法：在 PowerShell 中執行 .\create_release.ps1

$VERSION = "vS0002-1"
$TITLE = "vS0002-1 - 性能優化與UI改進"

Write-Host "正在創建 GitHub Release: $VERSION" -ForegroundColor Green

# 檢查 GitHub CLI 是否已安裝
try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "[OK] GitHub CLI 已安裝" -ForegroundColor Green
} catch {
    Write-Host "[X] GitHub CLI 未安裝" -ForegroundColor Red
    Write-Host ""
    Write-Host "請先安裝 GitHub CLI：" -ForegroundColor Yellow
    Write-Host "1. 訪問: https://cli.github.com/" -ForegroundColor Cyan
    Write-Host "2. 下載並安裝 Windows 版本" -ForegroundColor Cyan
    Write-Host "3. 安裝後執行: gh auth login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "或者使用以下替代方案：" -ForegroundColor Yellow
    Write-Host "- 方法一：通過 GitHub Web 界面創建（參考 GITHUB_RELEASE_GUIDE.md）" -ForegroundColor Cyan
    Write-Host "- 方法二：使用 Git 標籤和手動上傳文件" -ForegroundColor Cyan
    exit 1
}

# 檢查是否已登錄
Write-Host "檢查 GitHub CLI 登錄狀態..." -ForegroundColor Yellow
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] 未登錄 GitHub CLI" -ForegroundColor Red
        Write-Host "請執行: gh auth login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] GitHub CLI 已登錄" -ForegroundColor Green
} catch {
    Write-Host "[X] 無法檢查登錄狀態" -ForegroundColor Red
    exit 1
}

# 檢查文件是否存在
$files = @("RELEASE_NOTES.md", "CHANGELOG.md", "README_VERSION.md")
$allExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "[OK] 找到文件: $file" -ForegroundColor Green
    } else {
        Write-Host "[X] 文件不存在: $file" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host "錯誤：部分文件缺失，無法創建 Release" -ForegroundColor Red
    exit 1
}

# 檢查標籤是否存在
Write-Host "檢查 Git 標籤..." -ForegroundColor Yellow
$tagExists = git tag -l $VERSION
if ($tagExists) {
    Write-Host "[OK] 標籤 $VERSION 已存在" -ForegroundColor Green
} else {
    Write-Host "[!] 標籤 $VERSION 不存在" -ForegroundColor Yellow
    Write-Host "提示：標籤不存在時，GitHub CLI 會自動創建" -ForegroundColor Cyan
}

# 創建 Release
Write-Host ""
Write-Host "正在創建 Release..." -ForegroundColor Yellow
Write-Host "標籤: $VERSION" -ForegroundColor Cyan
Write-Host "標題: $TITLE" -ForegroundColor Cyan
Write-Host ""

try {
    gh release create $VERSION `
        --title $TITLE `
        --notes-file RELEASE_NOTES.md `
        RELEASE_NOTES.md `
        CHANGELOG.md `
        README_VERSION.md `
        --target main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[OK] Release 創建成功！" -ForegroundColor Green
        Write-Host ""
        
        # 獲取倉庫信息
        $remoteUrl = git remote get-url origin 2>$null
        if ($remoteUrl) {
            if ($remoteUrl -match 'github.com[:/]([^/]+)/([^/]+?)(?:\.git)?$') {
                $owner = $matches[1]
                $repo = $matches[2] -replace '\.git$', ''
                Write-Host "查看 Release: https://github.com/$owner/$repo/releases/tag/$VERSION" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "[X] Release 創建失敗" -ForegroundColor Red
        exit 1
    }
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "[X] 發生錯誤: $errorMsg" -ForegroundColor Red
    exit 1
}
