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

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

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

// 中文化輸出
const logInfo = (msg) => console.log(`[INFO] ${msg}`);
const logSuccess = (msg) => console.log(`[成功] ${msg}`);
const logError = (msg) => console.log(`[錯誤] ${msg}`);
const logWarn = (msg) => console.log(`[警告] ${msg}`);

// 等待服務器就緒
function waitForServer(port, timeout = 60) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      try {
        if (process.platform === 'win32') {
          const result = execSync('netstat -an', execOptions());
          if (result.includes(`:${port}`)) {
            clearInterval(checkInterval);
            resolve();
          }
        } else {
          const result = execSync(`lsof -i :${port}`, execOptions());
          if (result) {
            clearInterval(checkInterval);
            resolve();
          }
        }
      } catch (err) {
        // 端口尚未監聽，繼續等待
      }

      if (Date.now() - startTime > timeout * 1000) {
        clearInterval(checkInterval);
        reject(new Error('服務器啟動超時'));
      }
    }, 1000);
  });
}

// 打開瀏覽器
function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      // Windows - 使用 spawn 而不是 execSync 來避免 shell 警告
      spawn('cmd', ['/c', 'start', url], { stdio: 'ignore', shell: false });
    } else if (process.platform === 'darwin') {
      // macOS
      spawn('open', [url], { stdio: 'ignore' });
    } else {
      // Linux
      spawn('xdg-open', [url], { stdio: 'ignore' });
    }
    logSuccess(`已在瀏覽器中打開: ${url}`);
  } catch (err) {
    logWarn(`無法自動打開瀏覽器，請手動訪問: ${url}`);
  }
}

// 啟動服務器
function startServer(mode) {
  const serverDir = path.join(__dirname, 'server');
  
  if (mode === 'background' && process.platform === 'win32') {
    // Windows 後台模式：使用 VBS 腳本
    const tempDir = os.tmpdir();
    const vbsFile = path.join(tempDir, `start_server_${Date.now()}.vbs`);
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${serverDir.replace(/\\/g, '\\\\')}"\nWshShell.Run "cmd /c npm start", 0, False`;
    fs.writeFileSync(vbsFile, vbsContent, 'utf8');
    execSync(`cscript //nologo "${vbsFile}"`, { stdio: 'ignore' });
    return null;
  } else {
    return spawn('npm', ['start'], {
      cwd: serverDir,
      stdio: mode === 'background' ? 'ignore' : 'inherit',
      detached: mode === 'background',
      shell: false,
      env: { ...process.env, CHCP: '65001' }
    });
  }
}

// 啟動客戶端
function startClient(mode) {
  const clientDir = path.join(__dirname, 'client');
  
  if (mode === 'background' && process.platform === 'win32') {
    // Windows 後台模式：使用 VBS 腳本
    const tempDir = os.tmpdir();
    const vbsFile = path.join(tempDir, `start_client_${Date.now()}.vbs`);
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${__dirname.replace(/\\/g, '\\\\')}"\nWshShell.Run "cmd /c npm run start:client", 0, False`;
    fs.writeFileSync(vbsFile, vbsContent, 'utf8');
    execSync(`cscript //nologo "${vbsFile}"`, { stdio: 'ignore' });
    return null;
  } else {
    return spawn('npm', ['run', 'start:client'], {
      cwd: __dirname,
      stdio: mode === 'background' ? 'ignore' : 'inherit',
      detached: mode === 'background',
      shell: false,
      env: { ...process.env, CHCP: '65001' }
    });
  }
}

