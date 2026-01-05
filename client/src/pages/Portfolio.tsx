import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Holding {
  id: number;
  stock_code: string;
  stock_name: string;
  quantity: number;
  cost_price: number;
  current_price?: number;
  market_value: number;
  profit_loss: number;
  profit_loss_percent: number;
  currency: string;
  account_name?: string;
  broker_name?: string;
  industry?: string | null;
}

interface SecuritiesAccount {
  id: number;
  account_name: string;
  broker_name: string;
}

const Portfolio = () => {
  const { t } = useLanguage();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<SecuritiesAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
    fetchHoldings();
  }, [selectedAccount, currentPage, pageSize]);

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
      if (selectedAccount !== 'all') {
        params.securitiesAccountId = selectedAccount;
      }

      const response = await axios.get('/api/holdings', { params });
      setHoldings(response.data.data);
    } catch (err: any) {
      console.error('獲取投資組合失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  // 計算總體統計
  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + (h.cost_price * h.quantity), 0);
  const totalProfitLoss = holdings.reduce((sum, h) => sum + (h.profit_loss || 0), 0);
  const totalReturnRate = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

  // 按帳戶分組統計
  const accountStats = accounts.map((account) => {
    const accountHoldings = holdings.filter(
      (h) => h.account_name === account.account_name && h.broker_name === account.broker_name
    );
    const marketValue = accountHoldings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    const cost = accountHoldings.reduce((sum, h) => sum + (h.cost_price * h.quantity), 0);
    const profitLoss = accountHoldings.reduce((sum, h) => sum + (h.profit_loss || 0), 0);
    const returnRate = cost > 0 ? (profitLoss / cost) * 100 : 0;

    return {
      account_name: account.account_name,
      broker_name: account.broker_name,
      marketValue,
      cost,
      profitLoss,
      returnRate,
    };
  });

  // 計算權重
  const holdingsWithWeight = holdings.map((holding) => ({
    ...holding,
    weight: totalMarketValue > 0 ? (holding.market_value / totalMarketValue) * 100 : 0,
  }));

  const totalPages = Math.ceil(holdingsWithWeight.length / pageSize);
  const paginatedHoldings = holdingsWithWeight.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 圖表數據準備
  // 資產分布圖（前10大持股，其他合併）
  const topHoldings = [...holdingsWithWeight]
    .sort((a, b) => b.market_value - a.market_value)
    .slice(0, 10);
  const otherValue = holdingsWithWeight
    .slice(10)
    .reduce((sum, h) => sum + h.market_value, 0);
  
  const pieChartData = [
    ...topHoldings.map((h) => ({
      name: h.stock_code,
      value: h.market_value,
      fullName: h.stock_name,
    })),
    ...(otherValue > 0 ? [{
      name: t('portfolio.other', '其他'),
      value: otherValue,
      fullName: t('portfolio.otherHoldings', '其他持股'),
    }] : []),
  ];

  // 顏色配置
  const COLORS = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
    '#84CC16', // lime
    '#6366F1', // indigo
    '#94A3B8', // slate (for "其他")
  ];

  // 帳戶市值柱狀圖數據
  const barChartData = accountStats
    .filter((stat) => stat.marketValue > 0)
    .map((stat) => ({
      name: `${stat.account_name}\n${stat.broker_name}`,
      marketValue: stat.marketValue,
      cost: stat.cost,
      profitLoss: stat.profitLoss,
    }));

  // 行業投資分佈數據（使用數據庫中的 industry 字段，如果沒有則使用「其他」）
  const industryDistribution = holdingsWithWeight.reduce((acc: any, holding: any) => {
    const industry = holding.industry || '其他';
    if (!acc[industry]) {
      acc[industry] = {
        name: industry,
        value: 0,
        count: 0,
      };
    }
    acc[industry].value += holding.market_value || 0;
    acc[industry].count += 1;
    return acc;
  }, {} as Record<string, { name: string; value: number; count: number }>);

  const industryChartData = Object.values(industryDistribution)
    .filter((item: any) => item.value > 0)
    .sort((a: any, b: any) => b.value - a.value)
    .map((item: any) => ({
      name: item.name,
      value: item.value,
      count: item.count,
    }));

  if (loading) {
    return <div className="text-center py-8">{t('common.loading', '載入中...')}</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('portfolio.title', '投資組合')}</h1>

        {/* 總體統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">{t('portfolio.totalMarketValue', '總市值')}</h3>
            <p className="text-2xl font-bold text-gray-900">${totalMarketValue.toFixed(2)}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">{t('portfolio.totalCost', '總成本')}</h3>
            <p className="text-2xl font-bold text-gray-900">${totalCost.toFixed(2)}</p>
          </div>
          <div className={`p-4 rounded-lg ${totalProfitLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <h3 className="text-sm font-medium text-gray-600">{t('portfolio.totalProfitLoss', '總損益')}</h3>
            <p className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              ${totalProfitLoss.toFixed(2)}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${totalReturnRate >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <h3 className="text-sm font-medium text-gray-600">{t('portfolio.totalReturnRate', '總報酬率')}</h3>
            <p className={`text-2xl font-bold ${totalReturnRate >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {totalReturnRate.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* 帳戶統計 */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">{t('portfolio.accountStats', '帳戶統計')}</h2>
            <select
              value={selectedAccount}
              onChange={(e) => {
                setSelectedAccount(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">{t('portfolio.allAccounts', '所有帳戶')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_name} - {account.broker_name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {accountStats.map((stat, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  {stat.account_name} - {stat.broker_name}
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">市值：</span>
                    <span className="font-medium">${stat.marketValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">成本：</span>
                    <span className="font-medium">${stat.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">損益：</span>
                    <span className={`font-medium ${stat.profitLoss >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${stat.profitLoss.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('portfolio.returnRate', '報酬率')}：</span>
                    <span className={`font-medium ${stat.returnRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {stat.returnRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 圖表區域 */}
        {holdings.length > 0 && (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 資產分布餅圖 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('portfolio.assetDistribution', '資產分布')}</h2>
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined, name?: string, props?: any) => [
                        `$${(value || 0).toFixed(2)}`,
                        props?.payload?.fullName || name || '',
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">{t('portfolio.noData', '尚無數據')}</div>
              )}
            </div>

            {/* 帳戶市值柱狀圖 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('portfolio.accountMarketValueComparison', '帳戶市值對比')}</h2>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${((value || 0) / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => `$${(value || 0).toFixed(2)}`}
                      labelStyle={{ color: '#333' }}
                    />
                    <Legend />
                    <Bar dataKey="marketValue" fill="#3B82F6" name="市值" />
                    <Bar dataKey="cost" fill="#8B5CF6" name="成本" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">{t('portfolio.noData', '尚無數據')}</div>
              )}
            </div>

            {/* 行業投資分佈圖 */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">行業投資分佈</h2>
              {industryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={industryChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {industryChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined, name?: string, props?: any) => [
                        `$${(value || 0).toFixed(2)} (${props?.payload?.count || 0}檔)`,
                        props?.payload?.name || name || '',
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-gray-500">{t('portfolio.noData', '尚無數據')}</div>
              )}
            </div>
          </div>
        )}

        {/* 持股明細 */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">持股明細</h2>
          {paginatedHoldings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">尚無持股記錄</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">股票代碼</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">持股</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">成本價</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">現價</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">市值</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">損益平衡點</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">報酬率</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">權重</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedHoldings.map((holding) => {
                    const rowKey = `${holding.stock_code}_${holding.account_name || ''}_${holding.broker_name || ''}`;
                    const isSelected = selectedHoldingKey === rowKey;
                    return (
                    <tr
                      key={rowKey}
                      onClick={() => setSelectedHoldingKey(rowKey)}
                      className={`cursor-pointer ${
                        isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.stock_code}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.quantity}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${holding.cost_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${(holding.current_price || holding.cost_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${holding.market_value.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${holding.cost_price.toFixed(2)}
                        </td>
                        <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${
                          holding.profit_loss_percent >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {holding.profit_loss_percent.toFixed(2)}%
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {holding.weight.toFixed(2)}%
                        </td>
                      </tr>
                  );
                  })}
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
                    共 {holdingsWithWeight.length} 筆，第 {currentPage} / {totalPages} 頁
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portfolio;


