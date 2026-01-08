import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';

interface SecuritiesAccount {
  id: number;
  account_name: string;
  broker_name: string;
}

interface Holding {
  id?: number;
  securities_account_id?: number;
  account_name?: string;
  broker_name?: string;
  stock_code: string;
  stock_name: string;
  market_type?: string;
  transaction_type?: string;
  quantity: number;
  cost_price: number;
  break_even_price?: number;
  current_price?: number;
  market_value: number;
  holding_cost?: number;
  profit_loss: number;
  profit_loss_percent: number;
  currency: string;
  // 價格來源資訊
  price_source?: string | null; // 'realtime' 或 'close'
  price_updated_at?: number | null; // 時間戳
  // 以下欄位可能需要在後端計算或前端顯示為空
  desired_price?: number; // 欲委託價
  desired_quantity?: number; // 欲委託量
  available_quantity?: number; // 可下單數量
  cash_quantity?: number; // 現股數量
  estimated_dividend?: number; // 預估息
  buy_pending?: number; // 買未入
  sell_pending?: number; // 賣未入
  collateral?: number; // 借貸擔保品
}

interface HoldingDetail {
  id: number;
  account_name: string;
  transaction_type: string;
  stock_code: string;
  stock_name: string;
  trade_date: string;
  quantity: number;
  price: number;
  holding_cost: number;
  estimated_interest: number;
  financing_amount_or_collateral: number | null;
  currency: string;
  buy_reason: string;
}

