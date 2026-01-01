import express from 'express';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { promisify } from 'util';

const router = express.Router();

router.use(authenticate);

// 輔助函數：無條件捨去到小數點第二位
const floorTo2Decimals = (value: number): number => {
  return Math.floor(value * 100) / 100;
};

// 輔助函數：四捨五入到小數點第四位（用於成本均價）
const roundTo4Decimals = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

// 輔助函數：計算融資金額（計算到新台幣千元單位，千元以下無條件捨去）
const calculateFinancingAmount = (price: number, quantity: number, financingRate: number = 0.6): number => {
  const amount = price * quantity * financingRate;
  return Math.floor(amount / 1000) * 1000; // 千元以下捨去
};

// 輔助函數：計算券保證金（計算到新台幣百元單位，百元以下無條件進位）
const calculateMargin = (price: number, quantity: number, marginRate: number = 0.9): number => {
  const amount = price * quantity * marginRate;
  return Math.ceil(amount / 100) * 100; // 百元以下進位
};

// 輔助函數：計算兩個日期之間的天數
const daysBetween = (date1: string, date2: string): number => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

// 輔助函數：計算預估息（融資價金 × 融資利率 × N/365）
const calculateInterest = (financingAmount: number, financingRate: number, days: number): number => {
  return floorTo2Decimals(financingAmount * financingRate * (days / 365));
};

// 輔助函數：解析 CSV 單行（支援引號與逗號）
const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current !== '') {
    result.push(current.trim());
  }

  return result;
};

