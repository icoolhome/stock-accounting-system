# GitHub Releases 使用指南

## 如何在 GitHub Releases 中添加版本文件

當您在 GitHub 上創建新的 Release 時，可以將版本文件附加到 Release 中。以下是詳細步驟：

## 步驟 1：準備版本文件

確保以下文件已經在倉庫中並已提交：

1. **RELEASE_NOTES.md** - Release 說明文件（專為 GitHub Releases 準備）
2. **CHANGELOG.md** - 完整的變更日誌
3. **README_VERSION.md** - 版本詳細說明文件

## 步驟 2：創建 GitHub Release

### 方法一：通過 GitHub Web 界面

1. 訪問您的 GitHub 倉庫
2. 點擊右側的 **"Releases"** 鏈接，或直接訪問：`https://github.com/YOUR_USERNAME/YOUR_REPO/releases`
3. 點擊 **"Draft a new release"** 或 **"Create a new release"**
4. 填寫 Release 信息：
   - **Tag version**: 輸入標籤名稱，例如 `vS0002-1`
   - **Release title**: 輸入標題，例如 `vS0002-1 - 性能優化與UI改進`
   - **Description**: 複製 `RELEASE_NOTES.md` 的內容到這裡，或者直接寫入更新說明
5. 可選：附加文件（見步驟 3）
6. 點擊 **"Publish release"**

### 方法二：使用 GitHub CLI

```bash
# 使用 GitHub CLI 創建 Release
gh release create vS0002-1 \
  --title "vS0002-1 - 性能優化與UI改進" \
  --notes-file RELEASE_NOTES.md \
  --target master
```

### 方法三：使用 Git 命令（需要配置 GitHub API）

如果您使用 GitHub API，可以通過 API 創建 Release 並附加文件。

## 步驟 3：附加版本文件到 Release

### 通過 Web 界面附加文件

1. 在創建或編輯 Release 頁面，向下滾動到 **"Attach binaries"** 區域
2. 將以下文件拖放到該區域：
   - `RELEASE_NOTES.md`
   - `CHANGELOG.md`
   - `README_VERSION.md`
3. 文件將被附加到 Release，用戶可以下載

### 使用 GitHub CLI 附加文件

```bash
# 創建 Release 並附加文件
gh release create vS0002-1 \
  --title "vS0002-1 - 性能優化與UI改進" \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target master
```

### 使用 GitHub API 附加文件

```bash
# 1. 創建 Release（獲取 Release ID）
RELEASE_ID=$(gh api repos/:owner/:repo/releases \
  --method POST \
  --field tag_name="vS0002" \
  --field name="vS0002 - 歷史收益增強與系統診斷改進" \
  --field body="$(cat RELEASE_NOTES.md)" \
  -q '.id')

# 2. 上傳文件
gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="RELEASE_NOTES.md" \
  --field label="Release Notes" \
  --raw-field data=@RELEASE_NOTES.md \
  --header "Content-Type: text/markdown"

gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="CHANGELOG.md" \
  --field label="Changelog" \
  --raw-field data=@CHANGELOG.md \
  --header "Content-Type: text/markdown"

gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="README_VERSION.md" \
  --field label="Version Details" \
  --raw-field data=@README_VERSION.md \
  --header "Content-Type: text/markdown"
```

## 步驟 4：自動化腳本（可選）

您可以創建一個腳本來自動化 Release 創建過程：

```bash
#!/bin/bash
# create_release.sh

VERSION="vS0002"
REPO_OWNER="YOUR_USERNAME"
REPO_NAME="YOUR_REPO"

# 創建 Release
gh release create $VERSION \
  --title "$VERSION - 歷史收益增強與系統診斷改進" \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target master

echo "Release $VERSION created successfully!"
```

使用方式：
```bash
chmod +x create_release.sh
./create_release.sh
```

## 推薦的 Release 說明格式

在 GitHub Release 的 Description 欄位中，建議使用以下格式：

```markdown
## 🎉 版本 vS0002

### ✨ 主要更新

- 歷史收益記錄增強（新增多個欄位）
- 系統診斷功能全面改進
- 模態窗口統一支援拖曳功能

### 📝 詳細說明

[此處可以簡要說明，或引導用戶查看附件文件]

### 📎 相關文件

- [Release Notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)
- [Version Details](README_VERSION.md)
```

## 注意事項

1. **文件大小限制**：GitHub Release 附件大小限制為 2GB，但對於文本文件（如 .md）通常不是問題
2. **文件格式**：建議使用 Markdown 格式（.md），GitHub 會自動渲染
3. **版本標籤**：確保 Git 標籤已經推送到 GitHub（`git push origin vS0002`）
4. **權限要求**：您需要對倉庫有寫入權限才能創建 Release

## 驗證 Release

創建 Release 後，訪問以下 URL 驗證：

```
https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/vS0002
```

您應該能看到：
- Release 標題和說明
- 附加的文件列表
- 可以下載的文件連結





