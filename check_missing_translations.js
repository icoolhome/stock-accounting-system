#!/usr/bin/env node
/**
 * 檢查所有頁面中需要翻譯但可能缺失的硬編碼中文文字
 */

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');
const pages = [
  'StockAnnouncements.tsx',
  'Transactions.tsx',
  'Settlements.tsx',
  'BankAccounts.tsx',
  'Holdings.tsx',
  'Portfolio.tsx',
  'Dividends.tsx',
  'Admin.tsx',
  'Settings.tsx'
];

const chinesePattern = /[\u4e00-\u9fa5]{2,}/g;
const hardcodedTexts = [];

pages.forEach(pageFile => {
  const filePath = path.join(pagesDir, pageFile);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${pageFile}`);
    return;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // 跳過註釋和翻譯函數調用
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return;
    }
    
    // 檢查是否包含中文且不在翻譯函數中
    if (line.includes("t('") || line.includes('t("') || line.includes('useLanguage')) {
      return; // 已在翻譯函數中
    }
    
    const matches = line.match(chinesePattern);
    if (matches) {
      matches.forEach(match => {
        // 排除一些明顯的註釋或變量名
        if (match.length >= 2) {
          // 檢查是否在字符串中（可能在硬編碼的文字中）
          const inString = /['"`]([^'"`]*[\u4e00-\u9fa5]+[^'"`]*)['"`]/.test(line);
          if (inString && !line.includes("t(")) {
            hardcodedTexts.push({
              file: pageFile,
              line: index + 1,
              text: match,
              context: line.trim().substring(0, 120)
            });
          }
        }
      });
    }
  });
});

console.log(`找到 ${hardcodedTexts.length} 個可能的硬編碼中文文字：\n`);
hardcodedTexts.slice(0, 100).forEach(item => {
  console.log(`${item.file}:${item.line} - "${item.text}"`);
  console.log(`  上下文: ${item.context}\n`);
});

if (hardcodedTexts.length > 100) {
  console.log(`... 還有 ${hardcodedTexts.length - 100} 個未顯示\n`);
}

// 統計每個文件
const byFile = {};
hardcodedTexts.forEach(item => {
  if (!byFile[item.file]) {
    byFile[item.file] = [];
  }
  byFile[item.file].push(item);
});

console.log('\n按文件統計：');
Object.keys(byFile).sort().forEach(file => {
  console.log(`  ${file}: ${byFile[file].length} 個`);
});


