@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在提交 vS0006 Release...
git add .
git commit -m "Release vS0006: 智能價格獲取與用戶體驗改進"
git tag -a vS0006 -m "vS0006 - 智能價格獲取與用戶體驗改進"
git push origin main
git push origin vS0006

echo.
echo 完成！vS0006 標籤已推送到 GitHub
echo 請前往 GitHub 創建 Release：https://github.com/icoolhome/stock-accounting-system/releases/new
echo 使用標籤：vS0006
echo 使用說明文檔：GITHUB_RELEASE_vS0006.md
pause