// 透過 TWSE MIS API 取得即時股價（支援多檔，上市/上櫃/興櫃）
const fetchRealtimePricesFromMis = async (
  stockCodes: string[],
  marketTypes: string[]
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  if (!stockCodes.length) return result;

  try {
    const channels: string[] = [];
    stockCodes.forEach((code, idx) => {
      const market = marketTypes[idx] || '上市';
      const m = market.includes('上櫃') ? 'otc' : 'tse';
      const normCode = code.padStart(4, '0');
      channels.push(`${m}_${normCode}.tw`);
    });

    const exCh = encodeURIComponent(channels.join('|'));
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${exCh}&json=1&delay=0`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://mis.twse.com.tw/stock/index.jsp',
      },
    });

    if (!res.ok) {
      console.error('TWSE MIS API 請求失敗:', res.status, res.statusText);
      return result;
    }

    const data: any = await res.json();
    const arr: any[] = data.msgArray || [];

    arr.forEach((item) => {
      const code: string = item.c;
      if (!code) return;
      // z: 即時成交價，y: 昨收
      const raw = (item.z && item.z !== '-' ? item.z : item.y) as string;
      if (!raw) return;
      const num = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        result.set(code, num);
      }
    });
  } catch (err: any) {
    console.error('取得 TWSE 即時股價失敗:', err?.message || err);
  }

  return result;
};

// 輔助函數：從台灣證券交易所獲取即時股價（單一股票，改為以收盤價為主）
const fetchStockPrice = async (stockCode: string, marketType: string): Promise<number | null> => {
  try {
    // 使用TWSE Open API獲取所有股票數據
    const response = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`TWSE API 請求失敗: ${response.status}`);
      return null;
    }

    const data: any[] = await response.json();
    const stock = data.find((item: any) => {
      const code = item.Code || item.code || item.股票代號;
      return code === stockCode || code === stockCode.padStart(6, '0');
    });

    if (stock) {
      // 先使用「收盤價」作為市價，其次才使用最後成交價 / 成交價
      const closePrice = stock.Close || stock.close || stock.收盤價;
      if (closePrice && !isNaN(parseFloat(closePrice))) {
        return parseFloat(closePrice);
      }
      // 如果收盤價不可用，再嘗試使用最後成交價 / 成交價
      const lastPrice = stock.Z || stock.z || stock.最後成交價 || stock.Price || stock.price || stock.成交金額;
      if (lastPrice && !isNaN(parseFloat(lastPrice))) {
        return parseFloat(lastPrice);
      }
    }

    return null;
  } catch (error: any) {
    console.error(`獲取股票 ${stockCode} 價格失敗:`, error.message);
    return null;
  }
};

// 批量獲取股票價格（緩存機制）
let priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_DURATION = 60000; // 緩存1分鐘

const fetchStockPricesBatch = async (
  stockCodes: string[],
  marketTypes: string[],
  etfFlagsByCode: Map<string, boolean>
): Promise<Map<string, number>> => {
  const priceMap = new Map<string, number>();
  const now = Date.now();

  // 先檢查緩存，並統計需要重新抓取的代碼與其中 ETF 代碼
  const codesToFetch: string[] = [];
  const etfCodesToFetch: string[] = [];

  stockCodes.forEach((code, index) => {
    const cacheKey = code;
    const cached = priceCache.get(cacheKey);
    const isEtf = !!etfFlagsByCode.get(code);

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      priceMap.set(code, cached.price);
    } else {
      codesToFetch.push(code);
      if (isEtf) {
        etfCodesToFetch.push(code);
      }
    }
  });

  // 如果所有股票都在緩存中，直接返回
  if (codesToFetch.length === 0) {
    return priceMap;
  }

  try {
    if (codesToFetch.length > 0) {
      const realtimeMap = await fetchRealtimePricesFromMis(
        codesToFetch,
        codesToFetch.map((code, idx) => marketTypes[idx] || '上市')
      );

      realtimeMap.forEach((price, code) => {
        if (!isNaN(price) && price > 0) {
          priceMap.set(code, price);
          priceCache.set(code, { price, timestamp: now });
        }
      });
    }

    return priceMap;
  } catch (error: any) {
    console.error(`批量獲取股票價格失敗:`, error.message);
    return priceMap;
  }
};

// 獲取所有庫存（根據交易記錄自動計算）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { securitiesAccountId, stockCode } = req.query;
    const db = getDatabase();
    const all = promisify(db.all.bind(db));

    // 獲取所有交易記錄
    let query = `SELECT t.*, sa.account_name, sa.broker_name, sd.market_type, sd.etf_type, sd.industry
                 FROM transactions t 
                 LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id 
                 LEFT JOIN stock_data sd ON t.stock_code = sd.stock_code
                 WHERE t.user_id = ?`;
    const params: any[] = [req.userId];

    if (securitiesAccountId) {
      query += ' AND t.securities_account_id = ?';
      params.push(securitiesAccountId);
    }
    if (stockCode) {
      query += ' AND t.stock_code LIKE ?';
      params.push(`%${stockCode}%`);
    }

    query += ' ORDER BY t.trade_date ASC, t.created_at ASC';

    const transactions: any[] = await all(query, params);

    // 獲取手續費設定
    let feeSettings: any = {
      baseFeeRate: 0.1425, // 預設 0.1425%（一般股票證券商手續費，單邊）
      etfFeeRate: 0.1425, // 預設 0.1425%（股票型ETF證券商手續費，單邊）
      buyFeeDiscount: 0.6, // 預設 6折（0.6），買進手續費折扣
      sellFeeDiscount: 0.6, // 預設 6折（0.6），賣出手續費折扣
      taxRate: 0.3, // 預設 0.3%（一般股票證交稅，只有賣出時扣，台股標準）
      etfTaxRate: 0.1, // 預設 0.1%（股票型ETF證交稅，只有賣出時扣，台股標準）
    };
    
    try {
      const settings = await all(
        'SELECT setting_key, setting_value FROM system_settings WHERE user_id = ? AND setting_key = ?',
        [req.userId, 'feeSettings']
      );
      
      if (settings.length > 0 && settings[0].setting_value) {
        const parsedSettings = JSON.parse(settings[0].setting_value);
        feeSettings = { ...feeSettings, ...parsedSettings };
        // 兼容舊設定：如果有feeDiscount但沒有buyFeeDiscount和sellFeeDiscount，則使用feeDiscount作為兩者的值
        if (parsedSettings.feeDiscount !== undefined && !parsedSettings.buyFeeDiscount && !parsedSettings.sellFeeDiscount) {
          feeSettings.buyFeeDiscount = parsedSettings.feeDiscount;
          feeSettings.sellFeeDiscount = parsedSettings.feeDiscount;
        }
        // 兼容舊設定：如果沒有etfTaxRate，使用預設值0.1%
        if (!parsedSettings.etfTaxRate) {
          feeSettings.etfTaxRate = 0.1;
        }
        // 兼容舊設定：如果沒有etfFeeRate，使用baseFeeRate作為ETF手續費率
        if (!parsedSettings.etfFeeRate) {
          feeSettings.etfFeeRate = parsedSettings.baseFeeRate || 0.1425;
        }
      }
    } catch (err) {
      console.error('讀取手續費設定失敗，使用預設值:', err);
    }

    // 根據交易記錄計算庫存
    // 使用 Map 來聚合相同股票、帳戶、交易類型的庫存
    // key格式: securities_account_id_stock_code_transactionType_category
    // transactionType: 現股、融資、融券
    // category: 國內(TWD) 或 國外(其他幣別)
    const holdingsMap = new Map<string, any>();

    // 獲取今天的日期（用於判斷國外股票是否包含當日買入）
    const today = new Date().toISOString().split('T')[0];

    // 從設定中讀取費率
    const FEE_RATE = (feeSettings.baseFeeRate || 0.1425) / 100; // 一般股票證券商手續費率（單邊，轉換為小數）
    const ETF_FEE_RATE = (feeSettings.etfFeeRate || 0.1425) / 100; // 股票型ETF證券商手續費率（單邊，轉換為小數）
    const BUY_FEE_RATE_DISCOUNT = FEE_RATE * (feeSettings.buyFeeDiscount || 0.6); // 一般股票買進手續費率（折扣後）
    const SELL_FEE_RATE_DISCOUNT = FEE_RATE * (feeSettings.sellFeeDiscount || 0.6); // 一般股票賣出手續費率（折扣後）
    const ETF_BUY_FEE_RATE_DISCOUNT = ETF_FEE_RATE * (feeSettings.buyFeeDiscount || 0.6); // ETF買進手續費率（折扣後）
    const ETF_SELL_FEE_RATE_DISCOUNT = ETF_FEE_RATE * (feeSettings.sellFeeDiscount || 0.6); // ETF賣出手續費率（折扣後）
    const DEFAULT_TAX_RATE = (feeSettings.taxRate || 0.3) / 100; // 一般股票證交稅率（只有賣出時扣，轉換為小數，台股標準為0.3%）
    const ETF_TAX_RATE = (feeSettings.etfTaxRate || 0.1) / 100; // 股票型ETF證交稅率（只有賣出時扣，轉換為小數，台股標準為0.1%）
    
    // 根據股票類型獲取證交稅率的函數
    // 2026年台股交易稅率規定：
    // - 一般股票：3‰（0.3%）
    // - 股票型ETF（含主動式ETF和被動式ETF）：1‰（0.1%）
    // - 權證：1‰（0.1%）
    // - 現股當沖：1.5‰（0.15%）
    const getTaxRate = (etfType: string | null, stockName: string = '') => {
      if (etfType) {
        // 所有ETF（含主動式ETF和被動式ETF）使用設定中的ETF稅率（預設0.1%）
        return ETF_TAX_RATE;
      }
      // 權證（目前系統未明確標記，可根據股票名稱判斷，暫使用預設值）
      // 一般股票使用預設值（0.3%）
      return DEFAULT_TAX_RATE;
    };
    
    // 根據股票類型獲取手續費率的函數
    const getFeeRate = (etfType: string | null) => {
      if (etfType) {
        // ETF 使用設定中的ETF手續費率
        return ETF_FEE_RATE;
      }
      // 一般股票使用預設手續費率
      return FEE_RATE;
    };
    
    // 根據股票類型和交易方向獲取折扣後手續費率的函數
    const getDiscountFeeRate = (etfType: string | null, isBuy: boolean) => {
      if (etfType) {
        // ETF
        return isBuy ? ETF_BUY_FEE_RATE_DISCOUNT : ETF_SELL_FEE_RATE_DISCOUNT;
      }
      // 一般股票
      return isBuy ? BUY_FEE_RATE_DISCOUNT : SELL_FEE_RATE_DISCOUNT;
    };
    
    const FINANCING_RATE = 0.6; // 融資成數（預設60%）
    const MARGIN_RATE = 0.9; // 融券成數（預設90%）
    const FINANCING_INTEREST_RATE = 0.06; // 融資利率（預設6%，年化）
    const BORROWING_FEE_RATE = 0.001; // 借券費率（預設0.1%）

    transactions.forEach((t: any) => {
      // 判斷交易類型
      let transactionType = '現股'; // 默認
      if (t.transaction_type.includes('融資')) {
        transactionType = '融資';
      } else if (t.transaction_type.includes('融券')) {
        transactionType = '融券';
      }

      // 判斷是國內還是國外
      const isDomestic = (t.currency || 'TWD') === 'TWD';
      const category = isDomestic ? 'TWD' : 'FOREIGN';

      const key = `${t.securities_account_id || 'null'}_${t.stock_code}_${transactionType}_${category}`;

      if (!holdingsMap.has(key)) {
        holdingsMap.set(key, {
          securities_account_id: t.securities_account_id,
          account_name: t.account_name,
          broker_name: t.broker_name,
          stock_code: t.stock_code,
          stock_name: t.stock_name,
          market_type: t.market_type || '',
          etf_type: t.etf_type || null,
          transaction_type: transactionType,
          currency: t.currency || 'TWD',
          isDomestic: isDomestic,
          // 現股相關
          cashQuantity: 0,
          cashTotalPriceQty: 0, // Σ(成交價 × 成交股數)
          cashTotalFee: 0, // Σ(現買交易費用 = 手續費)
          cashBuyBatches: [] as Array<{ price: number; quantity: number; fee: number; trade_date: string; originalQuantity: number }>, // FIFO 買入批次列表
          // 融資相關
          financingQuantity: 0,
          financingBuyTransactions: [] as any[], // 記錄買入交易（用於計算預估息）
          financingTotalMargin: 0, // Σ(資自備款 = 成交價 × 成交股數 - 融資金額)
          financingTotalFee: 0, // Σ(資買交易費用 = 手續費)
          financingTotalAmount: 0, // Σ(融資金額)
          // 融券相關
          shortSellQuantity: 0,
          shortSellSellTransactions: [] as any[], // 記錄賣出交易（用於計算擔保品）
          shortSellBuyTransactions: [] as any[], // 記錄買入交易（用於計算回補成本）
          shortSellTotalMargin: 0, // Σ(券保證金)
          // 國外股票相關
          foreignTotalBuyQuantity: 0, // 總買入股數（用於計算可下單股數）
          foreignTodayBuyQuantity: 0, // 今日買入股數
          foreignTodaySellQuantity: 0, // 今日賣出股數
          // 通用
          current_price: t.price,
        });
      }

      const holding = holdingsMap.get(key);

      // 更新市場別和最新價格
      if (t.market_type) holding.market_type = t.market_type;
      holding.current_price = t.price;

      // 判斷是買入還是賣出
      const isBuy = t.transaction_type.includes('買進') || t.transaction_type.includes('買入');
      const isSell = t.transaction_type.includes('賣出') || t.transaction_type.includes('賣');

      if (isBuy) {
        if (transactionType === '現股') {
          // 現股買入
          const priceQty = t.price * t.quantity;
          // 現買交易費用 = 手續費（使用折扣後的費率，因為持有成本應反映實際支付的手續費）
          const feeRate = getDiscountFeeRate(t.etf_type, true); // 使用買入折扣費率
          const fee = t.fee || floorTo2Decimals(priceQty * feeRate);
          
          holding.cashQuantity += t.quantity;
          holding.cashTotalPriceQty += priceQty;
          holding.cashTotalFee += fee;
          
          // FIFO：記錄買入批次
          holding.cashBuyBatches.push({
            price: t.price,
            quantity: t.quantity,
            fee: fee,
            trade_date: t.trade_date || today,
            originalQuantity: t.quantity,
          });
          
          // 國外股票：記錄買入
          if (!isDomestic) {
            holding.foreignTotalBuyQuantity += t.quantity;
            if (t.trade_date === today) {
              holding.foreignTodayBuyQuantity += t.quantity;
            }
          }
        } else if (transactionType === '融資') {
          // 融資買入
          const priceQty = t.price * t.quantity;
          // 融資金額 = 資買成交價 × 資買成交股數 × 融資成數（千元以下捨去）
          const financingAmount = calculateFinancingAmount(t.price, t.quantity, FINANCING_RATE);
          // 資自備款 = 成交價 × 成交股數 - 融資金額
          const margin = priceQty - financingAmount;
          // 資買交易費用 = 手續費（使用折扣後的費率，因為持有成本應反映實際支付的手續費）
          const feeRate = getDiscountFeeRate(t.etf_type, true); // 使用買入折扣費率
          const fee = t.fee || floorTo2Decimals(priceQty * feeRate);
          
          holding.financingQuantity += t.quantity;
          holding.financingTotalMargin += margin;
          holding.financingTotalFee += fee;
          holding.financingTotalAmount += financingAmount;
          // 記錄買入交易（包含交割日期，用於計算預估息）
          holding.financingBuyTransactions.push({
            quantity: t.quantity,
            price: t.price,
            settlement_date: t.settlement_date || t.trade_date,
            financingAmount: financingAmount,
          });
        } else if (transactionType === '融券') {
          // 融券買入（回補）
          const priceQty = t.price * t.quantity;
          // 券買交易費用 = 手續費 - 預估息
          // 這裡預估息通常是負數（因為是買入回補）
          const fee = t.fee || 0;
          const sellQty = Math.min(t.quantity, holding.shortSellQuantity);
          
          // 按比例減少融券數量
          if (holding.shortSellQuantity > 0) {
            const ratio = sellQty / holding.shortSellQuantity;
            holding.shortSellQuantity -= sellQty;
            holding.shortSellTotalMargin = floorTo2Decimals(holding.shortSellTotalMargin * (1 - ratio));
          }
          // 記錄買入交易（用於計算盈虧）
          holding.shortSellBuyTransactions.push({
            quantity: sellQty,
            price: t.price,
            fee: fee,
            priceQty: priceQty,
          });
        }
      } else if (isSell) {
        if (transactionType === '現股') {
          // 現股賣出（使用 FIFO 方法）
          const sellQty = Math.min(t.quantity, holding.cashQuantity);
          if (sellQty > 0 && holding.cashQuantity > 0) {
            let remainingSellQty = sellQty;
            
            // 按照買入時間順序（FIFO）扣除批次
            while (remainingSellQty > 0 && holding.cashBuyBatches.length > 0) {
              const batch = holding.cashBuyBatches[0];
              
              if (batch.quantity <= remainingSellQty) {
                // 整個批次都被賣出
                const batchPriceQty = batch.price * batch.quantity;
                holding.cashTotalPriceQty -= batchPriceQty;
                holding.cashTotalFee -= batch.fee;
                remainingSellQty -= batch.quantity;
                holding.cashBuyBatches.shift(); // 移除整個批次
              } else {
                // 部分批次被賣出
                const ratio = remainingSellQty / batch.quantity;
                const batchPriceQty = batch.price * batch.quantity;
                const deductedPriceQty = batch.price * remainingSellQty;
                const deductedFee = batch.fee * ratio;
                
                holding.cashTotalPriceQty -= deductedPriceQty;
                holding.cashTotalFee -= deductedFee;
                batch.quantity -= remainingSellQty;
                batch.fee -= deductedFee;
                remainingSellQty = 0;
              }
            }
            
            holding.cashQuantity -= sellQty;
            
            // 國外股票：記錄今日賣出
            if (!isDomestic && t.trade_date === today) {
              holding.foreignTodaySellQuantity += sellQty;
            }
          }
        } else if (transactionType === '融資') {
          // 融資賣出
          const sellQty = Math.min(t.quantity, holding.financingQuantity);
          if (sellQty > 0) {
            // 按比例減少
            const ratio = sellQty / holding.financingQuantity;
            holding.financingQuantity -= sellQty;
            holding.financingTotalMargin = floorTo2Decimals(holding.financingTotalMargin * (1 - ratio));
            holding.financingTotalFee = floorTo2Decimals(holding.financingTotalFee * (1 - ratio));
            holding.financingTotalAmount = floorTo2Decimals(holding.financingTotalAmount * (1 - ratio));
            
            // 從買入交易記錄中按比例移除
            let remainingQty = sellQty;
            for (let i = 0; i < holding.financingBuyTransactions.length && remainingQty > 0; i++) {
              const buyTxn = holding.financingBuyTransactions[i];
              if (buyTxn.quantity <= remainingQty) {
                remainingQty -= buyTxn.quantity;
                holding.financingBuyTransactions.splice(i, 1);
                i--;
              } else {
                buyTxn.quantity -= remainingQty;
                buyTxn.financingAmount = calculateFinancingAmount(buyTxn.price, buyTxn.quantity, FINANCING_RATE);
                remainingQty = 0;
              }
            }
          }
        } else if (transactionType === '融券') {
          // 融券賣出
          const priceQty = t.price * t.quantity;
          // 券保證金 = 成交價 × 成交股數 × 融券成數（百元以下進位）
          const margin = calculateMargin(t.price, t.quantity, MARGIN_RATE);
          // 券賣交易費用 = 手續費 + 交易稅 + 借券費
          const fee = t.fee || 0;
          const tax = (t.tax || 0) + (t.securities_tax || 0);
          const borrowingFee = t.borrowing_fee || floorTo2Decimals(priceQty * BORROWING_FEE_RATE);
          const totalFee = floorTo2Decimals(fee + tax + borrowingFee);
          // 券擔保品 = 券賣成交價 × 券賣成交股數 - 券賣交易費用
          const collateral = floorTo2Decimals(priceQty - totalFee);
          
          holding.shortSellQuantity += t.quantity;
          holding.shortSellTotalMargin += margin;
          // 記錄賣出交易（用於計算盈虧）
          holding.shortSellSellTransactions.push({
            quantity: t.quantity,
            price: t.price,
            fee: fee,
            tax: tax,
            borrowingFee: borrowingFee,
            collateral: collateral,
            settlement_date: t.settlement_date || t.trade_date,
          });
        }
      }
    });

    // 收集所有需要獲取價格的股票代碼（僅國內股票），並記錄是否為 ETF
    const stockCodesToFetch: string[] = [];
    const marketTypesToFetch: string[] = [];
    const etfFlagsByCode = new Map<string, boolean>();
    const uniqueStockCodes = new Set<string>();
    
    Array.from(holdingsMap.values()).forEach((h: any) => {
      if (h.isDomestic && h.stock_code && !uniqueStockCodes.has(h.stock_code)) {
        uniqueStockCodes.add(h.stock_code);
        stockCodesToFetch.push(h.stock_code);
        marketTypesToFetch.push(h.market_type || '上市');
        etfFlagsByCode.set(h.stock_code, !!h.etf_type);
      }
    });

    // 批量獲取股票價格
    const stockPrices = await fetchStockPricesBatch(stockCodesToFetch, marketTypesToFetch, etfFlagsByCode);

    // 更新holdingsMap中的價格
    holdingsMap.forEach((h: any) => {
      if (h.isDomestic && h.stock_code) {
        const realTimePrice = stockPrices.get(h.stock_code);
        if (realTimePrice !== undefined && realTimePrice !== null && realTimePrice > 0) {
          h.current_price = realTimePrice;
        }
      }
    });

    // 轉換為陣列並計算相關數值
    const holdings = Array.from(holdingsMap.values())
      .filter((h: any) => {
        // 根據交易類型判斷是否有庫存
        if (h.transaction_type === '現股') {
          return h.cashQuantity > 0;
        } else if (h.transaction_type === '融資') {
          return h.financingQuantity > 0;
        } else if (h.transaction_type === '融券') {
          return h.shortSellQuantity > 0;
        }
        return false;
      })
      .map((h: any) => {
        let cost_price = 0; // 成本均價
        let holding_cost = 0; // 持有成本
        let quantity = 0; // 股數/可下單股數
        let market_value = 0; // 股票市值
        let profit_loss = 0; // 盈虧
        let break_even_price = 0; // 損益平衡點

        if (h.transaction_type === '現股') {
          if (h.isDomestic) {
            // 國內現股
            quantity = h.cashQuantity;
            if (quantity > 0) {
              // 使用重新計算的值，不使用floorTo2Decimals以保持精度
              // 成本均價 = Σ(成交價 × 成交股數 + 手續費) / 股數（點精靈計算方式：包含手續費）
              cost_price = roundTo4Decimals((h.cashTotalPriceQty + h.cashTotalFee) / quantity);
              // 持有成本 = Σ(成交價 × 成交股數 + 手續費)（包含手續費，以匹配點精靈計算方式）
              // 四捨五入到整數
              holding_cost = Math.round(h.cashTotalPriceQty + h.cashTotalFee);
              // 股票市值 = 市價 × 股數（保持原始精度）
              market_value = (h.current_price || cost_price) * quantity;
              // 盈虧計算：點精靈的計算方式
              // 根據點精靈的計算邏輯：
              // 賣出費用 = 賣出手續費（原價，不打折）+ 賣出交易稅
              // 點精靈使用原價手續費進行預估，不扣除折扣
              const stockTaxRate = getTaxRate(h.etf_type, h.stock_name); // 賣出交易稅率（根據股票類型：一般股票0.3%，ETF 0.1%）
              const stockFeeRate = getFeeRate(h.etf_type); // 賣出手續費率（原價，根據股票類型：一般股票0.1425%，ETF 0.1425%）
              // 點精靈計算：賣出手續費（原價）+ 賣出交易稅
              const estimatedSellFee = floorTo2Decimals(market_value * stockFeeRate); // 賣出手續費（原價，不打折）
              const estimatedSellTax = floorTo2Decimals(market_value * stockTaxRate); // 賣出交易稅
              const totalSellCost = estimatedSellFee + estimatedSellTax; // 總賣出成本
              profit_loss = Math.round(market_value - holding_cost - totalSellCost); // 四捨五入到整數
            }
          } else {
            // 國外現股
            // 可下單股數 = 昨日買入股數 - 今日已賣出成交股數
            const yesterdayBuyQuantity = h.foreignTotalBuyQuantity - h.foreignTodayBuyQuantity;
            quantity = Math.max(0, yesterdayBuyQuantity - h.foreignTodaySellQuantity);
            if (quantity > 0 && h.cashQuantity > 0) {
              // 成本均價 = 持有成本 / 可下單股數
              const totalCost = h.cashTotalPriceQty + h.cashTotalFee;
              const avgCostPerShare = totalCost / h.cashQuantity;
              holding_cost = Math.round(avgCostPerShare * quantity); // 四捨五入到整數
              cost_price = quantity > 0 ? roundTo4Decimals(holding_cost / quantity) : 0;
              // 國外股票市值 = 可下單股數 * 市價（不包含當日買入）
              market_value = floorTo2Decimals((h.current_price || cost_price) * quantity);
              // 盈虧 = 股票市值 - (持有成本 + 賣出市場費用)
              // 假設賣出費用為1%
              const estimatedSellFee = floorTo2Decimals(market_value * 0.01);
              profit_loss = floorTo2Decimals(market_value - (holding_cost + estimatedSellFee));
            }
          }
        } else if (h.transaction_type === '融資') {
          quantity = h.financingQuantity;
          if (quantity > 0) {
            // 成本均價 = (成交價 × 成交股數 + 資買交易費用) / 股數
            // 但持有成本 = 資自備款 + 資買交易費用
            const totalPriceQty = h.financingBuyTransactions.reduce((sum: number, txn: any) => sum + (txn.price * txn.quantity), 0);
            const totalBuyFee = h.financingTotalFee;
            cost_price = roundTo4Decimals((totalPriceQty + totalBuyFee) / quantity);
            // 持有成本 = (成交價 × 成交股數 - 融資金額) + 資買交易費用 = 資自備款 + 資買交易費用
            holding_cost = Math.round(h.financingTotalMargin + h.financingTotalFee); // 四捨五入到整數
            market_value = floorTo2Decimals((h.current_price || cost_price) * quantity);
            
            // 計算預估息：需要根據當前日期和買入交割日期計算
            const today = new Date().toISOString().split('T')[0];
            let totalInterest = 0;
            for (const buyTxn of h.financingBuyTransactions) {
              const days = daysBetween(buyTxn.settlement_date, today);
              if (days > 0) {
                totalInterest += calculateInterest(buyTxn.financingAmount, FINANCING_INTEREST_RATE, days);
              }
            }
            
            // 盈虧 = 股票市值 - (資買成交價金 + 資買手續費 + 資賣預估息 + 資賣手續費 + 資賣交易稅)
            const sellFeeRate = getFeeRate(h.etf_type);
            const sellTaxRate = getTaxRate(h.etf_type, h.stock_name);
            const sellFee = floorTo2Decimals(market_value * sellFeeRate);
            const sellTax = floorTo2Decimals(market_value * sellTaxRate);
            const estimatedInterest = floorTo2Decimals(totalInterest);
            const sellTotalFee = sellFee + sellTax + estimatedInterest;
            profit_loss = floorTo2Decimals(market_value - (totalPriceQty + totalBuyFee + sellTotalFee));
          }
        } else if (h.transaction_type === '融券') {
          quantity = h.shortSellQuantity;
          if (quantity > 0) {
            // 成本均價 = (成交價 × 成交股數 - 券賣交易費用) / 股數
            // 券賣交易費用 = 手續費 + 交易稅 + 借券費（注意是減去）
            const totalSellPriceQty = h.shortSellSellTransactions.reduce((sum: number, txn: any) => sum + (txn.price * txn.quantity), 0);
            const totalSellFee = h.shortSellSellTransactions.reduce((sum: number, txn: any) => sum + (txn.fee + txn.tax + txn.borrowingFee), 0);
            cost_price = roundTo4Decimals((totalSellPriceQty - totalSellFee) / quantity);
            // 持有成本 = (成交價 × 成交股數 × 融券成數) = 券保證金
            holding_cost = Math.round(h.shortSellTotalMargin); // 四捨五入到整數
            market_value = floorTo2Decimals((h.current_price || cost_price) * quantity);
            
            // 盈虧 = (券賣擔保品 + 券賣預估息) - (券買成交價金 + 券買手續費)
            const totalCollateral = h.shortSellSellTransactions.reduce((sum: number, txn: any) => sum + txn.collateral, 0);
            // 預估息需要根據賣出交割日期和當前日期計算（這裡簡化處理）
            const totalInterest = 0; // TODO: 實現預估息計算
            const totalBuyPriceQty = h.shortSellBuyTransactions.reduce((sum: number, txn: any) => sum + txn.priceQty, 0);
            const totalBuyFee = h.shortSellBuyTransactions.reduce((sum: number, txn: any) => sum + txn.fee, 0);
            profit_loss = floorTo2Decimals((totalCollateral + totalInterest) - (totalBuyPriceQty + totalBuyFee));
          }
        }

        // 計算盈虧百分比
        let profit_loss_percent = holding_cost > 0 ? (profit_loss / holding_cost) * 100 : 0;
        profit_loss_percent = Math.round(profit_loss_percent * 100) / 100; // 四捨五入到小數點第二位
        
        // 計算損益平衡點（扣除雙邊手續費、交易稅、預估息）
        const stockFeeRate = getFeeRate(h.etf_type);
        const stockTaxRate = getTaxRate(h.etf_type, h.stock_name);
        if (h.transaction_type === '現股' && h.isDomestic && quantity > 0) {
          // 損益平衡點需要考慮賣出手續費和交易稅（根據股票類型使用不同的費率）
          // 公式：損益平衡點 = 成本均價 / (1 - 賣出手續費率 - 賣出交易稅率)
          const breakEvenFactor = 1 / (1 - stockFeeRate - stockTaxRate);
          break_even_price = Math.round(cost_price * breakEvenFactor * 100) / 100; // 四捨五入到小數點後兩位
        } else if (h.transaction_type === '融資' && quantity > 0) {
          // 融資需要考慮賣出手續費、交易稅、預估息（根據股票類型使用不同的費率）
          // 簡化：假設預估息為市價的某個比例
          const estimatedInterestRate = 0.001; // 簡化假設
          const breakEvenFactor = 1 / (1 - stockFeeRate - stockTaxRate - estimatedInterestRate);
          break_even_price = Math.round(cost_price * breakEvenFactor * 100) / 100; // 四捨五入到小數點後兩位
        } else if (h.transaction_type === '融券' && quantity > 0) {
          // 融券需要考慮買入手續費（根據股票類型使用不同的費率）
          const breakEvenFactor = 1 / (1 - stockFeeRate);
          break_even_price = Math.round(cost_price * breakEvenFactor * 100) / 100; // 四捨五入到小數點後兩位
        } else {
          break_even_price = cost_price;
        }

        return {
          securities_account_id: h.securities_account_id,
          account_name: h.account_name,
          broker_name: h.broker_name,
          stock_code: h.stock_code,
          stock_name: h.stock_name,
          market_type: h.market_type || '',
          transaction_type: h.transaction_type,
          industry: h.industry || null,
          quantity: quantity,
          cost_price: cost_price,
          break_even_price: break_even_price,
          current_price: h.current_price || cost_price,
          market_value: market_value,
          holding_cost: holding_cost,
          profit_loss: profit_loss,
          profit_loss_percent: profit_loss_percent,
          currency: h.currency,
          // 國外股票專用
          available_quantity: h.isDomestic ? null : quantity,
        };
      })
      .sort((a: any, b: any) => a.stock_code.localeCompare(b.stock_code));

    // 計算統計
    const totalHoldings = holdings.length;
    const totalMarketValue = holdings.reduce((sum: number, h: any) => sum + (h.market_value || 0), 0);
    const totalCost = holdings.reduce((sum: number, h: any) => sum + (h.holding_cost || 0), 0);
    const totalProfitLoss = holdings.reduce((sum: number, h: any) => sum + (h.profit_loss || 0), 0);
    const totalProfitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    res.json({
      success: true,
      data: holdings,
      stats: {
        totalHoldings,
        totalMarketValue,
        totalCost,
        totalProfitLoss,
        totalProfitLossPercent,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取庫存失敗',
    });
  }
});

// 獲取國內股票庫存明細
router.get('/details', async (req: AuthRequest, res) => {
  try {
    const { securitiesAccountId, stockCode } = req.query;
    const db = getDatabase();
    const all = promisify(db.all.bind(db));

    // 只獲取國內（TWD）的買入交易記錄（未完全賣出的）
    let query = `SELECT t.*, sa.account_name, sa.broker_name
                 FROM transactions t 
                 LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id 
                 WHERE t.user_id = ? 
                 AND (t.currency = 'TWD' OR t.currency IS NULL)
                 AND (t.transaction_type LIKE '%買進%' OR t.transaction_type LIKE '%買入%')`;
    const params: any[] = [req.userId];

    if (securitiesAccountId) {
      query += ' AND t.securities_account_id = ?';
      params.push(securitiesAccountId);
    }
    if (stockCode) {
      query += ' AND t.stock_code LIKE ?';
      params.push(`%${stockCode}%`);
    }

    query += ' ORDER BY t.trade_date DESC, t.created_at DESC';

    const transactions: any[] = await all(query, params);

    // 預設費率
    const FEE_RATE = 0.001425;
    const FINANCING_RATE = 0.6;
    const MARGIN_RATE = 0.9;
    const FINANCING_INTEREST_RATE = 0.06;
    const BORROWING_FEE_RATE = 0.001;

    // 計算每筆交易記錄的明細信息
    const details = transactions.map((t: any) => {
      const priceQty = t.price * t.quantity;
      const isFinancing = t.transaction_type.includes('融資');
      const isShortSell = t.transaction_type.includes('融券');

      let transactionType = '現股';
      if (isFinancing) transactionType = '融資';
      else if (isShortSell) transactionType = '融券';

      // 計算持有成本
      let holdingCost = 0;
      if (transactionType === '現股') {
        const fee = t.fee || floorTo2Decimals(priceQty * FEE_RATE);
        holdingCost = floorTo2Decimals(priceQty + fee);
      } else if (transactionType === '融資') {
        const financingAmount = calculateFinancingAmount(t.price, t.quantity, FINANCING_RATE);
        const margin = priceQty - financingAmount;
        const fee = t.fee || floorTo2Decimals(priceQty * FEE_RATE);
        holdingCost = floorTo2Decimals(margin + fee);
      } else if (transactionType === '融券') {
        const margin = calculateMargin(t.price, t.quantity, MARGIN_RATE);
        holdingCost = floorTo2Decimals(margin);
      }

      // 計算預估息（僅融資）
      let estimatedInterest = 0;
      if (transactionType === '融資' && t.settlement_date) {
        const today = new Date().toISOString().split('T')[0];
        const days = daysBetween(t.settlement_date, today);
        if (days > 0) {
          const financingAmount = calculateFinancingAmount(t.price, t.quantity, FINANCING_RATE);
          estimatedInterest = calculateInterest(financingAmount, FINANCING_INTEREST_RATE, days);
        }
      }

      // 計算融資金額/券擔保品
      let financingAmountOrCollateral = null;
      if (transactionType === '融資') {
        financingAmountOrCollateral = calculateFinancingAmount(t.price, t.quantity, FINANCING_RATE);
      } else if (transactionType === '融券') {
        const fee = t.fee || 0;
        const tax = (t.tax || 0) + (t.securities_tax || 0);
        const borrowingFee = t.borrowing_fee || floorTo2Decimals(priceQty * BORROWING_FEE_RATE);
        const totalFee = floorTo2Decimals(fee + tax + borrowingFee);
        financingAmountOrCollateral = floorTo2Decimals(priceQty - totalFee); // 券擔保品
      }

      return {
        id: t.id,
        account_name: t.account_name || '-',
        transaction_type: transactionType,
        stock_code: t.stock_code,
        stock_name: t.stock_name,
        trade_date: t.trade_date,
        quantity: t.quantity,
        price: t.price,
        holding_cost: holdingCost,
        estimated_interest: estimatedInterest,
        financing_amount_or_collateral: financingAmountOrCollateral,
        currency: t.currency || 'TWD',
        buy_reason: t.buy_reason || '',
      };
    });

    res.json({
      success: true,
      data: details,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取庫存明細失敗',
    });
  }
});

// 庫存現在由交易記錄自動計算，不再支持手動新增/編輯/刪除

export default router;
