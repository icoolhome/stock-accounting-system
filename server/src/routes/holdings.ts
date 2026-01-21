import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

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
    const market = marketTypes[idx];
    const normCode = code.padStart(4, '0');

    // 若市場別不明，為避免上市/上櫃誤判，兩種通道都加入
    const shouldTryBoth = !market || market.trim() === '';
    const isOtc = market ? market.includes('上櫃') || market.includes('興櫃') : false;

    if (shouldTryBoth) {
      channels.push(`tse_${normCode}.tw`);
      channels.push(`otc_${normCode}.tw`);
    } else {
      const m = isOtc ? 'otc' : 'tse';
      channels.push(`${m}_${normCode}.tw`);
    }
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
      
      // 調試：記錄0050的原始數據
      if (code === '0050' || code.includes('0050')) {
        console.log(`[TWSE MIS API] 0050 原始數據:`, JSON.stringify(item, null, 2));
      }
      
      // 優先順序：z (即時成交價) > tv (即時成交量對應價格) > y (昨收)
      // 如果 z 為 '-' 或空，嘗試其他字段
      let raw: string | null = null;
      if (item.z && item.z !== '-' && item.z !== '') {
        raw = item.z;
      } else if (item.tv && item.tv !== '-' && item.tv !== '') {
        raw = item.tv;
      } else if (item.y && item.y !== '-' && item.y !== '') {
        raw = item.y;
      }
      
      if (!raw) {
        // 調試：記錄未獲取到價格的情況
        if (code === '0050' || code.includes('0050')) {
          console.log(`[TWSE MIS API] 0050 未獲取到價格，可用字段: z=${item.z}, tv=${item.tv}, y=${item.y}`);
        }
        return;
      }
      
      const num = parseFloat(String(raw).replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        result.set(code, num);
        
        // 調試：記錄0050的價格
        if (code === '0050' || code.includes('0050')) {
          console.log(`[TWSE MIS API] 0050 價格解析成功: ${raw} -> ${num}`);
        }
      } else {
        // 調試：記錄解析失敗的情況
        if (code === '0050' || code.includes('0050')) {
          console.log(`[TWSE MIS API] 0050 價格解析失敗: raw=${raw}, num=${num}`);
        }
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

    const data = (await response.json()) as any[];
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

// 判斷是否為台股交易時間（週一至週五 09:00-13:30，台灣時區）
const isTradingHours = (): boolean => {
  const now = new Date();
  const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const dayOfWeek = taiwanTime.getDay(); // 0 = 週日, 1 = 週一, ..., 6 = 週六
  const hours = taiwanTime.getHours();
  const minutes = taiwanTime.getMinutes();
  const time = hours * 60 + minutes;

  // 週一到週五
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    // 09:00-13:30 (540-810 分鐘)
    if (time >= 540 && time <= 810) {
      return true;
    }
  }
  return false;
};

// 判斷是否為交易日期（週一至週五，排除國定假日）
const isTradingDay = (): boolean => {
  const now = new Date();
  const taiwanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const dayOfWeek = taiwanTime.getDay();
  // 週一到週五為交易日（簡化版，不考慮國定假日）
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

// 批量獲取股票價格（緩存機制 + 智能數據來源切換）
let priceCache: Map<string, { price: number; timestamp: number; source: string }> = new Map();

// 根據交易時間動態調整緩存時間
const getCacheDuration = (): number => {
  if (isTradingHours()) {
    return 60000; // 盤中：緩存1分鐘
  } else if (isTradingDay()) {
    return 3600000; // 盤後：緩存1小時
  } else {
    return 86400000; // 非交易日：緩存24小時
  }
};

// 從 TWSE OpenAPI 獲取收盤價（作為降級方案）
const fetchClosePricesFromOpenAPI = async (
  stockCodes: string[]
): Promise<Map<string, number>> => {
  const result = new Map<string, number>();
  if (!stockCodes.length) return result;

  try {
    const response = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error('TWSE OpenAPI 請求失敗:', response.status);
      return result;
    }

    const data = (await response.json()) as any[];
    
    stockCodes.forEach((code) => {
      const stock = data.find((item: any) => {
        const itemCode = item.Code || item.code || item.股票代號;
        return itemCode === code || itemCode === code.padStart(6, '0');
      });

      if (stock) {
        // 調試：記錄0050的原始數據
        if (code === '0050' || code.includes('0050')) {
          console.log(`[TWSE OpenAPI] 0050 原始數據:`, JSON.stringify(stock, null, 2));
        }
        
        // 收盤後優先使用當日收盤價（Close字段），這是當日的最終收盤價
        // 如果收盤價不可用，再使用最後成交價作為備選
        const closePrice = stock.Close || stock.close || stock.收盤價;
        if (closePrice && !isNaN(parseFloat(closePrice))) {
          const price = parseFloat(closePrice);
          result.set(code, price);
          
          // 調試：記錄0050的價格
          if (code === '0050' || code.includes('0050')) {
            console.log(`[TWSE OpenAPI] 0050 使用當日收盤價: ${closePrice} -> ${price}`);
          }
          return;
        }
        
        // 如果收盤價不可用，使用最後成交價作為備選
        const lastPrice = stock.Z || stock.z || stock.最後成交價;
        if (lastPrice && !isNaN(parseFloat(lastPrice))) {
          const price = parseFloat(lastPrice);
          result.set(code, price);
          
          // 調試：記錄0050的價格
          if (code === '0050' || code.includes('0050')) {
            console.log(`[TWSE OpenAPI] 0050 使用最後成交價（備選）: ${lastPrice} -> ${price}`);
          }
          return;
        }
        
        // 如果都不可用，嘗試其他字段
        const otherPrice = stock.Price || stock.price;
        if (otherPrice && !isNaN(parseFloat(otherPrice))) {
          result.set(code, parseFloat(otherPrice));
        }
      } else {
        // 調試：記錄未找到股票的情況
        if (code === '0050' || code.includes('0050')) {
          console.log(`[TWSE OpenAPI] 0050 未找到股票數據`);
        }
      }
    });
  } catch (error: any) {
    console.error('從 TWSE OpenAPI 獲取收盤價失敗:', error.message);
  }

  return result;
};

// 從 Yahoo Finance API 獲取股票價格（支援即時價格和收盤價）
const fetchPricesFromYahoo = async (
  stockCodes: string[],
  inTradingHours: boolean,
  marketMapByCode?: Map<string, string>
): Promise<Map<string, { price: number; source: string }>> => {
  const result = new Map<string, { price: number; source: string }>();
  if (!stockCodes.length) return result;

  try {
    // Yahoo Finance API 需要逐個查詢，或使用批量查詢
    // 使用 v8/finance/chart API
    for (const code of stockCodes) {
      try {
        const market = marketMapByCode?.get(code) || '';
        const isOtc = market.includes('上櫃') || market.includes('興櫃') || market.includes('櫃');
        const symbol = `${code}.${isOtc ? 'TWO' : 'TW'}`;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`Yahoo Finance API 請求失敗 (${code}):`, response.status);
          continue;
        }

        const data = await response.json() as any;
        
        if (!data.chart || !data.chart.result || !Array.isArray(data.chart.result) || data.chart.result.length === 0) {
          console.error(`Yahoo Finance API 返回格式錯誤 (${code})`);
          continue;
        }

        const stockData = data.chart.result[0];
        const meta = stockData.meta || {};
        
        // 獲取價格資訊
        const regularMarketPrice = meta.regularMarketPrice;
        const previousClose = meta.previousClose;
        const regularMarketTime = meta.regularMarketTime;
        
        // 判斷是否在交易時間內
        const now = Math.floor(Date.now() / 1000); // 轉換為秒
        const isMarketOpen = inTradingHours && regularMarketTime && (now - regularMarketTime) < 3600; // 1小時內有更新
        
        let price: number | null = null;
        let source = 'close';
        
        if (isMarketOpen && regularMarketPrice) {
          // 盤中：使用即時價格
          price = regularMarketPrice;
          source = 'realtime';
        } else if (regularMarketPrice) {
          // 收盤後：使用當日收盤價（regularMarketPrice 在收盤後就是收盤價）
          price = regularMarketPrice;
          source = 'close';
        } else if (previousClose) {
          // 如果沒有當日價格，使用昨收作為備選
          price = previousClose;
          source = 'close';
        }

        if (price && !isNaN(price) && price > 0) {
          result.set(code, { price, source });
          
          // 調試：記錄價格獲取情況
          if (code === '00901' || code === '0050') {
            console.log(`[Yahoo Finance] ${code}: 價格=${price}, 來源=${source}, 交易時間=${inTradingHours}, regularMarketPrice=${regularMarketPrice}, previousClose=${previousClose}`);
          }
        }
      } catch (err: any) {
        console.error(`從 Yahoo Finance 獲取價格失敗 (${code}):`, err.message);
      }
    }
  } catch (error: any) {
    console.error('從 Yahoo Finance 獲取價格失敗:', error.message);
  }

  return result;
};

