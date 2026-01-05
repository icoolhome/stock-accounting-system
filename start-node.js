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
  console.log('  Stock Accounting System - Start');
  console.log('========================================\n');
  console.log('========================================');
  console.log('  Select startup mode');
  console.log('========================================');
  console.log('  1. Normal mode (show window)');
  console.log('  2. Background mode (hide window)');
  console.log('========================================\n');
  
  const answer = await question('Select mode (1 or 2, default 1): ');
  return answer.trim() || '1';
}

function startServer(mode) {
  const serverDir = path.join(__dirname, 'server');
  const isHidden = mode === '2';
  
  logInfo('Starting backend server...');
  
  if (isHidden && process.platform === 'win32') {
    // Windows: Use start with /B to hide window
    const serverProcess = spawn('cmd', ['/c', 'start', '/B', 'npm', 'start'], {
      cwd: serverDir,
      stdio: 'ignore',
      shell: true,
    });
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
  
  logInfo('Starting frontend client...');
  
  if (isHidden && process.platform === 'win32') {
    // Windows: Use start with /B to hide window
    const clientProcess = spawn('cmd', ['/c', 'start', '/B', 'npm', 'run', 'preview'], {
      cwd: clientDir,
      stdio: 'ignore',
      shell: true,
    });
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
    logError('Node.js is not installed');
    logInfo('Please run setup.js or setup-node.bat first to install Node.js');
    process.exit(1);
  }
  
  // Check npm
  if (!checkNpmInstalled()) {
    logError('npm is not installed');
    process.exit(1);
  }
  
  // Check dependencies
  const deps = checkDependencies();
  if (!deps.rootExists || !deps.serverExists || !deps.clientExists) {
    logWarn('Dependencies are not installed');
    logInfo('Please run setup.js or setup-node.bat first to install dependencies');
    process.exit(1);
  }
  
  // Select mode
  const mode = await selectMode();
  
  if (mode === '1') {
    logInfo('Starting in normal mode...');
  } else {
    logInfo('Starting in background mode...');
  }
  
  console.log();
  
  // Start server
  const serverProcess = startServer(mode);
  
  // Wait for server to be ready
  try {
    logInfo('Waiting for server to start...');
    await waitForServer(3001, 60);
    logSuccess('Server is ready');
  } catch (error) {
    logWarn('Server may not be ready yet, but continuing...');
  }
  
  // Start client
  const clientProcess = startClient(mode);
  
  // Wait a bit for client to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Open browser (only in normal mode)
  if (mode === '1') {
    logInfo('Opening browser in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (openBrowser('http://localhost:3000')) {
      logSuccess('Browser opened');
    } else {
      logWarn('Could not open browser automatically');
      logInfo('Please open http://localhost:3000 in your browser');
    }
  }
  
  console.log();
  logSuccess('System started successfully!');
  logInfo('Backend API: http://localhost:3001');
  logInfo('Frontend: http://localhost:3000');
  console.log();
  
  if (mode === '1') {
    logInfo('Press Ctrl+C to stop the system');
    console.log();
    
    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log('\n');
      logInfo('Stopping system...');
      serverProcess.kill();
      clientProcess.kill();
      process.exit(0);
    });
    
    // Keep process alive
    process.stdin.resume();
  } else {
    logInfo('System is running in background mode');
    logInfo('Use stop.bat or stop-node.bat to stop the system');
  }
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});

