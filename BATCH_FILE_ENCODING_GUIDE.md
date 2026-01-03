# Windows 批處理文件中文編碼指南

## 問題
Windows 批處理文件（.bat）要在命令提示字元中正確顯示中文，必須使用 **ANSI/GBK 編碼**，而不是 UTF-8。

## 解決方法

### 使用 Node.js 和 iconv-lite 創建正確編碼的批處理文件

**關鍵步驟**：
1. 使用 `server/node_modules/iconv-lite` 模組
2. 將 UTF-8 字符串轉換為 GBK 編碼
3. 使用 `\r\n` 作為換行符（Windows 標準）
4. 寫入文件時使用 Buffer，而不是字符串

**示例代碼**：

```javascript
const fs = require('fs');
const iconv = require('./server/node_modules/iconv-lite');

// 準備文件內容（使用 \r\n 作為換行符）
const lines = [
  '@echo off',
  'chcp 936 >nul 2>&1',
  'echo 中文內容',
  // ... 更多行
];

const content = lines.join('\r\n') + '\r\n';

// 轉換為 GBK 編碼
const gbkBuffer = iconv.encode(content, 'gbk');

// 寫入文件
fs.writeFileSync('start.bat', gbkBuffer);
```

## 重要注意事項

1. **編碼**：必須使用 GBK/GB2312 編碼，在 Windows 中文系統中對應 ANSI
2. **換行符**：必須使用 `\r\n`（Windows 標準），而不是 `\n`
3. **文件開頭**：添加 `chcp 936` 設置代碼頁為 GBK
4. **變數擴展**：使用 `setlocal enabledelayedexpansion` 和 `!var!` 語法處理變數

## 驗證方法

文件創建後，在命令提示字元中運行：
```cmd
chcp 936
type start.bat
```

應該能正確顯示中文內容。

## 其他方法

如果 Node.js 方法不可用，可以使用：
- **Notepad++**：編碼 → 轉換為 ANSI 編碼
- **記事本**：另存為 → 編碼選擇「ANSI」
- **PowerShell**：使用 `[System.Text.Encoding]::Default` 編碼