const fetchStockPricesBatch = async (
  stockCodes: string[],
  marketTypes: string[],
  etfFlagsByCode: Map<string, boolean>,
  priceSource?: string, // 'auto' | 'twse_stock_day_all' | 'twse_mi_index' | 'tpex' | 'realtime'
  forceRefresh?: boolean // 強制刷新，忽略緩存
): Promise<Map<string, { price: number; source: string; updatedAt: number }>> => {
  const priceMap = new Map<string, { price: number; source: string; updatedAt: number }>();
  const now = Date.now();
  const cacheDuration = getCacheDuration();

  // 決定使用哪種數據來源
  // 規則（符合你的需求）：
  // - 09:00-13:30（盤中）：使用即時價格
  // - 13:30 之後（收盤後）：使用當日收盤價
  const inTradingHours = isTradingHours(); // 09:00-13:30

  let useRealtime: boolean;

  if (!inTradingHours) {
    // 收盤後一律使用收盤價（除非明確指定 priceSource = 'realtime'，目前庫存頁面不會這樣做）
    useRealtime = priceSource === 'realtime';
  } else {
    // 盤中：預設使用即時價格
    if (priceSource === 'twse_stock_day_all') {
      // 即使用了收盤價來源設定，盤中仍以即時價格為主
      useRealtime = true;
    } else if (priceSource === 'realtime') {
      useRealtime = true;
    } else {
      // auto / 其他：盤中用即時
      useRealtime = true;
    }
  }

  const useClosePrice = !useRealtime;

  // 先檢查緩存（如果強制刷新，則跳過緩存檢查）
  const codesToFetch: string[] = [];
  const marketTypesToFetch: string[] = [];
  // 建立代碼 -> 市場別對照表，供後續降級時使用正確通道
  const marketMapByCode = new Map<string, string>();

  stockCodes.forEach((code, index) => {
    const cacheKey = code;
    
    // 如果強制刷新，清除該股票的緩存
    if (forceRefresh) {
      priceCache.delete(cacheKey);
    }
    
    const cached = priceCache.get(cacheKey);

    // 檢查緩存是否有效（根據當前交易狀態使用不同的緩存時間）
    if (!forceRefresh && cached && now - cached.timestamp < cacheDuration) {
      priceMap.set(code, { 
        price: cached.price, 
        source: cached.source, 
        updatedAt: cached.timestamp 
      });
    } else {
      codesToFetch.push(code);
      const market = marketTypes[index] || '上市';
      marketTypesToFetch.push(market);
      marketMapByCode.set(code, market);
    }
  });

  // 如果所有股票都在緩存中，直接返回
  if (codesToFetch.length === 0) {
    return priceMap;
  }

  try {
    // 優先使用 Yahoo Finance API（根據用戶要求）
    // 根據交易時間自動切換：09:00-13:30 使用即時價格，13:30 之後使用收盤價
    console.log(
      `[價格獲取] 使用 Yahoo Finance API，股票數量: ${codesToFetch.length}, 交易時間: ${inTradingHours}`
    );
    const yahooPrices = await fetchPricesFromYahoo(codesToFetch, inTradingHours, marketMapByCode);

    // 記錄成功獲取的代碼
    const successCodes = new Set<string>();

    yahooPrices.forEach((priceInfo, code) => {
      if (priceInfo.price > 0) {
        priceMap.set(code, {
          price: priceInfo.price,
          source: priceInfo.source,
          updatedAt: now,
        });
        priceCache.set(code, {
          price: priceInfo.price,
          timestamp: now,
          source: priceInfo.source,
        });
        successCodes.add(code);
      }
    });

    const failedCodes = codesToFetch.filter((code) => !successCodes.has(code));

    if (useRealtime) {
      // 需要即時價：對 Yahoo 失敗的部份，改用 TWSE MIS 即時價，再不行才用收盤價
      if (failedCodes.length > 0) {
        if (forceRefresh) {
          console.log(
            `[價格獲取] 降級：使用 TWSE 即時價格API，股票數量: ${failedCodes.length}`
          );
        } else if (inTradingHours) {
          console.log(
            `[價格獲取] 降級：使用 TWSE 即時價格API（交易時間內），股票數量: ${failedCodes.length}`
          );
        } else {
          console.log(
            `[價格獲取] 降級：使用 TWSE 即時價格API，股票數量: ${failedCodes.length}`
          );
        }

        const realtimeMap = await fetchRealtimePricesFromMis(
          failedCodes,
          failedCodes.map((code) => marketMapByCode.get(code) || '上市')
        );

        const twseSuccessCodes = new Set<string>();

        realtimeMap.forEach((price, code) => {
          if (!isNaN(price) && price > 0) {
            const normalizedCode = code.replace(/^0+/, '') || code;
            const originalCode = failedCodes.find((c) => {
              const normalized = c.replace(/^0+/, '') || c;
              return (
                c === code ||
                normalized === normalizedCode ||
                c === normalizedCode ||
                normalized === code
              );
            });

            const finalCode = originalCode || code;
            priceMap.set(finalCode, { price, source: 'realtime', updatedAt: now });
            priceCache.set(finalCode, {
              price,
              timestamp: now,
              source: 'realtime',
            });
            twseSuccessCodes.add(finalCode);

            if (finalCode === '0050' || finalCode.includes('0050')) {
              console.log(
                `[TWSE 即時] 0050: API返回代碼=${code}, 匹配代碼=${finalCode}, 價格=${price}`
              );
            }
          }
        });

        const stillFailedCodes = failedCodes.filter((code) => !twseSuccessCodes.has(code));
        if (stillFailedCodes.length > 0) {
          console.log(
            `TWSE 即時數據獲取失敗，降級到收盤價，影響 ${stillFailedCodes.length} 檔股票`
          );
          const closePriceMap = await fetchClosePricesFromOpenAPI(stillFailedCodes);
          closePriceMap.forEach((price, code) => {
            if (!isNaN(price) && price > 0) {
              priceMap.set(code, { price, source: 'close', updatedAt: now });
              priceCache.set(code, { price, timestamp: now, source: 'close' });
            }
          });
        }
      }
    } else {
      // 不需要即時價：直接對所有 codesToFetch 使用收盤價
      console.log(
        `[價格獲取] 使用收盤價API，股票數量: ${codesToFetch.length}，交易時間: ${inTradingHours}`
      );
      const closePriceMap = await fetchClosePricesFromOpenAPI(codesToFetch);
      closePriceMap.forEach((price, code) => {
        if (!isNaN(price) && price > 0) {
          priceMap.set(code, { price, source: 'close', updatedAt: now });
          priceCache.set(code, { price, timestamp: now, source: 'close' });
        }
      });
    }

    return priceMap;
  } catch (error: any) {
    console.error(`批量獲取股票價格失敗:`, error.message);
    // 發生錯誤時，嘗試使用收盤價作為最後手段
    try {
      const closePriceMap = await fetchClosePricesFromOpenAPI(codesToFetch);
      closePriceMap.forEach((price, code) => {
        if (!isNaN(price) && price > 0) {
          priceMap.set(code, { price, source: 'close', updatedAt: now });
          priceCache.set(code, { price, timestamp: now, source: 'close' });
        }
      });
    } catch (fallbackError: any) {
      console.error('降級到收盤價也失敗:', fallbackError.message);
    }
    return priceMap;
  }
};

