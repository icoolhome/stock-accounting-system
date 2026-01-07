// 設置 UTF-8 編碼支持中文
if (process.platform === 'win32') {
  process.env.CHCP = '65001';
  // 設置控制台輸出編碼
  try {
    require('child_process').execSync('chcp 65001 > nul', { stdio: 'ignore' });
  } catch (e) {
    // 忽略錯誤
  }
}

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// 中文化輸出
const logInfo = (msg) => console.log(`[INFO] ${msg}`);
const logSuccess = (msg) => console.log(`[成功] ${msg}`);
const logError = (msg) => console.log(`[錯誤] ${msg}`);
const logWarn = (msg) => console.log(`[警告] ${msg}`);

// 統一設置子進程編碼選項
const execOptions = (options = {}) => {
  return {
    encoding: 'utf8',
    ...options,
    env: {
      ...process.env,
      CHCP: '65001',
      ...(options.env || {})
    }
  };
};

// 檢查命令是否可用
function checkCommand(command) {
  try {
    execSync(`${command} --version`, execOptions({ stdio: 'ignore' }));
    return true;
  } catch {
    return false;
  }
}

// 帶重試的檢查命令
function checkCommandWithRetry(command, maxRetries = 10, delay = 2000) {
  return new Promise((resolve) => {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (checkCommand(command)) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (attempts >= maxRetries) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, delay);
  });
}

// 下載文件
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 處理重定向
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// 使用 Chocolatey 安裝 Node.js
async function installWithChocolatey() {
  try {
    logInfo('正在使用 Chocolatey 安裝 Node.js LTS 版本...');
    logWarn('此操作可能需要管理員權限');
    console.log();
    
      execSync('choco install nodejs-lts -y', execOptions({
        stdio: 'inherit',
        shell: true
      }));
    
    return true;
  } catch (error) {
    logError(`Chocolatey 安裝失敗: ${error.message}`);
    return false;
  }
}

