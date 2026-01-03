# 修復 start.bat 編碼問題 - 詳細指南

## 問題說明
由於編碼轉換問題，start.bat 文件中的中文字符無法正確顯示。

## 解決方法

### 方法 1：使用 Notepad++（推薦）

1. **下載並安裝 Notepad++**（如果還沒有）
   - 下載地址：https://notepad-plus-plus.org/

2. **使用 Notepad++ 打開 start.bat**
   - 右鍵點擊 `start.bat` → 選擇「Edit with Notepad++」

3. **轉換編碼**
   - 點擊頂部菜單「編碼」→「轉換為 ANSI 編碼」
   - 或者：點擊「編碼」→「字符集」→「中文」→「GB2312 (Simplified Chinese)」

4. **保存文件**
   - 按 Ctrl+S 或點擊「檔案」→「儲存」

### 方法 2：使用記事本（Windows 內建）

1. **右鍵點擊 start.bat**
2. **選擇「開啟」→「記事本」**
3. **點擊「檔案」→「另存為」**
4. **在「編碼」下拉選單中，選擇「ANSI」**
   - ⚠️ 重要：不要選擇「UTF-8」或其他編碼
5. **點擊「儲存」**
6. **如果提示文件已存在，選擇「是」覆蓋**

### 方法 3：使用 PowerShell 命令

在 PowerShell 中執行以下命令：

```powershell
cd F:\stock-ai\stock-accounting-system
$content = Get-Content start.bat -Raw -Encoding UTF8
$ansi = [System.Text.Encoding]::Default
$bytes = $ansi.GetBytes($content)
[System.IO.File]::WriteAllBytes('start.bat', $bytes)
```

## 驗證

修復後，請執行以下步驟驗證：

1. 雙擊運行 `start.bat`
2. 查看是否正確顯示中文
3. 如果仍然亂碼，請重複上述步驟

## 注意事項

- Windows 批處理文件（.bat）必須使用 **ANSI 編碼**才能正確顯示中文
- 在中文 Windows 系統中，ANSI 編碼對應 **GBK/GB2312**
- 文件開頭的 `chcp 936` 命令會設置代碼頁為 GBK，確保中文正確顯示

