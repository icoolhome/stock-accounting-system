# vS0008 Release

## 📦 版本資訊

- **版本號**: vS0008
- **發布日期**: 2026-01-13
- **發布類型**: Bug Fix

---

## 🐛 Bug 修復

### 1. 修復導入邏輯：避免銀行帳戶餘額重複計算

**問題描述**：
- 在「載入存檔（覆蓋）」功能中，導入銀行交易記錄和交割記錄時，系統會自動更新銀行帳戶餘額
- 但導入的銀行帳戶餘額已經是最終餘額（包含了所有銀行明細的影響）
- 導致餘額被重複計算，顯示錯誤的金額（例如：顯示 $2785348.00，實際應該是 $1392674.00）

**修復方案**：
- 在導入銀行交易記錄時，添加 `skipBalanceUpdate: true` 參數，跳過餘額更新
- 在導入交割記錄時，添加 `skipAutoBankTransaction: true` 參數，跳過自動創建銀行明細
- 確保導入的餘額不會被重複計算

**影響範圍**：
- `server/src/routes/bankTransactions.ts`：新增 `skipBalanceUpdate` 參數支持
- `server/src/routes/settlements.ts`：新增 `skipAutoBankTransaction` 參數支持
- `client/src/pages/Settings.tsx`：導入邏輯更新，傳遞跳過參數

**注意事項**：
- 如果您的數據已經被重複計算，請在「銀行帳戶管理」頁面手動編輯，將餘額修改為正確的值
- 之後再次導入數據時，不會再出現重複計算的問題

---

## 📋 技術細節

### 後端修改

#### bankTransactions.ts
- 新增 `skipBalanceUpdate` 參數
- 當 `skipBalanceUpdate` 為 `true` 時，跳過銀行帳戶餘額更新

#### settlements.ts
- 新增 `skipAutoBankTransaction` 參數
- 當 `skipAutoBankTransaction` 為 `true` 時，跳過自動創建銀行明細

### 前端修改

#### Settings.tsx
- 導入銀行交易記錄時，傳遞 `skipBalanceUpdate: true`
- 導入交割記錄時，傳遞 `skipAutoBankTransaction: true`

---

## ✅ 測試建議

1. 導出完整系統備份
2. 清空數據庫或使用新的數據庫
3. 載入存檔（覆蓋）
4. 檢查銀行帳戶餘額是否正確（不應該被重複計算）
5. 驗證銀行交易記錄和交割記錄是否正確導入

---

## 📝 相關文件

- 修復的導入邏輯相關文件：
  - `server/src/routes/bankTransactions.ts`
  - `server/src/routes/settlements.ts`
  - `client/src/pages/Settings.tsx`

---

## 🙏 感謝

感謝用戶反饋此問題，讓我們能夠及時修復導入邏輯中的餘額計算錯誤。







