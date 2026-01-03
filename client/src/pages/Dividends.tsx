import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

interface Dividend {
  id: number;
  record_date: string;
  income_type: string;
  stock_code: string;
  stock_name: string;
  pre_tax_amount: number;
  tax_amount: number;
  after_tax_amount: number;
  dividend_per_share?: number;
  share_count?: number;
  source?: string;
  description?: string;
}

const Dividends = () => {
  const [activeTab, setActiveTab] = useState<'history' | 'twse'>('history');
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDividend, setEditingDividend] = useState<Dividend | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState('');
  // 收益類型選項列表（可自由添加，使用 localStorage 存儲）
  const [incomeTypes, setIncomeTypes] = useState<string[]>(() => {
    const saved = localStorage.getItem('dividend_income_types');
    return saved ? JSON.parse(saved) : ['股息', 'ETF股息', '資本利得', '除權', '除息', '除權除息', '其他收益'];
  });

  const [newIncomeTypeInput, setNewIncomeTypeInput] = useState('');
  const [showIncomeTypeDropdown, setShowIncomeTypeDropdown] = useState(false);

  // 保存選項列表到 localStorage
  const saveIncomeTypes = (types: string[]) => {
    setIncomeTypes(types);
    localStorage.setItem('dividend_income_types', JSON.stringify(types));
  };

  // 添加新選項
  const handleAddIncomeType = () => {
    if (newIncomeTypeInput.trim() && !incomeTypes.includes(newIncomeTypeInput.trim())) {
      const updated = [...incomeTypes, newIncomeTypeInput.trim()];
      saveIncomeTypes(updated);
      setNewIncomeTypeInput('');
    }
  };

  // 刪除選項
  const handleDeleteIncomeType = (typeToDelete: string) => {
    // 如果當前表單選中要刪除的選項，先清空選擇
    if (formData.income_type === typeToDelete) {
      setFormData(prev => ({ ...prev, income_type: incomeTypes.length > 1 ? incomeTypes.filter(t => t !== typeToDelete)[0] : '' }));
    }
    const updated = incomeTypes.filter(t => t !== typeToDelete);
    saveIncomeTypes(updated);
  };

  // 點擊外部關閉選項下拉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showIncomeTypeDropdown && !target.closest('.income-type-dropdown-container')) {
        setShowIncomeTypeDropdown(false);
      }
    };

    if (showIncomeTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showIncomeTypeDropdown]);

  const [stats, setStats] = useState({
    totalAfterTax: 0,
    totalProfitLoss: 0,
    totalDividend: 0,
    totalCapitalGain: 0,
    totalTax: 0,
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    incomeType: '全部',
    stockCode: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dragging, setDragging] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedDividendId, setSelectedDividendId] = useState<number | null>(null);
  const [twseLoading, setTwseLoading] = useState(false);
  const [twseError, setTwseError] = useState('');
  const [twseFields, setTwseFields] = useState<string[]>([]);
  const [twseRecords, setTwseRecords] = useState<string[][]>([]);

  const [formData, setFormData] = useState({
    record_date: format(new Date(), 'yyyy-MM-dd'),
    income_type: '',
    stock_code: '',
    stock_name: '',
    pre_tax_amount: '' as number | '',
    tax_amount: '' as number | '',
    after_tax_amount: '' as number | '',
    dividend_per_share: '' as number | '',
    share_count: '' as number | '',
    source: '',
    description: '',
  });

  useEffect(() => {
    fetchDividends();
    // 設置默認收益類型為第一個（如果表單中的類型為空）
    if (incomeTypes.length > 0 && !formData.income_type) {
      setFormData(prev => ({ ...prev, income_type: incomeTypes[0] }));
    }
  }, [filters, currentPage, pageSize]);

  // 根據股票代碼自動帶出股票名稱（簡易查詢）
  const handleStockCodeBlur = async () => {
    const code = formData.stock_code.trim();
    if (!code) return;

    try {
      const response = await axios.get('/api/stocks/search', {
        params: { keyword: code },
      });
      const list = response.data.data || [];
      if (list.length === 0) return;

      const matched =
        list.find((item: any) => item.stock_code === code) || list[0];

      if (matched?.stock_name) {
        setFormData((prev) => ({
          ...prev,
          stock_name: prev.stock_name || matched.stock_name,
        }));
      }
    } catch (err) {
      console.error('根據股票代碼查詢股票名稱失敗:', err);
    }
  };

  const fetchDividends = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.incomeType && filters.incomeType !== '全部') params.incomeType = filters.incomeType;
      if (filters.stockCode) params.stockCode = filters.stockCode;

      const response = await axios.get('/api/dividends', { params });
      setDividends(response.data.data);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取歷史收益失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        ...formData,
        pre_tax_amount: formData.pre_tax_amount === '' ? 0 : parseFloat(formData.pre_tax_amount.toString()),
        tax_amount: formData.tax_amount === '' ? 0 : parseFloat(formData.tax_amount.toString()),
        after_tax_amount: formData.after_tax_amount === '' ? 0 : parseFloat(formData.after_tax_amount.toString()),
        dividend_per_share: formData.dividend_per_share === '' ? null : (parseFloat(formData.dividend_per_share.toString()) || null),
        share_count: formData.share_count === '' ? null : (parseFloat(formData.share_count.toString()) || null),
      };

      if (editingDividend) {
        await axios.put(`/api/dividends/${editingDividend.id}`, data);
      } else {
        await axios.post('/api/dividends', data);
      }
      setShowModal(false);
      setEditingDividend(null);
      resetForm();
      fetchDividends();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleEdit = (dividend: Dividend) => {
    setEditingDividend(dividend);
    setFormData({
      record_date: dividend.record_date,
      income_type: dividend.income_type,
      stock_code: dividend.stock_code,
      stock_name: dividend.stock_name,
      pre_tax_amount: dividend.pre_tax_amount,
      tax_amount: dividend.tax_amount,
      after_tax_amount: dividend.after_tax_amount,
      dividend_per_share: dividend.dividend_per_share || 0,
      share_count: dividend.share_count || 0,
      source: dividend.source || '',
      description: dividend.description || '',
    });
    // 重置模態框位置到中間
    setModalPosition({ x: null, y: null });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/dividends/${id}`);
      setDeleteConfirm(null);
      fetchDividends();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
  };

  const resetForm = () => {
    const defaultType = incomeTypes.length > 0 ? incomeTypes[0] : '';
    setFormData({
      record_date: format(new Date(), 'yyyy-MM-dd'),
      income_type: defaultType,
      stock_code: '',
      stock_name: '',
      pre_tax_amount: 0,
      tax_amount: 0,
      after_tax_amount: 0,
      dividend_per_share: 0,
      share_count: 0,
      source: '',
      description: '',
    });
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) {
      return;
    }
    const modalElement = e.currentTarget as HTMLElement;
    const rect = modalElement.getBoundingClientRect();
    
    // 如果當前是居中狀態，先計算實際位置
    let currentX = modalPosition.x;
    let currentY = modalPosition.y;
    
    if (currentX === null || currentY === null) {
      // 居中狀態，計算實際像素位置
      currentX = rect.left;
      currentY = rect.top;
      setModalPosition({ x: currentX, y: currentY });
    }
    
    setDragging(true);
    setDragStart({
      x: e.clientX - currentX,
      y: e.clientY - currentY,
    });
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setModalPosition({
        x: newX,
        y: newY,
      });
    }
  };

  const handleModalMouseUp = () => {
    setDragging(false);
  };

  const totalPages = Math.ceil(dividends.length / pageSize);
  const paginatedDividends = dividends.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading && dividends.length === 0) {
    return <div className="text-center py-8">載入中...</div>;
  }

  const handleExportDividendsExcel = () => {
    // TODO: 實作匯出歷史收益到 Excel 的功能
    console.log('export dividends to excel (TODO)');
  };

  const handleTwseQuery = async () => {
    setTwseError('');
    setTwseFields([]);
    setTwseRecords([]);

    if (!filters.startDate || !filters.endDate) {
      setTwseError('請先選擇開始日期與結束日期');
      return;
    }

    try {
      setTwseLoading(true);
      const response = await axios.get('/api/twse/exrights', {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      });

      if (!response.data.success) {
        setTwseError(response.data.message || '查詢失敗');
        return;
      }

      setTwseFields(response.data.fields || []);
      setTwseRecords(response.data.records || []);
    } catch (err: any) {
      setTwseError(err.response?.data?.message || '查詢 TWSE 除權除息資料失敗');
    } finally {
      setTwseLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">歷史收益</h1>
        </div>

        {/* 標籤頁導航：歷史收益 / TWSE 除權除息查詢 */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              歷史收益記錄
            </button>
            <button
              onClick={() => setActiveTab('twse')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'twse'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              TWSE 除權除息查詢
            </button>
          </nav>
        </div>

        {/* 歷史收益分頁 */}
        {activeTab === 'history' && (
          <div>
            <div className="flex justify-end items-center gap-3 mb-6">
              <button
                type="button"
                onClick={handleExportDividendsExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                title="匯出歷史收益 Excel"
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
                onClick={() => {
                  resetForm();
                  // 重置模態框位置到中間
                  setModalPosition({ x: null, y: null });
                  setShowModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                新增收益記錄
              </button>
            </div>

            {/* 統計資訊 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600">總收益(稅後)</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalAfterTax.toFixed(2)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600">股息收入</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalDividend.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600">資本利得</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalCapitalGain.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600">總稅額</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats.totalTax.toFixed(2)}
                </p>
              </div>
            </div>

            {/* 篩選條件 */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">收益類型</label>
                <select
                  value={filters.incomeType}
                  onChange={(e) => setFilters({ ...filters, incomeType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="全部">全部</option>
                  {incomeTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">股票代號</label>
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

            {/* 收益記錄列表 */}
            {paginatedDividends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">尚無收益記錄</div>
            ) : (
              <>
                <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">收益類型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">股票代號</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">股票名稱</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">每股股息</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">持股數量</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">稅前金額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">稅額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">稅後金額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">來源</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedDividends.map((dividend) => {
                    const isSelected = selectedDividendId === dividend.id;
                    return (
                    <tr
                      key={dividend.id}
                      onClick={() => setSelectedDividendId(dividend.id)}
                      className={`cursor-pointer ${
                        isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(dividend.record_date), 'yyyy/MM/dd')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dividend.income_type}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dividend.stock_code}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dividend.stock_name}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dividend.dividend_per_share ? `$${dividend.dividend_per_share.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {dividend.share_count ? dividend.share_count.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${dividend.pre_tax_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${dividend.tax_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${dividend.after_tax_amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {dividend.source || '-'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        {dividend.description || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(dividend)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(dividend.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          刪除
                        </button>
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
                      共 {dividends.length} 筆，第 {currentPage} / {totalPages} 頁
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
        )}

        {/* TWSE 除權除息查詢分頁 */}
        {activeTab === 'twse' && (
          <div>
            <div className="mt-2 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                TWSE 除權除息計算結果表查詢
              </h3>
              <div className="flex flex-wrap items-end gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    開始日期（TWSE）
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    結束日期（TWSE）
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleTwseQuery}
                  disabled={twseLoading}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {twseLoading ? '查詢中...' : '查詢 TWSE 除權除息'}
                </button>
              </div>
              {twseError && (
                <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {twseError}
                </div>
              )}
              {twseRecords.length > 0 && (
                <div className="overflow-x-auto max-h-80 border border-gray-200 rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {twseFields.map((field) => (
                          <th
                            key={field}
                            className="px-2 py-2 border-b border-gray-200 text-left text-[11px] text-gray-600"
                          >
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {twseRecords.map((row, idx) => (
                        <tr
                          key={idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-2 py-2 border-b border-gray-100 text-[11px] text-gray-900 whitespace-nowrap"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-500">
                本區資料直接來自{' '}
                <span className="underline">
                  臺灣證券交易所／除權除息計算結果表（TWT49U）
                </span>
                ，查詢期間請配合上方日期區間設定。
              </p>
            </div>
          </div>
        )}

        {/* 新增/編輯模態框 */}
        {showModal && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
            onMouseMove={handleModalMouseMove}
            onMouseUp={handleModalMouseUp}
          >
            <div
              className="relative mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white"
              style={{
                position: 'fixed',
                top: modalPosition.y === null ? '50%' : `${modalPosition.y}px`,
                left: modalPosition.x === null ? '50%' : `${modalPosition.x}px`,
                transform: modalPosition.y === null ? 'translate(-50%, -50%)' : 'none',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onMouseDown={handleModalMouseDown}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4 cursor-move">
                {editingDividend ? '編輯收益記錄' : '新增收益記錄'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">記錄日期 *</label>
                    <input
                      type="date"
                      required
                      value={formData.record_date}
                      onChange={(e) => setFormData({ ...formData, record_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">收益類型 *</label>
                    <div className="relative income-type-dropdown-container">
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <button
                            type="button"
                            onClick={() => setShowIncomeTypeDropdown(!showIncomeTypeDropdown)}
                            className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white flex items-center justify-between"
                          >
                            <span className={formData.income_type ? 'text-gray-900' : 'text-gray-500'}>
                              {formData.income_type || '請選擇'}
                            </span>
                            <svg className={`w-5 h-5 text-gray-400 transition-transform ${showIncomeTypeDropdown ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showIncomeTypeDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                              <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={newIncomeTypeInput}
                                    onChange={(e) => setNewIncomeTypeInput(e.target.value)}
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddIncomeType();
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                    placeholder="新增收益類型"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddIncomeType();
                                    }}
                                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                    title="添加新選項"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="py-1">
                                {incomeTypes.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-gray-500 text-center">暫無選項</div>
                                ) : (
                                  incomeTypes.map((type) => (
                                    <div
                                      key={type}
                                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 cursor-pointer group"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setFormData({ ...formData, income_type: type });
                                        setShowIncomeTypeDropdown(false);
                                      }}
                                    >
                                      <span className={formData.income_type === type ? 'text-blue-600 font-medium' : 'text-gray-900'}>
                                        {type}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteIncomeType(type);
                                        }}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-100 rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="刪除此選項"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">股票代碼 *</label>
                    <input
                      type="text"
                      required
                      value={formData.stock_code}
                      onChange={(e) => setFormData({ ...formData, stock_code: e.target.value })}
                      onBlur={handleStockCodeBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="輸入股票代碼"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">股票名稱 *</label>
                    <input
                      type="text"
                      required
                      value={formData.stock_name}
                      onChange={(e) => setFormData({ ...formData, stock_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="輸入股票名稱"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">稅前金額 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.pre_tax_amount === '' ? '' : formData.pre_tax_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, pre_tax_amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：10000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">稅額</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax_amount === '' ? '' : formData.tax_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, tax_amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">稅後金額 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.after_tax_amount === '' ? '' : formData.after_tax_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, after_tax_amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：9000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">每股股息</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.dividend_per_share === '' ? '' : formData.dividend_per_share}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, dividend_per_share: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">持股數量</label>
                    <input
                      type="number"
                      value={formData.share_count === '' ? '' : formData.share_count}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, share_count: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">來源</label>
                    <input
                      type="text"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：元大證券"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                      placeholder="例：2024年第四季股息"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingDividend(null);
                      resetForm();
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    儲存
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 刪除確認模態框 */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">確認刪除</h3>
              <p className="mb-4">確定要刪除此收益記錄嗎？此操作無法復原。</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  取消
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  確定刪除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dividends;


