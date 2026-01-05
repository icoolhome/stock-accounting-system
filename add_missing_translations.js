#!/usr/bin/env node
/**
 * 添加缺失的翻譯鍵到英文語言包
 */

const fs = require('fs');
const path = require('path');

const enPackPath = path.join(__dirname, 'language_pack_en.json');
const zhTWPackPath = path.join(__dirname, 'language_pack_zh-TW.json');
const zhCNPackPath = path.join(__dirname, 'language_pack_zh-CN.json');

// 讀取現有語言包
const enPack = JSON.parse(fs.readFileSync(enPackPath, 'utf8'));
const zhTWPack = JSON.parse(fs.readFileSync(zhTWPackPath, 'utf8'));
const zhCNPack = JSON.parse(fs.readFileSync(zhCNPackPath, 'utf8'));

// 新增的翻譯鍵（英文）
const newTranslations = {
  // Portfolio 頁面
  'portfolio.totalMarketValue': 'Total Market Value',
  'portfolio.totalCost': 'Total Cost',
  'portfolio.totalProfitLoss': 'Total Profit/Loss',
  'portfolio.totalReturnRate': 'Total Return Rate',
  'portfolio.accountStats': 'Account Statistics',
  'portfolio.allAccounts': 'All Accounts',
  'portfolio.returnRate': 'Return Rate',
  'portfolio.assetDistribution': 'Asset Distribution',
  'portfolio.accountMarketValueComparison': 'Account Market Value Comparison',
  'portfolio.noData': 'No Data',
  'portfolio.otherHoldings': 'Other Holdings',
  
  // Admin 頁面
  'admin.systemLogsSheet': 'System Logs',
  'admin.systemLogsFileName': 'System Logs',
  'admin.exportLogsSuccess': 'Logs exported successfully',
  'admin.exportLogsFailed': 'Failed to export logs',
  'admin.confirmDeleteUser': 'Are you sure you want to delete this user?',
  'admin.userDeleted': 'User deleted',
  'admin.deleteUserFailed': 'Failed to delete user',
  'admin.confirmEditAdmin': 'Are you sure you want to edit this admin?',
  'admin.adminCreated': 'Admin created',
  'admin.adminUpdated': 'Admin updated',
  'admin.settingsUpdatedRelogin': 'Settings updated, please log in again',
  'admin.diagnosticsCompleted': 'System diagnostics completed',
  'admin.confirmDeleteLog': 'Are you sure you want to delete this log?',
  'admin.logDeleted': 'Log deleted',
  'admin.deleteLogFailed': 'Failed to delete log',
  'admin.confirmPurgeAllData': 'This operation will delete all transactions, holdings, settlements, dividends, bank accounts, currency settings, system logs and TWSE ex-rights/ex-dividend data, and cannot be recovered. Are you sure you want to continue?',
  'admin.confirmPurgeAllDataSecond': 'Confirm again: Are you sure you want to delete all business data? This action cannot be undone, please proceed with caution.',
  'admin.allDataPurged': 'All business data deleted',
  'admin.purgeAllDataFailed': 'Failed to delete all data',
  
  // Dividends 頁面
  'dividends.historyRecords': 'Dividend History Records',
  'dividends.twseExrightsQuery': 'TWSE Ex-Rights/Ex-Dividend Query',
  'dividends.exportDividendsExcel': 'Export Dividend History Excel',
  'dividends.addDividendRecord': 'Add Dividend Record',
  'dividends.selectStartEndDate': 'Please select start date and end date first',
  'dividends.queryFailed': 'Query failed',
  'dividends.queryTwseFailed': 'Failed to query TWSE ex-rights/ex-dividend data',
  'dividends.editDividendRecord': 'Edit Dividend Record',
  
  // StockAnnouncements 頁面
  'stockAnnouncements.enterStockCodeOrName': 'Please enter stock code (e.g., 2330) or stock name (e.g., TSMC)',
  'stockAnnouncements.clearKeyword': 'Clear keyword',
  'stockAnnouncements.listed': 'Listed',
  'stockAnnouncements.otc': 'OTC',
  'stockAnnouncements.emerging': 'Emerging',
  'stockAnnouncements.nonETF': 'Non-ETF',
  'stockAnnouncements.stockETF': 'Stock ETF',
  'stockAnnouncements.bondETF': 'Bond ETF',
  'stockAnnouncements.commodityETF': 'Commodity ETF',
  'stockAnnouncements.currencyETF': 'Currency ETF',
  'stockAnnouncements.allIndustries': 'All Industries',
  'stockAnnouncements.clearFilters': 'Clear Filters',
  'stockAnnouncements.clearAll': 'Clear All',
  'stockAnnouncements.searching': 'Searching...',
  'stockAnnouncements.search': 'Search',
  'stockAnnouncements.searchResults': 'Search Results',
  'stockAnnouncements.clearResults': 'Clear Results',
  'stockAnnouncements.normalStock': 'Normal Stock',
  'stockAnnouncements.marketType': 'Market Type',
  'stockAnnouncements.etfType': 'ETF Type',
  'stockAnnouncements.industry': 'Industry',
  'stockAnnouncements.advancedFilters': 'Advanced Filters',
  'stockAnnouncements.searchFailed': 'Search failed',
  
  // Settings 頁面（缺失的部分）
  'settings.saveSettingsSuccess': 'Settings saved successfully',
  'settings.saveSettingsFailed': 'Failed to save settings',
  'settings.currencyAddSuccess': 'Currency added successfully',
  'settings.currencyAddFailed': 'Failed to add currency',
  'settings.languagePackSaved': 'Language pack saved successfully',
  'settings.languagePackSaveFailed': 'Failed to save language pack',
  'settings.editLanguagePack': 'Edit Language Pack',
  'settings.securitiesAccountManagementDesc': 'Add, edit or delete your securities accounts for use in transactions, settlements, holdings and other functions.',
};

