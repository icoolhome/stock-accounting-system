# 股票記帳系統

一個功能完整的台股記帳系統，支援多帳戶管理、交易記錄、庫存管理、投資組合分析等功能。

## 主要功能

- 📊 投資組合儀表板
- 📈 交易記錄管理
- 💰 庫存管理與盈虧計算
- 🏦 銀行帳戶管理
- 📋 交割記錄管理
- 💵 歷史收益追蹤
- 📱 個股查詢功能
- ⚙️ 系統設定與帳戶管理

## 技術架構

- **前端**: React + TypeScript + Vite + Tailwind CSS
- **後端**: Node.js + Express + TypeScript
- **資料庫**: SQLite（輕量級，無需額外安裝）

## 專案結構

```
stock-accounting-system/
├── client/                    # 前端應用
│   ├── src/
│   │   ├── components/        # React 組件
│   │   ├── pages/            # 頁面組件
│   │   │   ├── Dashboard.tsx      # 儀表板
│   │   │   ├── Holdings.tsx       # 庫存管理
│   │   │   ├── Transactions.tsx   # 交易記錄
│   │   │   ├── Portfolio.tsx      # 投資組合
│   │   │   └── ...
│   │   ├── contexts/         # React Context
│   │   └── utils/            # 工具函數
│   ├── public/               # 靜態資源
│   └── package.json
│
├── server/                   # 後端服務
│   ├── src/
│   │   ├── routes/           # API 路由
│   │   │   ├── holdings.ts        # 庫存相關 API
│   │   │   ├── transactions.ts    # 交易相關 API
│   │   │   ├── settings.ts        # 設定相關 API
│   │   │   └── ...
│   │   ├── jobs/             # 定時任務
│   │   ├── middleware/       # 中間件
│   │   └── utils/            # 工具函數
│   ├── database.sqlite       # SQLite 資料庫
│   └── package.json
│
├── setup-node.bat           # 自動安裝腳本
├── start-node.bat           # 啟動腳本
├── stop-node.bat            # 停止腳本
├── setup.js                 # Node.js 安裝邏輯
├── start-node.js            # 啟動邏輯
├── stop-node.js             # 停止邏輯
│
├── 安裝說明.md              # 安裝與使用指南
├── RELEASE_NOTES.md         # 版本更新記錄
├── README.md                # 本文件
└── package.json             # 專案配置
```

## 快速開始

### 自動安裝
執行 `setup-node.bat` 即可自動完成：
- Node.js 安裝（如未安裝）
- 所有依賴安裝
- 後端編譯
- 桌面捷徑建立

### 啟動系統
執行桌面的「股票記帳系統 - 啟動」捷徑，或執行 `start-node.bat`

### 停止系統
執行桌面的「股票記帳系統 - 停止」捷徑，或執行 `stop-node.bat`

## 詳細說明

詳細的安裝與使用說明請參考：
- [安裝說明.md](./安裝說明.md) - 完整的安裝與使用指南
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) - 版本更新記錄

## 版本資訊

**當前版本**: vS0005

### vS0005 主要更新

- ✨ **持有成本整數顯示優化**
  - 國內股票庫存明細中所有持有成本自動四捨五入到整數
  - 每一行明細、小計、總計都正確顯示為整數（無小數點）

- ✨ **使用指南增強**
  - 新增第7步驟：讚賞碼區域
  - 新增聯絡 Email：icoolhome001@gmail.com（可點擊發送郵件）

- 🐛 **Bug 修復**
  - 修復持有成本顯示小數點問題（如 `62254.99` → `62255`）
  - 修復持有成本小計和總計未正確四捨五入的問題
  - 優化 Node.js 腳本中文顯示支援

- 📝 **文檔更新**
  - 更新庫存管理頁面備註說明，詳細解釋盈虧計算公式
  - 更新安裝說明文件，包含完整的計算邏輯說明

詳細版本更新記錄請查看 [RELEASE_NOTES.md](./RELEASE_NOTES.md)

## 系統需求

- Windows 10/11
- Node.js v18 或以上（系統會自動安裝）
- Chrome / Edge / Firefox 瀏覽器

## 聯絡資訊

如有任何問題，歡迎聯繫：icoolhome001@gmail.com

## 授權

MIT License