const Holdings = () => {
  const { t } = useLanguage();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [holdingDetails, setHoldingDetails] = useState<HoldingDetail[]>([]);
  const [accounts, setAccounts] = useState<SecuritiesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalHoldings: 0,
    totalMarketValue: 0,
    totalCost: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
  });
  const [filters, setFilters] = useState({
    accountId: '',
    stockCode: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedHoldingRowKey, setSelectedHoldingRowKey] = useState<string | null>(null);
  const [detailSortField, setDetailSortField] = useState<string>('trade_date');
  const [detailSortDirection, setDetailSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedHoldingDetailId, setSelectedHoldingDetailId] = useState<number | null>(null);
  const [currentDetailPage, setCurrentDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(10);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [tradingSettings, setTradingSettings] = useState({
    addPositionThreshold: -5,
    sellPositionThreshold: 10,
    addPositionSound: '',
    sellPositionSound: '',
  });
  const [playedSounds, setPlayedSounds] = useState<Set<string>>(new Set());
  const [editingHolding, setEditingHolding] = useState<string | null>(null);
  const [editedProfitLoss, setEditedProfitLoss] = useState<{ [key: string]: { profit_loss: number; profit_loss_percent: number } }>({});

  // 獲取庫存的唯一標識
  const getHoldingKey = (holding: Holding) => {
    return `${holding.securities_account_id || ''}_${holding.stock_code}_${holding.transaction_type || ''}`;
  };

  // 獲取顯示的盈虧值（優先使用手動輸入的值）
  const getDisplayProfitLoss = (holding: Holding) => {
    const key = getHoldingKey(holding);
    return editedProfitLoss[key]?.profit_loss ?? holding.profit_loss;
  };

  // 獲取顯示的盈虧百分比（優先使用手動輸入的值）
  const getDisplayProfitLossPercent = (holding: Holding) => {
    const key = getHoldingKey(holding);
    return editedProfitLoss[key]?.profit_loss_percent ?? holding.profit_loss_percent;
  };

  // 保存手動輸入的盈虧
  const saveEditedProfitLoss = (holding: Holding) => {
    const key = getHoldingKey(holding);
    const current = editedProfitLoss[key];
    if (current) {
      setHoldings(prevHoldings => 
        prevHoldings.map(h => {
          const hKey = getHoldingKey(h);
          if (hKey === key) {
            return { ...h, profit_loss: current.profit_loss, profit_loss_percent: current.profit_loss_percent };
          }
          return h;
        })
      );
    }
    setEditingHolding(null);
  };

  // 開始編輯盈虧
  const startEditProfitLoss = (holding: Holding) => {
    const key = getHoldingKey(holding);
    setEditingHolding(key);
    if (!editedProfitLoss[key]) {
      setEditedProfitLoss(prev => ({
        ...prev,
        [key]: {
          profit_loss: holding.profit_loss,
          profit_loss_percent: holding.profit_loss_percent
        }
      }));
    }
  };

  // 取消編輯
  const cancelEditProfitLoss = (holding: Holding) => {
    const key = getHoldingKey(holding);
    setEditingHolding(null);
    // 恢復原始值
    setEditedProfitLoss(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  // 更新編輯中的盈虧值
  const updateEditedProfitLoss = (holding: Holding, field: 'profit_loss' | 'profit_loss_percent', value: number) => {
    const key = getHoldingKey(holding);
    setEditedProfitLoss(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { profit_loss: holding.profit_loss, profit_loss_percent: holding.profit_loss_percent }),
        [field]: value
      }
    }));
  };

  const handleExportHoldingsExcel = () => {
    // TODO: 實作匯出庫存列表到 Excel 的功能
    console.log('export holdings to excel (TODO)');
  };

  const handleExportHoldingDetailsExcel = () => {
    // TODO: 實作匯出庫存明細到 Excel 的功能
    console.log('export holding details to excel (TODO)');
  };

  useEffect(() => {
    fetchAccounts();
    fetchHoldings();
    fetchTradingSettings();
  }, [filters, currentPage, pageSize]);

  // 獲取交易設定
  const fetchTradingSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      if (response.data.data?.tradingSettings) {
        setTradingSettings(response.data.data.tradingSettings);
      }
    } catch (err: any) {
      console.error('獲取交易設定失敗:', err);
    }
  };

  // 檢查並觸發提醒（僅在數據更新時觸發）
  useEffect(() => {
    if (!holdings.length) return;
    
    holdings.forEach((holding) => {
      const stockKey = `${holding.stock_code}_${holding.securities_account_id || 0}`;
      const profitLossPercent = holding.profit_loss_percent || 0;
      
      // 檢查加倉提醒
      if (profitLossPercent <= tradingSettings.addPositionThreshold && tradingSettings.addPositionSound) {
        const soundKey = `${stockKey}_add`;
        if (!playedSounds.has(soundKey)) {
          try {
            const audio = new Audio(tradingSettings.addPositionSound);
            audio.volume = 0.5; // 設置音量為50%
            audio.play().catch((err) => {
              console.error('播放加倉提醒聲音失敗:', err);
            });
            setPlayedSounds(prev => new Set(prev).add(soundKey));
            
            // 5秒後允許再次播放（避免重複播放）
            setTimeout(() => {
              setPlayedSounds(prev => {
                const newSet = new Set(prev);
                newSet.delete(soundKey);
                return newSet;
              });
            }, 5000);
          } catch (err) {
            console.error('創建音頻對象失敗:', err);
          }
        }
      }
      
      // 檢查賣出提醒
      if (profitLossPercent >= tradingSettings.sellPositionThreshold && tradingSettings.sellPositionSound) {
        const soundKey = `${stockKey}_sell`;
        if (!playedSounds.has(soundKey)) {
          try {
            const audio = new Audio(tradingSettings.sellPositionSound);
            audio.volume = 0.5; // 設置音量為50%
            audio.play().catch((err) => {
              console.error('播放賣出提醒聲音失敗:', err);
            });
            setPlayedSounds(prev => new Set(prev).add(soundKey));
            
            // 5秒後允許再次播放（避免重複播放）
            setTimeout(() => {
              setPlayedSounds(prev => {
                const newSet = new Set(prev);
                newSet.delete(soundKey);
                return newSet;
              });
            }, 5000);
          } catch (err) {
            console.error('創建音頻對象失敗:', err);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings, tradingSettings.addPositionThreshold, tradingSettings.sellPositionThreshold, tradingSettings.addPositionSound, tradingSettings.sellPositionSound]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/securities-accounts');
      setAccounts(response.data.data);
    } catch (err: any) {
      console.error('獲取證券帳戶失敗:', err);
    }
  };

  const fetchHoldings = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.accountId) params.securitiesAccountId = filters.accountId;
      if (filters.stockCode) params.stockCode = filters.stockCode;

      const response = await axios.get('/api/holdings', { params });
      setHoldings(response.data.data);
      if (response.data.stats) {
        setStats(response.data.stats);
      }

      // 獲取庫存明細
      const detailsResponse = await axios.get('/api/holdings/details', { params });
      setHoldingDetails(detailsResponse.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取庫存失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrices = async () => {
    try {
      setRefreshingPrices(true);
      setPlayedSounds(new Set()); // 重置已播放聲音列表，允許重新播放
      await fetchHoldings();
    } finally {
      setRefreshingPrices(false);
    }
  };


  const totalPages = Math.ceil(holdings.length / pageSize);
  const paginatedHoldings = holdings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading && holdings.length === 0) {
    return <div className="text-center py-8">{t('common.loading', '載入中...')}</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('holdings.title', '庫存管理')}</h1>
          <p className="text-sm text-gray-500">庫存由交易記錄自動計算</p>
        </div>

        {/* 統計資訊 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">持股檔數</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalHoldings}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">總市值</h3>
            <p className="text-2xl font-bold text-gray-900">${stats.totalMarketValue.toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">總成本</h3>
            <p className="text-2xl font-bold text-gray-900">${stats.totalCost.toFixed(2)}</p>
          </div>
          <div className={`p-4 rounded-lg ${stats.totalProfitLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <h3 className="text-sm font-medium text-gray-600">總損益</h3>
            <p className={`text-2xl font-bold ${stats.totalProfitLoss >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              ${stats.totalProfitLoss.toFixed(2)} ({stats.totalProfitLossPercent.toFixed(2)}%)
            </p>
          </div>
        </div>

        {/* 篩選條件 */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">交易帳號</label>
            <select
              value={filters.accountId}
              onChange={(e) => setFilters({ ...filters, accountId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">全部</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} - {account.broker_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">股票代號</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportHoldingsExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1"
                  title="匯出庫存 Excel"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleRefreshPrices}
                  disabled={refreshingPrices || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                >
                  {refreshingPrices ? '更新中...' : '更新市價'}
                </button>
              </div>
            </div>
            <input
              type="text"
              value={filters.stockCode}
              onChange={(e) => setFilters({ ...filters, stockCode: e.target.value })}
              placeholder="輸入股票代號"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 庫存列表 */}
        {paginatedHoldings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無庫存記錄</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">交易帳號</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">市場別</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">種類</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">代號</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">商品名稱</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">欲委託價</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">欲委託量</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">可下單數量</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">現股數量</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">成本均價</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">損益平衡點</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">市價</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">股票市值</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">持有成本</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">盈虧</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">盈虧(％)</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">買賣點</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">預估息</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">買未入</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">賣未入</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">交易幣別</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">借貸擔保品</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedHoldings.map((holding, index) => {
                    const formatValue = (value: number | null | undefined): string => {
                      if (value === null || value === undefined || value === 0) return '';
                      return value.toFixed(2);
                    };
                    const formatCostPrice = (value: number | null | undefined): string => {
                      if (value === null || value === undefined || value === 0) return '';
                      return value.toFixed(4);
                    };
                    const formatQty = (value: number | null | undefined): string => {
                      if (value === null || value === undefined || value === 0) return '';
                      return value.toString();
                    };
                    const formatPercentage = (value: number | null | undefined): string => {
                      if (value === null || value === undefined || value === 0) return '';
                      return value.toFixed(2);
                    };
                    const rowKey = `${holding.stock_code}_${holding.securities_account_id}_${index}`;
                    const isSelected = selectedHoldingRowKey === rowKey;
                    
                    return (
                      <tr
                        key={rowKey}
                        onClick={() => setSelectedHoldingRowKey(rowKey)}
                        className={`cursor-pointer ${
                          isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* 交易帳號 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {holding.account_name ? `${holding.account_name} - ${holding.broker_name}` : '-'}
                      </td>
                        {/* 市場別 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.market_type || '-'}
                        </td>
                        {/* 種類 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.transaction_type || '-'}
                      </td>
                        {/* 代號 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-600">
                          {holding.stock_code}
                        </td>
                        {/* 商品名稱 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                        {holding.stock_name}
                      </td>
                        {/* 欲委託價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.desired_price)}
                        </td>
                        {/* 欲委託量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQty(holding.desired_quantity)}
                        </td>
                        {/* 可下單數量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQty(holding.available_quantity)}
                        </td>
                        {/* 現股數量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQty(holding.cash_quantity || holding.quantity)}
                        </td>
                        {/* 成本均價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCostPrice(holding.cost_price)}
                        </td>
                        {/* 損益平衡點 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.break_even_price || holding.cost_price)}
                        </td>
                        {/* 市價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div className="flex flex-col items-end">
                            <span>{formatValue(holding.current_price || holding.cost_price)}</span>
                            {holding.price_source && (
                              <span className={`text-xs mt-0.5 ${
                                holding.price_source === 'realtime' 
                                  ? 'text-green-600' 
                                  : 'text-gray-500'
                              }`} title={
                                holding.price_source === 'realtime' 
                                  ? '即時價格' 
                                  : '收盤價'
                              }>
                                {holding.price_source === 'realtime' ? '⚡即時' : '📊收盤'}
                                {holding.price_updated_at && (
                                  <span className="text-gray-400 ml-1">
                                    {new Date(holding.price_updated_at).toLocaleTimeString('zh-TW', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* 股票市值 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.market_value)}
                        </td>
                        {/* 持有成本 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.holding_cost || (holding.cost_price * holding.quantity))}
                        </td>
                        {/* 盈虧 */}
                        <td 
                          className={`px-3 py-4 whitespace-nowrap text-sm text-right ${
                            getDisplayProfitLoss(holding) >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                          onDoubleClick={() => startEditProfitLoss(holding)}
                          title="雙擊可手動編輯盈虧"
                        >
                          {editingHolding === getHoldingKey(holding) ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.01"
                                value={editedProfitLoss[getHoldingKey(holding)]?.profit_loss ?? holding.profit_loss}
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value) || 0;
                                  updateEditedProfitLoss(holding, 'profit_loss', newValue);
                                  // 自動計算百分比
                                  const cost = holding.holding_cost || (holding.cost_price * holding.quantity);
                                  if (cost > 0) {
                                    updateEditedProfitLoss(holding, 'profit_loss_percent', (newValue / cost) * 100);
                                  }
                                }}
                                onBlur={() => saveEditedProfitLoss(holding)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEditedProfitLoss(holding);
                                  } else if (e.key === 'Escape') {
                                    cancelEditProfitLoss(holding);
                                  }
                                }}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-right"
                                autoFocus
                              />
                              <button
                                onClick={() => saveEditedProfitLoss(holding)}
                                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                title="保存"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => cancelEditProfitLoss(holding)}
                                className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                title="取消"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <span className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                              {formatValue(getDisplayProfitLoss(holding))}
                            </span>
                          )}
                        </td>
                        {/* 盈虧(％) */}
                        <td 
                          className={`px-3 py-4 whitespace-nowrap text-sm text-right ${
                            getDisplayProfitLossPercent(holding) >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                          onDoubleClick={() => startEditProfitLoss(holding)}
                          title="雙擊可手動編輯盈虧百分比"
                        >
                          {editingHolding === getHoldingKey(holding) ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editedProfitLoss[getHoldingKey(holding)]?.profit_loss_percent ?? holding.profit_loss_percent}
                              onChange={(e) => {
                                const newPercent = parseFloat(e.target.value) || 0;
                                updateEditedProfitLoss(holding, 'profit_loss_percent', newPercent);
                                // 自動計算盈虧
                                const cost = holding.holding_cost || (holding.cost_price * holding.quantity);
                                updateEditedProfitLoss(holding, 'profit_loss', (newPercent / 100) * cost);
                              }}
                              onBlur={() => saveEditedProfitLoss(holding)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveEditedProfitLoss(holding);
                                } else if (e.key === 'Escape') {
                                  cancelEditProfitLoss(holding);
                                }
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-right"
                            />
                          ) : (
                            <span className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                              {formatPercentage(getDisplayProfitLossPercent(holding))}
                            </span>
                          )}
                        </td>
                        {/* 買賣點 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                          {(() => {
                            const profitLossPercent = holding.profit_loss_percent || 0;
                            if (profitLossPercent <= tradingSettings.addPositionThreshold) {
                              return (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title={`已達到加倉點位（${tradingSettings.addPositionThreshold}%）`}>
                                  ⬇️ 加倉
                                </span>
                              );
                            } else if (profitLossPercent >= tradingSettings.sellPositionThreshold) {
                              return (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800" title={`已達到賣出點位（${tradingSettings.sellPositionThreshold}%）`}>
                                  ⬆️ 賣出
                                </span>
                              );
                            }
                            return <span className="text-gray-400">-</span>;
                          })()}
                        </td>
                        {/* 預估息 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.estimated_dividend)}
                        </td>
                        {/* 買未入 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQty(holding.buy_pending)}
                        </td>
                        {/* 賣未入 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatQty(holding.sell_pending)}
                        </td>
                        {/* 交易幣別 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.currency || 'TWD'}
                        </td>
                        {/* 借貸擔保品 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatValue(holding.collateral)}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* 小計行 */}
                  {paginatedHoldings.length > 0 && (() => {
                    const totals = paginatedHoldings.reduce((acc, h) => ({
                      desired_quantity: acc.desired_quantity + (h.desired_quantity || 0),
                      available_quantity: acc.available_quantity + (h.available_quantity || 0),
                      cash_quantity: acc.cash_quantity + ((h.cash_quantity || h.quantity) || 0),
                      quantity: acc.quantity + (h.quantity || 0),
                      market_value: acc.market_value + (h.market_value || 0),
                      holding_cost: acc.holding_cost + Math.round((h.holding_cost || (h.cost_price * h.quantity)) || 0), // 每個值都四捨五入為整數再累加
                      profit_loss: acc.profit_loss + (h.profit_loss || 0),
                      estimated_dividend: acc.estimated_dividend + (h.estimated_dividend || 0),
                      buy_pending: acc.buy_pending + (h.buy_pending || 0),
                      sell_pending: acc.sell_pending + (h.sell_pending || 0),
                      collateral: acc.collateral + (h.collateral || 0),
                    }), {
                      desired_quantity: 0,
                      available_quantity: 0,
                      cash_quantity: 0,
                      quantity: 0,
                      market_value: 0,
                      holding_cost: 0,
                      profit_loss: 0,
                      estimated_dividend: 0,
                      buy_pending: 0,
                      sell_pending: 0,
                      collateral: 0,
                    });
                    
                    // 確保總計持有成本為整數
                    totals.holding_cost = Math.round(totals.holding_cost);
                    
                    // 計算總盈虧百分比
                    const totalProfitLossPercent = totals.holding_cost > 0 
                      ? (totals.profit_loss / totals.holding_cost) * 100 
                      : 0;
                    
                    const formatTotalValue = (value: number): string => {
                      if (value === 0) return '';
                      return value.toFixed(2);
                    };
                    
                    const formatTotalQty = (value: number): string => {
                      if (value === 0) return '';
                      return value.toString();
                    };
                    
                    const formatTotalPercentage = (value: number): string => {
                      if (value === 0) return '';
                      return value.toFixed(2);
                    };
                    
                    const formatTotalHoldingCost = (value: number): string => {
                      if (value === 0) return '';
                      return Math.round(value).toString();
                    };
                    
                    return (
                      <tr className="bg-gray-100 font-semibold">
                        {/* 交易帳號 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-bold" colSpan={1}>小計</td>
                        {/* 市場別 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        {/* 種類 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        {/* 代號 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        {/* 商品名稱 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        {/* 欲委託價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                        {/* 欲委託量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalQty(totals.desired_quantity)}
                        </td>
                        {/* 可下單數量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalQty(totals.available_quantity)}
                      </td>
                        {/* 現股數量 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalQty(totals.cash_quantity)}
                      </td>
                        {/* 成本均價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                        {/* 損益平衡點 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                        {/* 市價 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                        {/* 股票市值 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalValue(totals.market_value)}
                      </td>
                        {/* 持有成本 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalHoldingCost(totals.holding_cost)}
                      </td>
                        {/* 盈虧 */}
                        <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          totals.profit_loss >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatTotalValue(totals.profit_loss)}
                      </td>
                        {/* 盈虧(％) */}
                        <td className={`px-3 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          totalProfitLossPercent >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatTotalPercentage(totalProfitLossPercent)}
                        </td>
                        {/* 買賣點 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-center">-</td>
                        {/* 預估息 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalValue(totals.estimated_dividend)}
                        </td>
                        {/* 買未入 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalQty(totals.buy_pending)}
                        </td>
                        {/* 賣未入 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalQty(totals.sell_pending)}
                      </td>
                        {/* 交易幣別 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        {/* 借貸擔保品 */}
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                          {formatTotalValue(totals.collateral)}
                      </td>
                    </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* 分頁 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">每頁顯示：</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">
                  共 {holdings.length} 筆，第 {currentPage} / {totalPages} 頁
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  上一頁
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  下一頁
                </button>
              </div>
            </div>

            {/* 國內股票庫存明細 */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">國內股票庫存明細</h2>
                <button
                  type="button"
                  onClick={handleExportHoldingDetailsExcel}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1"
                  title="匯出庫存明細 Excel"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Excel
                </button>
              </div>
              <div className="overflow-x-auto -mx-6 px-6">
                <div style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {(() => {
                        const handleSort = (field: string) => {
                          if (detailSortField === field) {
                            setDetailSortDirection(detailSortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setDetailSortField(field);
                            setDetailSortDirection('asc');
                          }
                        };

                        const SortableHeader = ({ field, label, align = 'left' }: { field: string; label: string; align?: 'left' | 'right' }) => {
                          const isActive = detailSortField === field;
                          return (
                            <th
                              className={`px-3 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none`}
                              onClick={() => handleSort(field)}
                            >
                              <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} space-x-1`}>
                                <span>{label}</span>
                                {isActive && (
                                  <span className="text-gray-700">
                                    {detailSortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                                {!isActive && (
                                  <span className="text-gray-300">⇅</span>
                                )}
                              </div>
                            </th>
                          );
                        };

                        return (
                          <>
                            <SortableHeader field="account_name" label="交易帳號" />
                            <SortableHeader field="transaction_type" label="種類" />
                            <SortableHeader field="stock_code" label="代號" />
                            <SortableHeader field="stock_name" label="商品名稱" />
                            <SortableHeader field="trade_date" label="成交日期" />
                            <SortableHeader field="quantity" label="成交數量" align="right" />
                            <SortableHeader field="price" label="成交價" align="right" />
                            <SortableHeader field="holding_cost" label="持有成本" align="right" />
                            <SortableHeader field="estimated_interest" label="預估息" align="right" />
                            <SortableHeader field="financing_amount_or_collateral" label="融資金額/券擔保品" align="right" />
                            <SortableHeader field="currency" label="幣別" />
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">備註</th>
                          </>
                        );
                      })()}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(() => {
                      // 如果沒有數據，返回空
                      if (holdingDetails.length === 0) {
                        return (
                          <tr>
                            <td colSpan={12} className="px-3 py-4 text-center text-sm text-gray-500">
                              尚無庫存明細資料
                            </td>
                          </tr>
                        );
                      }

                      // 排序邏輯（支持多欄位排序：主排序 + 日期作為次要排序）
                      const sortedDetails = [...holdingDetails].sort((a, b) => {
                        if (!detailSortField) return 0;

                        let aValue: any = a[detailSortField as keyof HoldingDetail];
                        let bValue: any = b[detailSortField as keyof HoldingDetail];

                        if (aValue === null || aValue === undefined) aValue = '';
                        if (bValue === null || bValue === undefined) bValue = '';

                        let primarySortResult = 0;

                        // 處理日期字符串排序（YYYY-MM-DD格式）
                        if (detailSortField === 'trade_date') {
                          if (detailSortDirection === 'asc') {
                            // 升序：較早的日期排在前面
                            primarySortResult = String(aValue).localeCompare(String(bValue));
                          } else {
                            // 降序：較晚的日期排在前面
                            primarySortResult = String(bValue).localeCompare(String(aValue));
                          }
                        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                          // 數字類型排序
                          primarySortResult = detailSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                        } else {
                          // 字符串類型排序
                          const aStr = String(aValue).toLowerCase();
                          const bStr = String(bValue).toLowerCase();
                          if (detailSortDirection === 'asc') {
                            primarySortResult = aStr.localeCompare(bStr, 'zh-TW');
                          } else {
                            primarySortResult = bStr.localeCompare(aStr, 'zh-TW');
                          }
                        }

                        // 如果主排序結果相同，使用成交日期作為次要排序（降序，較晚日期在前）
                        if (primarySortResult === 0 && detailSortField !== 'trade_date') {
                          const aDate = a.trade_date || '';
                          const bDate = b.trade_date || '';
                          return String(bDate).localeCompare(String(aDate)); // 降序
                        }

                        return primarySortResult;
                      });

                      const formatValue = (value: number | null | undefined): string => {
                        if (value === null || value === undefined || value === 0) return '';
                        return value.toFixed(2);
                      };
                      const formatQty = (value: number | null | undefined): string => {
                        if (value === null || value === undefined || value === 0) return '';
                        return value.toString();
                      };
                      const formatHoldingCost = (value: number | string | null | undefined): string => {
                        if (value === null || value === undefined || value === 0 || value === '0') return '';
                        // 強制轉換為數字，處理字符串輸入（如 "123370.00"）
                        const numValue = typeof value === 'string' ? parseFloat(value) : value;
                        if (isNaN(numValue)) return '';
                        // 四捨五入為整數，確保沒有小數點
                        const roundedValue = Math.round(numValue);
                        return roundedValue.toString();
                      };

                      // 分頁處理
                      const paginatedDetails = sortedDetails.slice(
                        (currentDetailPage - 1) * detailPageSize,
                        currentDetailPage * detailPageSize
                      );
                      // const totalDetailPages = Math.ceil(sortedDetails.length / detailPageSize); // 保留備用

                      return (
                        <>
                          {paginatedDetails.map((detail) => {
                            const isSelected = selectedHoldingDetailId === detail.id;
                            return (
                              <tr
                                key={detail.id}
                                onClick={() => setSelectedHoldingDetailId(detail.id)}
                                className={`cursor-pointer ${
                                  isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                                }`}
                              >
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{detail.account_name}</td>
                                <td className={`px-3 py-4 whitespace-nowrap text-sm ${
                                  detail.transaction_type === '融資' || detail.transaction_type === '融券' 
                                    ? 'text-red-600' 
                                    : 'text-gray-900'
                                }`}>
                                  {detail.transaction_type}
                                </td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-blue-600">{detail.stock_code}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{detail.stock_name}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{detail.trade_date}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatQty(detail.quantity)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatValue(detail.price)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatHoldingCost(detail.holding_cost)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatValue(detail.estimated_interest)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatValue(detail.financing_amount_or_collateral)}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{detail.currency}</td>
                                <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate">{detail.buy_reason}</td>
                              </tr>
                            );
                          })}
                        </>
                      );
                    })()}
                    
                    {/* 小計行 */}
                    {(() => {
                      // 重新計算排序後的數據用於小計
                      const sortedForTotal = [...holdingDetails].sort((a, b) => {
                        if (!detailSortField) return 0;

                        let aValue: any = a[detailSortField as keyof HoldingDetail];
                        let bValue: any = b[detailSortField as keyof HoldingDetail];

                        if (aValue === null || aValue === undefined) aValue = '';
                        if (bValue === null || bValue === undefined) bValue = '';

                        let primarySortResult = 0;

                        if (detailSortField === 'trade_date') {
                          if (detailSortDirection === 'asc') {
                            primarySortResult = String(aValue).localeCompare(String(bValue));
                          } else {
                            primarySortResult = String(bValue).localeCompare(String(aValue));
                          }
                        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                          primarySortResult = detailSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                        } else {
                          const aStr = String(aValue).toLowerCase();
                          const bStr = String(bValue).toLowerCase();
                          if (detailSortDirection === 'asc') {
                            primarySortResult = aStr.localeCompare(bStr, 'zh-TW');
                          } else {
                            primarySortResult = bStr.localeCompare(aStr, 'zh-TW');
                          }
                        }

                        if (primarySortResult === 0 && detailSortField !== 'trade_date') {
                          const aDate = a.trade_date || '';
                          const bDate = b.trade_date || '';
                          return String(bDate).localeCompare(String(aDate));
                        }

                        return primarySortResult;
                      });
                      
                      if (sortedForTotal.length === 0) return null;
                      
                      // 計算所有數據的小計（持有成本確保為整數）
                      // 先將所有持有成本轉換為整數，然後再累加，避免浮點數精度問題
                      let totalHoldingCost = 0; // 使用單獨變數累加，確保每一步都是整數
                      sortedForTotal.forEach((d) => {
                        const cost = d.holding_cost || 0;
                        const roundedCost = Math.round(cost); // 確保每個值都是整數
                        totalHoldingCost += roundedCost; // 累加整數
                      });
                      // 最終總計再次確保為整數（防止累加過程中的任何精度問題）
                      totalHoldingCost = Math.round(totalHoldingCost);
                      
                      const totals = sortedForTotal.reduce((acc, d) => ({
                        quantity: acc.quantity + (d.quantity || 0),
                        holding_cost: 0, // 暫時設為0，下面會設置正確值
                        estimated_interest: acc.estimated_interest + (d.estimated_interest || 0),
                        financing_amount_or_collateral: acc.financing_amount_or_collateral + (d.financing_amount_or_collateral || 0),
                      }), {
                        quantity: 0,
                        holding_cost: 0,
                        estimated_interest: 0,
                        financing_amount_or_collateral: 0,
                      });
                      // 設置正確的持有成本（整數）
                      totals.holding_cost = totalHoldingCost;
                      
                      const formatTotalValue = (value: number): string => {
                        if (value === 0) return '';
                        return value.toFixed(2);
                      };
                      
                      const formatTotalQty = (value: number): string => {
                        if (value === 0) return '';
                        return value.toString();
                      };
                      
                      const formatTotalHoldingCost = (value: number | string): string => {
                        if (!value || value === 0) return '';
                        // 強制轉換為數字然後四捨五入為整數，確保沒有小數點
                        const numValue = typeof value === 'string' ? parseFloat(value) : value;
                        if (isNaN(numValue)) return '';
                        const roundedValue = Math.round(numValue);
                        return roundedValue.toString();
                      };
                      
                      return (
                        <tr className="bg-gray-100 font-semibold">
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 font-bold" colSpan={5}>小計</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalQty(totals.quantity)}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalHoldingCost(totals.holding_cost)}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.estimated_interest)}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.financing_amount_or_collateral)}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900" colSpan={2}>-</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
                  </div>

                {/* 庫存明細分頁 */}
                {(() => {
                  const sortedDetailsForPagination = [...holdingDetails].sort((a, b) => {
                    if (!detailSortField) return 0;

                    let aValue: any = a[detailSortField as keyof HoldingDetail];
                    let bValue: any = b[detailSortField as keyof HoldingDetail];

                    if (aValue === null || aValue === undefined) aValue = '';
                    if (bValue === null || bValue === undefined) bValue = '';

                    let primarySortResult = 0;

                    if (detailSortField === 'trade_date') {
                      if (detailSortDirection === 'asc') {
                        primarySortResult = String(aValue).localeCompare(String(bValue));
                      } else {
                        primarySortResult = String(bValue).localeCompare(String(aValue));
                      }
                    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                      primarySortResult = detailSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
                    } else {
                      const aStr = String(aValue).toLowerCase();
                      const bStr = String(bValue).toLowerCase();
                      if (detailSortDirection === 'asc') {
                        primarySortResult = aStr.localeCompare(bStr, 'zh-TW');
                      } else {
                        primarySortResult = bStr.localeCompare(aStr, 'zh-TW');
                      }
                    }

                    if (primarySortResult === 0 && detailSortField !== 'trade_date') {
                      const aDate = a.trade_date || '';
                      const bDate = b.trade_date || '';
                      return String(bDate).localeCompare(String(aDate));
                    }

                    return primarySortResult;
                  });

                  const totalDetailPages = Math.ceil(sortedDetailsForPagination.length / detailPageSize);

                  return (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">每頁顯示：</span>
                        <select
                          value={detailPageSize}
                          onChange={(e) => {
                            setDetailPageSize(Number(e.target.value));
                            setCurrentDetailPage(1);
                          }}
                          className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-gray-700">
                          共 {sortedDetailsForPagination.length} 筆，第 {currentDetailPage} / {totalDetailPages || 1} 頁
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setCurrentDetailPage(Math.max(1, currentDetailPage - 1))}
                          disabled={currentDetailPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                        >
                          上一頁
                        </button>
                        {Array.from({ length: totalDetailPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentDetailPage(page)}
                            className={`px-3 py-1 border rounded-md text-sm ${
                              currentDetailPage === page
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-300'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentDetailPage(Math.min(totalDetailPages, currentDetailPage + 1))}
                          disabled={currentDetailPage === totalDetailPages || totalDetailPages === 0}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                        >
                          下一頁
                        </button>
                      </div>
                    </div>
                  );
                })()}
                </div>

                </div>
          </>
        )}

        {/* 備註說明 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">📋 備註：基礎計算公式（對齊點精靈）</h3>
          <div className="text-sm text-gray-600 space-y-2">
            
            <p className="mt-3"><strong>🏷️ ETF 自動辨識規則：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>0050~0057（元大系列老牌 ETF）</li>
              <li>006XXX（6位數字開頭 ETF）</li>
              <li>00XXXL（槓桿型 ETF）、00XXXR（反向型 ETF）、00XXXU（期貨型 ETF）</li>
              <li>00XXXB（債券型 ETF）、00XXXA（主動式 ETF）</li>
              <li>00XXX（5位數字，一般 ETF）</li>
              <li>其他代碼（如 2330、2317）= 普通股</li>
            </ul>

            <p className="mt-3"><strong>💰 費率設定：</strong></p>
            <table className="ml-2 mt-1 text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1">類型</th>
                  <th className="border border-gray-300 px-2 py-1">賣出手續費率</th>
                  <th className="border border-gray-300 px-2 py-1">賣出交易稅率</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 px-2 py-1">ETF</td>
                  <td className="border border-gray-300 px-2 py-1">0.1425%（原價）</td>
                  <td className="border border-gray-300 px-2 py-1 text-green-600 font-medium">0.1%</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 px-2 py-1">普通股</td>
                  <td className="border border-gray-300 px-2 py-1">0.1425%（原價）</td>
                  <td className="border border-gray-300 px-2 py-1 text-red-600 font-medium">0.3%</td>
                </tr>
              </tbody>
            </table>

            <p className="mt-3"><strong>📊 股票市值：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>股票市值 = 市價 × 股數</li>
              <li>精度處理：先無條件捨去到小數2位，再四捨五入成整數</li>
            </ul>

            <p className="mt-3"><strong>💵 持有成本計算方式：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>【現股】持有成本 = Σ(成交價 × 成交股數 + 買入手續費)，使用 FIFO（先進先出）</li>
              <li>買入手續費 = 交易金額 × 手續費率 × 買進手續費折扣</li>
              <li>【融資】持有成本 = 資自備款 + 資買手續費</li>
              <li>【融券】持有成本 = 券保證金</li>
              <li>精度處理：四捨五入到整數</li>
            </ul>

            <p className="mt-3"><strong>📈 成本均價計算方式：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>成本均價 = 持有成本 ÷ 股數</li>
              <li>精度處理：四捨五入到小數點後第4位</li>
            </ul>

            <p className="mt-3"><strong>⚖️ 損益平衡點計算方式：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>【現股】損益平衡點 = 成本均價 ÷ (1 - 賣出手續費率 - 賣出交易稅率)</li>
              <li>精度處理：四捨五入到小數點後第2位</li>
            </ul>

            <p className="mt-3"><strong>📉 盈虧計算方式（對齊點精靈）：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>【現股】盈虧 = 市值(整數) - 持有成本(整數) - 賣出費用(整數)</strong></li>
              <li>賣出手續費 = floor(市值 × 手續費率) ← <span className="text-orange-600">無條件捨去成整數</span></li>
              <li>賣出交易稅 = floor(市值 × 交易稅率) ← <span className="text-orange-600">無條件捨去成整數</span></li>
              <li>賣出費用 = 賣出手續費 + 賣出交易稅</li>
              <li>【融資】盈虧 = 市值 - (資買成交價金 + 資買手續費 + 資賣預估息 + 資賣手續費 + 資賣交易稅)</li>
              <li>【融券】盈虧 = (券賣擔保品 + 券賣預估息) - (券買成交價金 + 券買手續費)</li>
              <li>【國外】盈虧 = 市值 - (持有成本 + 賣出市場費用)</li>
            </ul>

            <p className="mt-3"><strong>📝 計算範例：</strong></p>
            <div className="ml-2 mt-1 p-2 bg-white rounded border border-gray-200 text-xs font-mono">
              <p className="font-bold text-blue-600">0050（ETF）：</p>
              <p>市值 = 69.85 × 14,000 = 977,900</p>
              <p>持有成本 = 59.8446 × 14,000 ≈ 837,825</p>
              <p>手續費 = floor(977,900 × 0.1425%) = 1,393</p>
              <p>交易稅 = floor(977,900 × <span className="text-green-600">0.1%</span>) = 977</p>
              <p>盈虧 = 977,900 - 837,825 - 2,370 = <span className="text-green-600 font-bold">137,705</span></p>
            </div>
            <div className="ml-2 mt-2 p-2 bg-white rounded border border-gray-200 text-xs font-mono">
              <p className="font-bold text-purple-600">2330 台積電（普通股）：</p>
              <p>市值 = 1,000 × 1,000 = 1,000,000</p>
              <p>持有成本 = 900 × 1,000 = 900,000</p>
              <p>手續費 = floor(1,000,000 × 0.1425%) = 1,425</p>
              <p>交易稅 = floor(1,000,000 × <span className="text-red-600">0.3%</span>) = 3,000</p>
              <p>盈虧 = 1,000,000 - 900,000 - 4,425 = <span className="text-green-600 font-bold">95,575</span></p>
            </div>

            <p className="mt-3"><strong>⚙️ 說明：</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>系統根據股票代碼自動判定 ETF 或普通股，無需手動設定</li>
              <li>預估賣出費用使用原價手續費率（不打折）</li>
              <li>費率設定請至「系統設定 → 手續費設定」進行調整</li>
              <li>盈虧、盈虧(%)欄位支援手動輸入覆蓋</li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Holdings;