// 獲取所有庫存（根據交易記錄自動計算）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { securitiesAccountId, stockCode, refresh } = req.query;
    
    console.log(`[Holdings API] 收到請求: refresh=${refresh}, securitiesAccountId=${securitiesAccountId}, stockCode=${stockCode}`);
    
    // 如果要求強制刷新，清除相關股票的緩存
    if (refresh === 'true' || refresh === '1') {
      // 先獲取需要清除緩存的股票代碼
      let queryForCodes = `SELECT DISTINCT t.stock_code
                          FROM transactions t 
                          WHERE t.user_id = ?`;
      const paramsForCodes: any[] = [req.userId];
      
      if (securitiesAccountId) {
        queryForCodes += ' AND t.securities_account_id = ?';
        paramsForCodes.push(securitiesAccountId);
      }
      if (stockCode) {
        queryForCodes += ' AND t.stock_code LIKE ?';
        paramsForCodes.push(`%${stockCode}%`);
      }
      
      const stockCodes = await all<{ stock_code: string }>(queryForCodes, paramsForCodes);
      // 清除這些股票的緩存
      stockCodes.forEach((row: any) => {
        priceCache.delete(row.stock_code);
      });
      console.log(`強制刷新：已清除 ${stockCodes.length} 檔股票的價格緩存`);
    }

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

    const transactions = await all<any>(query, params);

    // 獲取手續費設定和價格來源設定
    let feeSettings: any = {
      baseFeeRate: 0.1425, // 預設 0.1425%（一般股票證券商手續費，單邊）
      etfFeeRate: 0.1425, // 預設 0.1425%（股票型ETF證券商手續費，單邊）
      buyFeeDiscount: 0.6, // 預設 6折（0.6），買進手續費折扣
      sellFeeDiscount: 0.6, // 預設 6折（0.6），賣出手續費折扣
      taxRate: 0.3, // 預設 0.3%（一般股票證交稅，只有賣出時扣，台股標準）
      etfTaxRate: 0.1, // 預設 0.1%（股票型ETF證交稅，只有賣出時扣，台股標準）
    };
    
    let priceSource = 'auto'; // 預設使用自動模式
    
    try {
      const settings = await all<any>(
        'SELECT setting_key, setting_value FROM system_settings WHERE user_id = ? AND (setting_key = ? OR setting_key = ?)',
        [req.userId, 'feeSettings', 'apiSettings']
      );
      
      settings.forEach((s: any) => {
        try {
          const parsed = JSON.parse(s.setting_value);
          if (s.setting_key === 'feeSettings') {
            feeSettings = { ...feeSettings, ...parsed };
            // 兼容舊設定：如果有feeDiscount但沒有buyFeeDiscount和sellFeeDiscount，則使用feeDiscount作為兩者的值
            if (parsed.feeDiscount !== undefined && !parsed.buyFeeDiscount && !parsed.sellFeeDiscount) {
              feeSettings.buyFeeDiscount = parsed.feeDiscount;
              feeSettings.sellFeeDiscount = parsed.feeDiscount;
            }
            // 兼容舊設定：如果沒有etfTaxRate，使用預設值0.1%
            if (!parsed.etfTaxRate) {
              feeSettings.etfTaxRate = 0.1;
            }
            // 兼容舊設定：如果沒有etfFeeRate，使用baseFeeRate作為ETF手續費率
            if (!parsed.etfFeeRate) {
              feeSettings.etfFeeRate = parsed.baseFeeRate || 0.1425;
            }
          } else if (s.setting_key === 'apiSettings' && parsed.priceSource) {
            priceSource = parsed.priceSource;
          }
        } catch (parseErr) {
          console.error(`解析設定 ${s.setting_key} 失敗:`, parseErr);
        }
      });
    } catch (err) {
      console.error('讀取設定失敗，使用預設值:', err);
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
    
    // 判斷是否為 ETF 的輔助函數
    // 台股 ETF 代碼特徵：
    // 1. 0050~0057（元大系列老牌 ETF）
    // 2. 006XXX（6位數字開頭的 ETF）
    // 3. 00XXXL/R/U（槓桿/反向/期貨 ETF）
    // 4. 00XXXB（債券 ETF）
    // 5. 00XXXA（主動式 ETF）
    // 6. 00XXX（5位數字，大多數 ETF）
    const isEtfByCode = (stockCode: string): boolean => {
      if (!stockCode) return false;
      // 0050~0057
      if (/^005[0-7]$/.test(stockCode)) return true;
      // 006XXX（6位數字開頭）
      if (/^006\d{3}$/.test(stockCode)) return true;
      // 00XXX 後面接 L/R/U/B/A（槓桿/反向/期貨/債券/主動式）
      if (/^00\d{3}[LRUBA]$/.test(stockCode)) return true;
      // 00XXX（純5位數字，大多數 ETF）
      if (/^00\d{3}$/.test(stockCode)) return true;
      return false;
    };

    // 根據股票類型獲取證交稅率的函數
    // 2026年台股交易稅率規定：
    // - 一般股票：3‰（0.3%）
    // - 股票型ETF（含主動式ETF和被動式ETF）：1‰（0.1%）
    // - 權證：1‰（0.1%）
    // - 現股當沖：1.5‰（0.15%）
    const getTaxRate = (etfType: string | null, stockName: string = '', stockCode: string = '') => {
      // 優先用股票代碼判定是否為 ETF
      if (isEtfByCode(stockCode)) {
        return ETF_TAX_RATE;
      }
      if (etfType) {
        // 所有ETF（含主動式ETF和被動式ETF）使用設定中的ETF稅率（預設0.1%）
        return ETF_TAX_RATE;
      }
      // 權證（目前系統未明確標記，可根據股票名稱判斷，暫使用預設值）
      // 一般股票使用預設值（0.3%）
      return DEFAULT_TAX_RATE;
    };
    
    // 根據股票類型獲取手續費率的函數
    const getFeeRate = (etfType: string | null, stockCode: string = '') => {
      // 優先用股票代碼判定是否為 ETF
      if (isEtfByCode(stockCode)) {
        return ETF_FEE_RATE;
      }
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

    // 調試：統計 0050 的所有交易
    const transactions0050 = transactions.filter((t: any) => t.stock_code === '0050' || t.stock_code === '50');
    const buyCount0050 = transactions0050.filter((t: any) => (t.transaction_type.includes('買進') || t.transaction_type.includes('買入')) && !t.transaction_type.includes('融資')).length;
    const sellCount0050 = transactions0050.filter((t: any) => (t.transaction_type.includes('賣出') || t.transaction_type.includes('賣')) && !t.transaction_type.includes('融資')).length;
    const totalBuy0050 = transactions0050.filter((t: any) => (t.transaction_type.includes('買進') || t.transaction_type.includes('買入')) && !t.transaction_type.includes('融資')).reduce((sum: number, t: any) => sum + t.quantity, 0);
    const totalSell0050 = transactions0050.filter((t: any) => (t.transaction_type.includes('賣出') || t.transaction_type.includes('賣')) && !t.transaction_type.includes('融資')).reduce((sum: number, t: any) => sum + t.quantity, 0);
    console.log(`[0050 交易統計] 總交易數=${transactions0050.length}, 買入筆數=${buyCount0050}, 賣出筆數=${sellCount0050}, 買入總數=${totalBuy0050}, 賣出總數=${totalSell0050}, 理論庫存=${totalBuy0050 - totalSell0050}`);
    
    transactions.forEach((t: any) => {
      // 判斷交易類型
      let transactionType = '現股'; // 默認
      if (t.transaction_type.includes('融資')) {
        transactionType = '融資';
      } else if (t.transaction_type.includes('融券')) {
        transactionType = '融券';
      }
      
        // 調試：記錄所有 50 股票的交易（特別是 6/24 前後的交易）
        if (t.stock_code === '0050' || t.stock_code === '50') {
          const isBuy = t.transaction_type.includes('買進') || t.transaction_type.includes('買入');
          const isSell = t.transaction_type.includes('賣出') || t.transaction_type.includes('賣');
          const isCriticalDate = t.trade_date === '2025-06-24' || 
                                 (t.trade_date && new Date(t.trade_date) >= new Date('2025-06-24'));
          if (isCriticalDate || t.trade_date === '2025-06-24') {
            console.log(`[關鍵日期交易] ${t.stock_code} ${t.stock_name}: 交易類型=${t.transaction_type}, transactionType=${transactionType}, isBuy=${isBuy}, isSell=${isSell}, 數量=${t.quantity}, 交易ID=${t.id}, 成交日期=${t.trade_date}, 帳號=${t.account_name} - ${t.broker_name}`);
          }
          console.log(`[交易類型判斷] ${t.stock_code} ${t.stock_name}: 交易類型=${t.transaction_type}, transactionType=${transactionType}, isBuy=${isBuy}, isSell=${isSell}, 數量=${t.quantity}, 交易ID=${t.id}, 成交日期=${t.trade_date}, 帳號=${t.account_name} - ${t.broker_name}`);
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
      
      // 調試：記錄所有 50 股票的交易（簡化條件以確保記錄所有交易）
      if (t.stock_code === '0050' || t.stock_code === '50') {
        console.log(`[交易類型判斷] ${t.stock_code} ${t.stock_name}: 交易類型=${t.transaction_type}, transactionType=${transactionType}, isBuy=${isBuy}, isSell=${isSell}, 數量=${t.quantity}, 交易ID=${t.id}, 成交日期=${t.trade_date}, 帳號=${t.account_name} - ${t.broker_name}`);
      }

      if (isBuy) {
        if (transactionType === '現股') {
          // 現股買入
          const priceQty = t.price * t.quantity;
          // 現買交易費用 = 手續費（使用折扣後的費率，因為持有成本應反映實際支付的手續費）
          const feeRate = getDiscountFeeRate(t.etf_type, true); // 使用買入折扣費率
          const fee = t.fee || floorTo2Decimals(priceQty * feeRate);
          
          const oldQuantity = holding.cashQuantity;
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
          
          // 調試：記錄買入計算詳情（特別是 50 股票）
          if (t.stock_code === '0050' || t.stock_code === '50') {
            const batchTotal = holding.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
            console.log(`[買入計算] ${t.stock_code} ${t.stock_name}: 買入數量=${t.quantity}, 舊庫存=${oldQuantity}, 新庫存=${holding.cashQuantity}, 批次總數量=${batchTotal}, 交易ID=${t.id}, 成交日期=${t.trade_date}`);
          }
          
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
          // 計算可實際賣出的數量（基於批次總數量）
          const totalBatchQuantity = holding.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
          // 確保庫存數量與批次總數量一致
          if (holding.cashQuantity !== totalBatchQuantity) {
            console.log(`[賣出前庫存不一致] ${t.stock_code} ${t.stock_name}: 庫存數量=${holding.cashQuantity}, 批次總數量=${totalBatchQuantity}, 修正庫存數量`);
            holding.cashQuantity = totalBatchQuantity;
          }
          const actualSellQty = Math.min(t.quantity, totalBatchQuantity);
          
          // 調試：記錄賣出前的狀態（特別是 50 股票和 6/24 的交易）
          if (t.stock_code === '0050' || t.stock_code === '50') {
            const isCriticalDate = t.trade_date === '2025-06-24';
            const logLevel = isCriticalDate ? '[關鍵賣出前狀態]' : '[賣出前狀態]';
            // 保存賣出前的批次詳情（深拷貝）
            const batchesBeforeSell = JSON.parse(JSON.stringify(holding.cashBuyBatches));
            console.log(`${logLevel} ${t.stock_code} ${t.stock_name}: 賣出數量=${t.quantity}, 庫存數量=${holding.cashQuantity}, 批次總數量=${totalBatchQuantity}, 批次數量=${holding.cashBuyBatches.length}, 實際可賣=${actualSellQty}, 交易ID=${t.id}, 成交日期=${t.trade_date}`);
            if (isCriticalDate) {
              console.log(`  [6/24 賣出前批次詳情] ${JSON.stringify(batchesBeforeSell.map((b: any) => ({ qty: b.quantity, price: b.price, date: b.trade_date })))}`);
            }
          }
          
          // 只要有批次就可以賣出，即使庫存數量為0也要處理（可能是數據不一致的情況）
          if (actualSellQty > 0 && holding.cashBuyBatches.length > 0) {
            let remainingSellQty = actualSellQty;
            
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
            
            // 確保庫存數量與批次總數量一致
            const newTotalBatchQuantity = holding.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
            const oldQuantity = holding.cashQuantity;
            holding.cashQuantity = newTotalBatchQuantity;
            
            // 國外股票：記錄今日賣出
            if (!isDomestic && t.trade_date === today) {
              holding.foreignTodaySellQuantity += actualSellQty;
            }
            
            // 調試：記錄賣出計算詳情（特別是 50 股票和 6/24 的交易）
            if (t.stock_code === '0050' || t.stock_code === '50') {
              const isCriticalDate = t.trade_date === '2025-06-24';
              const logLevel = isCriticalDate ? '[關鍵賣出計算完成]' : '[賣出計算完成]';
              console.log(`${logLevel} ${t.stock_code} ${t.stock_name}: 賣出數量=${t.quantity}, 賣出前庫存=${oldQuantity}, 賣出前批次總數量=${totalBatchQuantity}, 實際賣出=${actualSellQty}, 賣出後批次總數量=${newTotalBatchQuantity}, 新庫存=${holding.cashQuantity}, 交易ID=${t.id}, 成交日期=${t.trade_date}`);
              if (actualSellQty !== t.quantity) {
                console.log(`  [警告] 實際賣出數量(${actualSellQty}) 不等於 請求賣出數量(${t.quantity})！`);
              }
              if (isCriticalDate) {
                console.log(`  [6/24 賣出後批次詳情] ${JSON.stringify(holding.cashBuyBatches.map((b: any) => ({ qty: b.quantity, price: b.price, date: b.trade_date })))}`);
              }
            }
          } else {
            // 調試：記錄無法賣出的情況（這是關鍵！如果賣出沒有被扣除，庫存就會多算）
            if (t.stock_code === '0050' || t.stock_code === '50') {
              console.log(`[無法賣出 - 警告] ${t.stock_code} ${t.stock_name}: 賣出數量=${t.quantity}, 庫存數量=${holding.cashQuantity}, 批次總數量=${totalBatchQuantity}, 批次數量=${holding.cashBuyBatches.length}, 實際可賣=${actualSellQty}, 交易ID=${t.id}, 成交日期=${t.trade_date}`);
              console.log(`  [無法賣出原因] actualSellQty=${actualSellQty}, cashBuyBatches.length=${holding.cashBuyBatches.length}`);
            }
            // 即使無法賣出，也要確保庫存數量與批次總數量一致
            const batchTotal = holding.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
            if (holding.cashQuantity !== batchTotal) {
              console.log(`[無法賣出但修正庫存] ${t.stock_code} ${t.stock_name}: 庫存數量=${holding.cashQuantity}, 批次總數量=${batchTotal}, 修正庫存數量`);
              holding.cashQuantity = batchTotal;
            }
          }
        } else if (transactionType === '融資') {
          // 融資賣出（不扣除現股庫存）
          const sellQty = Math.min(t.quantity, holding.financingQuantity);
          
          // 調試：記錄融資賣出前的狀態（特別是 50 股票）
          if (t.stock_code === '0050' || t.stock_code === '50') {
            console.log(`[融資賣出前狀態] ${t.stock_code} ${t.stock_name}: 賣出數量=${t.quantity}, 融資庫存=${holding.financingQuantity}, 現股庫存=${holding.cashQuantity}, 實際可賣=${sellQty}, 交易ID=${t.id}`);
          }
          
          if (sellQty > 0) {
            // 按比例減少
            const ratio = sellQty / holding.financingQuantity;
            const oldFinancingQuantity = holding.financingQuantity;
            holding.financingQuantity -= sellQty;
            holding.financingTotalMargin = floorTo2Decimals(holding.financingTotalMargin * (1 - ratio));
            holding.financingTotalFee = floorTo2Decimals(holding.financingTotalFee * (1 - ratio));
            holding.financingTotalAmount = floorTo2Decimals(holding.financingTotalAmount * (1 - ratio));
            
            // 調試：記錄融資賣出計算詳情（特別是 50 股票）
            if (t.stock_code === '0050' || t.stock_code === '50') {
              console.log(`[融資賣出計算完成] ${t.stock_code} ${t.stock_name}: 賣出數量=${t.quantity}, 賣出前融資庫存=${oldFinancingQuantity}, 實際賣出=${sellQty}, 新融資庫存=${holding.financingQuantity}, 現股庫存=${holding.cashQuantity}, 交易ID=${t.id}, 成交日期=${t.trade_date}`);
            }
            
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

    // 獲取手動設置的價格（優先使用手動價格）
    const manualPriceSettings = await all<any>(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE user_id = ? AND setting_key LIKE 'manual_price_%'`,
      [req.userId]
    );
    const manualPrices = new Map<string, number>();
    manualPriceSettings.forEach((setting: any) => {
      const price = parseFloat(setting.setting_value);
      if (!isNaN(price) && price > 0) {
        manualPrices.set(setting.setting_key, price);
      }
    });

    // 批量獲取股票價格（包含價格來源資訊）
    const forceRefresh = refresh === 'true' || refresh === '1';
    if (forceRefresh) {
      console.log(`[強制刷新] 準備獲取 ${stockCodesToFetch.length} 檔股票的價格`);
    }
    const stockPrices = await fetchStockPricesBatch(stockCodesToFetch, marketTypesToFetch, etfFlagsByCode, priceSource, forceRefresh);

    // 更新holdingsMap中的價格和價格來源資訊
    let priceUpdateCount = 0;
    holdingsMap.forEach((h: any) => {
      if (h.isDomestic && h.stock_code) {
        // 先檢查是否有手動設置的價格
        const manualPriceKey = `manual_price_${h.securities_account_id}_${h.stock_code}_${h.transaction_type || '現股'}`;
        const manualPrice = manualPrices.get(manualPriceKey);
        
        if (manualPrice !== undefined && manualPrice > 0) {
          // 使用手動設置的價格
          const oldPrice = h.current_price;
          h.current_price = manualPrice;
          h.price_source = 'manual'; // 標記為手動設置
          h.price_updated_at = Date.now(); // 時間戳
          priceUpdateCount++;
          
          // 調試：記錄手動價格更新
          if (h.stock_code === '0050' || h.stock_code.includes('0050')) {
            console.log(`[手動價格] ${h.stock_code} ${h.stock_name}: 舊價格=${oldPrice}, 新價格=${manualPrice}, 來源=manual`);
          }
        } else {
          // 使用 API 獲取的價格
          const priceInfo = stockPrices.get(h.stock_code);
          if (priceInfo && priceInfo.price !== undefined && priceInfo.price !== null && priceInfo.price > 0) {
            const oldPrice = h.current_price;
            h.current_price = priceInfo.price;
            // 確保 price_source 被正確設置（'realtime' 或 'close'）
            h.price_source = priceInfo.source || 'close'; // 如果 source 為空，默認為 'close'
            h.price_updated_at = priceInfo.updatedAt; // 時間戳
            priceUpdateCount++;
            
            // 調試：記錄價格更新（特別是 3323 和 3402）
            if (h.stock_code === '3323' || h.stock_code === '3402' || h.stock_code === '0050' || h.stock_code.includes('0050')) {
              console.log(`[價格更新] ${h.stock_code} ${h.stock_name}: 舊價格=${oldPrice}, 新價格=${priceInfo.price}, 來源=${h.price_source}, priceInfo=${JSON.stringify(priceInfo)}`);
            }
          } else {
            // 調試：記錄未獲取到價格的股票（特別是 3323 和 3402）
            if (h.stock_code === '3323' || h.stock_code === '3402' || h.stock_code === '0050' || h.stock_code.includes('0050')) {
              console.log(`[價格更新失敗] ${h.stock_code} ${h.stock_name}: 未獲取到價格信息, priceInfo=${priceInfo ? JSON.stringify(priceInfo) : 'null'}, stockPrices.has(${h.stock_code})=${stockPrices.has(h.stock_code)}`);
            }
          }
        }
      }
    });
    
    if (forceRefresh) {
      console.log(`[強制刷新完成] 成功更新 ${priceUpdateCount} 檔股票的價格`);
    }

    // 確保有價格來源的庫存都帶有時間戳，方便前端顯示時間
    holdingsMap.forEach((h: any) => {
      if (h.current_price && !h.price_updated_at) {
        // 若已有價格但缺少時間戳，補上當前時間，方便前端顯示
        h.price_updated_at = Date.now();
      }
    });

    // 轉換為陣列並計算相關數值
    // 首先確保所有庫存數量與批次總數量一致
    // 調試：檢查 holdingsMap 中有多少條 50 股票的記錄
    const holdings50 = Array.from(holdingsMap.values()).filter((h: any) => h.stock_code === '0050' || h.stock_code === '50');
    if (holdings50.length > 0) {
      console.log(`[調試] holdingsMap 中找到 ${holdings50.length} 條 50 股票的記錄:`);
      holdings50.forEach((h: any, idx: number) => {
        const batchTotal = h.cashBuyBatches ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) : 0;
        console.log(`  [${idx}] ${h.stock_code} ${h.stock_name}:`);
        console.log(`    - key: ${h.securities_account_id}_${h.stock_code}_${h.transaction_type}_${h.isDomestic ? 'TWD' : 'FOREIGN'}`);
        console.log(`    - cashQuantity: ${h.cashQuantity}`);
        console.log(`    - batchTotal: ${batchTotal}`);
        console.log(`    - batchCount: ${h.cashBuyBatches?.length || 0}`);
        console.log(`    - cashTotalPriceQty: ${h.cashTotalPriceQty}`);
        console.log(`    - cashTotalFee: ${h.cashTotalFee}`);
      });
    }
    
    holdingsMap.forEach((h: any) => {
      if (h.transaction_type === '現股') {
        const batchTotal = h.cashBuyBatches ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) : 0;
        // 強制同步庫存數量（批次總數量是唯一真實來源）
        const oldCashQuantity = h.cashQuantity;
        h.cashQuantity = batchTotal;
        if (oldCashQuantity !== batchTotal) {
          console.log(`[庫存不一致修正] ${h.stock_code} ${h.stock_name}: 舊庫存數量=${oldCashQuantity}, 批次總數量=${batchTotal}, 修正為批次總數量`);
        }
          // 調試：記錄 50 股票的庫存狀態（特別關注 6/24 之後的批次）
          if (h.stock_code === '0050' || h.stock_code === '50') {
            const batchesAfter624 = h.cashBuyBatches?.filter((b: any) => b.trade_date && new Date(b.trade_date) >= new Date('2025-06-24')) || [];
            const totalAfter624 = batchesAfter624.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
            console.log(`[過濾前] ${h.stock_code} ${h.stock_name}: 修正後庫存數量=${h.cashQuantity}, 批次總數量=${batchTotal}, 批次數量=${h.cashBuyBatches?.length || 0}`);
            console.log(`  [6/24 之後批次] 批次數量=${batchesAfter624.length}, 總數量=${totalAfter624}`);
            console.log(`  [所有批次詳情] ${JSON.stringify(h.cashBuyBatches?.map((b: any) => ({ quantity: b.quantity, price: b.price, date: b.trade_date })) || [])}`);
          }
      }
    });
    
    const holdings = Array.from(holdingsMap.values())
      .filter((h: any) => {
        // 根據交易類型判斷是否有庫存
        if (h.transaction_type === '現股') {
          // 確保庫存數量與批次總數量一致
          const batchTotal = h.cashBuyBatches ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) : 0;
          // 強制使用批次總數量作為庫存數量
          h.cashQuantity = batchTotal;
          
          // 調試：記錄 50 股票的過濾狀態
          if (h.stock_code === '0050' || h.stock_code === '50') {
            console.log(`[過濾檢查] ${h.stock_code} ${h.stock_name}: 修正後cashQuantity=${h.cashQuantity}, 批次總數量=${batchTotal}, 批次數量=${h.cashBuyBatches?.length || 0}, 是否通過過濾=${h.cashQuantity > 0}`);
          }
          
          // 只返回庫存數量大於0的記錄
          return batchTotal > 0;
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
            // 強制使用批次總數量作為庫存數量（唯一真實來源）
            const batchTotal = h.cashBuyBatches ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) : 0;
            // 強制同步庫存數量
            h.cashQuantity = batchTotal;
            quantity = batchTotal;
            
            // 調試：記錄 50 股票的庫存狀態（增加更多調試信息）
            if (h.stock_code === '0050' || h.stock_code === '50') {
              console.log(`[映射計算開始] ${h.stock_code} ${h.stock_name}:`);
              console.log(`  - 批次總數量=${batchTotal}`);
              console.log(`  - 修正前cashQuantity=${h.cashQuantity}`);
              console.log(`  - 修正後cashQuantity=${batchTotal}`);
              console.log(`  - quantity=${quantity}`);
              console.log(`  - 批次數量=${h.cashBuyBatches?.length || 0}`);
              console.log(`  - 批次詳情=${JSON.stringify(h.cashBuyBatches?.map((b: any) => ({ qty: b.quantity, price: b.price })) || [])}`);
              console.log(`  - cashTotalPriceQty=${h.cashTotalPriceQty}`);
              console.log(`  - cashTotalFee=${h.cashTotalFee}`);
            }
            
            // 重要：確保 quantity 始終等於 batchTotal（不要累加！）
            // 如果批次總數量為0，跳過計算
            if (batchTotal === 0) {
              // 調試：記錄 50 股票跳過計算的情況
              if (h.stock_code === '0050' || h.stock_code === '50') {
                console.log(`[跳過計算] ${h.stock_code} ${h.stock_name}: 批次總數量=${batchTotal}, quantity=${quantity}, 跳過計算`);
              }
              // 返回空值，但保留基本信息
              quantity = 0;
              market_value = 0;
              holding_cost = 0;
              profit_loss = 0;
            } else {
              // 重要：確保 quantity 始終等於 batchTotal（不要累加！）
              if (quantity !== batchTotal) {
                // 調試：確保 quantity 正確設置（特別是 50 股票）
                if (h.stock_code === '0050' || h.stock_code === '50') {
                  console.log(`[警告] ${h.stock_code} ${h.stock_name}: quantity(${quantity}) !== batchTotal(${batchTotal})，強制修正！`);
                }
                quantity = batchTotal;
              }
              
              // 調試：確認 quantity 正確設置（特別是 50 股票）
              if (h.stock_code === '0050' || h.stock_code === '50') {
                console.log(`[數量確認] ${h.stock_code} ${h.stock_name}: quantity=${quantity}, batchTotal=${batchTotal}`);
              }
              
              // 計算相關數值（quantity > 0 才執行）
              // 使用重新計算的值，不使用floorTo2Decimals以保持精度
              // 成本均價 = Σ(成交價 × 成交股數 + 手續費) / 股數（點精靈計算方式：包含手續費）
              cost_price = roundTo4Decimals((h.cashTotalPriceQty + h.cashTotalFee) / quantity);
              // 持有成本 = Σ(成交價 × 成交股數 + 手續費)（包含手續費，以匹配點精靈計算方式）
              // 四捨五入到整數
              holding_cost = Math.round(h.cashTotalPriceQty + h.cashTotalFee);
              // 股票市值 = 市價 × 股數（保持原始精度）
              market_value = (h.current_price || cost_price) * quantity;
              // 盈虧計算：點精靈的計算方式
              // 根據點精靈的計算邏輯（實際測試發現點精靈使用未折扣的手續費率）：
              // 賣出費用 = 賣出手續費（未折扣） + 賣出交易稅
              let stockTaxRate = getTaxRate(h.etf_type, h.stock_name, h.stock_code); // 賣出交易稅率（根據股票類型：一般股票0.3%，ETF 0.1%）
              // 判斷是否為ETF（優先使用etf_type，如果為null則通過stockCode判斷）
              const isEtf = !!h.etf_type || isEtfByCode(h.stock_code);
              // 點精靈在計算盈虧時使用未折扣的手續費率
              let stockFeeRate = isEtf ? ETF_FEE_RATE : FEE_RATE; // 賣出手續費率（未折扣，與點精靈對齊）
              
              // 點精靈計算：賣出手續費 + 賣出交易稅
              // 點精靈實測對齊（以 0050/00992A 為例）：
              // - 市值/成本最終以「整數」呈現（市值：先到小數2位再四捨五入；成本：四捨五入）
              // - 預估賣出手續費、交易稅：以「整數」無條件捨去（floor）
              const roundedMarketValue = Math.round(floorTo2Decimals(market_value));
              const roundedHoldingCost = Math.round(holding_cost);
              const estimatedSellFeeInt = Math.floor(roundedMarketValue * stockFeeRate); // 賣出手續費（未折扣，整數捨去，與點精靈對齊）
              const estimatedSellTaxInt = Math.floor(roundedMarketValue * stockTaxRate); // 賣出交易稅（整數捨去）
              const totalSellCostInt = estimatedSellFeeInt + estimatedSellTaxInt; // 總賣出成本（整數）
              profit_loss = roundedMarketValue - roundedHoldingCost - totalSellCostInt;
              
              // 調試信息：所有國內現股
              const is0050 = h.stock_code === '0050';
              if (is0050) {
                // 計算對比：使用未折扣手續費率的情況
                const baseFeeRate = isEtf ? ETF_FEE_RATE : FEE_RATE;
                const estimatedSellFeeNoDiscount = Math.floor(roundedMarketValue * baseFeeRate);
                const estimatedSellCostNoDiscount = estimatedSellFeeNoDiscount + estimatedSellTaxInt;
                const profitLossNoDiscount = roundedMarketValue - roundedHoldingCost - estimatedSellCostNoDiscount;
                
                console.log(`[0050 盈虧計算詳情]`);
                console.log(`  股票代碼: ${h.stock_code}, 股票名稱: ${h.stock_name}`);
                console.log(`  ETF類型: ${h.etf_type}, 是否為ETF: ${isEtf}`);
                console.log(`  市價: ${h.current_price}`);
                console.log(`  股數: ${quantity}`);
                console.log(`  市值(raw): ${market_value}`);
                console.log(`  市值(先floorTo2Decimals): ${floorTo2Decimals(market_value)}`);
                console.log(`  市值(整數四捨五入): ${roundedMarketValue}`);
                console.log(`  持有成本(raw): ${holding_cost}`);
                console.log(`  持有成本(整數四捨五入): ${roundedHoldingCost}`);
                console.log(`  手續費率(折扣後): ${stockFeeRate} (${stockFeeRate * 100}%)`);
                console.log(`  手續費率(未折扣): ${baseFeeRate} (${baseFeeRate * 100}%)`);
                console.log(`  交易稅率: ${stockTaxRate} (${stockTaxRate * 100}%)`);
                console.log(`  賣出手續費(折扣後, 整數捨去): ${estimatedSellFeeInt} = floor(${roundedMarketValue} * ${stockFeeRate})`);
                console.log(`  賣出手續費(未折扣, 整數捨去): ${estimatedSellFeeNoDiscount} = floor(${roundedMarketValue} * ${baseFeeRate})`);
                console.log(`  賣出交易稅(整數捨去): ${estimatedSellTaxInt} = floor(${roundedMarketValue} * ${stockTaxRate})`);
                console.log(`  總賣出成本(折扣後): ${totalSellCostInt}`);
                console.log(`  總賣出成本(未折扣): ${estimatedSellCostNoDiscount}`);
                console.log(`  盈虧(折扣後): ${roundedMarketValue} - ${roundedHoldingCost} - ${totalSellCostInt} = ${profit_loss}`);
                console.log(`  盈虧(未折扣): ${roundedMarketValue} - ${roundedHoldingCost} - ${estimatedSellCostNoDiscount} = ${profitLossNoDiscount}`);
                console.log(`  點精靈顯示: 144688, 系統計算(折扣後): ${profit_loss}, 系統計算(未折扣): ${profitLossNoDiscount}`);
              }
              
              console.log(
                `[國內現股計算結果] ${h.stock_code} ${h.stock_name} ` +
                  `數量=${quantity}, ` +
                  `市值(raw)=${market_value}, 市值(整數)=${roundedMarketValue}, ` +
                  `持有成本(raw)=${holding_cost}, 持有成本(整數)=${roundedHoldingCost}, ` +
                  `手續費率=${stockFeeRate}, 交易稅率=${stockTaxRate}, ` +
                  `手續費(整數捨去)=${estimatedSellFeeInt}, 交易稅(整數捨去)=${estimatedSellTaxInt}, ` +
                  `賣出費用(整數)=${totalSellCostInt}, 盈虧=${profit_loss}`
              );
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

        // 調試：記錄返回前的最終狀態（特別是 50 股票）
        if (h.stock_code === '0050' || h.stock_code === '50') {
          const finalBatchTotal = h.transaction_type === '現股' && h.cashBuyBatches 
            ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) 
            : 0;
          console.log(`[返回前檢查] ${h.stock_code} ${h.stock_name}:`);
          console.log(`  - quantity=${quantity}`);
          console.log(`  - h.cashQuantity=${h.cashQuantity}`);
          console.log(`  - finalBatchTotal=${finalBatchTotal}`);
          console.log(`  - market_value=${market_value}`);
          console.log(`  - holding_cost=${holding_cost}`);
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
          
          // 調試：記錄返回的庫存數量（特別是 50 股票）
          _debug_cashQuantity: h.cashQuantity,
          _debug_batchTotal: h.transaction_type === '現股' && h.cashBuyBatches 
            ? h.cashBuyBatches.reduce((sum: number, batch: any) => sum + batch.quantity, 0) 
            : 0,
          _debug_financingQuantity: h.financingQuantity || 0,
          profit_loss_percent: profit_loss_percent,
          currency: h.currency,
          // 價格來源資訊
          price_source: h.price_source || null, // 'realtime' 或 'close'
          price_updated_at: h.price_updated_at || null, // 時間戳
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

    // 調試：記錄所有股票的盈虧明細
    console.log(`[總盈虧計算] 總庫存數=${totalHoldings}, 總市值=${totalMarketValue}, 總成本=${totalCost}, 總盈虧=${totalProfitLoss}`);
    console.log(`[總盈虧計算] 各股票盈虧明細:`);
    holdings.forEach((h: any) => {
      // 使用調試字段而不是嘗試從返回對象中計算（因為返回對象可能不包含 cashBuyBatches）
      const batchTotal = h._debug_batchTotal || 0;
      console.log(`  - ${h.stock_code} ${h.stock_name}: 盈虧=${h.profit_loss}, 市值=${h.market_value}, 成本=${h.holding_cost}, 庫存數量=${h.quantity || 0}, 現股庫存=${h._debug_cashQuantity || 0}, 批次總數量=${batchTotal}, 融資庫存=${h._debug_financingQuantity || 0}`);
      
      // 調試：如果庫存數量與批次總數量不一致，記錄警告（特別是 50 股票）
      if ((h.stock_code === '0050' || h.stock_code === '50') && h.quantity !== batchTotal) {
        console.log(`  [警告] ${h.stock_code} ${h.stock_name}: 庫存數量(${h.quantity})與批次總數量(${batchTotal})不一致！`);
      }
    });

    // 調試：記錄0050的所有最終返回數據（包括 '0050' 和 '50' 兩種格式）
    const holdings0050 = holdings.filter((h: any) => h.stock_code === '0050' || h.stock_code === '50');
    if (holdings0050.length > 0) {
      console.log(`[Holdings API 返回] 找到 ${holdings0050.length} 條 0050 股票的記錄:`);
      holdings0050.forEach((h: any, idx: number) => {
        console.log(`  [${idx}] 股票代碼=${h.stock_code}, 股票名稱=${h.stock_name}, 帳號=${h.account_name}, 數量=${h.quantity}, 市值=${h.market_value}, 成本=${h.holding_cost}, 盈虧=${h.profit_loss}`);
      });
      // 計算總數量
      const totalQuantity0050 = holdings0050.reduce((sum: number, h: any) => sum + (h.quantity || 0), 0);
      console.log(`[Holdings API 返回] 0050 總數量=${totalQuantity0050}, 預期數量=11000`);
    }

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

    // 獲取所有交易記錄（包含買入和賣出，用於計算剩餘數量）
    let query = `SELECT t.*, sa.account_name, sa.broker_name, sd.market_type, sd.etf_type
                 FROM transactions t 
                 LEFT JOIN securities_accounts sa ON t.securities_account_id = sa.id 
                 LEFT JOIN stock_data sd ON t.stock_code = sd.stock_code
                 WHERE t.user_id = ? 
                 AND (t.currency = 'TWD' OR t.currency IS NULL)`;
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

    const allTransactions = await all<any>(query, params);

    // 讀取手續費設定
    let feeSettings = {
      baseFeeRate: 0.1425,
      etfFeeRate: 0.1425,
      taxRate: 0.3,
      etfTaxRate: 0.1,
      buyFeeDiscount: 0.6,
      sellFeeDiscount: 0.6,
    };

    try {
      const settings = await all<any>(
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
        // 兼容舊設定：如果沒有etfFeeRate，使用baseFeeRate或預設值
        if (!parsedSettings.etfFeeRate) {
          feeSettings.etfFeeRate = parsedSettings.baseFeeRate || 0.1425;
        }
      }
    } catch (err) {
      console.error('讀取手續費設定失敗，使用預設值:', err);
    }

    const FEE_RATE = (feeSettings.baseFeeRate || 0.1425) / 100;
    const ETF_FEE_RATE = (feeSettings.etfFeeRate || 0.1425) / 100;
    const BUY_FEE_RATE_DISCOUNT = FEE_RATE * (feeSettings.buyFeeDiscount || 0.6);
    const ETF_BUY_FEE_RATE_DISCOUNT = ETF_FEE_RATE * (feeSettings.buyFeeDiscount || 0.6);
    const FINANCING_RATE = 0.6;
    const MARGIN_RATE = 0.9;
    const FINANCING_INTEREST_RATE = 0.06;

    // 判斷是否為 ETF 的輔助函數
    const isEtfByCode = (code: string): boolean => {
      if (!code) return false;
      if (/^005[0-7]$/.test(code)) return true;
      if (/^006\d{3}$/.test(code)) return true;
      if (/^00\d{3}[LRUBA]$/.test(code)) return true;
      if (/^00\d{3}$/.test(code)) return true;
      return false;
    };

    // 根據股票類型獲取折扣後手續費率的函數
    const getDiscountFeeRate = (etfType: string | null, stockCode: string = '', isBuy: boolean) => {
      if (isEtfByCode(stockCode) || etfType) {
        return ETF_BUY_FEE_RATE_DISCOUNT;
      }
      return BUY_FEE_RATE_DISCOUNT;
    };

    // 使用 Map 追蹤每筆買入交易的剩餘數量（key: transaction_id, value: remainingQuantity）
    const buyTransactionRemaining = new Map<number, number>();
    const buyTransactionDetails = new Map<number, any>();

    // 第一次遍歷：記錄所有買入交易（只記錄現股買入），並初始化剩餘數量
    allTransactions.forEach((t: any) => {
      const isBuy = t.transaction_type.includes('買進') || t.transaction_type.includes('買入');
      // 只處理現股買入（排除融資和融券）
      const isFinancing = t.transaction_type.includes('融資');
      const isShortSell = t.transaction_type.includes('融券');
      
      if (isBuy && !isFinancing && !isShortSell) {
        buyTransactionRemaining.set(t.id, t.quantity);
        buyTransactionDetails.set(t.id, t);
      }
    });

    // 第二次遍歷：使用 FIFO 邏輯扣除已賣出的數量
    // 按照交易日期和時間順序處理，先買的先賣（FIFO）
    const today = new Date().toISOString().split('T')[0];
    
    // 按股票代碼、帳戶、交易類型分組處理
    const stockGroupMap = new Map<string, Array<{ id: number; quantity: number; trade_date: string; created_at: string }>>();

    allTransactions.forEach((t: any) => {
      const isBuy = t.transaction_type.includes('買進') || t.transaction_type.includes('買入');
      const isSell = t.transaction_type.includes('賣出') || t.transaction_type.includes('賣');
      
      // 只處理現股交易（排除融資和融券）
      const isFinancing = t.transaction_type.includes('融資');
      const isShortSell = t.transaction_type.includes('融券');
      
      if ((isBuy || isSell) && !isFinancing && !isShortSell) {
        const groupKey = `${t.securities_account_id || 'null'}_${t.stock_code}_現股`;
        
        if (!stockGroupMap.has(groupKey)) {
          stockGroupMap.set(groupKey, []);
        }
        
        stockGroupMap.get(groupKey)!.push({
          id: t.id,
          quantity: isSell ? -t.quantity : t.quantity, // 賣出用負數
          trade_date: t.trade_date || today,
          created_at: t.created_at || t.trade_date || today,
        });
      }
    });

    // 對每個分組執行 FIFO 扣除
    stockGroupMap.forEach((transactions, groupKey) => {
      // 按交易日期和時間排序
      transactions.sort((a, b) => {
        if (a.trade_date !== b.trade_date) {
          return a.trade_date.localeCompare(b.trade_date);
        }
        return a.created_at.localeCompare(b.created_at);
      });

      // 使用佇列處理 FIFO
      const buyQueue: Array<{ id: number; quantity: number }> = [];

      transactions.forEach((txn) => {
        if (txn.quantity > 0) {
          // 買入：加入佇列
          buyQueue.push({ id: txn.id, quantity: txn.quantity });
        } else {
          // 賣出：從佇列中扣除（FIFO）
          let remainingSellQty = Math.abs(txn.quantity);
          
          while (remainingSellQty > 0 && buyQueue.length > 0) {
            const buy = buyQueue[0];
            const currentRemaining = buyTransactionRemaining.get(buy.id) || 0;
            
            if (currentRemaining <= remainingSellQty) {
              // 整個買入都被賣出
              buyTransactionRemaining.set(buy.id, 0);
              remainingSellQty -= currentRemaining;
              buyQueue.shift();
            } else {
              // 部分買入被賣出
              buyTransactionRemaining.set(buy.id, currentRemaining - remainingSellQty);
              remainingSellQty = 0;
            }
          }
        }
      });
    });

    // 調試：記錄庫存明細計算結果
    console.log(`[庫存明細 API] 找到 ${buyTransactionDetails.size} 筆買入交易`);
    const remainingCount = Array.from(buyTransactionRemaining.values()).filter((qty: number) => qty > 0).length;
    console.log(`[庫存明細 API] 剩餘數量 > 0 的買入交易: ${remainingCount} 筆`);
    
    // 只返回剩餘數量 > 0 的買入交易
    const details = Array.from(buyTransactionDetails.values())
      .filter((t: any) => {
        const remaining = buyTransactionRemaining.get(t.id) || 0;
        if (remaining > 0) {
          console.log(`[庫存明細 API] 股票 ${t.stock_code} ${t.stock_name}: 交易ID=${t.id}, 原始數量=${t.quantity}, 剩餘數量=${remaining}`);
        }
        return remaining > 0;
      })
      .map((t: any) => {
        const remaining = buyTransactionRemaining.get(t.id) || 0;
        // 使用 floorTo2Decimals 處理價格 × 數量，避免浮點數誤差
        const priceQty = floorTo2Decimals(t.price * remaining); // 使用剩餘數量計算
        const isFinancing = t.transaction_type.includes('融資');
        const isShortSell = t.transaction_type.includes('融券');

        let transactionType = '現股';
        if (isFinancing) transactionType = '融資';
        else if (isShortSell) transactionType = '融券';

        // 計算持有成本（基於剩餘數量，四捨五入到整數）
        let holdingCost = 0;
        if (transactionType === '現股') {
          const feeRate = getDiscountFeeRate(t.etf_type, t.stock_code, true);
          let fee = 0;
          if (t.fee) {
            // 如果資料庫中有手續費，按比例計算剩餘部分的手續費
            fee = t.fee * (remaining / t.quantity);
            fee = floorTo2Decimals(fee); // 保留兩位小數，避免浮點數誤差
          } else {
            fee = floorTo2Decimals(priceQty * feeRate);
          }
          // 確保 priceQty 和 fee 都是數字，然後相加再四捨五入
          const totalCost = Number(priceQty) + Number(fee);
          holdingCost = Math.round(totalCost); // 四捨五入到整數
        } else if (transactionType === '融資') {
          const financingAmount = calculateFinancingAmount(t.price, remaining, FINANCING_RATE);
          const margin = priceQty - financingAmount;
          const feeRate = getDiscountFeeRate(t.etf_type, t.stock_code, true);
          let fee = 0;
          if (t.fee) {
            fee = t.fee * (remaining / t.quantity);
            fee = Math.round(fee * 100) / 100; // 先保留兩位小數，避免浮點數誤差
          } else {
            fee = floorTo2Decimals(priceQty * feeRate);
          }
          const totalCost = Number(margin) + Number(fee);
          holdingCost = Math.round(totalCost); // 四捨五入到整數
        } else if (transactionType === '融券') {
          const margin = calculateMargin(t.price, remaining, MARGIN_RATE);
          holdingCost = Math.round(margin); // 四捨五入到整數
        }

        // 計算預估息（僅融資，基於剩餘數量）
        let estimatedInterest = 0;
        if (transactionType === '融資' && t.settlement_date) {
          const days = daysBetween(t.settlement_date, today);
          if (days > 0) {
            const financingAmount = calculateFinancingAmount(t.price, remaining, FINANCING_RATE);
            estimatedInterest = calculateInterest(financingAmount, FINANCING_INTEREST_RATE, days);
          }
        }

        // 計算融資金額/券擔保品（基於剩餘數量）
        let financingAmountOrCollateral = null;
        if (transactionType === '融資') {
          financingAmountOrCollateral = calculateFinancingAmount(t.price, remaining, FINANCING_RATE);
        } else if (transactionType === '融券') {
          const fee = t.fee ? (t.fee * (remaining / t.quantity)) : 0;
          const tax = ((t.tax || 0) + (t.securities_tax || 0)) * (remaining / t.quantity);
          const borrowingFee = (t.borrowing_fee || 0) * (remaining / t.quantity);
          const totalFee = floorTo2Decimals(fee + tax + borrowingFee);
          financingAmountOrCollateral = floorTo2Decimals(priceQty - totalFee);
        }

        return {
          id: t.id,
          account_name: t.account_name || '-',
          transaction_type: transactionType,
          stock_code: t.stock_code,
          stock_name: t.stock_name,
          trade_date: t.trade_date,
          quantity: remaining, // 返回剩餘數量
          original_quantity: t.quantity, // 原始買入數量
          price: t.price,
          holding_cost: holdingCost,
          estimated_interest: estimatedInterest,
          financing_amount_or_collateral: financingAmountOrCollateral,
          currency: t.currency || 'TWD',
          buy_reason: t.buy_reason || '',
        };
      })
      .sort((a, b) => {
        // 按交易日期倒序排列
        if (a.trade_date !== b.trade_date) {
          return b.trade_date.localeCompare(a.trade_date);
        }
        return b.id - a.id;
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

// 手動更新股票市價
router.put('/:securitiesAccountId/:stockCode/price', async (req: AuthRequest, res) => {
  try {
    const { securitiesAccountId, stockCode } = req.params;
    const { price, transactionType } = req.body;

    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      return res.status(400).json({
        success: false,
        message: '無效的價格',
      });
    }

    const transactionTypeValue = transactionType || '現股';
    const settingKey = `manual_price_${securitiesAccountId}_${stockCode}_${transactionTypeValue}`;
    const priceValue = parseFloat(price).toFixed(2);

    // 檢查是否已存在該設定
    const existing = await get<any>(
      'SELECT id FROM system_settings WHERE user_id = ? AND setting_key = ?',
      [req.userId, settingKey]
    );

    if (existing) {
      // 更新現有設定
      await run(
        'UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND setting_key = ?',
        [priceValue, req.userId, settingKey]
      );
    } else {
      // 創建新設定
      await run(
        'INSERT INTO system_settings (user_id, setting_key, setting_value) VALUES (?, ?, ?)',
        [req.userId, settingKey, priceValue]
      );
    }

    // 清除該股票的價格緩存，以便下次獲取時使用新價格
    priceCache.delete(stockCode);

    res.json({
      success: true,
      message: '市價更新成功',
      data: {
        securities_account_id: securitiesAccountId,
        stock_code: stockCode,
        transaction_type: transactionTypeValue,
        price: parseFloat(priceValue),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新市價失敗',
    });
  }
});

// 清除手動設置的股票市價（恢復自動獲取）
router.delete('/:securitiesAccountId/:stockCode/price', async (req: AuthRequest, res) => {
  try {
    const { securitiesAccountId, stockCode } = req.params;
    const { transactionType } = req.query;

    const transactionTypeValue = transactionType || '現股';
    const settingKey = `manual_price_${securitiesAccountId}_${stockCode}_${transactionTypeValue}`;

    // 刪除設定
    await run(
      'DELETE FROM system_settings WHERE user_id = ? AND setting_key = ?',
      [req.userId, settingKey]
    );

    // 清除該股票的價格緩存
    priceCache.delete(stockCode);

    res.json({
      success: true,
      message: '已清除手動設置的市價，將恢復自動獲取',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '清除市價失敗',
    });
  }
});

// 庫存現在由交易記錄自動計算，不再支持手動新增/編輯/刪除

export default router;
