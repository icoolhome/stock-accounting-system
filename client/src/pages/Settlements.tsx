import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface BankAccount {
  id: number;
  bank_name: string;
  account_number: string;
}

interface Transaction {
  id: number;
  stock_code: string;
  stock_name: string;
  trade_date: string;
  transaction_type: string;
  quantity: number;
  price: number;
  transaction_amount: number;
  fee: number;
  tax: number;
  securities_tax: number;
  health_insurance: number;
  margin: number;
  financing_amount: number;
  interest: number;
  borrowing_fee: number;
  net_amount: number;
  currency: string;
}

interface Settlement {
  id: number;
  transaction_id?: number; // 保留以向後兼容
  transaction_ids?: string; // JSON 字符串存儲的交易 ID 數組
  bank_account_id: number;
  bank_name?: string;
  account_number?: string;
  settlement_date: string;
  trade_date?: string;
  settlement_amount: number;
  twd_amount?: number;
  status: string;
  notes?: string;
  stock_code?: string;
  stock_name?: string;
}

const Settlements = () => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState<Settlement | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ pendingAmount: 0, completedAmount: 0 });
  const [filters, setFilters] = useState({
    bankAccountId: '',
    startDate: '',
    endDate: '',
    status: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    transaction_ids: [] as number[],
    bank_account_id: '',
    settlement_date: format(new Date(), 'yyyy-MM-dd'),
    trade_date: '',
    settlement_amount: '' as number | '',
    twd_amount: '' as number | '',
    status: '未交割',
    notes: '',
  });

  const [showTransactionDetail, setShowTransactionDetail] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<Transaction[]>([]);
  const [selectedSettlementForDetail, setSelectedSettlementForDetail] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchBankAccounts();
    fetchTransactions();
    fetchSettlements();
  }, [filters, currentPage, pageSize]);

  // 當選擇關聯交易時，自動填入成交日期（使用第一個選擇的交易日期）
  useEffect(() => {
    if (formData.transaction_ids.length > 0 && transactions.length > 0) {
      const firstTransaction = transactions.find(t => formData.transaction_ids.includes(t.id));
      if (firstTransaction) {
        setFormData(prev => ({
          ...prev,
          trade_date: firstTransaction.trade_date
        }));
      }
    }
  }, [formData.transaction_ids, transactions]);

  // 根據交割日期自動判斷狀態
  useEffect(() => {
    if (formData.settlement_date && !editingSettlement) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const settlementDate = new Date(formData.settlement_date);
      settlementDate.setHours(0, 0, 0, 0);
      
      // 如果交割日期是今天或過去，狀態設為「已交割」；否則設為「未交割」
      const autoStatus = settlementDate <= today ? '已交割' : '未交割';
      
      setFormData(prev => ({
        ...prev,
        status: autoStatus
      }));
    }
  }, [formData.settlement_date, editingSettlement]);

  const fetchBankAccounts = async () => {
    try {
      const response = await axios.get('/api/bank-accounts');
      setBankAccounts(response.data.data);
    } catch (err: any) {
      console.error('獲取銀行帳戶失敗:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await axios.get('/api/transactions');
      setTransactions(response.data.data);
    } catch (err: any) {
      console.error('獲取交易記錄失敗:', err);
    }
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.bankAccountId) params.bankAccountId = filters.bankAccountId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;

      const response = await axios.get('/api/settlements', { params });
      setSettlements(response.data.data);
      if (response.data.stats) {
        setStats(response.data.stats);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取交割記錄失敗');
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
        transaction_ids: formData.transaction_ids.length > 0 ? formData.transaction_ids : null,
        bank_account_id: parseInt(formData.bank_account_id),
        settlement_amount: formData.settlement_amount === '' ? 0 : parseFloat(formData.settlement_amount.toString()),
        twd_amount: formData.twd_amount === '' ? null : parseFloat(formData.twd_amount.toString()),
        trade_date: formData.trade_date || null,
      };

      if (editingSettlement) {
        await axios.put(`/api/settlements/${editingSettlement.id}`, data);
      } else {
        await axios.post('/api/settlements', data);
      }
      setShowModal(false);
      setEditingSettlement(null);
      resetForm();
      fetchSettlements();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleEdit = (settlement: Settlement) => {
    try {
      setEditingSettlement(settlement);
      // 解析 transaction_ids（可能是 JSON 字符串）
      let transactionIds: number[] = [];
      if (settlement.transaction_ids) {
        try {
          transactionIds = JSON.parse(settlement.transaction_ids);
        } catch (e) {
          // 如果解析失敗，嘗試使用舊的 transaction_id
          if (settlement.transaction_id) {
            transactionIds = [settlement.transaction_id];
          }
        }
      } else if (settlement.transaction_id) {
        transactionIds = [settlement.transaction_id];
      }
      
      // 轉換舊的狀態值為新的狀態值（向後兼容）
      let status = settlement.status || '未交割';
      if (status === '待處理') {
        status = '未交割';
      } else if (status === '已完成') {
        status = '已交割';
      }
      
      setFormData({
        transaction_ids: transactionIds,
        bank_account_id: settlement.bank_account_id?.toString() || '',
        settlement_date: settlement.settlement_date || format(new Date(), 'yyyy-MM-dd'),
        trade_date: settlement.trade_date || '',
        settlement_amount: settlement.settlement_amount || '' as number | '',
        twd_amount: settlement.twd_amount || '' as number | '',
        status: status,
        notes: settlement.notes || '',
      });
      // 重置模態框位置到中間
      setModalPosition({ x: null, y: null });
      setShowModal(true);
    } catch (error) {
      console.error('編輯交割記錄時發生錯誤:', error);
      setError('編輯失敗，請稍後再試');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/settlements/${id}`);
      setDeleteConfirm(null);
      fetchSettlements();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
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

  const resetForm = () => {
    setFormData({
      transaction_ids: [],
      bank_account_id: '',
      settlement_date: format(new Date(), 'yyyy-MM-dd'),
      trade_date: '',
      settlement_amount: '' as number | '',
      twd_amount: '' as number | '',
      status: '未交割',
      notes: '',
    });
    setShowTransactionDetail(false);
    setSelectedTransactions([]);
  };

  const handleViewDetail = () => {
    if (formData.transaction_ids.length > 0) {
      const selected = transactions.filter(t => formData.transaction_ids.includes(t.id));
      setSelectedTransactions(selected);
      setShowTransactionDetail(true);
    }
  };

  const handleViewDetailFromTable = (settlement: Settlement) => {
    // 如果點擊的是當前已選中的記錄，則關閉明細；否則顯示新記錄的明細
    if (selectedSettlementForDetail === settlement.id) {
      setSelectedSettlementForDetail(null);
      setSelectedTransactions([]);
    } else {
      let transactionIds: number[] = [];
      if (settlement.transaction_ids) {
        try {
          transactionIds = JSON.parse(settlement.transaction_ids);
        } catch (e) {
          if (settlement.transaction_id) {
            transactionIds = [settlement.transaction_id];
          }
        }
      } else if (settlement.transaction_id) {
        transactionIds = [settlement.transaction_id];
      }
      
      if (transactionIds.length > 0) {
        const selected = transactions.filter(t => transactionIds.includes(t.id));
        setSelectedTransactions(selected);
        setSelectedSettlementForDetail(settlement.id);
      }
    }
  };

  const handleTransactionToggle = (transactionId: number) => {
    setFormData(prev => {
      const ids = prev.transaction_ids.includes(transactionId)
        ? prev.transaction_ids.filter(id => id !== transactionId)
        : [...prev.transaction_ids, transactionId];
      return { ...prev, transaction_ids: ids };
    });
  };

  const totalPages = Math.ceil(settlements.length / pageSize);
  const paginatedSettlements = settlements.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 導出Excel功能
  const exportToExcel = () => {
    // 準備Excel數據
    const excelData = settlements.map((settlement) => ({
      '銀行帳戶': settlement.bank_name ? `${settlement.bank_name} - ${settlement.account_number || ''}` : '-',
      '交割日期': settlement.settlement_date ? format(new Date(settlement.settlement_date), 'yyyy/MM/dd') : '',
      '成交日期': settlement.trade_date ? format(new Date(settlement.trade_date), 'yyyy/MM/dd') : '',
      '股票代號': settlement.stock_code || '-',
      '股票名稱': settlement.stock_name || '-',
      '交割金額': settlement.settlement_amount,
      '台幣金額': settlement.twd_amount || '-',
      '狀態': settlement.status,
      '備註': settlement.notes || '',
      '交易ID': settlement.transaction_ids || settlement.transaction_id || '-',
    }));

    // 創建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 設置列寬
    const colWidths = [
      { wch: 25 }, // 銀行帳戶
      { wch: 12 }, // 交割日期
      { wch: 12 }, // 成交日期
      { wch: 12 }, // 股票代號
      { wch: 20 }, // 股票名稱
      { wch: 12 }, // 交割金額
      { wch: 12 }, // 台幣金額
      { wch: 12 }, // 狀態
      { wch: 30 }, // 備註
      { wch: 20 }, // 交易ID
    ];
    ws['!cols'] = colWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '交割記錄');

    // 生成文件名（包含日期範圍）
    const dateRange = filters.startDate && filters.endDate
      ? `${filters.startDate}_${filters.endDate}`
      : format(new Date(), 'yyyy-MM-dd');
    const fileName = `交割記錄_${dateRange}.xlsx`;

    // 下載文件
    XLSX.writeFile(wb, fileName);
  };

  if (loading && settlements.length === 0) {
    return <div className="text-center py-8">載入中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">交割管理</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              title="匯出Excel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
              匯出Excel
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
              新增交割記錄
            </button>
          </div>
        </div>

        {/* 統計資訊 */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">待交割金額</h3>
            <p className="text-2xl font-bold text-gray-900">
              ${stats.pendingAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">已交割</h3>
            <p className="text-2xl font-bold text-gray-900">
              ${stats.completedAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* 篩選條件 */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">銀行帳戶</label>
            <select
              value={filters.bankAccountId}
              onChange={(e) => setFilters({ ...filters, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">全部</option>
              {bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bank_name} - {account.account_number}
                </option>
              ))}
            </select>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">日期範圍</label>
            <select
              value=""
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let startDate: Date;
                let endDate: Date = new Date(today);
                
                switch (value) {
                  case '昨日':
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 1);
                    endDate = new Date(startDate);
                    break;
                  case '今日':
                    startDate = new Date(today);
                    endDate = new Date(today);
                    break;
                  case '本週':
                    startDate = new Date(today);
                    const dayOfWeek = startDate.getDay();
                    startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                    break;
                  case '本月':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    break;
                  case '本季':
                    const quarter = Math.floor(today.getMonth() / 3);
                    startDate = new Date(today.getFullYear(), quarter * 3, 1);
                    break;
                  case '上週':
                    const lastWeekStart = new Date(today);
                    const lastWeekDay = lastWeekStart.getDay();
                    lastWeekStart.setDate(lastWeekStart.getDate() - (lastWeekDay === 0 ? 13 : lastWeekDay + 6));
                    startDate = lastWeekStart;
                    const lastWeekEnd = new Date(startDate);
                    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
                    endDate = lastWeekEnd;
                    break;
                  case '上月':
                    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
                    endDate = lastDay;
                    break;
                  case '近一週':
                    startDate = new Date(today);
                    startDate.setDate(startDate.getDate() - 6);
                    break;
                  case '近一月':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                  case '近一季':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                  case '近半年':
                    startDate = new Date(today);
                    startDate.setMonth(startDate.getMonth() - 6);
                    break;
                  default:
                    return;
                }
                
                setFilters({
                  ...filters,
                  startDate: format(startDate, 'yyyy-MM-dd'),
                  endDate: format(endDate, 'yyyy-MM-dd'),
                });
                
                // 重置選擇框
                e.target.value = '';
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">請選擇</option>
              <option value="昨日">昨日</option>
              <option value="今日">今日</option>
              <option value="本週">本週</option>
              <option value="本月">本月</option>
              <option value="本季">本季</option>
              <option value="上週">上週</option>
              <option value="上月">上月</option>
              <option value="近一週">近一週</option>
              <option value="近一月">近一月</option>
              <option value="近一季">近一季</option>
              <option value="近半年">近半年</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">全部</option>
              <option value="未交割">未交割</option>
              <option value="已交割">已交割</option>
              <option value="失敗">失敗</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 交割記錄列表 */}
        {paginatedSettlements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無交割記錄</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">銀行帳戶</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">交割日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">台幣收付金額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">交割金額</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">成交日期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">檢視明細</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">狀態</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">備註</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSettlements.map((settlement) => {
                    let transactionIds: number[] = [];
                    if (settlement.transaction_ids) {
                      try {
                        transactionIds = JSON.parse(settlement.transaction_ids);
                      } catch (e) {
                        if (settlement.transaction_id) {
                          transactionIds = [settlement.transaction_id];
                        }
                      }
                    } else if (settlement.transaction_id) {
                      transactionIds = [settlement.transaction_id];
                    }
                    const hasTransactions = transactionIds.length > 0;
                    const isSelected = selectedSettlementId === settlement.id;
                    
                    return (
                      <tr
                        key={settlement.id}
                        onClick={() => setSelectedSettlementId(settlement.id)}
                        className={`cursor-pointer ${
                          isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* 1. 銀行帳戶 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {settlement.bank_name} - {settlement.account_number}
                        </td>
                        {/* 2. 交割日期 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {format(new Date(settlement.settlement_date), 'yyyy/MM/dd')}
                        </td>
                        {/* 3. 台幣收付金額 */}
                        <td className={`px-4 py-4 whitespace-nowrap text-sm ${
                          settlement.twd_amount 
                            ? (settlement.twd_amount >= 0 ? 'text-red-600' : 'text-green-600')
                            : 'text-gray-900'
                        }`}>
                          {settlement.twd_amount ? `$${settlement.twd_amount.toFixed(2)}` : '-'}
                        </td>
                        {/* 4. 交割金額 */}
                        <td className={`px-4 py-4 whitespace-nowrap text-sm ${
                          settlement.settlement_amount >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ${settlement.settlement_amount.toFixed(2)}
                        </td>
                        {/* 5. 成交日期 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          {settlement.trade_date ? format(new Date(settlement.trade_date), 'yyyy/MM/dd') : '-'}
                        </td>
                        {/* 6. 檢視明細 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          {hasTransactions ? (
                            <button
                              onClick={() => handleViewDetailFromTable(settlement)}
                              className={`text-blue-600 hover:text-blue-900 underline ${
                                selectedSettlementForDetail === settlement.id ? 'font-bold' : ''
                              }`}
                            >
                              {selectedSettlementForDetail === settlement.id ? '隱藏明細' : '檢視明細'}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        {/* 7. 狀態 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              settlement.status === '已交割'
                                ? 'bg-green-100 text-green-800'
                                : settlement.status === '失敗'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {settlement.status}
                          </span>
                        </td>
                        {/* 8. 備註 */}
                        <td className="px-4 py-4 text-sm text-gray-900">{settlement.notes || '-'}</td>
                        {/* 操作 */}
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(settlement);
                            }}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            編輯
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(settlement.id);
                            }}
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
                  共 {settlements.length} 筆，第 {currentPage} / {totalPages} 頁
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

            {/* 交易明細顯示區域 - 顯示在分頁下方 */}
            {selectedSettlementForDetail && selectedTransactions.length > 0 && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">關聯交易明細（共 {selectedTransactions.length} 筆）</h3>
                  <button
                    onClick={() => {
                      setSelectedSettlementForDetail(null);
                      setSelectedTransactions([]);
                    }}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    ✕ 關閉
                  </button>
                </div>
                {/* 表格顯示明細 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase whitespace-nowrap">代號</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase whitespace-nowrap">商品名稱</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase whitespace-nowrap">種類</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">數量</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">成交價</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">成交金額</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">手續費</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">交易稅</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">證所稅</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">二代健保</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">券保證金</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">資自備款</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">利息</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">借券費</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">客戶淨收(+)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase whitespace-nowrap">客戶淨付(-)</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase whitespace-nowrap">幣別</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedTransactions.map((transaction) => {
                        const formatValue = (value: number | null | undefined): string => {
                          if (value === null || value === undefined || value === 0) return '';
                          return value.toFixed(2);
                        };
                        const formatQty = (value: number | null | undefined): string => {
                          if (value === null || value === undefined || value === 0) return '';
                          return value.toString();
                        };
                        const netAmount = transaction.net_amount || 0;
                        const isPositive = netAmount >= 0;
                        
                        return (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-sm text-blue-600 underline">{transaction.stock_code || ''}</td>
                            <td className="px-3 py-2 text-sm text-blue-600 underline">{transaction.stock_name || ''}</td>
                            <td className={`px-3 py-2 text-sm ${transaction.transaction_type?.includes('買') ? 'text-red-600' : 'text-green-600'}`}>
                              {transaction.transaction_type || ''}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatQty(transaction.quantity)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.price)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.transaction_amount)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.fee)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.tax)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.securities_tax)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.health_insurance)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.margin)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.financing_amount)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.interest)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{formatValue(transaction.borrowing_fee)}</td>
                            <td className={`px-3 py-2 text-sm text-right ${isPositive ? 'text-red-600' : ''}`}>
                              {isPositive ? formatValue(netAmount) : ''}
                            </td>
                            <td className={`px-3 py-2 text-sm text-right ${!isPositive ? 'text-green-600' : ''}`}>
                              {!isPositive ? formatValue(Math.abs(netAmount)) : ''}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900">{transaction.currency || 'TWD'}</td>
                          </tr>
                        );
                      })}
                      
                      {/* 小計行 */}
                      {selectedTransactions.length > 0 && (() => {
                        const totals = selectedTransactions.reduce((acc, t) => ({
                          quantity: acc.quantity + (t.quantity || 0),
                          transaction_amount: acc.transaction_amount + (t.transaction_amount || 0),
                          fee: acc.fee + (t.fee || 0),
                          tax: acc.tax + (t.tax || 0),
                          securities_tax: acc.securities_tax + (t.securities_tax || 0),
                          health_insurance: acc.health_insurance + (t.health_insurance || 0),
                          margin: acc.margin + (t.margin || 0),
                          financing_amount: acc.financing_amount + (t.financing_amount || 0),
                          interest: acc.interest + (t.interest || 0),
                          borrowing_fee: acc.borrowing_fee + (t.borrowing_fee || 0),
                          net_amount: acc.net_amount + (t.net_amount || 0),
                        }), {
                          quantity: 0,
                          transaction_amount: 0,
                          fee: 0,
                          tax: 0,
                          securities_tax: 0,
                          health_insurance: 0,
                          margin: 0,
                          financing_amount: 0,
                          interest: 0,
                          borrowing_fee: 0,
                          net_amount: 0,
                        });
                        
                        const formatTotalValue = (value: number): string => {
                          if (value === 0) return '';
                          return value.toFixed(2);
                        };
                        
                        const formatTotalQty = (value: number): string => {
                          if (value === 0) return '';
                          return value.toString();
                        };
                        
                        const totalNetAmount = totals.net_amount;
                        const isTotalPositive = totalNetAmount >= 0;
                        
                        return (
                          <tr className="bg-gray-100 font-semibold">
                            <td className="px-3 py-2 text-sm text-gray-900" colSpan={3}>小計</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalQty(totals.quantity)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">-</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.transaction_amount)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.fee)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.tax)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.securities_tax)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.health_insurance)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.margin)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.financing_amount)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.interest)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right font-bold">{formatTotalValue(totals.borrowing_fee)}</td>
                            <td className={`px-3 py-2 text-sm text-right font-bold ${isTotalPositive ? 'text-red-600' : ''}`}>
                              {isTotalPositive ? formatTotalValue(totalNetAmount) : ''}
                            </td>
                            <td className={`px-3 py-2 text-sm text-right font-bold ${!isTotalPositive ? 'text-green-600' : ''}`}>
                              {!isTotalPositive ? formatTotalValue(Math.abs(totalNetAmount)) : ''}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900"></td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 新增/編輯模態框 */}
        {showModal && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
            onMouseMove={handleModalMouseMove}
            onMouseUp={handleModalMouseUp}
          >
            <div
              className="relative mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white"
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
                {editingSettlement ? '編輯交割記錄' : '新增交割記錄'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 1. 關聯交易（選填，可多選） */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">關聯交易（選填，可多選）</label>
                    <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                      {transactions.length === 0 ? (
                        <div className="text-sm text-gray-500">尚無交易記錄</div>
                      ) : (
                        <>
                          {/* 顯示已選擇的交易 */}
                          {formData.transaction_ids.length > 0 && (
                            <div className="mb-3 pb-3 border-b border-gray-200">
                              <div className="text-xs font-medium text-gray-600 mb-2">已選擇的交易：</div>
                              <div className="space-y-1">
                                {formData.transaction_ids.map((selectedId) => {
                                  const selectedTransaction = transactions.find(t => t.id === selectedId);
                                  if (!selectedTransaction) return null;
                                  return (
                                    <div key={selectedId} className="flex items-center justify-between bg-blue-50 px-2 py-1 rounded text-sm">
                                      <span className="text-gray-700">
                                        {selectedTransaction.stock_code} {selectedTransaction.stock_name} - {format(new Date(selectedTransaction.trade_date), 'yyyy/MM/dd')}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleTransactionToggle(selectedId)}
                                        className="text-red-600 hover:text-red-800 text-xs ml-2"
                                      >
                                        移除
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* 顯示未選擇的交易 */}
                          {(() => {
                            // 收集所有已經被其他交割記錄關聯的交易 ID（排除當前正在編輯的交割記錄）
                            const usedTransactionIds = new Set<number>();
                            settlements.forEach(settlement => {
                              // 排除當前正在編輯的交割記錄
                              if (editingSettlement && settlement.id === editingSettlement.id) {
                                return;
                              }
                              
                              // 處理 transaction_ids（JSON 字符串）
                              if (settlement.transaction_ids) {
                                try {
                                  const ids = JSON.parse(settlement.transaction_ids);
                                  ids.forEach((id: number) => usedTransactionIds.add(id));
                                } catch (e) {
                                  // 解析失敗，忽略
                                }
                              }
                              
                              // 處理舊的 transaction_id（向後兼容）
                              if (settlement.transaction_id) {
                                usedTransactionIds.add(settlement.transaction_id);
                              }
                            });
                            
                            // 過濾掉已選擇和已被其他交割記錄使用的交易
                            const availableTransactions = transactions.filter(t => 
                              !formData.transaction_ids.includes(t.id) && 
                              !usedTransactionIds.has(t.id)
                            );
                            
                            if (availableTransactions.length === 0) {
                              return <div className="text-sm text-gray-500">所有交易都已選擇或已被其他交割記錄使用</div>;
                            }
                            return (
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-600 mb-1">可選擇的交易：</div>
                                {availableTransactions.map((t) => (
                                  <label key={t.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                    <input
                                      type="checkbox"
                                      checked={false}
                                      onChange={() => handleTransactionToggle(t.id)}
                                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">
                                      {t.stock_code} {t.stock_name} - {format(new Date(t.trade_date), 'yyyy/MM/dd')}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                    {formData.transaction_ids.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        已選擇 {formData.transaction_ids.length} 筆交易
                      </div>
                    )}
                  </div>
                  
                  {/* 2. 銀行帳戶 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">銀行帳戶 *</label>
                    <select
                      value={formData.bank_account_id}
                      onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">請選擇</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} - {account.account_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* 3. 交割日期 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">交割日期 *</label>
                    <input
                      type="date"
                      required
                      value={formData.settlement_date}
                      onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  {/* 4. 台幣收付金額 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">台幣收付金額</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.twd_amount === '' ? '' : formData.twd_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, twd_amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  {/* 5. 交割金額 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">交割金額 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.settlement_amount === '' ? '' : formData.settlement_amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, settlement_amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  {/* 6. 成交日期 + 7. 檢視明細 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">成交日期</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={formData.trade_date}
                        onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      {formData.transaction_ids.length > 0 && (
                        <button
                          type="button"
                          onClick={handleViewDetail}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm"
                        >
                          檢視明細
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* 8. 狀態 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">狀態 *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="未交割">未交割</option>
                      <option value="已交割">已交割</option>
                      <option value="失敗">失敗</option>
                    </select>
                  </div>
                  
                  {/* 9. 備註 */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingSettlement(null);
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
              <p className="mb-4">確定要刪除此交割記錄嗎？此操作無法復原。</p>
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

        {/* 交易明細模態框 */}
        {showTransactionDetail && selectedTransactions.length > 0 && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">關聯交易明細（共 {selectedTransactions.length} 筆）</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedTransactions.map((transaction, index) => (
                  <div key={transaction.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-md font-semibold text-gray-900">
                        {index + 1}. {transaction.stock_code} {transaction.stock_name}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(transaction.trade_date), 'yyyy/MM/dd')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                      <div>
                        <span className="text-xs font-medium text-gray-600">客戶淨收付：</span>
                        <span className="text-sm text-gray-900 ml-1">${transaction.net_amount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setShowTransactionDetail(false);
                    setSelectedTransactions([]);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settlements;


