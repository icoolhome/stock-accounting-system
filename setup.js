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
  logInfo(`Installing ${name} dependencies...`);
  try {
    execSync('npm install', {
      cwd: dir,
      stdio: 'inherit',
    });
    logSuccess(`${name} dependencies installed successfully`);
    return true;
  } catch (error) {
    logError(`Failed to install ${name} dependencies`);
    return false;
  }
}

function installWithChocolatey() {
  logInfo('Chocolatey detected, using Chocolatey to install Node.js...');
  logInfo('This may require administrator privileges');
  
  return new Promise((resolve) => {
    const choco = spawn('choco', ['install', 'nodejs-lts', '-y'], {
      stdio: 'inherit',
      shell: true,
    });
    
    choco.on('close', (code) => {
      if (code === 0) {
        logSuccess('Node.js installed successfully via Chocolatey');
        resolve(true);
      } else {
        logWarn('Chocolatey installation failed');
        resolve(false);
      }
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

async function installNodeJs() {
  logInfo('Node.js is not installed');
  logInfo('Starting Node.js installation...');
  
  // Try Chocolatey first
  if (checkCommand('choco')) {
    const success = await installWithChocolatey();
    if (success) {
      // Wait a bit for PATH to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (checkCommand('node')) {
        return true;
      }
    }
  }
  
  // Fallback to downloading installer
  logInfo('Downloading Node.js installer...');
  logInfo('Please wait, this may take a few minutes...');
  
  const tempDir = path.join(os.tmpdir(), 'stock-accounting-setup');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const installerPath = path.join(tempDir, 'nodejs-installer.msi');
  const nodeUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi';
  
  try {
    await downloadFile(nodeUrl, installerPath);
    logInfo('Starting installation...');
    logInfo('Please follow the installation wizard');
    
    execSync(`msiexec /i "${installerPath}" /quiet /norestart`, {
      stdio: 'inherit',
    });
    
    // Cleanup
    if (fs.existsSync(installerPath)) {
      fs.unlinkSync(installerPath);
    }
    
    logSuccess('Node.js installer executed');
    logWarn('Please restart your terminal or restart your computer');
    logWarn('Then run setup.js again');
    
    return false;
  } catch (error) {
    logError('Failed to download or install Node.js');
    logInfo('Please download and install Node.js manually from:');
    logInfo('https://nodejs.org/');
    
    // Cleanup
    if (fs.existsSync(installerPath)) {
      fs.unlinkSync(installerPath);
    }
    
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  Stock Accounting System - Setup');
  console.log('========================================\n');
  
  // Check if Node.js is installed
  if (!checkCommand('node')) {
    const installed = await installNodeJs();
    if (!installed) {
      process.exit(1);
    }
  }
  
  const nodeVersion = getNodeVersion();
  const npmVersion = getNpmVersion();
  
  logInfo('Node.js is already installed');
  console.log(nodeVersion);
  console.log(npmVersion);
  console.log();
  
  // Install dependencies
  logInfo('Installing project dependencies...');
  logInfo('This may take several minutes...');
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
  logSuccess('Setup completed successfully!');
  logInfo('You can now run start.bat or npm run dev to start the system');
  console.log();
}

main().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});

