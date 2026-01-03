# 故障排除指南

## 問題：網頁無法打開或 API 請求失敗

### 症狀
- 網頁可以打開但顯示錯誤
- 瀏覽器控制台顯示 `ECONNREFUSED` 錯誤
- API 請求失敗

### 原因
通常是因為：
1. **後端服務器（端口 3001）沒有啟動**
2. 前端服務器（端口 3000）已啟動，但無法連接到後端

### 解決方案

#### 方法 1：使用 start.bat 啟動（推薦）
```batch
start.bat
```
這會自動啟動前端和後端服務器。

#### 方法 2：手動啟動服務器

**步驟 1：啟動後端服務器**
```batch
cd server
npm start
```

**步驟 2：啟動前端服務器（新終端）**
```batch
cd client
npm run preview
```

#### 方法 3：檢查服務器狀態

**檢查端口是否被占用：**
```batch
netstat -ano | findstr ":3001"
netstat -ano | findstr ":3000"
```

**如果端口被占用，終止進程：**
```batch
taskkill /PID <進程ID> /F
```

### 常見問題

#### Q: 為什麼會有代理錯誤？
A: 前端服務器（3000）通過代理轉發 API 請求到後端（3001）。如果後端沒有運行，就會出現 `ECONNREFUSED` 錯誤。

#### Q: 如何確認服務器是否正常運行？
A: 
- 後端：訪問 http://localhost:3001/api/health（如果有這個端點）
- 前端：訪問 http://localhost:3000

#### Q: start.bat 啟動後服務器立即關閉？
A: 檢查：
1. server\dist\index.js 是否存在
2. client\dist 目錄是否存在
3. 查看錯誤訊息

### 正確的啟動順序

1. ✅ 確保已運行 `setup.bat` 或 `npm run install:all`
2. ✅ 運行 `start.bat`
3. ✅ 等待兩個服務器都啟動完成
4. ✅ 瀏覽器應該自動打開 http://localhost:3000

### 驗證步驟

1. **檢查後端服務器**：
   - 打開瀏覽器訪問 http://localhost:3001
   - 應該看到錯誤或 API 回應（不是連接失敗）

2. **檢查前端服務器**：
   - 打開瀏覽器訪問 http://localhost:3000
   - 應該看到應用界面

3. **檢查 API 連接**：
   - 打開瀏覽器開發者工具（F12）
   - 查看 Network 標籤
   - API 請求應該返回數據，而不是錯誤


