#!/usr/bin/env node
/**
 * 批量更新所有頁面組件以支持國際化
 * 添加 useLanguage hook 並更新頁面標題
 */

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');
const pages = [
  'Transactions.tsx',
  'Settlements.tsx',
  'BankAccounts.tsx',
  'Holdings.tsx',
  'Portfolio.tsx',
  'Dividends.tsx',
  'StockAnnouncements.tsx',
  'WelcomeGuide.tsx',
  'Admin.tsx',
  'Dashboard.tsx',
];

const pageTitles = {
  'Transactions.tsx': { key: 'transactions.title', default: '交易記錄' },
  'Settlements.tsx': { key: 'settlements.title', default: '交割管理' },
  'BankAccounts.tsx': { key: 'bankAccounts.title', default: '銀行帳戶' },
  'Holdings.tsx': { key: 'holdings.title', default: '庫存管理' },
  'Portfolio.tsx': { key: 'portfolio.title', default: '投資組合' },
  'Dividends.tsx': { key: 'dividends.title', default: '歷史收益' },
  'StockAnnouncements.tsx': { key: 'stockAnnouncements.title', default: '個股查詢' },
  'WelcomeGuide.tsx': { key: 'welcomeGuide.title', default: '使用指南' },
  'Admin.tsx': { key: 'admin.title', default: '後台管理' },
  'Dashboard.tsx': { key: 'dashboard.title', default: '投資組合儀表版' },
};

pages.forEach(pageFile => {
  const filePath = path.join(pagesDir, pageFile);
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. 添加 useLanguage import
  if (!content.includes('useLanguage') && !content.includes("from '../contexts/LanguageContext'")) {
    // 查找第一個 import 語句後插入
    const importMatch = content.match(/^import.*from ['"]react['"];?/m);
    if (importMatch) {
      const insertPos = content.indexOf('\n', importMatch.index + importMatch[0].length);
      content = content.slice(0, insertPos) + 
                "\nimport { useLanguage } from '../contexts/LanguageContext';" +
                content.slice(insertPos);
      modified = true;
    }
  }

  // 2. 添加 useLanguage hook 調用
  const componentMatch = content.match(/(const\s+\w+\s*=\s*\(\)\s*=>\s*\{)/);
  if (componentMatch && !content.includes('const { t } = useLanguage();')) {
    const insertPos = componentMatch.index + componentMatch[0].length;
    // 查找下一行
    const nextLine = content.indexOf('\n', insertPos);
    content = content.slice(0, nextLine) + 
              '\n  const { t } = useLanguage();' +
              content.slice(nextLine);
    modified = true;
  }

  // 3. 替換常見的載入文字
  content = content.replace(/載入中\.\.\./g, "{t('common.loading', '載入中...')}");
  modified = modified || content.includes("{t('common.loading'");

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`已更新: ${pageFile}`);
  } else {
    console.log(`無需更新: ${pageFile}`);
  }
});

console.log('批量更新完成！');


