# 創建 GitHub Release vS0002

## 步驟說明

要在 GitHub 上創建 vS0002 Release，需要完成以下步驟：

## 步驟 1: 提交更改

確保所有更改已提交：

```bash
cd stock-accounting-system
git add .
git commit -m "更新版本為 vS0002 並更新相關文檔"
```

## 步驟 2: 創建 Git 標籤

```bash
git tag -a vS0002 -m "vS0002 - 歷史收益增強與系統診斷改進"
```

## 步驟 3: 推送到 GitHub

### 如果還沒有配置遠程倉庫：

```bash
# 添加遠程倉庫（請將 YOUR_USERNAME 和 REPO_NAME 替換為實際值）
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
```

### 推送代碼和標籤：

```bash
# 推送主分支
git push -u origin main
# 或
git push -u origin master

# 推送標籤
git push origin vS0002
```

## 步驟 4: 創建 GitHub Release

### 方法一：使用 GitHub CLI（推薦）

```bash
cd stock-accounting-system
gh release create vS0002 \
  --title "vS0002 - 歷史收益增強與系統診斷改進" \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target main
```

或使用 PowerShell 腳本：

```powershell
cd stock-accounting-system
.\create_release.ps1
```

### 方法二：使用 GitHub Web 界面

1. 訪問您的 GitHub 倉庫
2. 點擊右側的 **"Releases"** 鏈接
3. 點擊 **"Draft a new release"** 或 **"Create a new release"**
4. 選擇標籤 `vS0002`（如果還沒有，先創建標籤）
5. 填寫 Release 信息：
   - **Release title**: `vS0002 - 歷史收益增強與系統診斷改進`
   - **Description**: 複製 `RELEASE_NOTES.md` 的內容
6. 可選：在 "Attach binaries" 區域上傳文件：
   - `RELEASE_NOTES.md`
   - `CHANGELOG.md`
   - `README_VERSION.md`
7. 點擊 **"Publish release"**

## 驗證

創建成功後，訪問：
```
https://github.com/YOUR_USERNAME/REPO_NAME/releases/tag/vS0002
```

您應該能看到：
- Release 標題和說明
- 附加的文件列表（如果上傳了）
- 可以下載的文件連結

## 注意事項

1. 確保 GitHub CLI 已安裝並已登錄：`gh auth login`
2. 如果使用 PowerShell，可能需要先執行：`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. 標籤必須先推送到 GitHub，然後才能創建 Release
4. 如果標籤已經存在，GitHub CLI 會自動使用現有標籤


