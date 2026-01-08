import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface Transaction {
  id: number;
  trade_date: string;
  stock_code: string;
  stock_name: string;
  transaction_type: string;
  quantity: number;
  price: number;
}

const Dashboard = () => {
  const [holdingsStats, setHoldingsStats] = useState({
    totalMarketValue: 0,
    totalCost: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
  });
  const [dividendStats, setDividendStats] = useState({
    totalAfterTax: 0,
    totalDividend: 0,
  });
  const [bankStats, setBankStats] = useState({
    totalBalance: 0,
    availableBalance: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecentTransactionId, setSelectedRecentTransactionId] = useState<number | null>(null);
  const [quickShortcutFilter, setQuickShortcutFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    
    // 檢查是否顯示初始使用提示
    const hasSeenGuide = localStorage.getItem('hasSeenWelcomeGuide');
    if (!hasSeenGuide) {
      // 初次使用時自動跳轉到使用指南頁面
      navigate('/welcome-guide');
    }
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 獲取庫存統計
      const holdingsResponse = await axios.get('/api/holdings');
      if (holdingsResponse.data.stats) {
        setHoldingsStats(holdingsResponse.data.stats);
      }

      // 獲取歷史收益統計（本年度）
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-01-01`;
      const dividendsResponse = await axios.get('/api/dividends', {
        params: {
          startDate: startDate,
        },
      });
      if (dividendsResponse.data.stats) {
        setDividendStats({
          totalAfterTax: dividendsResponse.data.stats.totalAfterTax || 0,
          totalDividend: dividendsResponse.data.stats.totalDividend || 0,
        });
      }

      // 獲取銀行帳戶統計
      const bankResponse = await axios.get('/api/bank-accounts');
      const totalBalance = bankResponse.data.data.reduce(
        (sum: number, account: any) => sum + (account.balance || 0),
        0
      );
      setBankStats({
        totalBalance,
        availableBalance: totalBalance,
      });

      // 獲取最近交易記錄
      const transactionsResponse = await axios.get('/api/transactions', {
        params: { limit: 5 },
      });
      setRecentTransactions(transactionsResponse.data.data.slice(0, 5));
    } catch (err: any) {
      console.error('獲取儀表版數據失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">載入中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      
      <div className="space-y-6">
        {/* 投資組合儀表版 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">投資組合儀表版</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">投資組合價值</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${holdingsStats.totalMarketValue.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">總成本</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${holdingsStats.totalCost.toFixed(2)}
              </p>
            </div>
            <div className={`p-4 rounded-lg ${
              holdingsStats.totalProfitLoss >= 0 ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <h3 className="text-sm font-medium text-gray-600">損益</h3>
              <p className={`text-2xl font-bold ${
                holdingsStats.totalProfitLoss >= 0 ? 'text-green-900' : 'text-red-900'
              }`}>
                ${holdingsStats.totalProfitLoss.toFixed(2)} ({holdingsStats.totalProfitLossPercent.toFixed(2)}%)
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">股息收入（本年度累計）</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${dividendStats.totalDividend.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">銀行總額</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${bankStats.totalBalance.toFixed(2)}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-600">可用餘額</h3>
              <p className="text-2xl font-bold text-gray-900">
                ${bankStats.availableBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* 快捷功能 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">快捷功能</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">顯示：</span>
              <select
                value={quickShortcutFilter}
                onChange={(e) => setQuickShortcutFilter(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="all">全部</option>
                <option value="trade">交易相關</option>
                <option value="holdings">庫存 / 投資組合</option>
                <option value="income">收益 / 交割</option>
                <option value="bank">銀行帳戶</option>
                <option value="search">查詢 / 指南</option>
                <option value="settings">系統設定</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'trade') && (
              <Link
                to="/transactions"
                className="bg-blue-50 hover:bg-blue-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📝</div>
                <div className="text-sm font-medium text-gray-700">新增交易</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'holdings') && (
              <Link
                to="/holdings"
                className="bg-green-50 hover:bg-green-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📊</div>
                <div className="text-sm font-medium text-gray-700">庫存管理</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'holdings') && (
              <Link
                to="/portfolio"
                className="bg-purple-50 hover:bg-purple-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">💼</div>
                <div className="text-sm font-medium text-gray-700">投資組合</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'income') && (
              <Link
                to="/dividends"
                className="bg-yellow-50 hover:bg-yellow-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">💰</div>
                <div className="text-sm font-medium text-gray-700">歷史收益</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'income') && (
              <Link
                to="/settlements"
                className="bg-orange-50 hover:bg-orange-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📄</div>
                <div className="text-sm font-medium text-gray-700">交割管理</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'bank') && (
              <Link
                to="/bank-accounts"
                className="bg-teal-50 hover:bg-teal-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">🏦</div>
                <div className="text-sm font-medium text-gray-700">銀行帳戶管理</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'search') && (
              <Link
                to="/stock-announcements"
                className="bg-indigo-50 hover:bg-indigo-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm font-medium text-gray-700">個股查詢</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'search') && (
              <Link
                to="/welcome-guide"
                className="bg-pink-50 hover:bg-pink-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📖</div>
                <div className="text-sm font-medium text-gray-700">使用指南</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'trade') && (
              <Link
                to="/securities-accounts"
                className="bg-cyan-50 hover:bg-cyan-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">📋</div>
                <div className="text-sm font-medium text-gray-700">證券帳戶</div>
              </Link>
            )}
            {(quickShortcutFilter === 'all' || quickShortcutFilter === 'settings') && (
              <Link
                to="/settings"
                className="bg-gray-50 hover:bg-gray-100 p-4 rounded-lg text-center transition-colors"
              >
                <div className="text-2xl mb-2">⚙️</div>
                <div className="text-sm font-medium text-gray-700">系統設定</div>
              </Link>
            )}
          </div>
        </div>

        {/* 最近交易紀錄 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">最近交易紀錄</h2>
            <Link
              to="/transactions"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              查看全部 →
            </Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">尚無交易記錄</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成交日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種類</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">代號</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">商品名稱</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">數量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成交價</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      onClick={() => setSelectedRecentTransactionId(transaction.id)}
                      className={`cursor-pointer ${
                        selectedRecentTransactionId === transaction.id ? 'bg-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(transaction.trade_date), 'yyyy/MM/dd')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.transaction_type}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.stock_code}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.stock_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.quantity}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${transaction.price.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

