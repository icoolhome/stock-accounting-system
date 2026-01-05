#!/usr/bin/env node
/**
 * 讀取語言包並生成批處理文件使用的環境變量
 * 用於實現批處理文件的多語言支持
 */

const fs = require('fs');
const path = require('path');

const LANG_FILE = path.join(__dirname, 'batch_language.json');
const DEFAULT_LANG = 'zh-TW';

// 預設翻譯（如果語言包不存在）
function getDefaultTranslations() {
  return {
    'batch.setup.title': 'Stock Accounting System - Setup',
    'batch.setup.nodejs_installed': 'Node.js is already installed',
    'batch.setup.nodejs_not_found': 'Node.js is not installed',
    'batch.setup.installing': 'Starting Node.js installation...',
    'batch.setup.downloading': 'Downloading Node.js installer...',
    'batch.setup.installing_deps': 'Installing project dependencies...',
    'batch.setup.success': 'Setup completed successfully!',
    'batch.start.title': 'Stock Accounting System - Start',
    'batch.start.nodejs_not_found': 'Node.js not found',
    'batch.start.run_setup': 'Please run setup.bat first to install Node.js',
    'batch.start.select_mode': 'Select startup mode',
    'batch.start.mode_normal': 'Normal mode (show window)',
    'batch.start.mode_background': 'Background mode (hide window)',
    'batch.start.starting_normal': 'Starting in normal mode...',
    'batch.start.starting_background': 'Starting in background mode...',
    'batch.start.backend': 'Backend',
    'batch.start.frontend': 'Frontend',
    'batch.start.opening_browser': 'Opening browser in',
    'batch.start.opening_now': 'Opening browser now...',
    'batch.start.services_running': 'Services are running',
    'batch.start.use_stop': 'Use stop.bat to stop all services',
    'batch.stop.title': 'Stock Accounting System - Stop',
    'batch.stop.stopping': 'Stopping all Node.js processes...',
    'batch.stop.success': 'All services stopped',
    'batch.stop.warn': 'Some services may still be running',
    'batch.common.error': 'ERROR',
    'batch.common.info': 'INFO',
    'batch.common.success': 'SUCCESS',
    'batch.common.warn': 'WARN',
  };
}

// 從文件讀取語言包
function getLanguagePackFromFile(langCode) {
  const langPackPath = path.join(__dirname, `language_pack_${langCode}.json`);
  
  if (fs.existsSync(langPackPath)) {
    try {
      const content = fs.readFileSync(langPackPath, 'utf8');
      const pack = JSON.parse(content);
      const fileTranslations = pack.translations || {};
      
      // 合併預設翻譯以確保所有鍵都存在
      const defaultTrans = getDefaultTranslations();
      return { ...defaultTrans, ...fileTranslations };
    } catch (e) {
      console.error(`Error reading language pack: ${e.message}`);
    }
  }

  // 如果沒有找到，返回預設翻譯
  return getDefaultTranslations();
}

// 從數據庫讀取語言包
async function getLanguagePackFromDatabase(langCode) {
  try {
    const dbPath = path.join(__dirname, 'server', 'database.sqlite');
    if (!fs.existsSync(dbPath)) {
      return null;
    }

    const sqlite3 = require('sqlite3');
    const db = new sqlite3.Database(dbPath);
    
    return new Promise((resolve) => {
      db.get(
        'SELECT translations FROM language_packs WHERE language_code = ? LIMIT 1',
        [langCode],
        (err, row) => {
          db.close();
          if (!err && row && row.translations) {
            try {
              const translations = JSON.parse(row.translations);
              const defaultTrans = getDefaultTranslations();
              resolve({ ...defaultTrans, ...translations });
              return;
            } catch (e) {
              // 解析失敗
            }
          }
          resolve(null);
        }
      );
    });
  } catch (e) {
    return null;
  }
}

// 從數據庫或語言包文件讀取翻譯
async function getLanguagePack(langCode = DEFAULT_LANG) {
  // 首先嘗試從數據庫讀取
  const dbTranslations = await getLanguagePackFromDatabase(langCode);
  if (dbTranslations) {
    return dbTranslations;
  }

  // 從語言包文件讀取
  return getLanguagePackFromFile(langCode);
}

// 讀取當前語言設置
async function getCurrentLanguage() {
  // 首先嘗試從環境變量讀取
  if (process.env.BATCH_LANGUAGE) {
    return process.env.BATCH_LANGUAGE;
  }
  
  // 嘗試從數據庫讀取預設語言
  try {
    const dbPath = path.join(__dirname, 'server', 'database.sqlite');
    if (fs.existsSync(dbPath)) {
      const sqlite3 = require('sqlite3');
      const db = new sqlite3.Database(dbPath);
      
      return new Promise((resolve) => {
        db.get(
          'SELECT language_code FROM language_packs WHERE is_default = 1 LIMIT 1',
          [],
          (err, row) => {
            db.close();
            if (!err && row && row.language_code) {
              resolve(row.language_code);
            } else {
              // 如果沒有找到，檢查是否有任何語言包
              const db2 = new sqlite3.Database(dbPath);
              db2.get(
                'SELECT language_code FROM language_packs ORDER BY is_default DESC, id ASC LIMIT 1',
                [],
                (err2, row2) => {
                  db2.close();
                  if (!err2 && row2 && row2.language_code) {
                    resolve(row2.language_code);
                  } else {
                    resolve(DEFAULT_LANG);
                  }
                }
              );
            }
          }
        );
      });
    }
  } catch (e) {
    // 忽略錯誤
  }
  
  return DEFAULT_LANG;
}

// 生成批處理文件使用的環境變量文件
function generateBatchLanguageFile(langCode, translations) {
  if (!translations || typeof translations !== 'object') {
    translations = getDefaultTranslations();
  }
  
  const langData = {
    lang: langCode,
    translations: translations
  };
  
  fs.writeFileSync(LANG_FILE, JSON.stringify(langData, null, 2), 'utf8');
  return translations;
}

// 導出翻譯為環境變量格式
function exportAsEnvVars(translations) {
  if (!translations || typeof translations !== 'object') {
    translations = getDefaultTranslations();
  }
  
  const envVars = [];
  for (const [key, value] of Object.entries(translations)) {
    // 只處理 batch.* 開頭的鍵
    if (key.startsWith('batch.')) {
      // 轉換為批處理文件可用的格式
      const envKey = key.toUpperCase().replace(/\./g, '_');
      // 轉義特殊字符
      const envValue = String(value).replace(/[&|<>^]/g, '');
      envVars.push(`set ${envKey}=${envValue}`);
    }
  }
  return envVars.join('\n');
}

// 主函數
async function main() {
  let langCode = await getCurrentLanguage();
  let translations = await getLanguagePack(langCode);
  
  // 確保 translations 是對象
  if (!translations || typeof translations !== 'object') {
    translations = getDefaultTranslations();
  }
  
  translations = generateBatchLanguageFile(langCode, translations);
  
  // 輸出環境變量格式（用於批處理文件）
  const envOutput = exportAsEnvVars(translations);
  
  // 保存到臨時文件供批處理文件使用
  const envFile = path.join(__dirname, 'batch_language_env.bat');
  fs.writeFileSync(envFile, `@echo off\n${envOutput}\n`, 'utf8');
  
  if (process.argv.includes('--verbose')) {
    console.log(`Language file generated: ${LANG_FILE}`);
    console.log(`Environment file generated: ${envFile}`);
    console.log(`Current language: ${langCode}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { getLanguagePack, getCurrentLanguage, generateBatchLanguageFile };
