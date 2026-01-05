#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function checkNodeJs() {
  try {
    execSync('node --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkNpmInstalled() {
  try {
    execSync('npm --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkDependencies() {
  const rootDir = __dirname;
  const serverDir = path.join(rootDir, 'server');
  const clientDir = path.join(rootDir, 'client');
  
  const rootExists = fs.existsSync(path.join(rootDir, 'node_modules'));
  const serverExists = fs.existsSync(path.join(serverDir, 'node_modules'));
  const clientExists = fs.existsSync(path.join(clientDir, 'node_modules'));
  
  return { rootExists, serverExists, clientExists };
}

function openBrowser(url) {
  const platform = process.platform;
  let command;
  
  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  try {
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function selectMode() {
  console.log('\n========================================');
  console.log('  股票記帳系統 - 啟動');
  console.log('========================================\n');
  console.log('========================================');
  console.log('  請選擇啟動模式');
  console.log('========================================');
  console.log('  1. 正常模式（顯示視窗）');
  console.log('  2. 後台模式（隱藏視窗）');
  console.log('========================================\n');
  
  const answer = await question('請選擇模式（1 或 2，預設 1）：');
  return answer.trim() || '1';
}

function startServer(mode) {
  const serverDir = path.join(__dirname, 'server');
  const isHidden = mode === '2';
  
  logInfo('正在啟動後端伺服器...');
  
  if (isHidden && process.platform === 'win32') {
    // Windows: Use detached process to hide window
    const serverProcess = spawn('npm', ['start'], {
      cwd: serverDir,
      stdio: 'ignore',
      shell: true,
      detached: true,
    });
    serverProcess.unref();
    return serverProcess;
  } else {
    const serverProcess = spawn('npm', ['start'], {
      cwd: serverDir,
      stdio: 'inherit',
      shell: true,
    });
    return serverProcess;
  }
}

function startClient(mode) {
  const clientDir = path.join(__dirname, 'client');
  const isHidden = mode === '2';
  
  logInfo('正在啟動前端客戶端...');
  
  if (isHidden && process.platform === 'win32') {
    // Windows: Use detached process to hide window
    const clientProcess = spawn('npm', ['run', 'preview'], {
      cwd: clientDir,
      stdio: 'ignore',
      shell: true,
      detached: true,
    });
    clientProcess.unref();
    return clientProcess;
  } else {
    const clientProcess = spawn('npm', ['run', 'preview'], {
      cwd: clientDir,
      stdio: 'inherit',
      shell: true,
    });
    return clientProcess;
  }
}

function waitForServer(port = 3001, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    let attempts = 0;
    
    const checkServer = () => {
      attempts++;
      const req = http.get(`http://localhost:${port}`, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(checkServer, 1000);
        }
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        if (attempts >= maxAttempts) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(checkServer, 1000);
        }
      });
    };
    
    checkServer();
  });
}

async function main() {
  // Check Node.js
  if (!checkNodeJs()) {
    logError('Node.js 未安裝');
    logInfo('請先運行 setup.js 或 setup-node.bat 以安裝 Node.js');
    process.exit(1);
  }
  
  // Check npm
  if (!checkNpmInstalled()) {
    logError('npm 未安裝');
    process.exit(1);
  }
  
  // Check dependencies
  const deps = checkDependencies();
  if (!deps.rootExists || !deps.serverExists || !deps.clientExists) {
    logWarn('依賴項目未安裝');
    logInfo('請先運行 setup.js 或 setup-node.bat 以安裝依賴項目');
    process.exit(1);
  }
  
  // Select mode
  const mode = await selectMode();
  
  if (mode === '1') {
    logInfo('正在以正常模式啟動...');
  } else {
    logInfo('正在以後台模式啟動...');
  }
  
  console.log();
  
  // Use concurrently for normal mode, separate processes for background mode
  if (mode === '1') {
    // Normal mode: Use concurrently to run both services
    logInfo('正在使用 concurrently 啟動服務...');
    const concurrently = spawn('npm', ['start'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
    });
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n');
      logInfo('正在停止系統...');
      concurrently.kill();
      process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
    
    // Wait for services to start, then open browser
    logInfo('等待服務啟動...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (openBrowser('http://localhost:3000')) {
      logSuccess('瀏覽器已打開');
    } else {
      logWarn('無法自動打開瀏覽器');
      logInfo('請在瀏覽器中打開 http://localhost:3000');
    }
    
    console.log();
    logSuccess('系統啟動成功！');
    logInfo('後端 API: http://localhost:3001');
    logInfo('前端: http://localhost:3000');
    console.log();
    logInfo('按 Ctrl+C 停止系統');
    console.log();
    
    return;
  } else {
    // Background mode: Start services separately
    const serverProcess = startServer(mode);
    
    // Wait for server to be ready
    try {
      logInfo('等待伺服器啟動...');
      await waitForServer(3001, 60);
      logSuccess('伺服器已就緒');
    } catch (error) {
      logWarn('伺服器可能尚未就緒，但繼續執行...');
    }
    
    // Start client
    const clientProcess = startClient(mode);
    
    // Wait a bit for client to start
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Open browser (only in background mode, normal mode already handled)
  if (mode === '2') {
    logInfo('將在 5 秒後打開瀏覽器...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (openBrowser('http://localhost:3000')) {
      logSuccess('瀏覽器已打開');
    } else {
      logWarn('無法自動打開瀏覽器');
      logInfo('請在瀏覽器中打開 http://localhost:3000');
    }
    
    console.log();
    logSuccess('系統啟動成功！');
    logInfo('後端 API: http://localhost:3001');
    logInfo('前端: http://localhost:3000');
    console.log();
    logInfo('系統正在後台模式運行');
    logInfo('使用 stop.bat 或 stop-node.bat 停止系統');
  }
}

main().catch((error) => {
  logError(`發生未預期的錯誤: ${error.message}`);
  process.exit(1);
});

