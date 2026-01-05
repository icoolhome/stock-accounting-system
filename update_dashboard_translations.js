#!/usr/bin/env node
/**
 * 添加 Dashboard 頁面所需的翻譯鍵到語言包
 */

const fs = require('fs');
const path = require('path');

const translations = {
  'zh-CN': {
    "dashboard.portfolioValue": "投资组合价值",
    "dashboard.totalCost": "总成本",
    "dashboard.profitLoss": "损益",
    "dashboard.dividendIncome": "股息收入（本年度累计）",
    "dashboard.bankTotal": "银行总额",
    "dashboard.availableBalance": "可用余额",
    "dashboard.quickFunctions": "快捷功能",
    "dashboard.show": "显示：",
    "dashboard.all": "全部",
    "dashboard.tradeRelated": "交易相关",
    "dashboard.holdingsPortfolio": "库存 / 投资组合",
    "dashboard.incomeSettlement": "收益 / 交割",
    "dashboard.bankAccount": "银行账户",
    "dashboard.searchGuide": "查询 / 指南",
    "dashboard.systemSettings": "系统设定",
    "dashboard.addTransaction": "新增交易",
    "dashboard.viewAll": "查看全部",
    "dashboard.noTransactions": "尚无交易记录",
    "dashboard.tradeDate": "成交日期",
    "dashboard.type": "种类",
    "dashboard.code": "代号",
    "dashboard.productName": "商品名称",
    "dashboard.quantity": "数量",
    "dashboard.price": "成交价",
    "dashboard.addSecuritiesAccount": "新增证券账户",
    "dashboard.addBankAccount": "新增银行账户",
    "dashboard.updateStockData": "更新股票资料",
    "dashboard.addTransactionRecord": "新增交易记录",
    "dashboard.addSettlementRecord": "新增交割记录",
    "dashboard.addBankDetail": "新增银行明细",
    "dashboard.gotoSettings": "前往设定",
    "dashboard.gotoBankAccounts": "前往银行账户",
    "dashboard.gotoTransactions": "前往交易记录",
    "dashboard.gotoSettlements": "前往交割管理",
    "dashboard.iKnow": "我知道了",
    "dashboard.enter": "进入",
    "dashboard.click": "点击",
    "dashboard.to": "→",
    "dashboard.goToSecuritiesAccountManagement": "前往证券账户管理",
  },
  'zh-TW': {
    "dashboard.portfolioValue": "投資組合價值",
    "dashboard.totalCost": "總成本",
    "dashboard.profitLoss": "損益",
    "dashboard.dividendIncome": "股息收入（本年度累計）",
    "dashboard.bankTotal": "銀行總額",
    "dashboard.availableBalance": "可用餘額",
    "dashboard.quickFunctions": "快捷功能",
    "dashboard.show": "顯示：",
    "dashboard.all": "全部",
    "dashboard.tradeRelated": "交易相關",
    "dashboard.holdingsPortfolio": "庫存 / 投資組合",
    "dashboard.incomeSettlement": "收益 / 交割",
    "dashboard.bankAccount": "銀行帳戶",
    "dashboard.searchGuide": "查詢 / 指南",
    "dashboard.systemSettings": "系統設定",
    "dashboard.addTransaction": "新增交易",
    "dashboard.viewAll": "查看全部",
    "dashboard.noTransactions": "尚無交易記錄",
    "dashboard.tradeDate": "成交日期",
    "dashboard.type": "種類",
    "dashboard.code": "代號",
    "dashboard.productName": "商品名稱",
    "dashboard.quantity": "數量",
    "dashboard.price": "成交價",
    "dashboard.addSecuritiesAccount": "新增證券帳戶",
    "dashboard.addBankAccount": "新增銀行帳戶",
    "dashboard.updateStockData": "更新股票資料",
    "dashboard.addTransactionRecord": "新增交易記錄",
    "dashboard.addSettlementRecord": "新增交割記錄",
    "dashboard.addBankDetail": "新增銀行明細",
    "dashboard.gotoSettings": "前往設定",
    "dashboard.gotoBankAccounts": "前往銀行帳戶",
    "dashboard.gotoTransactions": "前往交易記錄",
    "dashboard.gotoSettlements": "前往交割管理",
    "dashboard.iKnow": "我知道了",
    "dashboard.enter": "進入",
    "dashboard.click": "點擊",
    "dashboard.to": "→",
    "dashboard.goToSecuritiesAccountManagement": "前往證券帳戶管理",
  },
  'en': {
    "dashboard.portfolioValue": "Portfolio Value",
    "dashboard.totalCost": "Total Cost",
    "dashboard.profitLoss": "Profit/Loss",
    "dashboard.dividendIncome": "Dividend Income (Year to Date)",
    "dashboard.bankTotal": "Bank Total",
    "dashboard.availableBalance": "Available Balance",
    "dashboard.quickFunctions": "Quick Functions",
    "dashboard.show": "Show:",
    "dashboard.all": "All",
    "dashboard.tradeRelated": "Trade Related",
    "dashboard.holdingsPortfolio": "Holdings / Portfolio",
    "dashboard.incomeSettlement": "Income / Settlement",
    "dashboard.bankAccount": "Bank Account",
    "dashboard.searchGuide": "Search / Guide",
    "dashboard.systemSettings": "System Settings",
    "dashboard.addTransaction": "Add Transaction",
    "dashboard.viewAll": "View All",
    "dashboard.noTransactions": "No transactions yet",
    "dashboard.tradeDate": "Trade Date",
    "dashboard.type": "Type",
    "dashboard.code": "Code",
    "dashboard.productName": "Product Name",
    "dashboard.quantity": "Quantity",
    "dashboard.price": "Price",
    "dashboard.addSecuritiesAccount": "Add Securities Account",
    "dashboard.addBankAccount": "Add Bank Account",
    "dashboard.updateStockData": "Update Stock Data",
    "dashboard.addTransactionRecord": "Add Transaction Record",
    "dashboard.addSettlementRecord": "Add Settlement Record",
    "dashboard.addBankDetail": "Add Bank Detail",
    "dashboard.gotoSettings": "Go to Settings",
    "dashboard.gotoBankAccounts": "Go to Bank Accounts",
    "dashboard.gotoTransactions": "Go to Transactions",
    "dashboard.gotoSettlements": "Go to Settlements",
    "dashboard.iKnow": "I Understand",
    "dashboard.enter": "Enter",
    "dashboard.click": "Click",
    "dashboard.to": "→",
    "dashboard.goToSecuritiesAccountManagement": "Go to Securities Account Management",
  }
};

['zh-CN', 'zh-TW', 'en'].forEach(lang => {
  const filePath = path.join(__dirname, `language_pack_${lang}.json`);
  const content = fs.readFileSync(filePath, 'utf8');
  const pack = JSON.parse(content);
  
  // 添加翻譯
  Object.assign(pack.translations, translations[lang]);
  
  // 寫回文件
  fs.writeFileSync(filePath, JSON.stringify(pack, null, 2) + '\n', 'utf8');
  console.log(`已更新 ${lang} 語言包`);
});

console.log('完成！');


