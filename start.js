#!/usr/bin/env node
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 設置 UTF-8 輸出
process.stdout.setDefaultEncoding('utf8');
console.log('========================================');
console.log('   股票記帳系統 - 啟動');
console.log('========================================');
console.log('');

const rootDir = __dirname;

// 檢查 Node.js 版本
const nodeVersion = process.version;
console.log(`[資訊] Node.js 版本: ${nodeVersion}`);
console.log('');

// 檢查是否存在必要的目錄和文件
function checkExists(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    console.log(`[提示] 找不到 ${description}，將進行編譯`);
  }
  return exists;
}

// 執行命令並顯示輸出
function execCommand(command, cwd = rootDir, description = '') {
  return new Promise((resolve, reject) => {
    console.log(description ? `[資訊] ${description}...` : `[資訊] 執行: ${command}`);
    const child = exec(command, { cwd, encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[錯誤] 執行失敗: ${error.message}`);
        reject(error);
      } else {
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        resolve();
      }
    });

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

// 編譯後端
async function buildServer() {
  const serverDir = path.join(rootDir, 'server');
  if (!fs.existsSync(path.join(serverDir, 'package.json'))) {
    throw new Error('找不到 server\\package.json');
  }
  await execCommand('npm run build', serverDir, '正在編譯後端服務');
  console.log('[完成] 後端服務編譯完成\n');
}

// 編譯前端
async function buildClient() {
  const clientDir = path.join(rootDir, 'client');
  if (!fs.existsSync(path.join(clientDir, 'package.json'))) {
    throw new Error('找不到 client\\package.json');
  }
  await execCommand('npm run build', clientDir, '正在編譯前端服務');
  console.log('[完成] 前端服務編譯完成\n');
}

// 檢查並安裝依賴
async function checkDependencies() {
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    console.log('[警告] 找不到 node_modules，正在安裝依賴...');
    await execCommand('npm install', rootDir, '安裝依賴');
  }

  const concurrentlyPath = path.join(rootDir, 'node_modules', 'concurrently', 'dist', 'bin', 'concurrently.js');
  if (!fs.existsSync(concurrentlyPath)) {
    console.log('[警告] 找不到 concurrently，正在安裝...');
    await execCommand('npm install', rootDir, '安裝 concurrently');
  }
}

// 讀取用戶輸入
function getUserInput(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 正常模式啟動
async function startNormalMode() {
  console.log('');
  console.log('[資訊] 以正常模式啟動服務（顯示視窗）...');
  console.log('[資訊] 後端服務: http://localhost:3001');
  console.log('[資訊] 前端服務: http://localhost:3000');
  console.log('');
  console.log('========================================');
  console.log('   注意: 請不要關閉此視窗');
  console.log('   ========================================');
  console.log('   服務將在此視窗中運行。');
  console.log('   使用 Ctrl+C 來停止所有服務。');
  console.log('========================================');
  console.log('');

  // 延遲 10 秒後打開瀏覽器
  setTimeout(() => {
    const start = (process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open');
    exec(`${start} http://localhost:3000`, () => {});
  }, 10000);

  // 使用 concurrently 啟動服務
  const concurrentlyPath = path.join(rootDir, 'node_modules', '.bin', 
    process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently');
  
  const child = spawn(concurrentlyPath, [
    '-n', 'SERVER,CLIENT',
    '-c', 'cyan,yellow',
    'npm run start:server',
    'npm run start:client'
  ], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    console.error(`[錯誤] 啟動失敗: ${error.message}`);
    process.exit(1);
  });

  // 處理 Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n[資訊] 正在停止服務...');
    child.kill('SIGINT');
    process.exit(0);
  });
}

// 背景模式啟動
async function startBackgroundMode() {
  console.log('');
  console.log('[資訊] 以背景模式啟動服務...');
  console.log('[資訊] 後端服務: http://localhost:3001');
  console.log('[資訊] 前端服務: http://localhost:3000');
  console.log('');

  // 啟動後端
  console.log('[資訊] 正在啟動後端服務...');
  const serverDir = path.join(rootDir, 'server');
  const backendProcess = spawn('npm', ['start'], {
    cwd: serverDir,
    detached: true,
    stdio: 'ignore'
  });
  backendProcess.unref();

  // 等待後端啟動
  console.log('[資訊] 等待後端服務啟動...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 檢查後端是否啟動
  const netstat = require('child_process').exec;
  let backendReady = false;
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    try {
      await new Promise((resolve, reject) => {
        netstat('netstat -ano | findstr ":3001" | findstr "LISTENING"', (error, stdout) => {
          if (stdout && stdout.includes('3001')) {
            backendReady = true;
            resolve();
          } else {
            reject();
          }
        });
      });
      break;
    } catch {
      // 繼續等待
    }
  }

  if (backendReady) {
    console.log('[完成] 後端服務已啟動');
  } else {
    console.log('[警告] 無法確認後端服務是否已啟動');
  }

  // 啟動前端
  console.log('[資訊] 正在啟動前端服務...');
  const frontendProcess = spawn('npm', ['run', 'start:client'], {
    cwd: rootDir,
    detached: true,
    stdio: 'ignore'
  });
  frontendProcess.unref();

  // 等待前端啟動
  console.log('[資訊] 等待前端服務啟動...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  // 打開瀏覽器
  console.log('[資訊] 正在打開瀏覽器...');
  const start = process.platform === 'win32' ? 'start' : 
                process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${start} http://localhost:3000`, () => {});

  console.log('');
  console.log('[完成] 服務已以背景模式啟動。');
  console.log('[資訊] 後端和前端服務在背景中運行。');
  console.log('[資訊] 要停止服務，您可以：');
  console.log('       1. 使用任務管理器結束 node.exe 進程');
  console.log('       2. 執行 stop.bat 或創建類似的停止腳本');
  console.log('');
}

// 主函數
async function main() {
  try {
    // 檢查是否需要編譯
    const needBuildServer = !checkExists('server/dist/index.js', 'server\\dist\\index.js');
    const needBuildClient = !checkExists('client/dist', 'client\\dist');

    if (needBuildServer) {
      await buildServer();
    }

    if (needBuildClient) {
      await buildClient();
    }

    // 檢查依賴
    await checkDependencies();

    // 選擇啟動模式
    console.log('');
    console.log('========================================');
    console.log('   請選擇啟動模式');
    console.log('========================================');
    console.log('   1. 正常模式 (顯示視窗)');
    console.log('   2. 背景模式 (隱藏視窗)');
    console.log('========================================');
    console.log('');

    const mode = await getUserInput('請選擇模式 (1 或 2，預設 1): ');

    if (mode === '2') {
      await startBackgroundMode();
    } else {
      await startNormalMode();
    }
  } catch (error) {
    console.error(`[錯誤] ${error.message}`);
    console.log('');
    console.log('按 Enter 鍵退出...');
    await getUserInput('');
    process.exit(1);
  }
}

// 運行主函數
main();


