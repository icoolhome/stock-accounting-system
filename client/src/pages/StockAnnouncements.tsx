import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface StockInfo {
  stock_code: string;
  stock_name: string;
  market_type?: string;
  etf_type?: string | null;
  industry?: string;
}

interface PriceInfo {
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  change?: number | string;
  volume?: number | string;
  yesterdayClose?: number | string;
}

interface DividendRecord {
  record_date: string;
  income_type: string;
  pre_tax_amount: number;
  tax_amount: number;
  after_tax_amount: number;
  dividend_per_share?: number;
  share_count?: number;
}

const StockAnnouncements = () => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  
  // 進階篩選條件
  const [filters, setFilters] = useState({
    marketType: '', // 市場別：listed, otc, emerging
    etfType: '', // ETF類型
    industry: '', // 行業
  });
  
  // const [allStocks, setAllStocks] = useState<StockInfo[]>([]); // 保留備用
  const [, setAllStocks] = useState<StockInfo[]>([]);
  const [uniqueIndustries, setUniqueIndustries] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // 股票詳細資訊
  const [stockDetail, setStockDetail] = useState<{
    stockInfo: StockInfo;
    priceInfo: PriceInfo | null;
    dividends: DividendRecord[];
    dividendStats: {
      thisYear: number;
      lastYear: number;
      avgFiveYears: number;
      thisYearCount: number;
      lastYearCount: number;
    };
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const navigate = useNavigate();

  // 載入所有股票資料（用於進階篩選）
  useEffect(() => {
    fetchAllStocks();
    
    // 檢查是否顯示初始使用提示
    const hasSeenGuide = localStorage.getItem('hasSeenWelcomeGuide');
    if (!hasSeenGuide) {
      setShowWelcomeGuide(true);
    }
  }, []);

  const handleCloseWelcomeGuide = () => {
    setShowWelcomeGuide(false);
    localStorage.setItem('hasSeenWelcomeGuide', 'true');
  };

  const handleGoToWelcomeGuide = () => {
    navigate('/welcome-guide');
    handleCloseWelcomeGuide();
  };

  const fetchAllStocks = async () => {
    try {
      const response = await axios.get('/api/stocks');
      const stocks = response.data.data || [];
      setAllStocks(stocks);
      
      // 提取所有不重複的行業
      const industries = Array.from(
        new Set(stocks.map((s: StockInfo) => s.industry).filter((i: string | null | undefined): i is string => !!i))
      ).sort() as string[];
      setUniqueIndustries(industries);
    } catch (err) {
      console.error('獲取股票資料失敗:', err);
    }
  };

  // 搜尋股票（支援關鍵字搜尋和進階篩選）
  const handleSearch = async () => {
    try {
      setLoading(true);
      setError('');
      setSearchPerformed(true);
      
      const keyword = searchKeyword.trim();
      
      if (!keyword) {
        setError('請輸入股票代號或名稱');
        setLoading(false);
        return;
      }
      
      let results: StockInfo[] = [];
      
      // 如果有關鍵字，使用搜尋API
      const response = await axios.get('/api/stocks/search', {
        params: { keyword },
      });
      results = response.data.data || [];
      
      // 套用進階篩選
      let filteredResults = results;
      
      if (filters.marketType) {
        filteredResults = filteredResults.filter(
          stock => stock.market_type === filters.marketType
        );
      }
      
      if (filters.etfType) {
        if (filters.etfType === '非ETF') {
          filteredResults = filteredResults.filter(
            stock => !stock.etf_type || stock.etf_type === ''
          );
        } else {
          filteredResults = filteredResults.filter(
            stock => stock.etf_type === filters.etfType
          );
        }
      }
      
      if (filters.industry) {
        filteredResults = filteredResults.filter(
          stock => stock.industry === filters.industry
        );
      }
      
      // 如果只有一筆結果，直接在新視窗打開 Win 投資網站
      if (filteredResults.length === 1) {
        const stockCode = filteredResults[0].stock_code;
        const url = `https://winvest.tw/Stock/Symbol/EtfInformation/${stockCode}`;
        window.open(url, '_blank');
        setLoading(false);
        return;
      }
      
      // 如果輸入的是精確的股票代號，直接在新視窗打開 Win 投資網站
      if (keyword && /^[0-9]{4,6}$/.test(keyword)) {
        const exactMatch = filteredResults.find(
          stock => stock.stock_code === keyword || 
                   stock.stock_code === keyword.padStart(6, '0') ||
                   stock.stock_code === keyword.padStart(4, '0')
        );
        if (exactMatch) {
          const url = `https://winvest.tw/Stock/Symbol/EtfInformation/${exactMatch.stock_code}`;
          window.open(url, '_blank');
          setLoading(false);
          return;
        } else {
          // 即使沒找到，也嘗試打開（可能是新股票）
          const url = `https://winvest.tw/Stock/Symbol/EtfInformation/${keyword.padStart(4, '0')}`;
          window.open(url, '_blank');
          setLoading(false);
          return;
        }
      }
      
      // 如果有多筆結果，顯示列表
      setSearchResults(filteredResults);
      
      if (filteredResults.length === 0) {
        setError('找不到符合條件的股票');
      } else {
        setError('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '搜尋失敗');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // 清除所有篩選條件
  const handleClearFilters = () => {
    setFilters({
      marketType: '',
      etfType: '',
      industry: '',
    });
  };

  // 處理鍵盤事件（Enter鍵搜尋）
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 清除搜尋
  const handleClear = () => {
    setSearchKeyword('');
    setSearchResults([]);
    setSelectedStock(null);
    setError('');
    setSearchPerformed(false);
    handleClearFilters();
  };

  // 選擇股票並載入詳細資訊（未使用，保留備用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-ignore - 備用函數，暫時未使用
  const _handleSelectStock = async (_stock: StockInfo) => {
    setSelectedStock(_stock);
    setSearchKeyword(`${_stock.stock_code} ${_stock.stock_name}`);
    setSearchResults([]);
    setSearchPerformed(false); // 隱藏搜尋結果列表
    
    // 載入股票詳細資訊
    try {
      setLoadingDetail(true);
      const response = await axios.get(`/api/stocks/${_stock.stock_code}/detail`);
      if (response.data.success) {
        setStockDetail(response.data.data);
      }
    } catch (err: any) {
      console.error('載入股票詳細資訊失敗:', err);
      // 即使失敗也顯示基本信息
      setStockDetail({
        stockInfo: _stock,
        priceInfo: null,
        dividends: [],
        dividendStats: {
          thisYear: 0,
          lastYear: 0,
          avgFiveYears: 0,
          thisYearCount: 0,
          lastYearCount: 0,
        },
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">個股查詢</h1>
        <p className="text-sm text-gray-500">資料來源：<span className="font-medium text-blue-600">Win 投資</span></p>
      </div>

      {/* 初始使用提示（簡化版，導向新頁面） */}
      {showWelcomeGuide && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-lg mb-6 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-2">歡迎使用股票記帳系統</h2>
              <p className="text-gray-700">
                為了讓您快速開始使用系統，我們為您準備了詳細的使用指南。
              </p>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <button
                onClick={handleGoToWelcomeGuide}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
              >
                查看使用指南 →
              </button>
              <button
                onClick={handleCloseWelcomeGuide}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 搜尋區域 */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            股票代號或名稱
          </label>
          <div className="relative" style={{ width: '50%' }}>
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="請輸入股票代號（如：2330）或股票名稱（如：台積電）"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                title="清除關鍵字"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="#676a6d"
                  className="w-5 h-5"
                >
                  <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 進階篩選 */}
        <div className="mb-4">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            <span>進階篩選</span>
            <svg
              className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4" style={{ width: '50%' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">市場別</label>
                <select
                  value={filters.marketType}
                  onChange={(e) => setFilters({ ...filters, marketType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  <option value="上市">上市</option>
                  <option value="上櫃">上櫃</option>
                  <option value="興櫃">興櫃</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ETF類型</label>
                <select
                  value={filters.etfType}
                  onChange={(e) => setFilters({ ...filters, etfType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部</option>
                  <option value="非ETF">非ETF</option>
                  <option value="股票型">股票型ETF</option>
                  <option value="債券型">債券型ETF</option>
                  <option value="商品型">商品型ETF</option>
                  <option value="貨幣型">貨幣型ETF</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">行業</label>
                <select
                  value={filters.industry}
                  onChange={(e) => setFilters({ ...filters, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">全部行業</option>
                  {uniqueIndustries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {Object.values(filters).some(v => v) && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  清除篩選條件
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
          >
            清除全部
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '搜尋中...' : '搜尋'}
          </button>
        </div>
      </div>


      {/* 搜尋結果（只有在有多筆結果且未選擇股票時才顯示列表） */}
      {searchPerformed && (searchResults as StockInfo[]).length > 1 && !selectedStock && !loadingDetail && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">
              搜尋結果（共 ${searchResults.length} 筆）
            </h2>
            <button
              onClick={handleClear}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              清除結果
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">載入中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      股票代號
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      股票名稱
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      市場別
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      類型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      行業
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchResults.map((stock, index) => {
                    const stockCode = stock.stock_code;
                    // @ts-expect-error - TypeScript inference issue with conditional rendering
                    const selectedStockCode = selectedStock?.stock_code;
                    const isSelected = selectedStockCode === stockCode;
                    return (
                    <tr
                      key={`${stock.stock_code}_${index}`}
                      className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {stock.stock_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {stock.stock_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stock.market_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stock.etf_type || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stock.industry || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            const url = `https://winvest.tw/Stock/Symbol/EtfInformation/${stock.stock_code}`;
                            window.open(url, '_blank');
                          }}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          查看詳情
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 沒有結果時的提示 */}
      {searchPerformed && searchResults.length === 0 && !selectedStock && !loading && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center py-8 text-gray-500">找不到符合條件的股票</div>
        </div>
      )}

      {/* 已選擇的股票詳情（保留此功能以備用） */}
      {selectedStock && stockDetail && (
        <div className="bg-white shadow rounded-lg p-6 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                {stockDetail.stockInfo.stock_name} ({stockDetail.stockInfo.stock_code})
              </h2>
              {stockDetail.priceInfo && (
                <p className="text-sm text-gray-500 mt-1">
                  最後更新時間：{format(new Date(), 'yyyy/MM/dd HH:mm:ss')}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setSelectedStock(null);
                setStockDetail(null);
                handleClear();
              }}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="#676a6d"
                className="w-4 h-4"
              >
                <path d="M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z" />
              </svg>
              關閉
            </button>
          </div>

          {loadingDetail ? (
            <div className="text-center py-8 text-gray-500">載入詳細資訊中...</div>
          ) : stockDetail ? (
            <>
              {/* 價格資訊 */}
              {stockDetail.priceInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">價格資訊</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">開盤</label>
                      <p className="text-xl font-bold text-gray-900">
                        {typeof stockDetail.priceInfo.open === 'number' 
                          ? stockDetail.priceInfo.open.toFixed(2) 
                          : stockDetail.priceInfo.open || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">最高</label>
                      <p className="text-xl font-bold text-green-600">
                        {typeof stockDetail.priceInfo.high === 'number' 
                          ? stockDetail.priceInfo.high.toFixed(2) 
                          : stockDetail.priceInfo.high || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">最低</label>
                      <p className="text-xl font-bold text-red-600">
                        {typeof stockDetail.priceInfo.low === 'number' 
                          ? stockDetail.priceInfo.low.toFixed(2) 
                          : stockDetail.priceInfo.low || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">收盤</label>
                      <p className="text-xl font-bold text-gray-900">
                        {typeof stockDetail.priceInfo.close === 'number' 
                          ? stockDetail.priceInfo.close.toFixed(2) 
                          : stockDetail.priceInfo.close || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">漲跌</label>
                      <p className={`text-xl font-bold ${
                        (typeof stockDetail.priceInfo.change === 'number' && stockDetail.priceInfo.change >= 0) ||
                        (typeof stockDetail.priceInfo.change === 'string' && !stockDetail.priceInfo.change.startsWith('-'))
                          ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {typeof stockDetail.priceInfo.change === 'number' 
                          ? (stockDetail.priceInfo.change >= 0 ? '+' : '') + stockDetail.priceInfo.change.toFixed(2)
                          : stockDetail.priceInfo.change || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">成交量</label>
                      <p className="text-xl font-bold text-gray-900">
                        {typeof stockDetail.priceInfo.volume === 'number' 
                          ? stockDetail.priceInfo.volume.toLocaleString()
                          : stockDetail.priceInfo.volume || '-'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">昨收</label>
                      <p className="text-xl font-bold text-gray-900">
                        {typeof stockDetail.priceInfo.yesterdayClose === 'number' 
                          ? stockDetail.priceInfo.yesterdayClose.toFixed(2) 
                          : stockDetail.priceInfo.yesterdayClose || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 配息記錄 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">配息記錄</h3>
                {stockDetail.dividends.length > 0 ? (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <label className="block text-gray-600 mb-1">{new Date().getFullYear()} 年現金股利</label>
                          <p className="text-lg font-bold text-gray-900">
                            ${stockDetail.dividendStats.thisYear.toFixed(2)}
                            {stockDetail.dividendStats.thisYearCount > 0 && ` (${stockDetail.dividendStats.thisYearCount} 次)`}
                          </p>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1">{new Date().getFullYear() - 1} 年現金股利</label>
                          <p className="text-lg font-bold text-gray-900">
                            ${stockDetail.dividendStats.lastYear.toFixed(2)}
                            {stockDetail.dividendStats.lastYearCount > 0 && ` (${stockDetail.dividendStats.lastYearCount} 次)`}
                          </p>
                        </div>
                        <div>
                          <label className="block text-gray-600 mb-1">近五年平均</label>
                          <p className="text-lg font-bold text-gray-900">
                            ${stockDetail.dividendStats.avgFiveYears.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">發放年度</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">除權息日</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">現金股利</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">稅額</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">稅後金額</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">每股股息</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stockDetail.dividends.map((dividend, index) => (
                            <tr key={index}>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {new Date(dividend.record_date).getFullYear()}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {format(new Date(dividend.record_date), 'yyyy/MM/dd')}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                ${dividend.pre_tax_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                ${dividend.tax_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                                ${dividend.after_tax_amount.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                {dividend.dividend_per_share ? `$${dividend.dividend_per_share.toFixed(2)}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                    尚無配息記錄
                  </div>
                )}
              </div>

              {/* 基本資料 */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">基本資料</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">股票代號</label>
                    <p className="text-lg font-semibold text-blue-600">{stockDetail.stockInfo.stock_code}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">股票名稱</label>
                    <p className="text-lg font-semibold text-gray-900">{stockDetail.stockInfo.stock_name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">市場別</label>
                    <p className="text-lg text-gray-900">{stockDetail.stockInfo.market_type || '-'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">類型</label>
                    <p className="text-lg text-gray-900">{stockDetail.stockInfo.etf_type || '一般股票'}</p>
                  </div>
                  {stockDetail.stockInfo.industry && (
                    <div className="col-span-2 md:col-span-4">
                      <label className="block text-sm font-medium text-gray-500 mb-1">行業</label>
                      <p className="text-lg text-gray-900">{stockDetail.stockInfo.industry}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default StockAnnouncements;

