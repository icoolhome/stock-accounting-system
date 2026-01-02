import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface Currency {
  id: number;
  currency_code: string;
  currency_name: string;
  exchange_rate: number;
  is_default: number;
}

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('api');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // API設定
  const [apiSettings, setApiSettings] = useState({
    apiUrl: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    autoUpdate: true,
    priceSource: 'auto', // 'auto' | 'twse_stock_day_all' | 'twse_mi_index' | 'tpex'
  });

  // 交易設定
  const [tradingSettings, setTradingSettings] = useState({
    addPositionThreshold: -5, // 加倉點位（%）
    sellPositionThreshold: 10, // 賣出點位（%）
    addPositionSound: '', // 加倉提醒聲音URL
    sellPositionSound: '', // 賣出提醒聲音URL
  });

  // 介面設定
  const [uiSettings, setUiSettings] = useState({
    fontSize: '16px',
  });

  // 手續費設定
  const [feeSettings, setFeeSettings] = useState({
    buyFeeDiscount: 0.6, // 買進手續費折扣（預設6折）
    sellFeeDiscount: 0.6, // 賣出手續費折扣（預設6折）
    baseFeeRate: 0.1425, // 一般股票手續費率（預設0.1425%）
    etfFeeRate: 0.1425, // 股票型ETF手續費率（預設0.1425%）
    taxRate: 0.3, // 一般股票交易稅率（預設0.3%）
    etfTaxRate: 0.1, // 股票型ETF交易稅率（預設0.1%）
    minFee: 20,
  });

  // 幣別設定
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [newCurrency, setNewCurrency] = useState({
    currency_code: '',
    currency_name: '',
    exchange_rate: 1.0,
    is_default: false,
  });

  // 密碼設定
  const [passwordSettings, setPasswordSettings] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 郵箱設定
  const [emailSettings, setEmailSettings] = useState({
    newEmail: user?.email || '',
  });

  // 測試連接狀態
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  // 文件選擇狀態
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  // 股票資料統計
  const [stockStats, setStockStats] = useState({
    listed: 0,
    otc: 0,
    emerging: 0,
    etf: 0,
    activeEtf: 0,
    passiveEtf: 0,
  });

  // 即時匯率
  const [exchangeRates, setExchangeRates] = useState({
    TWD: 1,
    CNY: null as number | null,
    USD: null as number | null,
    JPY: null as number | null,
    lastUpdated: null as string | null,
  });

  useEffect(() => {
    fetchSettings();
    fetchCurrencies();
    fetchStockStats();
    fetchExchangeRates();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      const settings = response.data.data;

      if (settings.apiSettings) setApiSettings(settings.apiSettings);
      if (settings.tradingSettings) setTradingSettings(settings.tradingSettings);
      if (settings.uiSettings) setUiSettings(settings.uiSettings);
      if (settings.feeSettings) setFeeSettings(settings.feeSettings);
    } catch (err: any) {
      console.error('獲取設定失敗:', err);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await axios.get('/api/settings/currencies');
      setCurrencies(response.data.data);
    } catch (err: any) {
      console.error('獲取幣別設定失敗:', err);
    }
  };

  const fetchStockStats = async () => {
    try {
      const response = await axios.get('/api/settings/stock-stats');
      setStockStats(response.data.data || {
        listed: 0,
        otc: 0,
        emerging: 0,
        etf: 0,
        activeEtf: 0,
        passiveEtf: 0,
      });
    } catch (err: any) {
      console.error('獲取股票資料統計失敗:', err);
    }
  };

  const fetchExchangeRates = async () => {
    try {
      const response = await axios.get('/api/settings/exchange-rates');
      if (response.data.success) {
        setExchangeRates(response.data.data || {
          TWD: 1,
          CNY: null,
          USD: null,
          JPY: null,
          lastUpdated: null,
        });
      }
    } catch (err: any) {
      console.error('獲取匯率失敗:', err);
    }
  };

  const saveSettings = async (settingsKey: string, settingsData: any) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.put('/api/settings', {
        settings: {
          [settingsKey]: settingsData,
        },
      });

      setSuccess('設定保存成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '保存設定失敗');
    } finally {
      setLoading(false);
    }
  };

  // 導出存檔
  const handleExportSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 獲取所有設定
      const response = await axios.get('/api/settings');
      const settings = response.data.data;
      
      // 獲取幣別設定
      const currenciesResponse = await axios.get('/api/settings/currencies');
      const currencies = currenciesResponse.data.data;
      
      // 獲取所有股票資料
      const stockDataResponse = await axios.get('/api/stocks');
      const stockData = stockDataResponse.data.data || [];
      
      // 獲取證券帳戶
      const securitiesAccountsResponse = await axios.get('/api/securities-accounts');
      const securitiesAccounts = securitiesAccountsResponse.data.data || [];
      
      // 獲取銀行帳戶
      const bankAccountsResponse = await axios.get('/api/bank-accounts');
      const bankAccounts = bankAccountsResponse.data.data || [];
      
      // 獲取交易記錄
      const transactionsResponse = await axios.get('/api/transactions');
      const transactions = transactionsResponse.data.data || [];
      
      // 獲取交割記錄
      const settlementsResponse = await axios.get('/api/settlements');
      const settlements = settlementsResponse.data.data || [];
      
      // 獲取歷史收益
      const dividendsResponse = await axios.get('/api/dividends');
      const dividends = dividendsResponse.data.data || [];
      
      // 獲取庫存管理（計算結果）
      const holdingsResponse = await axios.get('/api/holdings');
      const holdings = holdingsResponse.data.data || [];
      
      // 準備導出數據
      const exportData = {
        version: '2.0',
        exportDate: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        settings: {
          apiSettings: settings.apiSettings || apiSettings,
          feeSettings: settings.feeSettings || feeSettings,
          tradingSettings: settings.tradingSettings || tradingSettings,
          uiSettings: settings.uiSettings || uiSettings,
        },
        currencies: currencies,
        stockData: stockData.map((stock: any) => ({
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
          market_type: stock.market_type,
          etf_type: stock.etf_type,
          industry: stock.industry,
        })),
        securitiesAccounts: securitiesAccounts.map((account: any) => ({
          account_name: account.account_name,
          broker_name: account.broker_name,
          account_number: account.account_number,
        })),
        bankAccounts: bankAccounts.map((account: any) => ({
          securities_account_name: account.securities_account_name || null,
          securities_account_broker: account.broker_name || null,
          bank_name: account.bank_name,
          account_number: account.account_number,
          account_type: account.account_type,
          balance: account.balance,
          currency: account.currency,
        })),
        transactions: transactions.map((txn: any) => ({
          securities_account_name: txn.account_name,
          securities_account_broker: txn.broker_name,
          trade_date: txn.trade_date,
          settlement_date: txn.settlement_date,
          transaction_type: txn.transaction_type,
          stock_code: txn.stock_code,
          stock_name: txn.stock_name,
          quantity: txn.quantity,
          price: txn.price,
          fee: txn.fee,
          transaction_amount: txn.transaction_amount,
          tax: txn.tax,
          securities_tax: txn.securities_tax,
          financing_amount: txn.financing_amount,
          margin: txn.margin,
          interest: txn.interest,
          borrowing_fee: txn.borrowing_fee,
          net_amount: txn.net_amount,
          profit_loss: txn.profit_loss,
          return_rate: txn.return_rate,
          holding_cost: txn.holding_cost,
          health_insurance: txn.health_insurance,
          currency: txn.currency,
          buy_reason: txn.buy_reason,
        })),
        settlements: settlements.map((settlement: any) => ({
          bank_name: settlement.bank_name,
          bank_account_number: settlement.account_number,
          settlement_date: settlement.settlement_date,
          trade_date: settlement.trade_date,
          settlement_amount: settlement.settlement_amount,
          twd_amount: settlement.twd_amount,
          status: settlement.status,
          notes: settlement.notes,
          stock_code: settlement.stock_code,
          stock_name: settlement.stock_name,
          transaction_ids: settlement.transaction_ids,
        })),
        dividends: dividends.map((dividend: any) => ({
          record_date: dividend.record_date,
          income_type: dividend.income_type,
          stock_code: dividend.stock_code,
          stock_name: dividend.stock_name,
          pre_tax_amount: dividend.pre_tax_amount,
          tax_amount: dividend.tax_amount,
          after_tax_amount: dividend.after_tax_amount,
          dividend_per_share: dividend.dividend_per_share,
          share_count: dividend.share_count,
          source: dividend.source,
          description: dividend.description,
        })),
        holdings: holdings.map((holding: any) => ({
          account_name: holding.account_name,
          broker_name: holding.broker_name,
          stock_code: holding.stock_code,
          stock_name: holding.stock_name,
          market_type: holding.market_type,
          transaction_type: holding.transaction_type,
          industry: holding.industry,
          quantity: holding.quantity,
          cost_price: holding.cost_price,
          break_even_price: holding.break_even_price,
          current_price: holding.current_price,
          market_value: holding.market_value,
          holding_cost: holding.holding_cost,
          profit_loss: holding.profit_loss,
          profit_loss_percent: holding.profit_loss_percent,
          currency: holding.currency,
        })),
      };
      
      // 轉換為JSON字符串
      const jsonStr = JSON.stringify(exportData, null, 2);
      
      // 創建Blob並下載
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `系統完整備份_${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSuccess('完整備份檔案導出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '導出備份檔案失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 載入存檔(覆蓋)
  const handleImportSettings = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFileName('');
      return;
    }

    setSelectedFileName(file.name);

    try {
      setLoading(true);
      setError('');
      
      // 確認操作
      const confirmed = window.confirm(
        '載入存檔將會覆蓋現有設定，此操作無法復原。確定要繼續嗎？'
      );
      if (!confirmed) {
        e.target.value = ''; // 重置文件輸入
        setSelectedFileName('');
        return;
      }

      // 讀取文件
      const text = await file.text();
      const importData = JSON.parse(text);

      // 驗證數據格式
      if (!importData.settings) {
        throw new Error('檔案格式不正確');
      }

      // 載入設定
      if (importData.settings.apiSettings) {
        await saveSettings('apiSettings', importData.settings.apiSettings);
        setApiSettings(importData.settings.apiSettings);
      }
      if (importData.settings.feeSettings) {
        await saveSettings('feeSettings', importData.settings.feeSettings);
        setFeeSettings(importData.settings.feeSettings);
      }
      if (importData.settings.tradingSettings) {
        await saveSettings('tradingSettings', importData.settings.tradingSettings);
        setTradingSettings(importData.settings.tradingSettings);
      }
      if (importData.settings.uiSettings) {
        await saveSettings('uiSettings', importData.settings.uiSettings);
        setUiSettings(importData.settings.uiSettings);
      }

      // 載入幣別設定
      if (importData.currencies && Array.isArray(importData.currencies)) {
        // 先刪除現有幣別（可選，這裡先保留現有，只添加新的）
        // 然後添加導入的幣別
        for (const currency of importData.currencies) {
          try {
            await axios.post('/api/settings/currencies', currency);
          } catch (err: any) {
            // 如果已存在，忽略錯誤
            console.warn('幣別已存在，跳過:', currency.currency_code);
          }
        }
        await fetchCurrencies();
      }

      // 載入股票資料
      if (importData.stockData && Array.isArray(importData.stockData)) {
        // 批量導入股票資料
        for (const stock of importData.stockData) {
          try {
            // 使用PUT方法來更新或插入股票資料
            await axios.put('/api/stocks', {
              stock_code: stock.stock_code,
              stock_name: stock.stock_name,
              market_type: stock.market_type || null,
              etf_type: stock.etf_type || null,
              industry: stock.industry || null,
            });
          } catch (err: any) {
            // 如果失敗，記錄錯誤但繼續處理
            console.warn('股票資料導入失敗:', stock.stock_code, err.response?.data?.message || err.message);
          }
        }
      }

      // 載入證券帳戶（建立ID映射）
      // 先獲取現有證券帳戶（只獲取一次，提高效率）
      let existingAccountsResponse = await axios.get('/api/securities-accounts');
      let existingAccounts = existingAccountsResponse.data.data || [];
      let allSecuritiesAccounts = existingAccounts; // 用於後續匹配，會隨導入更新
      const existingAccountMap = new Map<string, number>();
      existingAccounts.forEach((acc: any) => {
        const key = `${acc.account_name}|${acc.broker_name}|${acc.account_number}`;
        existingAccountMap.set(key, acc.id);
      });

      const securitiesAccountMap = new Map<string, number>(); // key: account_name|broker_name|account_number, value: new ID
      if (importData.securitiesAccounts && Array.isArray(importData.securitiesAccounts)) {

        // 導入證券帳戶
        for (const account of importData.securitiesAccounts) {
          const key = `${account.account_name}|${account.broker_name}|${account.account_number}`;
          // 檢查是否已存在
          if (existingAccountMap.has(key)) {
            securitiesAccountMap.set(key, existingAccountMap.get(key)!);
          } else {
            try {
              const response = await axios.post('/api/securities-accounts', {
                account_name: account.account_name,
                broker_name: account.broker_name,
                account_number: account.account_number,
              });
              const newId = response.data.data?.id;
              if (newId) {
                securitiesAccountMap.set(key, newId);
                // 更新allSecuritiesAccounts列表
                allSecuritiesAccounts = [...allSecuritiesAccounts, { id: newId, account_name: account.account_name, broker_name: account.broker_name, account_number: account.account_number }];
              }
            } catch (err: any) {
              console.warn('證券帳戶導入失敗:', account.account_name, err.response?.data?.message || err.message);
            }
          }
        }
      }

      // 載入銀行帳戶（需要使用證券帳戶ID映射）
      // 先獲取現有銀行帳戶（只獲取一次，提高效率）
      let existingBankAccountsResponse = await axios.get('/api/bank-accounts');
      let existingBankAccounts = existingBankAccountsResponse.data.data || [];
      let allBankAccounts = existingBankAccounts; // 用於後續匹配，會隨導入更新
      const existingBankAccountMap = new Map<string, number>();
      existingBankAccounts.forEach((acc: any) => {
        const key = `${acc.bank_name}|${acc.account_number}`;
        existingBankAccountMap.set(key, acc.id);
      });

      const bankAccountMap = new Map<string, number>(); // key: bank_name|account_number, value: new ID
      if (importData.bankAccounts && Array.isArray(importData.bankAccounts)) {
        // 導入銀行帳戶
        for (const account of importData.bankAccounts) {
          const key = `${account.bank_name}|${account.account_number}`;
          // 檢查是否已存在
          if (existingBankAccountMap.has(key)) {
            bankAccountMap.set(key, existingBankAccountMap.get(key)!);
          } else {
            try {
              let securitiesAccountId = null;
              if (account.securities_account_name && account.securities_account_broker) {
                // 查找對應的證券帳戶ID（使用已經獲取的證券帳戶列表）
                const matchedAccount = allSecuritiesAccounts.find((acc: any) => 
                  acc.account_name === account.securities_account_name && 
                  acc.broker_name === account.securities_account_broker
                );
                if (matchedAccount) {
                  securitiesAccountId = matchedAccount.id;
                }
              }

              const response = await axios.post('/api/bank-accounts', {
                securities_account_id: securitiesAccountId,
                bank_name: account.bank_name,
                account_number: account.account_number,
                account_type: account.account_type || '儲蓄帳戶',
                balance: account.balance || 0,
                currency: account.currency || 'TWD',
              });
              const newId = response.data.data?.id;
              if (newId) {
                bankAccountMap.set(key, newId);
                // 更新allBankAccounts列表
                allBankAccounts = [...allBankAccounts, { id: newId, bank_name: account.bank_name, account_number: account.account_number }];
              }
            } catch (err: any) {
              console.warn('銀行帳戶導入失敗:', account.bank_name, err.response?.data?.message || err.message);
            }
          }
        }
      }

      // 載入交易記錄（需要使用證券帳戶ID映射）
      // 如果之前沒有導入證券帳戶，需要重新獲取（但通常不需要，因為上面已經有了）

      const transactionMap = new Map<number, number>(); // key: old index, value: new ID
      if (importData.transactions && Array.isArray(importData.transactions)) {
        for (let i = 0; i < importData.transactions.length; i++) {
          const txn = importData.transactions[i];
          try {
            // 查找對應的證券帳戶ID（使用已經獲取的證券帳戶列表）
            let securitiesAccountId = null;
            if (txn.securities_account_name && txn.securities_account_broker) {
              const matchedAccount = allSecuritiesAccounts.find((acc: any) => 
                acc.account_name === txn.securities_account_name && 
                acc.broker_name === txn.securities_account_broker
              );
              if (matchedAccount) {
                securitiesAccountId = matchedAccount.id;
              }
            }

            const response = await axios.post('/api/transactions', {
              securities_account_id: securitiesAccountId,
              trade_date: txn.trade_date,
              settlement_date: txn.settlement_date,
              transaction_type: txn.transaction_type,
              stock_code: txn.stock_code,
              stock_name: txn.stock_name,
              quantity: txn.quantity,
              price: txn.price,
              fee: txn.fee || 0,
              transaction_amount: txn.transaction_amount,
              tax: txn.tax || 0,
              securities_tax: txn.securities_tax || 0,
              financing_amount: txn.financing_amount || 0,
              margin: txn.margin || 0,
              interest: txn.interest || 0,
              borrowing_fee: txn.borrowing_fee || 0,
              net_amount: txn.net_amount,
              profit_loss: txn.profit_loss || 0,
              return_rate: txn.return_rate || 0,
              holding_cost: txn.holding_cost || 0,
              health_insurance: txn.health_insurance || 0,
              currency: txn.currency || 'TWD',
              buy_reason: txn.buy_reason || null,
            });
            const newId = response.data.data?.id;
            if (newId) {
              transactionMap.set(i, newId);
            }
          } catch (err: any) {
            console.warn('交易記錄導入失敗:', txn.stock_code, err.response?.data?.message || err.message);
          }
        }
      }

      // 載入交割記錄（需要使用銀行帳戶和交易記錄ID映射）
      if (importData.settlements && Array.isArray(importData.settlements)) {
        for (const settlement of importData.settlements) {
          try {
            // 查找對應的銀行帳戶ID（使用已經獲取的銀行帳戶列表）
            let bankAccountId = null;
            if (settlement.bank_name && settlement.bank_account_number) {
              const key = `${settlement.bank_name}|${settlement.bank_account_number}`;
              bankAccountId = bankAccountMap.get(key) || null;
              if (!bankAccountId) {
                // 如果映射中沒有，嘗試從已獲取的帳戶列表中查找
                const matchedAccount = allBankAccounts.find((acc: any) => 
                  acc.bank_name === settlement.bank_name && 
                  acc.account_number === settlement.bank_account_number
                );
                if (matchedAccount) {
                  bankAccountId = matchedAccount.id;
                }
              }
            }

            // 處理transaction_ids（如果有）
            let transactionIds: number[] | null = null;
            if (settlement.transaction_ids) {
              try {
                const oldIds = typeof settlement.transaction_ids === 'string' 
                  ? JSON.parse(settlement.transaction_ids) 
                  : settlement.transaction_ids;
                // 注意：由於ID映射複雜，這裡簡化處理，只導入settlement本身
                // 實際使用中，transaction_ids可能無法完全匹配
              } catch (e) {
                // 忽略解析錯誤
              }
            }

            await axios.post('/api/settlements', {
              transaction_ids: transactionIds,
              bank_account_id: bankAccountId,
              settlement_date: settlement.settlement_date,
              trade_date: settlement.trade_date,
              settlement_amount: settlement.settlement_amount,
              twd_amount: settlement.twd_amount,
              status: settlement.status || '未交割',
              notes: settlement.notes || null,
            });
          } catch (err: any) {
            console.warn('交割記錄導入失敗:', settlement.settlement_date, err.response?.data?.message || err.message);
          }
        }
      }

      // 載入歷史收益（無關聯，可以直接導入）
      if (importData.dividends && Array.isArray(importData.dividends)) {
        for (const dividend of importData.dividends) {
          try {
            await axios.post('/api/dividends', {
              record_date: dividend.record_date,
              income_type: dividend.income_type || '全部',
              stock_code: dividend.stock_code,
              stock_name: dividend.stock_name,
              pre_tax_amount: dividend.pre_tax_amount,
              tax_amount: dividend.tax_amount || 0,
              after_tax_amount: dividend.after_tax_amount,
              dividend_per_share: dividend.dividend_per_share || null,
              share_count: dividend.share_count || null,
              source: dividend.source || null,
              description: dividend.description || null,
            });
          } catch (err: any) {
            console.warn('歷史收益導入失敗:', dividend.stock_code, err.response?.data?.message || err.message);
          }
        }
      }

      // 注意：庫存管理（holdings）是計算結果，不需要導入

      e.target.value = ''; // 重置文件輸入
      setSelectedFileName('');
      setSuccess('完整備份檔案載入成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || '載入設定檔案失敗');
      setTimeout(() => setError(''), 3000);
      e.target.value = ''; // 重置文件輸入
      setSelectedFileName('');
    } finally {
      setLoading(false);
    }
  };

  // 導出庫存股票資料
  const handleExportHoldings = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 獲取庫存數據
      const response = await axios.get('/api/holdings');
      const holdings = response.data.data || [];

      // 準備Excel數據
      const excelData = holdings.map((holding: any) => ({
        '股票代碼': holding.stock_code,
        '股票名稱': holding.stock_name,
        '交易帳號': holding.account_name || '-',
        '券商': holding.broker_name || '-',
        '市場別': holding.market_type || '-',
        '種類': holding.transaction_type || '-',
        '行業': holding.industry || '-',
        '數量': holding.quantity,
        '成本均價': holding.cost_price?.toFixed(4) || '0',
        '損益平衡點': holding.break_even_price?.toFixed(2) || '0',
        '市價': holding.current_price?.toFixed(2) || '0',
        '股票市值': holding.market_value?.toFixed(2) || '0',
        '持有成本': holding.holding_cost?.toFixed(2) || '0',
        '盈虧': holding.profit_loss?.toFixed(2) || '0',
        '盈虧(%)': holding.profit_loss_percent?.toFixed(2) || '0',
        '幣別': holding.currency || 'TWD',
      }));

      // 創建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 設置列寬
      const colWidths = [
        { wch: 12 }, // 股票代碼
        { wch: 20 }, // 股票名稱
        { wch: 15 }, // 交易帳號
        { wch: 15 }, // 券商
        { wch: 10 }, // 市場別
        { wch: 10 }, // 種類
        { wch: 15 }, // 行業
        { wch: 10 }, // 數量
        { wch: 12 }, // 成本均價
        { wch: 12 }, // 損益平衡點
        { wch: 10 }, // 市價
        { wch: 15 }, // 股票市值
        { wch: 15 }, // 持有成本
        { wch: 15 }, // 盈虧
        { wch: 12 }, // 盈虧(%)
        { wch: 8 },  // 幣別
      ];
      ws['!cols'] = colWidths;

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '庫存股票資料');

      // 生成文件名
      const fileName = `庫存股票資料_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // 下載文件
      XLSX.writeFile(wb, fileName);
      
      setSuccess('庫存股票資料導出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '導出庫存股票資料失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 導出已實現損益資料
  const handleExportRealizedProfitLoss = async () => {
    try {
      setLoading(true);
      setError('');
      
      // 獲取所有交易記錄（包含已實現損益）
      const response = await axios.get('/api/transactions');
      const transactions = response.data.data || [];

      // 過濾出有損益記錄的賣出交易（已實現損益）
      const realizedTransactions = transactions.filter((t: any) => 
        t.transaction_type?.includes('賣') && t.profit_loss !== null && t.profit_loss !== undefined && t.profit_loss !== 0
      );

      // 準備Excel數據
      const excelData = realizedTransactions.map((transaction: any) => ({
        '成交日期': transaction.trade_date ? format(new Date(transaction.trade_date), 'yyyy/MM/dd') : '',
        '交割日期': transaction.settlement_date ? format(new Date(transaction.settlement_date), 'yyyy/MM/dd') : '',
        '交易類型': transaction.transaction_type || '-',
        '股票代碼': transaction.stock_code,
        '股票名稱': transaction.stock_name,
        '數量': transaction.quantity,
        '成交價': transaction.price?.toFixed(2) || '0',
        '成交價金': transaction.transaction_amount?.toFixed(2) || '0',
        '手續費': transaction.fee?.toFixed(2) || '0',
        '交易稅': ((transaction.tax || 0) + (transaction.securities_tax || 0))?.toFixed(2) || '0',
        '已實現損益': transaction.profit_loss?.toFixed(2) || '0',
        '報酬率(%)': transaction.return_rate?.toFixed(2) || '0',
        '淨收付': transaction.net_amount?.toFixed(2) || '0',
        '幣別': transaction.currency || 'TWD',
      }));

      // 創建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 設置列寬
      const colWidths = [
        { wch: 12 }, // 成交日期
        { wch: 12 }, // 交割日期
        { wch: 12 }, // 交易類型
        { wch: 12 }, // 股票代碼
        { wch: 20 }, // 股票名稱
        { wch: 10 }, // 數量
        { wch: 12 }, // 成交價
        { wch: 15 }, // 成交價金
        { wch: 12 }, // 手續費
        { wch: 12 }, // 交易稅
        { wch: 15 }, // 已實現損益
        { wch: 12 }, // 報酬率(%)
        { wch: 15 }, // 淨收付
        { wch: 8 },  // 幣別
      ];
      ws['!cols'] = colWidths;

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '已實現損益資料');

      // 生成文件名
      const fileName = `已實現損益資料_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // 下載文件
      XLSX.writeFile(wb, fileName);
      
      setSuccess('已實現損益資料導出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '導出已實現損益資料失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/settings/test-connection');
      setConnectionStatus(response.data.message);
    } catch (err: any) {
      setConnectionStatus('未連接資料庫，請檢查');
    } finally {
      setLoading(false);
    }
  };

  const updateStockData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await axios.post('/api/settings/update-stock-data');
      setSuccess(response.data.message || '股票資料更新請求已送出');
      
      // 更新後重新獲取統計資料
      await fetchStockStats();
    } catch (err: any) {
      setError(err.response?.data?.message || '更新股票資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (passwordSettings.newPassword !== passwordSettings.confirmPassword) {
      setError('新密碼與確認密碼不一致');
      return;
    }

    if (passwordSettings.newPassword.length < 8 || passwordSettings.newPassword.length > 12) {
      setError('密碼長度必須在 8-12 位之間');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await axios.put('/api/settings/password', {
        newPassword: passwordSettings.newPassword,
      });
      setSuccess('密碼更新成功');
      setPasswordSettings({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || '更新密碼失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      setLoading(true);
      setError('');
      await axios.put('/api/settings/email', {
        newEmail: emailSettings.newEmail,
      });
      setSuccess('郵箱更新成功');
    } catch (err: any) {
      setError(err.response?.data?.message || '更新郵箱失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCurrency = async () => {
    try {
      setLoading(true);
      setError('');
      await axios.post('/api/settings/currencies', newCurrency);
      setSuccess('幣別新增成功');
      setNewCurrency({
        currency_code: '',
        currency_name: '',
        exchange_rate: 1.0,
        is_default: false,
      });
      fetchCurrencies();
    } catch (err: any) {
      setError(err.response?.data?.message || '新增幣別失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCurrency = async (code: string) => {
    if (!confirm('確定要刪除此幣別設定嗎？')) return;

    try {
      await axios.delete(`/api/settings/currencies/${code}`);
      setSuccess('幣別刪除成功');
      fetchCurrencies();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除幣別失敗');
    }
  };

  // 手續費試算（買進）
  const calculateBuyFee = (amount: number) => {
    const baseFee = amount * (feeSettings.baseFeeRate / 100);
    const discountedFee = baseFee * feeSettings.buyFeeDiscount;
    const finalFee = Math.max(discountedFee, feeSettings.minFee);
    return {
      baseFee,
      discountedFee,
      finalFee,
    };
  };
  
  // 手續費試算（賣出）
  const calculateSellFee = (amount: number) => {
    const baseFee = amount * (feeSettings.baseFeeRate / 100);
    const discountedFee = baseFee * feeSettings.sellFeeDiscount;
    const finalFee = Math.max(discountedFee, feeSettings.minFee);
    return {
      baseFee,
      discountedFee,
      finalFee,
    };
  };

  const tabs = [
    { id: 'api', label: 'API設定' },
    { id: 'currency', label: '幣別設定' },
    { id: 'trading', label: '交易設定' },
    { id: 'ui', label: '介面設定' },
    { id: 'fee', label: '手續費設定' },
    { id: 'file', label: '檔案' },
    { id: 'password', label: '密碼設定' },
    { id: 'email', label: '郵箱設定' },
    { id: 'accounts', label: '帳戶相關' },
  ];

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">系統設定</h1>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* 標籤頁 */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* API設定 */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
              <input
                type="text"
                value={apiSettings.apiUrl}
                onChange={(e) => setApiSettings({ ...apiSettings, apiUrl: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="請輸入或選擇官方開放資料網址"
              />
              <div className="mt-2 text-xs text-gray-600 space-y-1">
                <div className="font-medium">官方來源快速選擇：</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
                      })
                    }
                    className="px-2 py-1 border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50"
                  >
                    TWSE 上市行情（JSON）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap03_L.csv',
                      })
                    }
                    className="px-2 py-1 border border-indigo-500 text-indigo-600 rounded-md hover:bg-indigo-50"
                  >
                    上市公司基本資料（CSV, MOPS）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv',
                      })
                    }
                    className="px-2 py-1 border border-green-500 text-green-600 rounded-md hover:bg-green-50"
                  >
                    上櫃公司基本資料（CSV, MOPS）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap03_R.csv',
                      })
                    }
                    className="px-2 py-1 border border-yellow-500 text-yellow-600 rounded-md hover:bg-yellow-50"
                  >
                    興櫃公司基本資料（CSV, MOPS）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://www.twse.com.tw/zh/ETFortune/ajaxProductsResult',
                      })
                    }
                    className="px-2 py-1 border border-purple-500 text-purple-600 rounded-md hover:bg-purple-50"
                  >
                    ETF 全部（JSON）
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setApiSettings({
                        ...apiSettings,
                        apiUrl: 'https://www.twse.com.tw/zh/ETFortune/ajaxProductsResult?type=active',
                      })
                    }
                    className="px-2 py-1 border border-pink-500 text-pink-600 rounded-md hover:bg-pink-50"
                  >
                    ETF 主動式（JSON，預留）
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">市價資料來源（庫存管理用）</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="priceSource"
                    value="auto"
                    checked={apiSettings.priceSource === 'auto'}
                    onChange={(e) => setApiSettings({ ...apiSettings, priceSource: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    自動模式（推薦）：ETF 使用 MI_INDEX 最後賣價，一般股票使用 TWSE/TPEx 收盤價
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="priceSource"
                    value="twse_stock_day_all"
                    checked={apiSettings.priceSource === 'twse_stock_day_all'}
                    onChange={(e) => setApiSettings({ ...apiSettings, priceSource: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    TWSE OpenAPI：上市收盤價優先（所有股票統一使用）
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="priceSource"
                    value="twse_mi_index"
                    checked={apiSettings.priceSource === 'twse_mi_index'}
                    onChange={(e) => setApiSettings({ ...apiSettings, priceSource: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    TWSE MI_INDEX：ETF 盤後最後賣價（僅限 ETF，其他股票需配合其他來源）
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="priceSource"
                    value="tpex"
                    checked={apiSettings.priceSource === 'tpex'}
                    onChange={(e) => setApiSettings({ ...apiSettings, priceSource: e.target.value })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    TPEx OpenAPI：上櫃/興櫃收盤價（僅適用上櫃/興櫃股票）
                  </span>
                </label>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                此設定影響「庫存管理」頁面的市價顯示與盈虧計算。建議使用「自動模式」。
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={apiSettings.autoUpdate}
                onChange={(e) => setApiSettings({ ...apiSettings, autoUpdate: e.target.checked })}
                className="mr-2"
              />
              <label className="text-sm text-gray-700">自動更新股票資料</label>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">股票資料統計</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">上市公司：</span>
                  <span className="font-medium">{stockStats.listed}</span>
                </div>
                <div>
                  <span className="text-gray-600">上櫃公司：</span>
                  <span className="font-medium">{stockStats.otc}</span>
                </div>
                <div>
                  <span className="text-gray-600">興櫃公司：</span>
                  <span className="font-medium">{stockStats.emerging}</span>
                </div>
                <div>
                  <span className="text-gray-600">ETF：</span>
                  <span className="font-medium">{stockStats.etf}</span>
                </div>
                <div>
                  <span className="text-gray-600">主動式ETF：</span>
                  <span className="font-medium">{stockStats.activeEtf}</span>
                </div>
                <div>
                  <span className="text-gray-600">被動式ETF：</span>
                  <span className="font-medium">{stockStats.passiveEtf}</span>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => saveSettings('apiSettings', apiSettings)}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                保存設定
              </button>
              <button
              onClick={updateStockData}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                更新股票資料
              </button>
            </div>
          </div>
        )}

        {/* 幣別設定 */}
        {activeTab === 'currency' && (
          <div className="space-y-4">
            {/* 即時匯率顯示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">即時匯率（對台幣）</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-md border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">台幣 (TWD)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {exchangeRates.TWD?.toFixed(4) || '1.0000'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">人民幣 (CNY)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {exchangeRates.CNY ? `1 CNY = ${exchangeRates.CNY.toFixed(4)} TWD` : '載入中...'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">美元 (USD)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {exchangeRates.USD ? `1 USD = ${exchangeRates.USD.toFixed(4)} TWD` : '載入中...'}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-md border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">日圓 (JPY)</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {exchangeRates.JPY ? `1 JPY = ${exchangeRates.JPY.toFixed(4)} TWD` : '載入中...'}
                  </div>
                </div>
              </div>
              {exchangeRates.lastUpdated && (
                <div className="mt-3 text-xs text-gray-500 text-right">
                  最後更新：{new Date(exchangeRates.lastUpdated).toLocaleString('zh-TW')}
                </div>
              )}
              <div className="mt-3">
                <button
                  onClick={fetchExchangeRates}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  重新載入匯率
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">幣別代碼</label>
                <input
                  type="text"
                  value={newCurrency.currency_code}
                  onChange={(e) => setNewCurrency({ ...newCurrency, currency_code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="TWD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">幣別名稱</label>
                <input
                  type="text"
                  value={newCurrency.currency_name}
                  onChange={(e) => setNewCurrency({ ...newCurrency, currency_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="台幣"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">匯率</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newCurrency.exchange_rate}
                  onChange={(e) => setNewCurrency({ ...newCurrency, exchange_rate: parseFloat(e.target.value) || 1.0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newCurrency.is_default}
                    onChange={(e) => setNewCurrency({ ...newCurrency, is_default: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">設為預設</span>
                </label>
              </div>
            </div>
            <button
              onClick={handleAddCurrency}
              disabled={loading || !newCurrency.currency_code || !newCurrency.currency_name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              新增幣別
            </button>

            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">已設定的幣別</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">幣別代碼</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">幣別名稱</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">匯率</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">預設</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currencies.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-500">
                          尚無幣別設定
                        </td>
                      </tr>
                    ) : (
                      currencies.map((currency) => (
                        <tr key={currency.id}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {currency.currency_code}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {currency.currency_name}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {currency.exchange_rate}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {currency.is_default ? '是' : '否'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleDeleteCurrency(currency.currency_code)}
                              className="text-red-600 hover:text-red-900"
                            >
                              刪除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 交易設定 */}
        {activeTab === 'trading' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                加倉點位（%）
              </label>
              <input
                type="number"
                step="0.1"
                value={tradingSettings.addPositionThreshold}
                onChange={(e) => setTradingSettings({ ...tradingSettings, addPositionThreshold: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="-5"
              />
              <p className="mt-1 text-sm text-gray-500">
                股價下跌超過此百分比時提醒加倉（負數標示跌幅）
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                賣出點位（%）
              </label>
              <input
                type="number"
                step="0.1"
                value={tradingSettings.sellPositionThreshold}
                onChange={(e) => setTradingSettings({ ...tradingSettings, sellPositionThreshold: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="10"
              />
              <p className="mt-1 text-sm text-gray-500">
                股價上漲超過此百分比時提醒賣出（正數標示漲幅）
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                加倉提醒聲音（URL或檔案路徑）
              </label>
              <input
                type="text"
                value={tradingSettings.addPositionSound || ''}
                onChange={(e) => setTradingSettings({ ...tradingSettings, addPositionSound: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md w-full"
                placeholder="https://example.com/sound.mp3 或 /sounds/add-position.mp3"
              />
              <p className="mt-1 text-sm text-gray-500">
                當達到加倉點位時播放的聲音（可選）
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                賣出提醒聲音（URL或檔案路徑）
              </label>
              <input
                type="text"
                value={tradingSettings.sellPositionSound || ''}
                onChange={(e) => setTradingSettings({ ...tradingSettings, sellPositionSound: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md w-full"
                placeholder="https://example.com/sound.mp3 或 /sounds/sell-position.mp3"
              />
              <p className="mt-1 text-sm text-gray-500">
                當達到賣出點位時播放的聲音（可選）
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">設定說明</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 加倉點位：當股價相對成本價下跌超過設定百分比時，系統會在庫存頁面提醒您考慮加倉。</li>
                <li>• 賣出點位：當股價相對成本價上漲超過設定百分比時，系統會在庫存頁面提醒您獲利了結。</li>
                <li>• 這些設定僅作為參考提醒，實際交易決策請根據市場情況和個人判斷。</li>
              </ul>
            </div>
            <button
              onClick={() => saveSettings('tradingSettings', tradingSettings)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              保存設定
            </button>
          </div>
        )}

        {/* 介面設定 */}
        {activeTab === 'ui' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">字體大小</label>
              <select
                value={uiSettings.fontSize}
                onChange={(e) => setUiSettings({ ...uiSettings, fontSize: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
              >
                <option value="14px">小（14px）</option>
                <option value="16px">中（16px）</option>
                <option value="18px">大（18px）</option>
                <option value="20px">特大（20px）</option>
              </select>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">預覽</h3>
              <p style={{ fontSize: uiSettings.fontSize }}>
                股票代碼：2330台積電，股價：$580.00（+2.5%），持股：1000股｜市值：$580000
              </p>
            </div>
            <button
              onClick={() => saveSettings('uiSettings', uiSettings)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              保存設定
            </button>
          </div>
        )}

        {/* 檔案管理 */}
        {activeTab === 'file' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">檔案管理說明</h3>
              <p className="text-sm text-blue-700">
                您可以在此導出完整系統備份（包含系統設定、證券帳戶、銀行帳戶、交易記錄、交割記錄、歷史收益、庫存管理等），或載入備份檔案以還原系統數據。
              </p>
            </div>

            {/* 導出存檔 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">1. 導出存檔</h3>
              <p className="text-sm text-gray-600 mb-4">
                導出完整系統備份（包含系統設定、幣別設定、交易記錄、證券帳戶、銀行帳戶、交割記錄、歷史收益、庫存管理等所有數據）
              </p>
              <button
                onClick={handleExportSettings}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                導出存檔
              </button>
            </div>

            {/* 載入存檔(覆蓋) */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">2. 載入存檔(覆蓋)</h3>
              <p className="text-sm text-gray-600 mb-4">
                從JSON檔案載入完整備份並還原所有數據（包含系統設定、幣別設定、交易記錄、證券帳戶、銀行帳戶、交割記錄、歷史收益等，此操作會添加數據到現有系統，請謹慎操作）
              </p>
              <div className="space-y-2">
                <label className="block">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportSettings}
                    className="hidden"
                    id="import-settings-file"
                  />
                  <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 cursor-pointer">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    選擇檔案
                  </span>
                </label>
                {selectedFileName ? (
                  <p className="text-sm text-gray-700">
                    已選擇檔案：<span className="font-medium">{selectedFileName}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500">未選擇檔案</p>
                )}
                <p className="text-xs text-gray-500">請選擇之前導出的JSON設定檔案</p>
              </div>
            </div>

            {/* 導出庫存股票資料 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">3. 導出庫存股票資料</h3>
              <p className="text-sm text-gray-600 mb-4">
                導出當前所有庫存股票資料（包含股票代碼、名稱、數量、成本、市值、盈虧等信息）
              </p>
              <button
                onClick={handleExportHoldings}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                導出庫存股票資料
              </button>
            </div>

            {/* 導出已實現損益資料 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">4. 導出已實現損益資料</h3>
              <p className="text-sm text-gray-600 mb-4">
                導出所有已實現損益的交易記錄（僅包含已賣出且有損益記錄的交易）
              </p>
              <button
                onClick={handleExportRealizedProfitLoss}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                導出已實現損益資料
              </button>
            </div>
          </div>
        )}

        {/* 手續費設定 */}
        {activeTab === 'fee' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">買進手續費折扣</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={feeSettings.buyFeeDiscount}
                    onChange={(e) => setFeeSettings({ ...feeSettings, buyFeeDiscount: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.6"
                  />
                  <p className="mt-1 text-sm text-gray-500">例如：6折請輸入0.6</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">賣出手續費折扣</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={feeSettings.sellFeeDiscount}
                    onChange={(e) => setFeeSettings({ ...feeSettings, sellFeeDiscount: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.6"
                  />
                  <p className="mt-1 text-sm text-gray-500">例如：6折請輸入0.6</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">一般股票交易稅率（%）</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeSettings.taxRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, taxRate: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.3"
                  />
                  <p className="mt-1 text-sm text-gray-500">一般股票交易稅率，預設為0.3%（僅賣出時收取）</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">股票型ETF交易稅率（%）</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feeSettings.etfTaxRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, etfTaxRate: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.1"
                  />
                  <p className="mt-1 text-sm text-gray-500">股票型ETF交易稅率，預設為0.1%（僅賣出時收取）</p>
                </div>
                {/* 手續費試算 */}
                <div className="bg-gray-50 pt-4 pr-4 pb-4 pl-0 rounded-lg -ml-8">
                  <h3 className="text-sm font-medium text-gray-700 mb-2 pl-8">手續費試算</h3>
                  <div className="mb-2">
                    <label className="block text-sm text-gray-700 mb-1 ml-8">交易金額</label>
                    <input
                      type="number"
                      id="feeCalcAmount"
                      defaultValue={10000}
                      className="px-3 py-2 border border-gray-300 rounded-md ml-8"
                      style={{ width: '10cm' }}
                    />
                  </div>
                  <div className="mb-2">
                    <button
                      onClick={() => {
                        const amount = parseFloat((document.getElementById('feeCalcAmount') as HTMLInputElement).value) || 0;
                        const calc = calculateBuyFee(amount);
                        alert(`【買進】\n交易金額：$${amount}\n基本手續費：$${calc.baseFee.toFixed(2)}\n折扣後手續費：$${calc.discountedFee.toFixed(2)}（${(feeSettings.buyFeeDiscount * 100).toFixed(0)}折）\n實際手續費：$${calc.finalFee.toFixed(2)}（最低$${feeSettings.minFee}）`);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 ml-8 mr-2"
                    >
                      計算買進手續費
                    </button>
                    <button
                      onClick={() => {
                        const amount = parseFloat((document.getElementById('feeCalcAmount') as HTMLInputElement).value) || 0;
                        const calc = calculateSellFee(amount);
                        alert(`【賣出】\n交易金額：$${amount}\n基本手續費：$${calc.baseFee.toFixed(2)}\n折扣後手續費：$${calc.discountedFee.toFixed(2)}（${(feeSettings.sellFeeDiscount * 100).toFixed(0)}折）\n實際手續費：$${calc.finalFee.toFixed(2)}（最低$${feeSettings.minFee}）`);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      計算賣出手續費
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">一般股票手續費率（%）</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={feeSettings.baseFeeRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, baseFeeRate: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.1425"
                  />
                  <p className="mt-1 text-sm text-gray-500">一般股票手續費率，預設為0.1425%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">股票型ETF手續費率（%）</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={feeSettings.etfFeeRate}
                    onChange={(e) => setFeeSettings({ ...feeSettings, etfFeeRate: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="0.1425"
                  />
                  <p className="mt-1 text-sm text-gray-500">股票型ETF手續費率，預設為0.1425%</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">最低手續費</label>
                  <input
                    type="number"
                    step="1"
                    value={feeSettings.minFee}
                    onChange={(e) => setFeeSettings({ ...feeSettings, minFee: parseFloat(e.target.value) || 0 })}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    style={{ width: '10cm' }}
                    placeholder="20"
                  />
                </div>
              </div>
            </div>

            {/* 手續費說明 */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">備註：手續費說明</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>手續費計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>買進/賣出手續費 = 交易金額 × 手續費率 × 折扣</li>
                  <li>實際手續費 = max(計算後手續費, 最低手續費)</li>
                  <li>一般股票與股票型ETF可使用不同的手續費率</li>
                </ul>
                <p className="mt-3"><strong>交易稅計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>交易稅僅在賣出時收取，買進時無需繳納</li>
                  <li>一般股票交易稅率：預設0.3%（千分之三）</li>
                  <li>股票型ETF交易稅率：預設0.1%（千分之一）</li>
                </ul>
                <p className="mt-3"><strong>持有成本計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>【現股】持有成本 = Σ(成交價 × 成交股數 + 買入手續費)，使用 FIFO（先進先出）方法計算</li>
                  <li>買入手續費 = 交易金額 × 手續費率 × 買進手續費折扣</li>
                  <li>【融資】持有成本 = 資自備款 + 資買手續費 = (成交價 × 成交股數 - 融資金額) + 資買手續費</li>
                  <li>【融券】持有成本 = 券保證金 = 成交價 × 成交股數 × 融券成數</li>
                  <li>持有成本採用四捨五入到整數</li>
                </ul>
                <p className="mt-3"><strong>成本均價計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>成本均價 = 持有成本 / 股數</li>
                  <li>成本均價顯示到小數點後第四位（四捨五入）</li>
                </ul>
                <p className="mt-3"><strong>損益平衡點計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>【現股】損益平衡點 = 成本均價 / (1 - 賣出手續費率 - 賣出交易稅率)</li>
                  <li>賣出手續費率使用原價費率（不打折）進行預估</li>
                  <li>損益平衡點顯示到小數點後第二位（四捨五入）</li>
                </ul>
                <p className="mt-3"><strong>盈虧計算方式：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>【現股】盈虧 = 股票市值 - (持有成本 + 預估賣出費用)</li>
                  <li>預估賣出費用 = 賣出手續費（原價，不打折）+ 賣出交易稅</li>
                  <li>賣出手續費（原價）= 股票市值 × 手續費率（一般股票/ETF：0.1425%）</li>
                  <li>賣出交易稅 = 股票市值 × 交易稅率（一般股票：0.3%，ETF：0.1%）</li>
                  <li>【融資】盈虧 = 股票市值 - (資買成交價金 + 資買手續費 + 資賣預估息 + 資賣手續費原價 + 資賣交易稅)</li>
                  <li>【融券】盈虧 = (券賣擔保品 + 券賣預估息) - (券買成交價金 + 券買手續費)</li>
                  <li>【國外】盈虧 = 股票市值 - (持有成本 + 賣出市場費用)</li>
                  <li>盈虧採用四捨五入到整數</li>
                </ul>
                <p className="mt-3"><strong>說明：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>系統會根據股票類型（一般股票/ETF）自動使用對應的手續費率和交易稅率</li>
                  <li>預估賣出費用使用原價手續費率計算，不扣除折扣</li>
                  <li>所有費率可根據您的券商實際費率進行調整</li>
                  <li>以上公式為系統基礎計算方式，適用於所有庫存相關計算</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => saveSettings('feeSettings', feeSettings)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              保存設定
            </button>
          </div>
        )}

        {/* 密碼設定 */}
        {activeTab === 'password' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
              <input
                type="password"
                value={passwordSettings.newPassword}
                onChange={(e) => setPasswordSettings({ ...passwordSettings, newPassword: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="8-12位數密碼"
                minLength={8}
                maxLength={12}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
              <input
                type="password"
                value={passwordSettings.confirmPassword}
                onChange={(e) => setPasswordSettings({ ...passwordSettings, confirmPassword: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="請再次輸入新密碼"
                minLength={8}
                maxLength={12}
              />
            </div>
            <button
              onClick={handleSavePassword}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              更新密碼
            </button>
          </div>
        )}

        {/* 郵箱設定 */}
        {activeTab === 'email' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新郵箱</label>
              <input
                type="email"
                value={emailSettings.newEmail}
                onChange={(e) => setEmailSettings({ ...emailSettings, newEmail: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-md"
                style={{ width: '10cm' }}
                placeholder="請輸入新郵箱"
              />
            </div>
            <button
              onClick={handleSaveEmail}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              更新郵箱
            </button>
          </div>
        )}

        {/* 帳戶相關設定（含導向證券帳戶管理） */}
        {activeTab === 'accounts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-800 mb-1">證券帳戶管理</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    新增、編輯或刪除您的證券帳戶，供交易記錄與交割、庫存等功能使用。
                  </p>
                </div>
                <div>
                  <Link
                    to="/securities-accounts"
                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                  >
                    前往證券帳戶管理
                  </Link>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200">
                <h3 className="text-sm font-medium text-gray-800 mb-1">其他帳戶設定（預留）</h3>
                <p className="text-sm text-gray-600">
                  未來可在此集中管理銀行帳戶預設、關聯證券帳戶等進階設定。
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">系統連接檢查</h3>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 mr-4">
                  {connectionStatus || '點擊按鈕測試資料庫連接狀態，確認帳戶相關功能可正常使用。'}
                </p>
                <button
                  onClick={testConnection}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                >
                  測試連接
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 測試連接（預設區塊保留給其他分頁共用） */}
        {activeTab !== 'accounts' && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-700">資料庫連接狀態</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {connectionStatus || '點擊按鈕測試連接'}
                </p>
              </div>
              <button
                onClick={testConnection}
                disabled={loading}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                測試連接
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;


