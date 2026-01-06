const fs = require('fs');
const path = require('path');

// 要保護的批處理文件
const protectedFiles = [
  'setup-node.bat',
  'start-node.bat',
  'stop-node.bat'
];

// 正確的文件內容（UTF-8 編碼，CRLF 換行符）
const fileContents = {
  'setup-node.bat': `@echo off
chcp 65001 > nul
cd /d "%~dp0"
node setup.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause
`,
  'start-node.bat': `@echo off
chcp 65001 > nul
cd /d "%~dp0"
node start-node.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause
`,
  'stop-node.bat': `@echo off
chcp 65001 > nul
cd /d "%~dp0"
node stop-node.js
if errorlevel 1 (
    echo.
    echo 執行過程中發生錯誤，錯誤代碼: %errorlevel%
    pause
    exit /b %errorlevel%
)
pause
`
};

function protectFiles() {
  protectedFiles.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    const correctContent = fileContents[fileName];
    
    // 將 LF 轉換為 CRLF
    const content = correctContent.replace(/\n/g, '\r\n');
    
    // 檢查文件是否存在
    if (fs.existsSync(filePath)) {
      // 讀取當前文件內容
      const currentContent = fs.readFileSync(filePath, { encoding: 'utf8' });
      
      // 如果內容不同，恢復正確內容
      if (currentContent !== content) {
        console.log(`⚠️  ${fileName} 內容已變更，正在恢復...`);
        fs.writeFileSync(filePath, content, { encoding: 'utf8' });
        console.log(`✅ ${fileName} 已恢復`);
      }
    } else {
      // 如果文件不存在，創建它
      console.log(`⚠️  ${fileName} 不存在，正在創建...`);
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
      console.log(`✅ ${fileName} 已創建`);
    }
    
    // 設置文件為只讀（Windows）
    try {
      if (process.platform === 'win32') {
        const { execSync } = require('child_process');
        execSync(`attrib +R "${filePath}"`, { stdio: 'ignore' });
        console.log(`🔒 ${fileName} 已設置為只讀`);
      }
    } catch (error) {
      console.warn(`⚠️  無法設置 ${fileName} 為只讀: ${error.message}`);
    }
  });
  
  console.log('\n✅ 所有批處理文件已保護！');
}

protectFiles();

