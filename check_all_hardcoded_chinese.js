#!/usr/bin/env node
/**
 * 檢查所有頁面中的硬編碼中文文字
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');
const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

const hardcodedChinese = [];
const chinesePattern = /[\u4e00-\u9fa5]{2,}/g;

pages.forEach(pageFile => {
  const filePath = path.join(pagesDir, pageFile);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 排除註釋和字符串中的翻譯函數調用
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // 跳過註釋
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    // 檢查是否包含中文且不是翻譯函數調用
    const matches = line.match(chinesePattern);
    if (matches) {
      // 檢查是否在翻譯函數中
      if (!line.includes("t('") && !line.includes('t("') && !line.includes('useLanguage')) {
        matches.forEach(match => {
          // 排除一些明顯的註釋或變量名
          if (match.length >= 2 && !match.includes('//') && !match.includes('/*')) {
            hardcodedChinese.push({
              file: pageFile,
              line: index + 1,
              text: match,
              context: line.trim().substring(0, 100)
            });
          }
        });
      }
    }
  });
});

console.log(`找到 ${hardcodedChinese.length} 個可能的硬編碼中文文字：\n`);
hardcodedChinese.slice(0, 50).forEach(item => {
  console.log(`${item.file}:${item.line} - "${item.text}"`);
  console.log(`  上下文: ${item.context}\n`);
});

if (hardcodedChinese.length > 50) {
  console.log(`... 還有 ${hardcodedChinese.length - 50} 個未顯示\n`);
}

// 統計每個文件
const byFile = {};
hardcodedChinese.forEach(item => {
  if (!byFile[item.file]) {
    byFile[item.file] = [];
  }
  byFile[item.file].push(item);
});

console.log('\n按文件統計：');
Object.keys(byFile).sort().forEach(file => {
  console.log(`  ${file}: ${byFile[file].length} 個`);
});