// 下載並安裝 Node.js
async function installNodeJs() {
  logInfo('Node.js 未安裝');
  logInfo('正在啟動 Node.js 自動安裝程序...');
  console.log();

  // 嘗試使用 Chocolatey 安裝
  if (checkCommand('choco')) {
    logInfo('偵測到 Chocolatey，使用 Chocolatey 安裝 Node.js LTS 版本...');
    logWarn('此操作可能需要管理員權限');
    console.log();
    const success = await installWithChocolatey();
    if (success) {
      logInfo('等待 PATH 環境變數更新...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 等待 PATH 更新
      if (await checkCommandWithRetry('node', 10, 2000)) {
        logSuccess('Node.js 已成功安裝並在 PATH 中');
        return true;
      } else {
        logWarn('Node.js 已通過 Chocolatey 安裝，但未在 PATH 中找到。請重啟終端或電腦。');
        return false;
      }
    }
  }

  // 回退到下載安裝程序
  logInfo('正在下載 Node.js 安裝程序...');
  logInfo('請稍候，這可能需要幾分鐘...');
  console.log();

  const tempDir = path.join(os.tmpdir(), 'stock-accounting-setup');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const installerPath = path.join(tempDir, 'nodejs-installer.msi');
  const nodeUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  const logFilePath = path.join(tempDir, 'nodejs-install.log');

  try {
    logInfo(`正在從 ${nodeUrl} 下載...`);
    await downloadFile(nodeUrl, installerPath);
    logSuccess('下載完成');
    console.log();

    logInfo('正在啟動安裝程序...');
    logInfo('請按照安裝嚮導的指示操作。');
    logInfo(`安裝日誌將保存到: ${logFilePath}`);
    console.log();

    // 使用 /qn 進行靜默安裝（無需用戶交互）
    execSync(`msiexec /i "${installerPath}" /qn /l*v "${logFilePath}"`, execOptions({
      stdio: 'inherit',
      shell: true
    }));

    // 清理
    if (fs.existsSync(installerPath)) {
      fs.unlinkSync(installerPath);
    }

    logSuccess('Node.js 安裝程序已執行。');
    logInfo('等待 Node.js 在 PATH 中可用...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 等待 10 秒
    
    if (await checkCommandWithRetry('node', 10, 2000)) {
      logSuccess('Node.js 已成功安裝並在 PATH 中');
      return true;
    } else {
      logError('Node.js 安裝完成但未在 PATH 中找到。請重啟終端或電腦。');
      logInfo(`安裝日誌位置: ${logFilePath}`);
      return false;
    }
  } catch (error) {
    logError(`下載或安裝 Node.js 失敗: ${error.message}`);
    logInfo('請從以下網址手動下載並安裝 Node.js:');
    logInfo('https://nodejs.org/');
    
    // 清理
    if (fs.existsSync(installerPath)) {
      try {
        fs.unlinkSync(installerPath);
      } catch (e) {
        // 忽略清理錯誤
      }
    }
    return false;
  }
}

// 檢查並安裝依賴
async function installDependencies() {
  logInfo('正在檢查項目依賴...');
  console.log();

  // 檢查根目錄依賴
  if (fs.existsSync(path.join(__dirname, 'package.json'))) {
    logInfo('安裝根目錄依賴...');
    try {
      execSync('npm install', execOptions({
        cwd: __dirname,
        stdio: 'inherit',
        shell: true
      }));
      logSuccess('根目錄依賴安裝完成');
    } catch (error) {
      logError(`根目錄依賴安裝失敗: ${error.message}`);
      return false;
    }
  }

  // 檢查 server 依賴
  const serverDir = path.join(__dirname, 'server');
  if (fs.existsSync(path.join(serverDir, 'package.json'))) {
    logInfo('安裝伺服器依賴...');
    try {
      execSync('npm install', execOptions({
        cwd: serverDir,
        stdio: 'inherit',
        shell: true
      }));
      logSuccess('伺服器依賴安裝完成');
    } catch (error) {
      logError(`伺服器依賴安裝失敗: ${error.message}`);
      return false;
    }
  }

  // 檢查 client 依賴
  const clientDir = path.join(__dirname, 'client');
  if (fs.existsSync(path.join(clientDir, 'package.json'))) {
    logInfo('安裝客戶端依賴...');
    try {
      execSync('npm install', execOptions({
        cwd: clientDir,
        stdio: 'inherit',
        shell: true
      }));
      logSuccess('客戶端依賴安裝完成');
    } catch (error) {
      logError(`客戶端依賴安裝失敗: ${error.message}`);
      return false;
    }
  }

  return true;
}

// 編譯服務器
async function buildServer() {
  const serverDir = path.join(__dirname, 'server');
  if (!fs.existsSync(path.join(serverDir, 'package.json'))) {
    return true; // 沒有 server 目錄，跳過
  }

  logInfo('正在編譯伺服器...');
  try {
    execSync('npm run build', execOptions({
      cwd: serverDir,
      stdio: 'inherit',
      shell: true
    }));
    logSuccess('伺服器編譯完成');
    return true;
  } catch (error) {
    logError(`伺服器編譯失敗: ${error.message}`);
    return false;
  }
}

// 顯示手動建立桌面捷徑的說明
async function createDesktopShortcuts() {
  logInfo('桌面捷徑建立說明');
  console.log();
  
  // 取得桌面路徑
  let desktopPath = path.join(os.homedir(), 'Desktop');
  if (!fs.existsSync(desktopPath)) {
    try {
      const psResult = execSync('powershell -Command "[Environment]::GetFolderPath(\'Desktop\')"', execOptions({
        stdio: 'pipe',
        shell: true
      })).trim();
      if (psResult && fs.existsSync(psResult)) {
        desktopPath = psResult;
      }
    } catch (e) {
      // 忽略錯誤
    }
  }

  const shortcuts = [
    {
      name: '股票記帳系統 - 啟動',
      target: path.join(__dirname, 'start-node.bat'),
      description: '啟動股票記帳系統'
    },
    {
      name: '股票記帳系統 - 停止',
      target: path.join(__dirname, 'stop-node.bat'),
      description: '停止股票記帳系統'
    },
    {
      name: '股票記帳系統 - 安裝',
      target: path.join(__dirname, 'setup-node.bat'),
      description: '安裝/更新股票記帳系統'
    }
  ];

  logInfo('請按照以下步驟手動建立桌面捷徑：');
  console.log();
  
  for (const shortcut of shortcuts) {
    if (fs.existsSync(shortcut.target)) {
      console.log(`【${shortcut.name}】`);
      console.log(`  1. 在檔案總管中找到: ${shortcut.target}`);
      console.log(`  2. 在檔案上按右鍵 → 選擇「傳送到」→「桌面 (建立捷徑)」`);
      console.log(`  3. 桌面上的捷徑會自動命名為「${path.basename(shortcut.target)} - 捷徑」`);
      console.log(`  4. 在捷徑上按右鍵 → 選擇「重新命名」→ 改為「${shortcut.name}」`);
      console.log();
    } else {
      logWarn(`⚠️  目標文件不存在: ${shortcut.target}`);
      console.log();
    }
  }

  logInfo('或者使用以下方法：');
  console.log();
  console.log('  方法二：使用快捷鍵');
  console.log('  1. 在檔案總管中找到目標 .bat 檔案');
  console.log('  2. 按住 Alt 鍵，拖曳檔案到桌面');
  console.log('  3. 系統會自動建立捷徑');
  console.log();
  
  if (fs.existsSync(desktopPath)) {
    logInfo('捷徑位置：');
    console.log(`  桌面路徑: ${desktopPath}`);
    console.log();
  }
  
  return true;
}

// 主程序
async function main() {
  console.log('='.repeat(60));
  console.log('股票記帳系統 - 自動安裝程序');
  console.log('='.repeat(60));
  console.log();

  // 檢查 Node.js
  logInfo('正在檢查 Node.js 安裝狀態...');
  if (!checkCommand('node')) {
    logWarn('Node.js 未安裝');
    const installed = await installNodeJs();
    if (!installed) {
      logError('Node.js 安裝失敗，無法繼續');
      process.exit(1);
    }
  } else {
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      logSuccess(`Node.js 已安裝: ${nodeVersion}`);
    } catch {
      logWarn('無法獲取 Node.js 版本');
    }
  }

  // 檢查 npm
  logInfo('正在檢查 npm 安裝狀態...');
  if (!checkCommand('npm')) {
    logError('npm 未安裝，這不正常（Node.js 通常包含 npm）');
    process.exit(1);
  } else {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      logSuccess(`npm 已安裝: ${npmVersion}`);
    } catch {
      logWarn('無法獲取 npm 版本');
    }
  }

  console.log();

  // 安裝依賴
  const depsInstalled = await installDependencies();
  if (!depsInstalled) {
    logError('依賴安裝失敗');
    process.exit(1);
  }

  console.log();

  // 編譯服務器
  const serverBuilt = await buildServer();
  if (!serverBuilt) {
    logWarn('服務器編譯失敗，但可以繼續（開發模式下不需要編譯）');
  }

  console.log();

  // 建立桌面捷徑
  await createDesktopShortcuts();

  console.log();
  console.log('='.repeat(60));
  logSuccess('安裝完成！');
  console.log('='.repeat(60));
  console.log();
  logInfo('請按照上述說明手動建立桌面捷徑');
  logInfo('建議建立以下三個捷徑：');
  logInfo('  📗 股票記帳系統 - 啟動');
  logInfo('  📕 股票記帳系統 - 停止');
  logInfo('  ⚙️  股票記帳系統 - 安裝');
  console.log();
  logInfo('建立完成後，雙擊「股票記帳系統 - 啟動」即可開始使用！');
  console.log();
}

main().catch((error) => {
  logError(`發生未預期的錯誤: ${error.message}`);
  console.error(error);
  process.exit(1);
});
