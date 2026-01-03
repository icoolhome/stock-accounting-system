# 安裝與使用說明

## 前置需求

- Node.js 18.0 或更高版本
- npm 或 yarn

## 安裝步驟

### 1. 安裝所有依賴套件

在專案根目錄執行：

```bash
npm run install:all
```

這會自動安裝根目錄、server 和 client 的所有依賴。

### 2. 設定環境變數

複製後端的環境變數範例文件：

```bash
cd server
copy .env.example .env
```

編輯 `.env` 文件，設定以下變數：

```
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
DB_PATH=./database.sqlite
```

**重要**：在生產環境中，請將 `JWT_SECRET` 改為強密碼。

### 3. 啟動系統

**方法 1：使用 start.bat（推薦，適用於生產環境）**

在專案根目錄雙擊執行 `start.bat`，或使用命令列：

```bash
start.bat
```

這會：
- 自動檢查是否需要建置
- 啟動後端 API 伺服器（端口 3001）
- 啟動前端預覽服務器（端口 3000）
- 自動打開瀏覽器到 http://localhost:3000

**⚠️ 重要提示：**
- 啟動後會開啟兩個服務器窗口
- **「股票記帳系統 - 伺服器」窗口不能關閉**（後端 API）
- **「股票記帳系統 - 客戶端」窗口不能關閉**（前端服務器）
- 關閉任一窗口都會導致系統無法正常使用

**方法 2：使用 npm run dev（開發模式）**

```bash
npm run dev
```

這會同時啟動：
- 後端 API 伺服器：http://localhost:3001
- 前端開發伺服器：http://localhost:3000

### 4. 訪問應用程式

**初始訪問網址：**
```
http://localhost:3000
```

這是系統的主要入口網址。

**系統端口說明：**
- **前端應用**：http://localhost:3000（用戶介面）
- **後端 API**：http://localhost:3001（API 服務，前端自動連接）

## 功能說明

### 已實作功能

1. **用戶認證系統**
   - 用戶註冊（郵箱 + 密碼，8-12位）
   - 用戶登入
   - JWT Token 認證

2. **證券帳戶管理**（您引用的功能）
   - 新增證券帳戶（帳戶名稱、券商名稱、帳戶號碼）
   - 查看所有證券帳戶
   - 編輯證券帳戶
   - 刪除證券帳戶（含確認提示）

3. **基礎架構**
   - 資料庫模型（用戶、證券帳戶、交易記錄、銀行帳戶、庫存）
   - RESTful API 架構
   - 前端路由和佈局

### 待實作功能

根據您的需求文件，以下功能尚未實作，但資料庫結構已準備好：

- 交易記錄管理
- 交割管理
- 銀行帳戶管理
- 庫存管理
- 投資組合分析
- 圖表分析
- 歷史收益記錄
- 系統設定（API設定、幣別設定等）
- 後台管理

## 資料庫結構

系統使用 SQLite 資料庫，資料庫文件會自動創建在 `server/database.sqlite`。

主要資料表：
- `users` - 用戶資料
- `securities_accounts` - 證券帳戶
- `transactions` - 交易記錄
- `bank_accounts` - 銀行帳戶
- `holdings` - 庫存

## API 端點

### 認證
- `POST /api/auth/register` - 註冊
- `POST /api/auth/login` - 登入

### 證券帳戶
- `GET /api/securities-accounts` - 獲取所有帳戶
- `GET /api/securities-accounts/:id` - 獲取單個帳戶
- `POST /api/securities-accounts` - 新增帳戶
- `PUT /api/securities-accounts/:id` - 更新帳戶
- `DELETE /api/securities-accounts/:id` - 刪除帳戶

所有證券帳戶相關 API 都需要認證（Bearer Token）。

## 開發說明

### 僅啟動後端
```bash
npm run dev:server
```

### 僅啟動前端
```bash
npm run dev:client
```

### 建置生產版本
```bash
npm run build
```

## 技術棧

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **後端**: Node.js + Express + TypeScript
- **資料庫**: SQLite
- **認證**: JWT (jsonwebtoken)
- **密碼加密**: bcryptjs

## 注意事項

1. 開發環境使用 SQLite，生產環境建議使用 PostgreSQL 或 MySQL
2. JWT Secret 在生產環境中必須更改
3. 密碼長度限制為 8-12 位（根據需求文件）
4. 所有 API 請求（除登入/註冊外）都需要在 Header 中帶上 `Authorization: Bearer <token>`


