# vS0006 Release Summary

## 📦 版本資訊
- **版本號**: vS0006
- **發布日期**: 2026-01-09
- **發布類型**: Feature Update & UX Improvement

## 🎯 主要變更摘要

### 核心功能
1. **智能價格獲取策略** - 根據交易時間自動切換數據來源
2. **使用指南改進** - 新增讚賞碼圖片，只顯示一次
3. **登入提示優化** - 默認管理員帳號提示只顯示一次
4. **價格來源顯示** - 庫存頁面顯示價格來源和更新時間

## 📄 相關文檔
- `RELEASE_vS0006.md` - 完整發佈說明（詳細版）
- `GITHUB_RELEASE_vS0006.md` - GitHub Release 說明（簡潔版）

## 🚀 創建 GitHub Release 步驟

### 方法一：使用 GitHub Web 介面

1. 前往 GitHub 倉庫：https://github.com/[your-repo]/stock-accounting-system
2. 點擊右側 "Releases" → "Draft a new release"
3. 填寫以下資訊：
   - **Tag**: `vS0006`
   - **Title**: `vS0006 - 智能價格獲取與用戶體驗改進`
   - **Description**: 複製 `GITHUB_RELEASE_vS0006.md` 的內容
4. 選擇 "Set as the latest release"
5. 點擊 "Publish release"

### 方法二：使用 GitHub CLI

```bash
# 確保已安裝 GitHub CLI (gh)
gh release create vS0006 \
  --title "vS0006 - 智能價格獲取與用戶體驗改進" \
  --notes-file GITHUB_RELEASE_vS0006.md \
  --latest
```

### 方法三：使用 Git 標籤

```bash
# 添加並提交變更
git add .
git commit -m "Release vS0006: 智能價格獲取與用戶體驗改進"

# 創建標籤
git tag -a vS0006 -m "vS0006 - 智能價格獲取與用戶體驗改進"

# 推送標籤到遠端
git push origin vS0006
git push origin main
```

然後在 GitHub Web 介面創建 Release。

## ✅ 發布前檢查清單

- [x] 所有代碼已編譯（前端和後端）
- [x] Release 文檔已創建
- [x] 變更已測試
- [ ] Git 變更已提交
- [ ] Git 標籤已創建
- [ ] GitHub Release 已創建

## 📝 Release Notes 快速參考

### 新功能
- 智能價格獲取策略（盤中即時 / 盤後收盤價）
- 使用指南讚賞碼圖片顯示
- 默認管理員帳號提示優化
- 價格來源和更新時間顯示

### Bug 修復
- 盤後價格數據源問題
- 使用指南顯示邏輯

### 改進
- 動態緩存策略
- 用戶體驗優化

---

**建立日期**: 2026-01-09





