# 修復 start.bat 編碼問題

如果 `start.bat` 文件顯示亂碼，請按照以下步驟修復：

## 方法 1：使用記事本修復（推薦）

1. **右鍵點擊 `start.bat` 文件**
2. **選擇「開啟」→「記事本」**（或直接用記事本打開）
3. **在記事本中，點擊「檔案」→「另存為」**
4. **在「編碼」下拉選單中，選擇「ANSI」**
   - **重要**：不要選擇「UTF-8」或其他編碼，必須選擇「ANSI」
5. **點擊「儲存」**
6. **如果提示檔案已存在，選擇「是」覆蓋**

完成後，`start.bat` 文件應該可以正確顯示中文。

## 方法 2：使用 PowerShell 修復

如果您熟悉 PowerShell，可以執行以下命令：

```powershell
$content = Get-Content start.bat -Raw -Encoding UTF8
$ansi = [System.Text.Encoding]::Default
$bytes = $ansi.GetBytes($content)
[System.IO.File]::WriteAllBytes('start.bat', $bytes)
```

## 說明

- Windows 批處理文件（.bat）需要使用 **ANSI 編碼**才能正確顯示中文
- 在中文 Windows 系統中，ANSI 編碼對應 **GBK/GB2312**
- 文件開頭的 `chcp 936` 命令會設置代碼頁為 GBK，確保中文正確顯示