// 檢查必要文件是否存在
async function checkPrerequisites() {
  const serverDist = path.join(__dirname, 'server', 'dist', 'index.js');
  const clientDist = path.join(__dirname, 'client', 'dist');
  const serverPackageJson = path.join(__dirname, 'server', 'package.json');
  const clientPackageJson = path.join(__dirname, 'client', 'package.json');
  
  if (!fs.existsSync(serverPackageJson)) {
    throw new Error('找不到 server/package.json，請確保在正確的目錄執行');
  }
  
  if (!fs.existsSync(clientPackageJson)) {
    throw new Error('找不到 client/package.json，請確保在正確的目錄執行');
  }
  
  if (!fs.existsSync(serverDist)) {
    logWarn('警告: 服務器未編譯，可能無法啟動。請先執行: cd server && npm run build');
  }
  
  // 檢查前端是否已構建，如果沒有則自動構建
  if (!fs.existsSync(clientDist)) {
    logWarn('前端未構建，正在自動構建前端...');
    try {
      const clientDir = path.join(__dirname, 'client');
      logInfo('正在執行: cd client && npm run build');
      execSync('npm run build', {
        cwd: clientDir,
        stdio: 'inherit',
        encoding: 'utf8',
        env: { ...process.env, CHCP: '65001' }
      });
      logSuccess('前端構建完成');
    } catch (error) {
      logError(`前端構建失敗: ${error.message}`);
      throw new Error('前端構建失敗，請手動執行: cd client && npm run build');
    }
  }
}

