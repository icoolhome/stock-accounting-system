@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在創建 GitHub Release vS0008...
gh release create vS0008 --title "vS0008 - 修復導入邏輯：避免銀行帳戶餘額重複計算" --notes-file GITHUB_RELEASE_vS0008.md --latest

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Release 創建成功！
    echo 請前往查看：https://github.com/icoolhome/stock-accounting-system/releases/tag/vS0008
) else (
    echo.
    echo ❌ Release 創建失敗，請檢查錯誤訊息
)

pause