// 新增的翻譯鍵（繁體中文）
const newTranslationsZHTW = {
  // Portfolio 頁面
  'portfolio.totalMarketValue': '總市值',
  'portfolio.totalCost': '總成本',
  'portfolio.totalProfitLoss': '總損益',
  'portfolio.totalReturnRate': '總報酬率',
  'portfolio.accountStats': '帳戶統計',
  'portfolio.allAccounts': '所有帳戶',
  'portfolio.returnRate': '報酬率',
  'portfolio.assetDistribution': '資產分布',
  'portfolio.accountMarketValueComparison': '帳戶市值對比',
  'portfolio.noData': '尚無數據',
  'portfolio.otherHoldings': '其他持股',
  
  // Admin 頁面
  'admin.systemLogsSheet': '系統日誌',
  'admin.systemLogsFileName': '系統日誌',
  'admin.exportLogsSuccess': '日誌匯出成功',
  'admin.exportLogsFailed': '匯出日誌失敗',
  'admin.confirmDeleteUser': '確定要刪除該用戶嗎？',
  'admin.userDeleted': '用戶已刪除',
  'admin.deleteUserFailed': '刪除用戶失敗',
  'admin.confirmEditAdmin': '確定要編輯該管理員嗎？',
  'admin.adminCreated': '管理員已創建',
  'admin.adminUpdated': '管理員已更新',
  'admin.settingsUpdatedRelogin': '設定已更新，請重新登入',
  'admin.diagnosticsCompleted': '系統診斷完成',
  'admin.confirmDeleteLog': '確定要刪除該日誌嗎？',
  'admin.logDeleted': '日誌已刪除',
  'admin.deleteLogFailed': '刪除日誌失敗',
  'admin.confirmPurgeAllData': '此操作將刪除所有交易、庫存、交割、股息、銀行帳戶、幣別設定、系統日誌與證交所除權除息資料，且無法復原。確定要繼續嗎？',
  'admin.confirmPurgeAllDataSecond': '再次確認：確定要刪除全部業務數據嗎？此動作無法還原，請謹慎操作。',
  'admin.allDataPurged': '已刪除全部業務數據',
  'admin.purgeAllDataFailed': '刪除全部數據失敗',
  
  // Dividends 頁面
  'dividends.historyRecords': '歷史收益記錄',
  'dividends.twseExrightsQuery': 'TWSE 除權除息查詢',
  'dividends.exportDividendsExcel': '匯出歷史收益 Excel',
  'dividends.addDividendRecord': '新增收益記錄',
  'dividends.selectStartEndDate': '請先選擇開始日期與結束日期',
  'dividends.queryFailed': '查詢失敗',
  'dividends.queryTwseFailed': '查詢 TWSE 除權除息資料失敗',
  'dividends.editDividendRecord': '編輯收益記錄',
  
  // StockAnnouncements 頁面
  'stockAnnouncements.enterStockCodeOrName': '請輸入股票代號（如：2330）或股票名稱（如：台積電）',
  'stockAnnouncements.clearKeyword': '清除關鍵字',
  'stockAnnouncements.listed': '上市',
  'stockAnnouncements.otc': '上櫃',
  'stockAnnouncements.emerging': '興櫃',
  'stockAnnouncements.nonETF': '非ETF',
  'stockAnnouncements.stockETF': '股票型ETF',
  'stockAnnouncements.bondETF': '債券型ETF',
  'stockAnnouncements.commodityETF': '商品型ETF',
  'stockAnnouncements.currencyETF': '貨幣型ETF',
  'stockAnnouncements.allIndustries': '全部行業',
  'stockAnnouncements.clearFilters': '清除篩選條件',
  'stockAnnouncements.clearAll': '清除全部',
  'stockAnnouncements.searching': '搜尋中...',
  'stockAnnouncements.search': '搜尋',
  'stockAnnouncements.searchResults': '搜尋結果',
  'stockAnnouncements.clearResults': '清除結果',
  'stockAnnouncements.normalStock': '一般股票',
  'stockAnnouncements.marketType': '市場別',
  'stockAnnouncements.etfType': 'ETF類型',
  'stockAnnouncements.industry': '行業',
  'stockAnnouncements.advancedFilters': '進階篩選',
  'stockAnnouncements.searchFailed': '搜尋失敗',
  
  // Settings 頁面
  'settings.saveSettingsSuccess': '設定保存成功',
  'settings.saveSettingsFailed': '保存設定失敗',
  'settings.currencyAddSuccess': '幣別新增成功',
  'settings.currencyAddFailed': '新增幣別失敗',
  'settings.languagePackSaved': '語言包保存成功',
  'settings.languagePackSaveFailed': '保存語言包失敗',
  'settings.editLanguagePack': '編輯語言包',
  'settings.securitiesAccountManagementDesc': '新增、編輯或刪除您的證券帳戶，供交易記錄與交割、庫存等功能使用。',
};