// 主程序
async function main() {
  try {
    await checkPrerequisites();
  } catch (error) {
    logError(`環境檢查失敗: ${error.message}`);
    process.exit(1);
  }
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise((resolve) => {
    rl.question('請選擇模式（1 或 2，預設 1）：\n  1. 正常模式（顯示視窗）\n  2. 後台模式（隱藏視窗）\n', resolve);
  });

  rl.close();

  const mode = answer.trim() === '2' ? 'background' : 'normal';
  
  if (mode === 'normal') {
    logInfo('正在以正常模式啟動服務...');
    
    // 啟動服務器和客戶端
    const serverProcess = startServer('normal');
    const clientProcess = startClient('normal');
    
    // 添加錯誤處理
    if (serverProcess) {
      serverProcess.on('error', (error) => {
        logError(`後端服務器啟動失敗: ${error.message}`);
        if (clientProcess) clientProcess.kill();
        process.exit(1);
      });
      
      serverProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logError(`後端服務器異常退出，錯誤代碼: ${code}`);
        }
      });
    }
    
    if (clientProcess) {
      clientProcess.on('error', (error) => {
        logError(`前端客戶端啟動失敗: ${error.message}`);
        if (serverProcess) serverProcess.kill();
        process.exit(1);
      });
      
      clientProcess.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          logError(`前端客戶端異常退出，錯誤代碼: ${code}`);
        }
      });
    }
    
    try {
      // 等待服務器就緒
      logInfo('等待伺服器啟動...');
      await waitForServer(3001, 60);
      logSuccess('伺服器已就緒');
      
      // 等待前端就緒（檢查端口 3000 或 4173）
      logInfo('等待前端啟動...');
      let frontendPort = 3000;
      let frontendReady = false;
      
      // 先檢查 3000，如果超時再檢查 4173
      try {
        await waitForServer(3000, 15);
        frontendReady = true;
        frontendPort = 3000;
      } catch {
        try {
          await waitForServer(4173, 15);
          frontendReady = true;
          frontendPort = 4173;
        } catch {
          logWarn('前端可能尚未完全就緒，但繼續執行...');
        }
      }
      
      if (frontendReady) {
        logSuccess(`前端已就緒（端口 ${frontendPort}）`);
      }
      
      // 自動打開瀏覽器
      logInfo('正在打開瀏覽器...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 再等2秒確保服務完全就緒
      openBrowser(`http://localhost:${frontendPort}`);
      
      logSuccess('服務已啟動！按 Ctrl+C 停止服務');
      
      // 保持進程運行
      process.on('SIGINT', () => {
        logInfo('正在停止服務...');
        if (serverProcess) serverProcess.kill();
        if (clientProcess) clientProcess.kill();
        process.exit(0);
      });
      
      // 等待進程結束（正常情況下不會結束）
      await Promise.all([
        new Promise((resolve) => {
          if (serverProcess) {
            serverProcess.on('exit', resolve);
          } else {
            resolve();
          }
        }),
        new Promise((resolve) => {
          if (clientProcess) {
            clientProcess.on('exit', resolve);
          } else {
            resolve();
          }
        })
      ]);
      
    } catch (error) {
      logError(`啟動失敗: ${error.message}`);
      logError(`詳細錯誤: ${error.stack || error}`);
      if (serverProcess) serverProcess.kill();
      if (clientProcess) clientProcess.kill();
      process.exit(1);
    }
  } else {
    logInfo('正在以後台模式啟動服務（隱藏視窗）...');
    
    if (process.platform === 'win32') {
      // Windows: 使用 VBS 腳本
      const serverDir = path.join(__dirname, 'server');
      const tempDir = os.tmpdir();
      const serverVbs = path.join(tempDir, `start_backend_${Date.now()}.vbs`);
      const clientVbs = path.join(tempDir, `start_frontend_${Date.now()}.vbs`);

      const serverVbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${serverDir.replace(/\\/g, '\\\\')}"\nWshShell.Run "cmd /c npm start", 0, False`;
      fs.writeFileSync(serverVbs, serverVbsContent, 'utf8');

      const clientVbsContent = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${__dirname.replace(/\\/g, '\\\\')}"\nWshShell.Run "cmd /c npm run start:client", 0, False`;
      fs.writeFileSync(clientVbs, clientVbsContent, 'utf8');

      logInfo('正在啟動後端伺服器（後台）...');
      execSync(`cscript //nologo "${serverVbs}"`, { stdio: 'ignore' });

      try {
        logInfo('等待伺服器啟動...');
        await waitForServer(3001, 60);
        logSuccess('伺服器已就緒');
      } catch (error) {
        logWarn('伺服器可能尚未就緒，但繼續執行...');
      }

      logInfo('正在啟動前端客戶端（後台）...');
      execSync(`cscript //nologo "${clientVbs}"`, { stdio: 'ignore' });
      
      // 等待前端就緒（檢查端口 3000 或 4173）
      try {
        logInfo('等待前端啟動...');
        let frontendPort = 3000;
        let frontendReady = false;
        
        // 先檢查 3000，如果超時再檢查 4173
        try {
          await waitForServer(3000, 15);
          frontendReady = true;
          frontendPort = 3000;
        } catch {
          try {
            await waitForServer(4173, 15);
            frontendReady = true;
            frontendPort = 4173;
          } catch {
            logWarn('前端可能尚未完全就緒，但繼續執行...');
          }
        }
        
        if (frontendReady) {
          logSuccess(`前端已就緒（端口 ${frontendPort}）`);
        }
        
        // 自動打開瀏覽器
        logInfo('正在打開瀏覽器...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 再等2秒確保服務完全就緒
        openBrowser(`http://localhost:${frontendPort}`);
      } catch (error) {
        logWarn('前端可能尚未就緒，但繼續執行...');
        logInfo('請稍後手動訪問: http://localhost:3000 或 http://localhost:4173');
      }
      
      logSuccess('服務已在後台啟動');
    } else {
      // 非 Windows 系統
      const serverProcess = startServer(mode);
      try {
        logInfo('等待伺服器啟動...');
        await waitForServer(3001, 60);
        logSuccess('伺服器已就緒');
      } catch (error) {
        logWarn('伺服器可能尚未就緒，但繼續執行...');
      }
      
      const clientProcess = startClient(mode);
      if (clientProcess) {
        clientProcess.unref();
      }
      
      // 等待前端就緒（檢查端口 3000 或 4173）
      try {
        logInfo('等待前端啟動...');
        let frontendPort = 3000;
        let frontendReady = false;
        
        // 先檢查 3000，如果超時再檢查 4173
        try {
          await waitForServer(3000, 15);
          frontendReady = true;
          frontendPort = 3000;
        } catch {
          try {
            await waitForServer(4173, 15);
            frontendReady = true;
            frontendPort = 4173;
          } catch {
            logWarn('前端可能尚未完全就緒，但繼續執行...');
          }
        }
        
        if (frontendReady) {
          logSuccess(`前端已就緒（端口 ${frontendPort}）`);
        }
        
        // 自動打開瀏覽器
        logInfo('正在打開瀏覽器...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // 再等2秒確保服務完全就緒
        openBrowser(`http://localhost:${frontendPort}`);
      } catch (error) {
        logWarn('前端可能尚未就緒，但繼續執行...');
        logInfo('請稍後手動訪問: http://localhost:3000 或 http://localhost:4173');
      }
      
      logSuccess('服務已在後台啟動');
    }
  }
}

main().catch((error) => {
  logError(`發生未預期的錯誤: ${error.message}`);
  logError(`錯誤堆疊: ${error.stack || '無堆疊信息'}`);
  console.error(error);
  process.exit(1);
});

