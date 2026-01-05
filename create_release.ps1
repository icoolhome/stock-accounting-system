# GitHub Release ?萄遣?單
# 雿輻?寞?嚗 PowerShell 銝剖銵?.\create_release.ps1

$VERSION = "vS0002-1"
$TITLE = "vS0002-1 - ?扯?芸??I?寥?

Write-Host "甇??萄遣 GitHub Release: $VERSION" -ForegroundColor Green

# 瑼Ｘ GitHub CLI ?臬撌脣?鋆?try {
    $null = Get-Command gh -ErrorAction Stop
    Write-Host "[OK] GitHub CLI 撌脣?鋆? -ForegroundColor Green
} catch {
    Write-Host "[X] GitHub CLI ?芸?鋆? -ForegroundColor Red
    Write-Host ""
    Write-Host "隢?摰? GitHub CLI嚗? -ForegroundColor Yellow
    Write-Host "1. 閮芸?: https://cli.github.com/" -ForegroundColor Cyan
    Write-Host "2. 銝?銝血?鋆?Windows ?" -ForegroundColor Cyan
    Write-Host "3. 摰?敺銵? gh auth login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "?蝙?其誑銝隞?獢?" -ForegroundColor Yellow
    Write-Host "- ?寞?銝嚗? GitHub Web ??萄遣嚗???GITHUB_RELEASE_GUIDE.md嚗? -ForegroundColor Cyan
    Write-Host "- ?寞?鈭?雿輻 Git 璅惜?????單?隞? -ForegroundColor Cyan
    exit 1
}

# 瑼Ｘ?臬撌脩??Write-Host "瑼Ｘ GitHub CLI ?駁????.." -ForegroundColor Yellow
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] ?芰??GitHub CLI" -ForegroundColor Red
        Write-Host "隢銵? gh auth login" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "[OK] GitHub CLI 撌脩?? -ForegroundColor Green
} catch {
    Write-Host "[X] ?⊥?瑼Ｘ?駁???? -ForegroundColor Red
    exit 1
}

# 瑼Ｘ?辣?臬摮
$files = @("RELEASE_NOTES.md", "CHANGELOG.md", "README_VERSION.md")
$allExist = $true
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "[OK] ?曉?辣: $file" -ForegroundColor Green
    } else {
        Write-Host "[X] ?辣銝??? $file" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host "?航炊嚗??隞嗥撩憭梧??⊥??萄遣 Release" -ForegroundColor Red
    exit 1
}

# 瑼Ｘ璅惜?臬摮
Write-Host "瑼Ｘ Git 璅惜..." -ForegroundColor Yellow
$tagExists = git tag -l $VERSION
if ($tagExists) {
    Write-Host "[OK] 璅惜 $VERSION 撌脣??? -ForegroundColor Green
} else {
    Write-Host "[!] 璅惜 $VERSION 銝??? -ForegroundColor Yellow
    Write-Host "?內嚗?蝐支?摮??GitHub CLI ??撱? -ForegroundColor Cyan
}

# ?萄遣 Release
Write-Host ""
Write-Host "甇??萄遣 Release..." -ForegroundColor Yellow
Write-Host "璅惜: $VERSION" -ForegroundColor Cyan
Write-Host "璅?: $TITLE" -ForegroundColor Cyan
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
        Write-Host "[OK] Release ?萄遣??嚗? -ForegroundColor Green
        Write-Host ""
        
        # ?脣??澈靽⊥
        $remoteUrl = git remote get-url origin 2>$null
        if ($remoteUrl) {
            if ($remoteUrl -match 'github.com[:/]([^/]+)/([^/]+?)(?:\.git)?$') {
                $owner = $matches[1]
                $repo = $matches[2] -replace '\.git$', ''
                Write-Host "?亦? Release: https://github.com/$owner/$repo/releases/tag/$VERSION" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "[X] Release ?萄遣憭望?" -ForegroundColor Red
        exit 1
    }
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "[X] ?潛??航炊: $errorMsg" -ForegroundColor Red
    exit 1
}