// 新增的翻譯鍵（簡體中文）
const newTranslationsZHCN = {
  // Portfolio 頁面
  'portfolio.totalMarketValue': '总市值',
  'portfolio.totalCost': '总成本',
  'portfolio.totalProfitLoss': '总损益',
  'portfolio.totalReturnRate': '总报酬率',
  'portfolio.accountStats': '账户统计',
  'portfolio.allAccounts': '所有账户',
  'portfolio.returnRate': '报酬率',
  'portfolio.assetDistribution': '资产分布',
  'portfolio.accountMarketValueComparison': '账户市值对比',
  'portfolio.noData': '尚无数据',
  'portfolio.otherHoldings': '其他持股',
  
  // Admin 頁面
  'admin.systemLogsSheet': '系统日志',
  'admin.systemLogsFileName': '系统日志',
  'admin.exportLogsSuccess': '日志导出成功',
  'admin.exportLogsFailed': '导出日志失败',
  'admin.confirmDeleteUser': '确定要删除该用户吗？',
  'admin.userDeleted': '用户已删除',
  'admin.deleteUserFailed': '删除用户失败',
  'admin.confirmEditAdmin': '确定要编辑该管理员吗？',
  'admin.adminCreated': '管理员已创建',
  'admin.adminUpdated': '管理员已更新',
  'admin.settingsUpdatedRelogin': '设置已更新，请重新登录',
  'admin.diagnosticsCompleted': '系统诊断完成',
  'admin.confirmDeleteLog': '确定要删除该日志吗？',
  'admin.logDeleted': '日志已删除',
  'admin.deleteLogFailed': '删除日志失败',
  'admin.confirmPurgeAllData': '此操作将删除所有交易、库存、交割、股息、银行账户、币别设置、系统日志与证交所除权除息资料，且无法复原。确定要继续吗？',
  'admin.confirmPurgeAllDataSecond': '再次确认：确定要删除全部业务数据吗？此动作无法还原，请谨慎操作。',
  'admin.allDataPurged': '已删除全部业务数据',
  'admin.purgeAllDataFailed': '删除全部数据失败',
  
  // Dividends 頁面
  'dividends.historyRecords': '历史收益记录',
  'dividends.twseExrightsQuery': 'TWSE 除权除息查询',
  'dividends.exportDividendsExcel': '导出历史收益 Excel',
  'dividends.addDividendRecord': '新增收益记录',
  'dividends.selectStartEndDate': '请先选择开始日期与结束日期',
  'dividends.queryFailed': '查询失败',
  'dividends.queryTwseFailed': '查询 TWSE 除权除息资料失败',
  'dividends.editDividendRecord': '编辑收益记录',
  
  // StockAnnouncements 頁面
  'stockAnnouncements.enterStockCodeOrName': '请输入股票代号（如：2330）或股票名称（如：台积电）',
  'stockAnnouncements.clearKeyword': '清除关键字',
  'stockAnnouncements.listed': '上市',
  'stockAnnouncements.otc': '上柜',
  'stockAnnouncements.emerging': '兴柜',
  'stockAnnouncements.nonETF': '非ETF',
  'stockAnnouncements.stockETF': '股票型ETF',
  'stockAnnouncements.bondETF': '债券型ETF',
  'stockAnnouncements.commodityETF': '商品型ETF',
  'stockAnnouncements.currencyETF': '货币型ETF',
  'stockAnnouncements.allIndustries': '全部行业',
  'stockAnnouncements.clearFilters': '清除筛选条件',
  'stockAnnouncements.clearAll': '清除全部',
  'stockAnnouncements.searching': '搜索中...',
  'stockAnnouncements.search': '搜索',
  'stockAnnouncements.searchResults': '搜索结果',
  'stockAnnouncements.clearResults': '清除结果',
  'stockAnnouncements.normalStock': '一般股票',
  'stockAnnouncements.marketType': '市场别',
  'stockAnnouncements.etfType': 'ETF类型',
  'stockAnnouncements.industry': '行业',
  'stockAnnouncements.advancedFilters': '进阶筛选',
  'stockAnnouncements.searchFailed': '搜索失败',
  
  // Settings 頁面
  'settings.saveSettingsSuccess': '设置保存成功',
  'settings.saveSettingsFailed': '保存设置失败',
  'settings.currencyAddSuccess': '币别新增成功',
  'settings.currencyAddFailed': '新增币别失败',
  'settings.languagePackSaved': '语言包保存成功',
  'settings.languagePackSaveFailed': '保存语言包失败',
  'settings.editLanguagePack': '编辑语言包',
  'settings.securitiesAccountManagementDesc': '新增、编辑或删除您的证券账户，供交易记录与交割、库存等功能使用。',
};

// 合併翻譯
Object.assign(enPack.translations, newTranslations);
Object.assign(zhTWPack.translations, newTranslationsZHTW);
Object.assign(zhCNPack.translations, newTranslationsZHCN);

// 寫回文件
fs.writeFileSync(enPackPath, JSON.stringify(enPack, null, 2), 'utf8');
fs.writeFileSync(zhTWPackPath, JSON.stringify(zhTWPack, null, 2), 'utf8');
fs.writeFileSync(zhCNPackPath, JSON.stringify(zhCNPack, null, 2), 'utf8');

console.log('已添加翻譯鍵到所有語言包：');
console.log(`  - 英文：${Object.keys(newTranslations).length} 個`);
console.log(`  - 繁體中文：${Object.keys(newTranslationsZHTW).length} 個`);
console.log(`  - 簡體中文：${Object.keys(newTranslationsZHCN).length} 個`);


