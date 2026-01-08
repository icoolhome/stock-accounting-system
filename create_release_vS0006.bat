@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在創建 GitHub Release vS0006...
gh release create vS0006 --title "vS0006 - 智能價格獲取與用戶體驗改進" --notes-file GITHUB_RELEASE_vS0006.md --latest

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Release 創建成功！
    echo 請前往查看：https://github.com/icoolhome/stock-accounting-system/releases/tag/vS0006
) else (
    echo.
    echo ❌ Release 創建失敗，請檢查錯誤訊息
)

pause


