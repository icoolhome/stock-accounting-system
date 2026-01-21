# vS0009 Release

## 📦 版本資訊

- **版本號**: vS0009
- **發布日期**: 2026-01-21
- **發布類型**: Feature Update & Bug Fix

---

## ✨ 主要更新

### 1. 分頁顯示選項優化

**變更內容**：
- 所有頁面的「每頁顯示」選項統一改為：**50、100、200、500**
- 預設頁面大小改為 **50**
- 適用於以下頁面：
  - 庫存管理（主表與明細表）
  - 交易記錄
  - 銀行帳戶管理（帳戶列表與交易列表）
  - 交割管理
  - 歷史收益
  - 投資組合
  - 後台管理（用戶列表與日誌）

**影響範圍**：
- `client/src/pages/Holdings.tsx`
- `client/src/pages/Transactions.tsx`
- `client/src/pages/BankAccounts.tsx`
- `client/src/pages/Admin.tsx`
- `client/src/pages/Settlements.tsx`
- `client/src/pages/Dividends.tsx`
- `client/src/pages/Portfolio.tsx`

---

### 2. 上櫃股票價格獲取修復

**問題描述**：
- 上櫃股票（如 3323、3402）無法正確顯示即時價格和收盤價
- Yahoo Finance API 查詢時使用了錯誤的股票代碼格式（`.TW` 而非 `.TWO`）

**修復方案**：
- 修正 Yahoo Finance API 查詢邏輯，根據市場別正確使用 `.TW`（上市）或 `.TWO`（上櫃）
- 確保上櫃股票能正確獲取即時價格和收盤價

**影響範圍**：
- `server/src/routes/holdings.ts`：`fetchPricesFromYahoo` 函數

---

### 3. 可用餘額計算邏輯修正

**問題描述**：
- 銀行帳戶管理中的「可用餘額」計算邏輯錯誤
- 交割金額為正數時，應該增加可用餘額，但系統卻減少了

**修復方案**：
- 修正可用餘額計算公式：**可用餘額 = 銀行餘額 + 交割金額**
  - 交割金額為**正數**：可用餘額增加（加上去）
  - 交割金額為**負數**：可用餘額減少（減掉該金額）
- 欄位名稱改為「可用餘額(交割)」以明確表示含交割計算

**影響範圍**：
- `server/src/routes/bankAccounts.ts`：可用餘額計算邏輯
- `client/src/pages/BankAccounts.tsx`：欄位名稱更新

---

### 4. 價格來源標記顯示優化

**變更內容**：
- 庫存管理頁面顯示價格來源標記：
  - ⚡即時：盤中即時價格
  - 📊收盤：收盤後使用收盤價
  - ✏️手動：手動設置的價格
- 即使 `price_source` 為空，也會顯示默認的「📊收盤」標記
- 添加時間顯示（例如：下午 08:30）

**影響範圍**：
- `server/src/routes/holdings.ts`：確保 `price_source` 和 `price_updated_at` 正確設置
- `client/src/pages/Holdings.tsx`：價格來源標記顯示邏輯

---

## 🐛 Bug 修復

### 1. 修復 TypeScript 編譯錯誤

- 修復 `fetchPricesFromYahoo` 函數中的 TypeScript 類型錯誤
- 將 `data` 標記為 `any` 類型以解決類型推斷問題

### 2. 修復價格獲取邏輯

- 確保上櫃股票使用正確的 Yahoo Finance 查詢格式（`.TWO`）
- 修正市場別判斷邏輯，避免上櫃股票被誤判為上市股票

---

## 📋 技術細節

### 後端修改

#### holdings.ts
- 修正 `fetchPricesFromYahoo` 函數，根據市場別使用正確的股票代碼格式
- 確保 `price_source` 和 `price_updated_at` 正確設置
- 添加調試日誌，特別針對 3323 和 3402 股票

#### bankAccounts.ts
- 修正可用餘額計算公式：`availableBalance = cashBalance + totalPendingAmount`
- 更新註釋說明交割金額的正負號邏輯

### 前端修改

#### Holdings.tsx
- 移除 `price_source` 條件判斷，確保所有價格都顯示來源標記
- 預設顯示「📊收盤」標記（當 `price_source` 不是 'realtime' 或 'manual' 時）

#### BankAccounts.tsx
- 欄位名稱從「可用餘額」改為「可用餘額(交割)」

#### 所有分頁相關頁面
- 統一「每頁顯示」選項為：50、100、200、500
- 預設頁面大小改為 50

---

## ✅ 測試建議

1. **分頁功能測試**：
   - 檢查所有頁面的「每頁顯示」選項是否正確顯示 50、100、200、500
   - 驗證預設頁面大小是否為 50

2. **上櫃股票價格測試**：
   - 在庫存管理頁面按「更新市價」
   - 檢查上櫃股票（如 3323、3402）是否正確顯示價格和來源標記

3. **可用餘額測試**：
   - 檢查銀行帳戶管理中的「可用餘額(交割)」是否正確計算
   - 驗證交割金額為正數時，可用餘額是否增加

4. **價格來源標記測試**：
   - 檢查庫存管理頁面是否正確顯示價格來源標記（⚡即時、📊收盤、✏️手動）
   - 驗證時間是否正確顯示

---

## 📝 相關文件

- 修改的文件：
  - `server/src/routes/holdings.ts`
  - `server/src/routes/bankAccounts.ts`
  - `client/src/pages/Holdings.tsx`
  - `client/src/pages/BankAccounts.tsx`
  - `client/src/pages/Transactions.tsx`
  - `client/src/pages/Admin.tsx`
  - `client/src/pages/Settlements.tsx`
  - `client/src/pages/Dividends.tsx`
  - `client/src/pages/Portfolio.tsx`
  - `README.md`
  - `RELEASE_NOTES.md`

---

## 🚀 升級說明

從 vS0008 升級：
1. 無需手動數據遷移
2. 建議清除瀏覽器緩存（Ctrl + F5）以確保顯示正確
3. 如果上櫃股票價格顯示異常，請按「更新市價」重新獲取

---

## 🙏 感謝

感謝用戶反饋上櫃股票價格獲取問題和可用餘額計算錯誤，讓我們能夠及時修復這些問題。

---

**發布日期**: 2026-01-21
**版本號**: vS0009

