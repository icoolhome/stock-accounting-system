# GitHub Release vS0005 創建指南

## 📦 版本資訊

- **版本號**: vS0005
- **發布日期**: 2026-01-08
- **Tag 名稱**: vS0005

---

## 🚀 創建 GitHub Release 步驟

### 方法一：使用 GitHub Web 界面（推薦）

1. **訪問 GitHub 倉庫**
   - 前往您的 GitHub 倉庫頁面
   - 點擊右側的 **"Releases"** 或直接訪問：`https://github.com/YOUR_USERNAME/YOUR_REPO/releases`

2. **創建新 Release**
   - 點擊 **"Draft a new release"** 或 **"Create a new release"**

3. **填寫 Release 資訊**
   
   **Tag version**:
   ```
   vS0005
   ```
   
   **Release title**:
   ```
   vS0005 - 持有成本顯示優化與使用指南增強
   ```
   
   **Description** (複製以下內容):
   ```markdown
   ## 🎯 vS0005 版本更新
   
   ### ✨ 主要更新
   
   - ✅ **持有成本顯示優化**：國內股票庫存明細中所有持有成本自動四捨五入到整數顯示
   - ✅ **使用指南增強**：新增第7步驟（讚賞碼區域 + 聯絡 email）
   - ✅ **Node.js 中文支援**：所有腳本添加 UTF-8 編碼支援
   - ✅ **桌面捷徑改進**：改為手動建立提示，提供詳細說明
   
   ### 🐛 Bug 修復
   
   - 修復持有成本顯示小數點問題（如 `62254.99` → `62255`）
   - 修復累加計算時的浮點數精度誤差
   - 修復後端持有成本計算未正確四捨五入
   
   ### 📝 使用說明
   
   - 持有成本自動顯示為整數（無小數點）
   - 使用指南第7步驟包含聯絡 email：icoolhome001@gmail.com
   - 桌面捷徑建立方式請參考安裝說明
   
   ### 📚 詳細文件
   
   完整的更新記錄請查看：
   - [RELEASE_vS0005.md](./RELEASE_vS0005.md)
   - [RELEASE_NOTES.md](./RELEASE_NOTES.md)
   - [安裝說明.md](./安裝說明.md)
   
   ### ⚠️ 升級注意
   
   - 建議重新執行 `setup-node.bat` 更新系統
   - 升級後請清除瀏覽器緩存（Ctrl + F5）
   - 本次更新不影響數據結構
   
   ---
   
   **聯絡方式**: icoolhome001@gmail.com
   ```

4. **附加文件（可選）**
   - 可以附加以下文件：
     - `RELEASE_vS0005.md`
     - `RELEASE_NOTES.md`
     - `GITHUB_RELEASE_vS0005.md`

5. **發布 Release**
   - 點擊 **"Publish release"**

---

### 方法二：使用 GitHub CLI

```bash
# 確保已安裝 GitHub CLI (gh)
# 如果未安裝：https://cli.github.com/

# 創建 Release
gh release create vS0005 \
  --title "vS0005 - 持有成本顯示優化與使用指南增強" \
  --notes-file GITHUB_RELEASE_vS0005.md \
  --target main

# 或附加文件
gh release create vS0005 \
  --title "vS0005 - 持有成本顯示優化與使用指南增強" \
  --notes-file GITHUB_RELEASE_vS0005.md \
  RELEASE_vS0005.md \
  RELEASE_NOTES.md \
  GITHUB_RELEASE_vS0005.md \
  --target main
```

---

### 方法三：使用 PowerShell 腳本

執行 `create_release.ps1`（需要先更新版本號）：

```powershell
cd F:\stock-ai\stock-accounting-system
.\create_release.ps1
```

---

## 📋 檢查清單

在創建 Release 前，請確認：

- [ ] 所有代碼已提交並推送到 GitHub
- [ ] `RELEASE_vS0005.md` 文件已更新
- [ ] `RELEASE_NOTES.md` 文件已更新
- [ ] `GITHUB_RELEASE_vS0005.md` 文件已準備
- [ ] `README.md` 文件已更新版本號
- [ ] `package.json` 版本號已更新為 vS0005
- [ ] 所有修改已測試通過

---

## 🔍 驗證 Release

創建完成後，訪問以下 URL 驗證：

```
https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/vS0005
```

---

## 📝 Release 說明模板

如果使用 Web 界面，可以直接複製以下內容作為 Release Description：

```markdown
## 🎯 vS0005 版本更新

### ✨ 主要更新

#### 1. 持有成本顯示優化
- ✅ 國內股票庫存明細中所有持有成本自動四捨五入到整數顯示
- ✅ 每一行明細、小計、總計都正確顯示為整數（無小數點）
- ✅ 後端計算邏輯優化，確保精度處理正確

#### 2. 使用指南增強
- ✅ 新增第7步驟：讚賞碼區域
- ✅ 在「感謝您的使用，如有任何問題歡迎聯繫我們」右邊添加 email 連結
- ✅ Email：icoolhome001@gmail.com（可點擊發送郵件）

#### 3. Node.js 中文支援
- ✅ 所有 Node.js 腳本添加 UTF-8 編碼支援
- ✅ 確保中文輸出正確顯示（無亂碼）

#### 4. 桌面捷徑建立
- ✅ 改為提示用戶手動建立桌面捷徑
- ✅ 提供詳細的手動建立說明（兩種方法）

### 🐛 Bug 修復

- 修復持有成本顯示小數點問題（如 `62254.99` → `62255`）
- 修復累加計算時的浮點數精度誤差
- 修復後端持有成本計算未正確四捨五入

### 📝 升級說明

1. 執行 `stop-node.bat` 停止服務
2. 執行 `setup-node.bat` 更新系統
3. 執行 `start-node.bat` 重新啟動
4. 清除瀏覽器緩存（Ctrl + F5）

### 📚 詳細文件

- [RELEASE_vS0005.md](./RELEASE_vS0005.md) - 完整版本說明
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) - 版本更新記錄
- [安裝說明.md](./安裝說明.md) - 安裝與使用指南

---

**聯絡方式**: icoolhome001@gmail.com
```

---

## ✅ 完成

創建 Release 後，用戶就可以從 GitHub Releases 頁面下載最新版本了！



