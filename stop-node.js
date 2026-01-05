#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

function killProcessByPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: Find process using the port and kill it
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
      const lines = result.trim().split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const match = line.trim().split(/\s+/);
        if (match.length > 0) {
          const pid = match[match.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
          }
        }
      });
      
      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          logInfo(`Killed process ${pid} using port ${port}`);
        } catch (err) {
          // Process may not exist or permission denied
        }
      });
      
      return pids.size > 0;
    } else {
      // Linux/Mac: Use lsof to find and kill process
      try {
        const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();
        if (pid) {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          logInfo(`Killed process ${pid} using port ${port}`);
          return true;
        }
      } catch (err) {
        // No process using the port
        return false;
      }
    }
  } catch (err) {
    return false;
  }
  return false;
}

function killNodeProcesses() {
  try {
    if (process.platform === 'win32') {
      // Windows: Kill all node.exe processes related to this project
      const rootDir = __dirname;
      const serverDir = path.join(rootDir, 'server');
      const clientDir = path.join(rootDir, 'client');
      
      // Try to kill processes by name (node.exe)
      // This is more aggressive but should work
      try {
        const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', { encoding: 'utf-8' });
        const lines = result.trim().split('\n').slice(1); // Skip header
        
        lines.forEach(line => {
          if (line.trim()) {
            const match = line.match(/"([^"]+)"/g);
            if (match && match.length > 1) {
              const pid = match[1].replace(/"/g, '');
              try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                logInfo(`Killed Node.js process ${pid}`);
              } catch (err) {
                // Process may not exist or permission denied
              }
            }
          }
        });
      } catch (err) {
        // No node processes found or error
      }
    } else {
      // Linux/Mac: Kill node processes
      try {
        execSync('pkill -f node', { stdio: 'ignore' });
        logInfo('Killed Node.js processes');
      } catch (err) {
        // No processes found
      }
    }
  } catch (err) {
    logWarn('Error killing Node.js processes: ' + err.message);
  }
}

function checkPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf-8' });
      return result.trim().length > 0;
    } else {
      try {
        execSync(`lsof -ti:${port}`, { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  Stock Accounting System - Stop');
  console.log('========================================\n');
  
  logInfo('Stopping services...');
  console.log();
  
  // Stop services by port
  let stopped = false;
  
  if (checkPortInUse(3001)) {
    logInfo('Stopping backend server (port 3001)...');
    if (killProcessByPort(3001)) {
      logSuccess('Backend server stopped');
      stopped = true;
    } else {
      logWarn('Could not stop backend server on port 3001');
    }
  } else {
    logInfo('Backend server (port 3001) is not running');
  }
  
  if (checkPortInUse(3000)) {
    logInfo('Stopping frontend client (port 3000)...');
    if (killProcessByPort(3000)) {
      logSuccess('Frontend client stopped');
      stopped = true;
    } else {
      logWarn('Could not stop frontend client on port 3000');
    }
  } else {
    logInfo('Frontend client (port 3000) is not running');
  }
  
  // Wait a bit for processes to terminate
  if (stopped) {
    logInfo('Waiting for processes to terminate...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Verify ports are free
  const port3001Free = !checkPortInUse(3001);
  const port3000Free = !checkPortInUse(3000);
  
  console.log();
  if (port3001Free && port3000Free) {
    logSuccess('All services stopped successfully!');
  } else {
    if (!port3001Free) {
      logWarn('Port 3001 is still in use');
    }
    if (!port3000Free) {
      logWarn('Port 3000 is still in use');
    }
    
    // Try more aggressive approach
    logInfo('Trying to kill all Node.js processes...');
    killNodeProcesses();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const port3001FreeAfter = !checkPortInUse(3001);
    const port3000FreeAfter = !checkPortInUse(3000);
    
    if (port3001FreeAfter && port3000FreeAfter) {
      logSuccess('All services stopped successfully!');
    } else {
      logWarn('Some services may still be running');
      logInfo('You may need to manually kill the processes using Task Manager');
    }
  }
  
  console.log();
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});

