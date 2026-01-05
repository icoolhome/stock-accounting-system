#!/usr/bin/env node
/**
 * 批量替換所有頁面標題為翻譯函數
 */

const fs = require('fs');
const path = require('path');

const replacements = [
  {
    file: 'Settlements.tsx',
    patterns: [
      { search: /<h1[^>]*>交割管理<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('settlements.title', '交割管理')}</h1>" },
      { search: /交割管理/g, replace: "{t('settlements.title', '交割管理')}" },
    ]
  },
  {
    file: 'BankAccounts.tsx',
    patterns: [
      { search: /<h1[^>]*>銀行帳戶<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('bankAccounts.title', '銀行帳戶')}</h1>" },
    ]
  },
  {
    file: 'Holdings.tsx',
    patterns: [
      { search: /<h1[^>]*>庫存管理<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('holdings.title', '庫存管理')}</h1>" },
    ]
  },
  {
    file: 'Portfolio.tsx',
    patterns: [
      { search: /<h1[^>]*>投資組合<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('portfolio.title', '投資組合')}</h1>" },
    ]
  },
  {
    file: 'Dividends.tsx',
    patterns: [
      { search: /<h1[^>]*>歷史收益<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('dividends.title', '歷史收益')}</h1>" },
    ]
  },
  {
    file: 'StockAnnouncements.tsx',
    patterns: [
      { search: /<h1[^>]*>個股查詢<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('stockAnnouncements.title', '個股查詢')}</h1>" },
    ]
  },
  {
    file: 'WelcomeGuide.tsx',
    patterns: [
      { search: /<h1[^>]*>使用指南<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('welcomeGuide.title', '使用指南')}</h1>" },
    ]
  },
  {
    file: 'Admin.tsx',
    patterns: [
      { search: /<h1[^>]*>後台管理<\/h1>/g, replace: "<h1 className=\"text-2xl font-bold text-gray-900\">{t('admin.title', '後台管理')}</h1>" },
    ]
  },
];

const pagesDir = path.join(__dirname, 'client', 'src', 'pages');

replacements.forEach(({ file, patterns }) => {
  const filePath = path.join(pagesDir, file);
  if (!fs.existsSync(filePath)) {
    console.log(`文件不存在: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  patterns.forEach(({ search, replace }) => {
    if (search.test(content)) {
      content = content.replace(search, replace);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`已更新: ${file}`);
  } else {
    console.log(`無需更新: ${file}`);
  }
});

console.log('批量替換完成！');


