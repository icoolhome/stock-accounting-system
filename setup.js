#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`[INFO] ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`[SUCCESS] ${message}`, 'green');
}

function logError(message) {
  log(`[ERROR] ${message}`, 'red');
}

function logWarn(message) {
  log(`[WARN] ${message}`, 'yellow');
}

function checkCommand(command) {
  try {
    execSync(`where ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getNodeVersion() {
  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim();
    return version;
  } catch {
    return null;
  }
}

function getNpmVersion() {
  try {
    const version = execSync('npm --version', { encoding: 'utf-8' }).trim();
    return version;
  } catch {
    return null;
  }
}

function installDependencies(dir, name) {
  logInfo(`正在安裝 ${name} 依賴項目...`);
  try {
    execSync('npm install', {
      cwd: dir,
      stdio: 'inherit',
    });
    logSuccess(`${name} 依賴項目安裝成功`);
    return true;
  } catch (error) {
    logError(`${name} 依賴項目安裝失敗`);
    return false;
  }
}

function installWithChocolatey() {
  logInfo('偵測到 Chocolatey，使用 Chocolatey 安裝 Node.js LTS 版本...');
  logWarn('此操作可能需要管理員權限');
  console.log();
  
  return new Promise((resolve) => {
    const choco = spawn('choco', ['install', 'nodejs-lts', '-y'], {
      stdio: 'inherit',
      shell: true,
    });
    
    choco.on('close', (code) => {
      if (code === 0) {
        logSuccess('Node.js 已通過 Chocolatey 成功安裝');
        resolve(true);
      } else {
        logWarn('Chocolatey 安裝失敗');
        resolve(false);
      }
    });
    
    choco.on('error', (error) => {
      logError(`Chocolatey 執行錯誤: ${error.message}`);
      resolve(false);
    });
  });
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    logInfo(`Downloading from: ${url}`);
    logInfo(`Saving to: ${filepath}`);
    
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Handle redirect
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        logSuccess('Download completed');
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      reject(err);
    });
  });
}

async function checkCommandWithRetry(command, maxRetries = 10, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    if (checkCommand(command)) {
      return true;
    }
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function installNodeJs() {
  logInfo('Node.js 未安裝');
  logInfo('開始自動安裝 Node.js...');
  console.log();
  
  // Try Chocolatey first
  if (checkCommand('choco')) {
    logInfo('偵測到 Chocolatey，使用 Chocolatey 安裝 Node.js...');
    const success = await installWithChocolatey();
    if (success) {
      logInfo('等待 PATH 環境變數更新...');
      // Wait longer and retry multiple times
      const nodeAvailable = await checkCommandWithRetry('node', 15, 2000);
      if (nodeAvailable) {
        const version = getNodeVersion();
        logSuccess(`Node.js 安裝成功！版本: ${version}`);
        return true;
      } else {
        logWarn('Node.js 安裝完成，但 PATH 尚未更新');
        logWarn('請關閉此視窗並重新運行 setup-node.bat');
        return false;
      }
    }
  }
  
  // Fallback to downloading installer
  logInfo('正在下載 Node.js 安裝程序...');
  logInfo('這可能需要幾分鐘，請稍候...');
  console.log();
  
  const tempDir = path.join(os.tmpdir(), 'stock-accounting-setup');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const installerPath = path.join(tempDir, 'nodejs-installer.msi');
  const nodeUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  
  try {
    await downloadFile(nodeUrl, installerPath);
    logSuccess('下載完成');
    console.log();
    logInfo('正在啟動安裝程序...');
    logInfo('安裝將在後台進行，請稍候...');
    
    // Use /qn for completely silent installation, /l*v for logging
    const logPath = path.join(tempDir, 'nodejs-install.log');
    execSync(`msiexec /i "${installerPath}" /qn /norestart /l*v "${logPath}"`, {
      stdio: 'ignore',
    });
    
    logInfo('安裝程序已執行，等待安裝完成...');
    
    // Wait for installation to complete and PATH to update
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds for installation
    
    // Try to refresh environment and check for node
    logInfo('檢查 Node.js 是否可用...');
    const nodeAvailable = await checkCommandWithRetry('node', 20, 2000);
    
    if (nodeAvailable) {
      const version = getNodeVersion();
      logSuccess(`Node.js 安裝成功！版本: ${version}`);
      
      // Cleanup
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
      if (fs.existsSync(logPath)) {
        fs.unlinkSync(logPath);
      }
      
      return true;
    } else {
      logWarn('Node.js 安裝程序已執行，但可能需要重啟終端才能使用');
      logWarn('請關閉此視窗並重新運行 setup-node.bat');
      logInfo(`安裝日誌位於: ${logPath}`);
      
      // Cleanup installer but keep log
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
      
      return false;
    }
  } catch (error) {
    logError(`安裝失敗: ${error.message}`);
    logInfo('請手動下載並安裝 Node.js：');
    logInfo('https://nodejs.org/');
    console.log();
    
    // Cleanup
    if (fs.existsSync(installerPath)) {
      try {
        fs.unlinkSync(installerPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  股票記帳系統 - 安裝程序');
  console.log('========================================\n');
  
  // Check if Node.js is installed
  let nodeJustInstalled = false;
  if (!checkCommand('node')) {
    const installed = await installNodeJs();
    if (!installed) {
      console.log();
      logError('Node.js 安裝未完成或需要重啟終端');
      logInfo('請關閉此視窗，重新打開，然後再次運行 setup-node.bat');
      process.exit(1);
    }
    nodeJustInstalled = true;
    console.log();
  }
  
  const nodeVersion = getNodeVersion();
  const npmVersion = getNpmVersion();
  
  if (nodeJustInstalled) {
    logSuccess('Node.js 已成功安裝並可用');
  } else {
    logInfo('Node.js 已安裝');
  }
  logInfo(`Node.js 版本: ${nodeVersion}`);
  logInfo(`npm 版本: ${npmVersion}`);
  console.log();
  
  // Install dependencies
  logInfo('正在安裝項目依賴項目...');
  logInfo('這可能需要幾分鐘，請稍候...');
  console.log();
  
  const rootDir = __dirname;
  const serverDir = path.join(rootDir, 'server');
  const clientDir = path.join(rootDir, 'client');
  
  // Install root dependencies
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    if (!installDependencies(rootDir, 'root')) {
      process.exit(1);
    }
  }
  
  // Install server dependencies
  if (!fs.existsSync(path.join(serverDir, 'node_modules'))) {
    if (!installDependencies(serverDir, 'server')) {
      process.exit(1);
    }
  }
  
  // Install client dependencies
  if (!fs.existsSync(path.join(clientDir, 'node_modules'))) {
    if (!installDependencies(clientDir, 'client')) {
      process.exit(1);
    }
  }
  
  console.log();
  logSuccess('安裝完成！');
  logInfo('現在可以運行 start-node.bat 或 npm run dev 來啟動系統');
  console.log();
}

main().catch((error) => {
  console.log();
  logError(`發生未預期的錯誤: ${error.message}`);
  if (error.stack) {
    console.log(error.stack);
  }
  process.exit(1);
});

