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

const { execSync } = require('child_process');

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

// 停止指定端口的進程
function stopPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: 使用 netstat 和 taskkill
      logInfo(`正在查找端口 ${port} 的進程...`);
      const result = execSync(`netstat -ano | findstr :${port}`, execOptions());
      
      if (!result || result.trim().length === 0) {
        logInfo(`端口 ${port} 沒有運行中的進程`);
        return false;
      }

      const lines = result.split('\n').filter(line => line.trim().length > 0);
      const pids = new Set();
      
      for (const line of lines) {
        const match = line.match(/\s+(\d+)\s*$/);
        if (match) {
          pids.add(match[1]);
        }
      }

      if (pids.size === 0) {
        logInfo(`端口 ${port} 沒有找到有效的進程 ID`);
        return false;
      }

      for (const pid of pids) {
        try {
          logInfo(`正在停止進程 ${pid}...`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          logSuccess(`進程 ${pid} 已停止`);
        } catch (err) {
          logError(`無法停止進程 ${pid}: ${err.message}`);
        }
      }
      return true;
    } else {
      // Linux/Mac: 使用 lsof 和 kill
      logInfo(`正在查找端口 ${port} 的進程...`);
      const result = execSync(`lsof -ti :${port}`, execOptions());
      
      if (!result || result.trim().length === 0) {
        logInfo(`端口 ${port} 沒有運行中的進程`);
        return false;
      }

      const pids = result.trim().split('\n').filter(pid => pid.trim().length > 0);
      
      for (const pid of pids) {
        try {
          logInfo(`正在停止進程 ${pid}...`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          logSuccess(`進程 ${pid} 已停止`);
        } catch (err) {
          logError(`無法停止進程 ${pid}: ${err.message}`);
        }
      }
      return true;
    }
  } catch (error) {
    // 端口沒有運行中的進程
    return false;
  }
}

// 主程序
function main() {
  logInfo('正在停止股票記帳系統服務...');
  
  const port3000 = stopPort(3000); // 前端端口
  const port3001 = stopPort(3001); // 後端端口

  if (port3000 || port3001) {
    logSuccess('服務已停止');
  } else {
    logInfo('沒有運行中的服務需要停止');
  }
}

main();


