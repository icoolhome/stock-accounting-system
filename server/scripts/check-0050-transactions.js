const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 找到數據庫文件（檢查多個可能的路徑）
const possiblePaths = [
  path.join(__dirname, '..', 'database.sqlite'),
  path.join(__dirname, '..', 'data', 'stock_accounting.db'),
  path.join(__dirname, '..', '..', 'database.sqlite'),
  path.join(process.cwd(), 'database.sqlite'),
  path.join(process.cwd(), 'server', 'database.sqlite'),
];

let dbPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    dbPath = p;
    break;
  }
}

if (!dbPath) {
  console.error('數據庫文件不存在，嘗試的路徑:');
  possiblePaths.forEach(p => console.error('  -', p));
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error('數據庫文件不存在:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

console.log('正在查詢 0050 的交易記錄...\n');

  // 查詢所有 0050 的交易記錄
  db.all(`
    SELECT 
      t.id,
      t.trade_date,
      t.settlement_date,
      t.transaction_type,
      t.stock_code,
      t.stock_name,
      t.quantity,
      t.price,
      t.fee,
      t.transaction_amount,
      sa.account_name,
      sa.broker_name
    FROM transactions t
    LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id
    WHERE t.stock_code = '0050' OR t.stock_code = '50'
    ORDER BY t.trade_date ASC, t.id ASC
  `, [], (err, rows) => {
  if (err) {
    console.error('查詢失敗:', err);
    db.close();
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('沒有找到 0050 的交易記錄');
    db.close();
    return;
  }

  console.log(`找到 ${rows.length} 筆 0050 的交易記錄\n`);
  console.log('='.repeat(100));

  // 分類買進和賣出
  const buys = [];
  const sells = [];
  
  rows.forEach(row => {
    const isBuy = row.transaction_type.includes('買進') || row.transaction_type.includes('買入');
    const isSell = row.transaction_type.includes('賣出') || row.transaction_type.includes('賣');
    const isFinancing = row.transaction_type.includes('融資');
    const isShortSell = row.transaction_type.includes('融券');
    
    if (isBuy && !isFinancing && !isShortSell) {
      buys.push(row);
    } else if (isSell && !isFinancing && !isShortSell) {
      sells.push(row);
    }
  });

  // 統計買進
  console.log('\n【買進交易記錄】');
  console.log('-'.repeat(100));
  let totalBuyQty = 0;
  buys.forEach((row, idx) => {
    totalBuyQty += row.quantity;
    console.log(`${idx + 1}. 日期: ${row.trade_date} | 類型: ${row.transaction_type} | 數量: ${row.quantity.toLocaleString()} | 價格: ${row.price} | 交易ID: ${row.id} | 帳號: ${row.account_name || 'N/A'} - ${row.broker_name || 'N/A'}`);
  });
  console.log(`\n買進統計: 總筆數=${buys.length}, 總數量=${totalBuyQty.toLocaleString()}`);

  // 統計賣出
  console.log('\n【賣出交易記錄】');
  console.log('-'.repeat(100));
  let totalSellQty = 0;
  sells.forEach((row, idx) => {
    totalSellQty += row.quantity;
    console.log(`${idx + 1}. 日期: ${row.trade_date} | 類型: ${row.transaction_type} | 數量: ${row.quantity.toLocaleString()} | 價格: ${row.price} | 交易ID: ${row.id} | 帳號: ${row.account_name || 'N/A'} - ${row.broker_name || 'N/A'}`);
  });
  console.log(`\n賣出統計: 總筆數=${sells.length}, 總數量=${totalSellQty.toLocaleString()}`);

  // 計算理論庫存
  const theoreticalHolding = totalBuyQty - totalSellQty;
  console.log('\n【庫存統計】');
  console.log('-'.repeat(100));
  console.log(`買進總數: ${totalBuyQty.toLocaleString()}`);
  console.log(`賣出總數: ${totalSellQty.toLocaleString()}`);
  console.log(`理論庫存: ${theoreticalHolding.toLocaleString()} (買進 - 賣出)`);
  console.log(`當前顯示庫存: 60,000 (需要檢查)`);
  console.log(`差異: ${(60000 - theoreticalHolding).toLocaleString()}`);

  // 檢查 6/24 的交易
  console.log('\n【2025/6/24 交易詳情】');
  console.log('-'.repeat(100));
  const trades624 = rows.filter(row => row.trade_date === '2025-06-24');
  if (trades624.length > 0) {
    trades624.forEach(row => {
      const isBuy = row.transaction_type.includes('買進') || row.transaction_type.includes('買入');
      const isSell = row.transaction_type.includes('賣出') || row.transaction_type.includes('賣');
      console.log(`日期: ${row.trade_date} | 類型: ${row.transaction_type} | 數量: ${row.quantity.toLocaleString()} | 價格: ${row.price} | 交易ID: ${row.id}`);
    });
  } else {
    console.log('沒有找到 2025/6/24 的交易記錄');
  }

  // 檢查 6/24 之後的交易
  console.log('\n【2025/6/24 之後的買進交易】');
  console.log('-'.repeat(100));
  const buysAfter624 = buys.filter(row => row.trade_date && new Date(row.trade_date) >= new Date('2025-06-24'));
  let totalBuyAfter624 = 0;
  if (buysAfter624.length > 0) {
    buysAfter624.forEach((row, idx) => {
      totalBuyAfter624 += row.quantity;
      console.log(`${idx + 1}. 日期: ${row.trade_date} | 數量: ${row.quantity.toLocaleString()} | 價格: ${row.price} | 交易ID: ${row.id}`);
    });
    console.log(`6/24 之後買進總數: ${totalBuyAfter624.toLocaleString()}`);
  } else {
    console.log('沒有找到 6/24 之後的買進交易');
  }

  console.log('\n【2025/6/24 之後的賣出交易】');
  console.log('-'.repeat(100));
  const sellsAfter624 = sells.filter(row => row.trade_date && new Date(row.trade_date) >= new Date('2025-06-24'));
  let totalSellAfter624 = 0;
  if (sellsAfter624.length > 0) {
    sellsAfter624.forEach((row, idx) => {
      totalSellAfter624 += row.quantity;
      console.log(`${idx + 1}. 日期: ${row.trade_date} | 數量: ${row.quantity.toLocaleString()} | 價格: ${row.price} | 交易ID: ${row.id}`);
    });
    console.log(`6/24 之後賣出總數: ${totalSellAfter624.toLocaleString()}`);
  } else {
    console.log('沒有找到 6/24 之後的賣出交易');
  }

  // 計算 6/24 之後的理論庫存
  if (buysAfter624.length > 0 || sellsAfter624.length > 0) {
    const theoreticalHoldingAfter624 = totalBuyAfter624 - totalSellAfter624;
    console.log(`\n6/24 之後理論庫存: ${theoreticalHoldingAfter624.toLocaleString()} (6/24 之後買進 - 6/24 之後賣出)`);
  }

  console.log('\n' + '='.repeat(100));

  db.close();
});
