import { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface SecuritiesAccount {
  id: number;
  account_name: string;
  broker_name: string;
}

interface Transaction {
  id: number;
  securities_account_id: number;
  account_name?: string;
  broker_name?: string;
  trade_date: string;
  settlement_date: string;
  transaction_type: string;
  stock_code: string;
  stock_name: string;
  quantity: number;
  price: number;
  fee: number;
  transaction_amount: number;
  tax: number;
  securities_tax: number;
  financing_amount: number;
  margin: number;
  interest: number;
  borrowing_fee: number;
  net_amount: number;
  profit_loss: number;
  return_rate: number;
  holding_cost: number;
  health_insurance: number;
  currency: string;
  buy_reason?: string;
}

const TRANSACTION_TYPES = [
  '普通買進',
  '普通賣出',
  '融資買進',
  '融券賣出',
  '融資賣出',
  '融券買進',
  '現股買進',
  '現股賣出',
];

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<SecuritiesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    stockCode: '',
    accountId: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<string>('trade_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dragging, setDragging] = useState(false);
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [stockSearchResults, setStockSearchResults] = useState<
    { stock_code: string; stock_name: string; market_type?: string; etf_type?: string | null }[]
  >([]);
  const [stockSearchLoading, setStockSearchLoading] = useState(false);
  const [holdingCostManuallyEdited, setHoldingCostManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    securities_account_id: '',
    trade_date: format(new Date(), 'yyyy-MM-dd'),
    settlement_date: format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // 初始值，將在 useEffect 中重新計算
    transaction_type: '普通買進',
    stock_code: '',
    stock_name: '',
    quantity: '' as number | '',
    price: '' as number | '',
    fee: '' as number | '',
    total_amount: '' as number | '', // 總金額：股價 × 數量 + 手續費
    transaction_amount: '' as number | '',
    tax: '' as number | '',
    securities_tax: '' as number | '',
    financing_amount: '' as number | '',
    margin: '' as number | '',
    interest: '' as number | '',
    borrowing_fee: '' as number | '',
    net_amount: '' as number | '',
    profit_loss: '' as number | '',
    return_rate: '' as number | '',
    holding_cost: '' as number | '',
    health_insurance: '' as number | '',
    currency: 'TWD',
    buy_reason: '',
  });

  // 手續費設定（用於自動計算）
  const [feeSettings, setFeeSettings] = useState({
    feeDiscount: 0.65,
    baseFeeRate: 0.1425,
    taxRate: 0.3,
    minFee: 20,
  });

  // 介面設定（用於字體大小）
  const [uiSettings, setUiSettings] = useState({
    fontSize: '16px',
  });

  // 處理數字輸入的輔助函數
  const handleNumberChange = (field: keyof typeof formData, value: string) => {
    if (value === '' || value === null || value === undefined) {
      setFormData({ ...formData, [field]: '' as number | '' });
    } else {
      const numValue = parseFloat(value);
      setFormData({ ...formData, [field]: isNaN(numValue) ? '' as number | '' : numValue });
    }
  };

  // 台灣國定假日列表（格式：YYYY-MM-DD）
  const getTaiwanHolidays = (year: number): string[] => {
    const holidays: string[] = [];
    
    // 固定假日
    holidays.push(`${year}-01-01`); // 元旦
    holidays.push(`${year}-02-28`); // 和平紀念日
    holidays.push(`${year}-05-01`); // 勞動節
    holidays.push(`${year}-10-10`); // 國慶日
    holidays.push(`${year}-12-25`); // 行憲紀念日
    
    // 農曆假日（簡化處理，使用固定日期，實際應該根據農曆計算）
    // 春節通常為1月底或2月初，這裡使用常見日期
    // 清明節：4月4日或5日
    holidays.push(`${year}-04-04`);
    holidays.push(`${year}-04-05`);
    
    // 其他常見假日日期（這裡只列舉固定日期，農曆假日需要根據具體年份查詢）
    // 可以後續擴展添加更多年份的具體假日
    
    return holidays;
  };

  // 檢查是否為工作日（非週末且非國定假日）
  const isBusinessDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    // 週六（6）和週日（0）不是工作日
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // 檢查是否為國定假日
    const dateStr = format(date, 'yyyy-MM-dd');
    const year = date.getFullYear();
    const holidays = getTaiwanHolidays(year);
    
    return !holidays.includes(dateStr);
  };

  // 計算下一個工作日（T+2 交易日）
  const calculateSettlementDate = (tradeDate: Date): Date => {
    let settlementDate = new Date(tradeDate);
    let businessDaysAdded = 0;
    
    // 如果成交日期本身不是工作日，先移到下一個工作日
    while (!isBusinessDay(settlementDate)) {
      settlementDate.setDate(settlementDate.getDate() + 1);
    }
    
    // 計算 T+2（加上2個交易日）
    while (businessDaysAdded < 2) {
      settlementDate.setDate(settlementDate.getDate() + 1);
      if (isBusinessDay(settlementDate)) {
        businessDaysAdded++;
      }
    }
    
    return settlementDate;
  };

  // 格式化數字顯示：如果為0則顯示空白
  const formatNumber = (value: number | null | undefined, decimals: number = 2, prefix: string = ''): string => {
    const num = value || 0;
    if (num === 0) return '';
    return `${prefix}${num.toFixed(decimals)}`;
  };

  // 格式化百分比顯示：如果為0則顯示空白
  const formatPercentage = (value: number | null | undefined, decimals: number = 2): string => {
    const num = value || 0;
    if (num === 0) return '';
    return `${num.toFixed(decimals)}%`;
  };

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
    fetchFeeSettings();
  }, [filters, currentPage, pageSize]);

  // 獲取手續費設定
  const fetchFeeSettings = async () => {
    try {
      const response = await axios.get('/api/settings');
      if (response.data.data?.feeSettings) {
        setFeeSettings(response.data.data.feeSettings);
      }
      if (response.data.data?.uiSettings) {
        setUiSettings(response.data.data.uiSettings);
      }
    } catch (err: any) {
      console.error('獲取設定失敗:', err);
    }
  };

  // 自動計算成交價金、總金額和持有成本
  useEffect(() => {
    const price = (formData.price === '' ? 0 : Number(formData.price)) || 0;
    const quantity = (formData.quantity === '' ? 0 : Number(formData.quantity)) || 0;
    let fee = (formData.fee === '' ? 0 : Number(formData.fee)) || 0;

    // 如果手續費為0，且股價和數量都有值，則自動計算手續費（但不更新 formData.fee，只計算總金額）
    if (fee === 0 && price > 0 && quantity > 0) {
      const transactionAmount = price * quantity;
      const baseFee = transactionAmount * (feeSettings.baseFeeRate / 100);
      const discountedFee = baseFee * feeSettings.feeDiscount;
      fee = Math.max(discountedFee, feeSettings.minFee);
    }

    const transactionAmount = price * quantity;
    const totalAmount = price * quantity + fee;
    const holdingCost = price * quantity + fee;
    // 更新成交價金、總金額，持有成本只有在未手動編輯時才自動計算
    setFormData((prev) => ({ 
      ...prev, 
      transaction_amount: transactionAmount || ('' as number | ''),
      total_amount: totalAmount || ('' as number | ''),
      holding_cost: holdingCostManuallyEdited ? prev.holding_cost : (holdingCost || ('' as number | ''))
    }));
  }, [formData.price, formData.quantity, formData.fee, feeSettings, holdingCostManuallyEdited]);

  // 當成交日期改變時，自動更新交割日期（成交日期 + 2 個交易日，T+2，跳過週末和國定假日）
  useEffect(() => {
    if (formData.trade_date && !editingTransaction) {
      // 只在新增記錄時自動計算，編輯時不自動更新
      const tradeDate = new Date(formData.trade_date);
      const settlementDate = calculateSettlementDate(tradeDate);
      setFormData((prev) => ({
        ...prev,
        settlement_date: format(settlementDate, 'yyyy-MM-dd'),
      }));
    }
  }, [formData.trade_date, editingTransaction]);

  // 根據股票代號自動查詢本地股票資料表（簡易 debounce）
  useEffect(() => {
    const keyword = formData.stock_code.trim();
    if (!keyword) {
      setStockSearchResults([]);
      return;
    }

    const handler = setTimeout(() => {
      searchStocks(keyword);
    }, 300);

    return () => clearTimeout(handler);
  }, [formData.stock_code]);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/securities-accounts');
      setAccounts(response.data.data);
    } catch (err: any) {
      console.error('獲取證券帳戶失敗:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.stockCode) params.stockCode = filters.stockCode;
      if (filters.accountId) params.accountId = filters.accountId;

      const response = await axios.get('/api/transactions', { params });
      setTransactions(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取交易記錄失敗');
    } finally {
      setLoading(false);
    }
  };

  const searchStocks = async (keyword: string) => {
    try {
      setStockSearchLoading(true);
      const response = await axios.get('/api/stocks/search', {
        params: { keyword },
      });
      setStockSearchResults(response.data.data || []);
    } catch (err) {
      // 失敗時不影響主要流程，只在 console 記錄
      console.error('搜尋股票代號失敗:', err);
      setStockSearchResults([]);
    } finally {
      setStockSearchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const data = {
        ...formData,
        securities_account_id: formData.securities_account_id ? parseInt(formData.securities_account_id) : null,
        quantity: formData.quantity === '' ? 0 : parseFloat(formData.quantity.toString()),
        price: formData.price === '' ? 0 : parseFloat(formData.price.toString()),
        fee: formData.fee === '' ? 0 : parseFloat(formData.fee.toString()),
        transaction_amount: formData.transaction_amount === '' ? 0 : parseFloat(formData.transaction_amount.toString()),
        tax: formData.tax === '' ? 0 : parseFloat(formData.tax.toString()),
        securities_tax: formData.securities_tax === '' ? 0 : parseFloat(formData.securities_tax.toString()),
        financing_amount: formData.financing_amount === '' ? 0 : parseFloat(formData.financing_amount.toString()),
        margin: formData.margin === '' ? 0 : parseFloat(formData.margin.toString()),
        interest: formData.interest === '' ? 0 : parseFloat(formData.interest.toString()),
        borrowing_fee: formData.borrowing_fee === '' ? 0 : parseFloat(formData.borrowing_fee.toString()),
        net_amount: formData.net_amount === '' ? 0 : parseFloat(formData.net_amount.toString()),
        profit_loss: formData.profit_loss === '' ? 0 : parseFloat(formData.profit_loss.toString()),
        return_rate: formData.return_rate === '' ? 0 : parseFloat(formData.return_rate.toString()),
        holding_cost: formData.holding_cost === '' ? 0 : parseFloat(formData.holding_cost.toString()),
        health_insurance: formData.health_insurance === '' ? 0 : parseFloat(formData.health_insurance.toString()),
      };

      if (editingTransaction) {
        await axios.put(`/api/transactions/${editingTransaction.id}`, data);
      } else {
        await axios.post('/api/transactions', data);
      }
      setShowModal(false);
      setEditingTransaction(null);
      resetForm();
      fetchTransactions();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setHoldingCostManuallyEdited(true); // 編輯模式下，假設用戶想要保留現有的持有成本值
    // 計算總金額：股價 × 數量 + 手續費
    const totalAmount = transaction.price * transaction.quantity + transaction.fee;
    setFormData({
      securities_account_id: transaction.securities_account_id?.toString() || '',
      trade_date: transaction.trade_date,
      settlement_date: transaction.settlement_date || format(new Date(new Date(transaction.trade_date).getTime() + 2 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      transaction_type: transaction.transaction_type,
      stock_code: transaction.stock_code,
      stock_name: transaction.stock_name,
      quantity: transaction.quantity,
      price: transaction.price,
      fee: transaction.fee,
      total_amount: totalAmount,
      transaction_amount: transaction.transaction_amount,
      tax: transaction.tax,
      securities_tax: transaction.securities_tax,
      financing_amount: transaction.financing_amount,
      margin: transaction.margin,
      interest: transaction.interest,
      borrowing_fee: transaction.borrowing_fee,
      net_amount: transaction.net_amount,
      profit_loss: transaction.profit_loss,
      return_rate: transaction.return_rate,
      holding_cost: transaction.holding_cost,
      health_insurance: transaction.health_insurance,
      currency: transaction.currency,
      buy_reason: transaction.buy_reason || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/transactions/${id}`);
      setDeleteConfirm(null);
      fetchTransactions();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
  };

  const resetForm = () => {
    const today = new Date();
    const settlementDate = calculateSettlementDate(today);
    setHoldingCostManuallyEdited(false); // 重置時恢復自動計算
    setFormData({
      securities_account_id: '',
      trade_date: format(today, 'yyyy-MM-dd'),
      settlement_date: format(settlementDate, 'yyyy-MM-dd'),
      transaction_type: '普通買進',
      stock_code: '',
      stock_name: '',
      quantity: '' as number | '',
      price: '' as number | '',
      fee: '' as number | '',
      total_amount: '' as number | '',
      transaction_amount: '' as number | '',
      tax: '' as number | '',
      securities_tax: '' as number | '',
      financing_amount: '' as number | '',
      margin: '' as number | '',
      interest: '' as number | '',
      borrowing_fee: '' as number | '',
      net_amount: '' as number | '',
      profit_loss: '' as number | '',
      return_rate: '' as number | '',
      holding_cost: '' as number | '',
      health_insurance: '' as number | '',
      currency: 'TWD',
      buy_reason: '',
    });
  };

  const handleModalMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, select, textarea, button')) {
      return;
    }
    setDragging(true);
    setDragStart({
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y,
    });
  };

  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setModalPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleModalMouseUp = () => {
    setDragging(false);
  };

  // 排序處理函數
  const handleSort = (field: string) => {
    if (sortField === field) {
      // 如果點擊同一個欄位，切換排序方向
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 如果點擊不同的欄位，設置新的排序欄位和方向（默認降序）
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 排序後的交易記錄
  const sortedTransactions = [...transactions].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any;
    let bValue: any;

    // 處理 account_name 組合欄位
    if (sortField === 'account_name') {
      aValue = a.account_name ? `${a.account_name} - ${a.broker_name || ''}` : '';
      bValue = b.account_name ? `${b.account_name} - ${b.broker_name || ''}` : '';
    } else {
      aValue = a[sortField as keyof Transaction];
      bValue = b[sortField as keyof Transaction];
    }

    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    let primarySortResult = 0;

    // 處理日期字符串排序（YYYY-MM-DD格式）
    if (sortField === 'trade_date' || sortField === 'settlement_date') {
      if (sortDirection === 'asc') {
        primarySortResult = String(aValue).localeCompare(String(bValue));
      } else {
        primarySortResult = String(bValue).localeCompare(String(aValue));
      }
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      // 數字類型排序
      primarySortResult = sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      // 字符串類型排序
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (sortDirection === 'asc') {
        primarySortResult = aStr.localeCompare(bStr, 'zh-TW');
      } else {
        primarySortResult = bStr.localeCompare(aStr, 'zh-TW');
      }
    }

    // 如果主排序結果相同，使用成交日期作為次要排序（降序，較晚日期在前）
    if (primarySortResult === 0 && sortField !== 'trade_date') {
      const aDate = a.trade_date || '';
      const bDate = b.trade_date || '';
      return String(bDate).localeCompare(String(aDate)); // 降序
    }

    return primarySortResult;
  });

  // 計算統計數據（基於所有符合篩選條件的交易）
  const statistics = (() => {
    let buyAmount = 0;
    let buyQuantity = 0;
    let sellAmount = 0;
    let sellQuantity = 0;
    let totalFee = 0;
    let totalTax = 0;
    let totalNetAmount = 0;
    let totalProfitLoss = 0;

    sortedTransactions.forEach(t => {
      const isBuy = t.transaction_type.includes('買進') || t.transaction_type.includes('買入') || t.transaction_type.includes('買');
      const isSell = t.transaction_type.includes('賣出') || t.transaction_type.includes('賣');
      
      if (isBuy) {
        buyAmount += t.transaction_amount || 0;
        buyQuantity += t.quantity || 0;
      } else if (isSell) {
        sellAmount += t.transaction_amount || 0;
        sellQuantity += t.quantity || 0;
      }
      
      totalFee += t.fee || 0;
      totalTax += t.tax || 0;
      totalNetAmount += t.net_amount || 0;
      totalProfitLoss += t.profit_loss || 0;
    });

    const difference = buyAmount - sellAmount;
    const quantityDiff = buyQuantity - sellQuantity;
    const buyAvgPrice = buyQuantity > 0 ? buyAmount / buyQuantity : 0;
    const sellAvgPrice = sellQuantity > 0 ? sellAmount / sellQuantity : 0;

    return {
      buyAmount,
      buyQuantity,
      sellAmount,
      sellQuantity,
      difference,
      quantityDiff,
      totalNetAmount,
      totalProfitLoss,
      buyAvgPrice,
      sellAvgPrice,
      totalFee,
      totalTax,
    };
  })();

  // 計算分頁
  const totalPages = Math.ceil(sortedTransactions.length / pageSize);
  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 導出Excel功能
  const exportToExcel = () => {
    // 準備Excel數據
    const excelData = sortedTransactions.map((transaction) => ({
      '證券帳戶': transaction.account_name ? `${transaction.account_name} - ${transaction.broker_name || ''}` : '-',
      '成交日期': transaction.trade_date ? format(new Date(transaction.trade_date), 'yyyy/MM/dd') : '',
      '交易類別': transaction.transaction_type,
      '股票代號': transaction.stock_code,
      '股票名稱': transaction.stock_name,
      '數量': transaction.quantity,
      '成交價': transaction.price,
      '手續費': transaction.fee,
      '成交金額': transaction.transaction_amount,
      '交易稅': transaction.tax,
      '證券交易稅': transaction.securities_tax,
      '融資金額': transaction.financing_amount,
      '保證金': transaction.margin,
      '利息': transaction.interest,
      '借券費': transaction.borrowing_fee,
      '淨收付': transaction.net_amount,
      '損益': transaction.profit_loss,
      '報酬率(%)': transaction.return_rate,
      '持有成本': transaction.holding_cost,
      '交割日期': transaction.settlement_date ? format(new Date(transaction.settlement_date), 'yyyy/MM/dd') : '',
      '健保補充保費': transaction.health_insurance,
      '幣別': transaction.currency || 'TWD',
    }));

    // 創建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 設置列寬
    const colWidths = [
      { wch: 25 }, // 證券帳戶
      { wch: 12 }, // 成交日期
      { wch: 12 }, // 交易類別
      { wch: 12 }, // 股票代號
      { wch: 20 }, // 股票名稱
      { wch: 10 }, // 數量
      { wch: 12 }, // 成交價
      { wch: 12 }, // 手續費
      { wch: 12 }, // 成交金額
      { wch: 12 }, // 交易稅
      { wch: 15 }, // 證券交易稅
      { wch: 12 }, // 融資金額
      { wch: 12 }, // 保證金
      { wch: 12 }, // 利息
      { wch: 12 }, // 借券費
      { wch: 12 }, // 淨收付
      { wch: 12 }, // 損益
      { wch: 12 }, // 報酬率
      { wch: 12 }, // 持有成本
      { wch: 12 }, // 交割日期
      { wch: 15 }, // 健保補充保費
      { wch: 10 }, // 幣別
    ];
    ws['!cols'] = colWidths;

    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(wb, ws, '交易記錄');

    // 生成文件名（包含日期範圍）
    const dateRange = filters.startDate && filters.endDate
      ? `${filters.startDate}_${filters.endDate}`
      : format(new Date(), 'yyyy-MM-dd');
    const fileName = `交易記錄_${dateRange}.xlsx`;

    // 下載文件
    XLSX.writeFile(wb, fileName);
  };

  if (loading && transactions.length === 0) {
    return <div className="text-center py-8">載入中...</div>;
  }

  return (
    <div className="py-6" style={{ fontSize: uiSettings.fontSize }}>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">交易記錄</h1>
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
                setShowModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              新增交易記錄
            </button>
          </div>
        </div>

        {/* 篩選條件 */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">股票代號</label>
            <input
              type="text"
              value={filters.stockCode}
              onChange={(e) => setFilters({ ...filters, stockCode: e.target.value })}
              placeholder="輸入股票代號"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
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
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* 交易記錄列表 */}
        {paginatedTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無交易記錄</div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full divide-y divide-gray-200" style={{ fontSize: uiSettings.fontSize }}>
                <thead className="bg-gray-50">
                  <tr>
                    {(() => {
                      // 可排序表頭組件
                      const SortableHeader = ({ field, label, align = 'left', minWidth }: { field: string; label: string; align?: 'left' | 'right'; minWidth?: string }) => {
                        const isActive = sortField === field;
                        return (
                          <th
                            className={`px-2 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none`}
                            style={{ minWidth: minWidth || 'auto' }}
                            onClick={() => handleSort(field)}
                          >
                            <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} space-x-1`}>
                              <span>{label}</span>
                              {isActive && (
                                <span className="text-gray-700">
                                  {sortDirection === 'asc' ? '↑' : '↓'}
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
                          <SortableHeader field="account_name" label="交易帳號" minWidth="120px" />
                          <SortableHeader field="trade_date" label="成交日期" minWidth="90px" />
                          <SortableHeader field="transaction_type" label="種類" minWidth="70px" />
                          <SortableHeader field="stock_code" label="代號" minWidth="70px" />
                          <SortableHeader field="stock_name" label="商品名稱" minWidth="100px" />
                          <SortableHeader field="quantity" label="數量" align="right" minWidth="60px" />
                          <SortableHeader field="price" label="成交價" align="right" minWidth="70px" />
                          <SortableHeader field="fee" label="手續費" align="right" minWidth="70px" />
                          <SortableHeader field="transaction_amount" label="成交價金" align="right" minWidth="80px" />
                          <SortableHeader field="tax" label="交易稅" align="right" minWidth="70px" />
                          <SortableHeader field="securities_tax" label="證所稅" align="right" minWidth="70px" />
                          <SortableHeader field="financing_amount" label="融資券擔" align="right" minWidth="80px" />
                          <SortableHeader field="margin" label="自備保證" align="right" minWidth="80px" />
                          <SortableHeader field="interest" label="利息" align="right" minWidth="60px" />
                          <SortableHeader field="borrowing_fee" label="借券費" align="right" minWidth="70px" />
                          <SortableHeader field="net_amount" label="客戶淨收付" align="right" minWidth="90px" />
                          <SortableHeader field="profit_loss" label="損益" align="right" minWidth="70px" />
                          <SortableHeader field="return_rate" label="報酬率(%)" align="right" minWidth="80px" />
                          <SortableHeader field="holding_cost" label="持有成本" align="right" minWidth="80px" />
                          <SortableHeader field="settlement_date" label="交割日期" minWidth="90px" />
                          <SortableHeader field="health_insurance" label="二代健保" align="right" minWidth="80px" />
                          <SortableHeader field="currency" label="幣別" minWidth="60px" />
                          <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 whitespace-nowrap" style={{ minWidth: '80px' }}>操作</th>
                        </>
                      );
                    })()}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTransactions.map((transaction) => (
                    <tr 
                      key={transaction.id} 
                      onClick={() => setSelectedTransactionId(transaction.id)}
                      className={`cursor-pointer ${
                        selectedTransactionId === transaction.id 
                          ? 'bg-blue-300' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.account_name ? `${transaction.account_name} - ${transaction.broker_name}` : '-'}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(transaction.trade_date), 'yyyy/MM/dd')}
                      </td>
                      <td className={`px-2 py-4 whitespace-nowrap text-sm font-medium ${
                        transaction.transaction_type.includes('賣出') || transaction.transaction_type.includes('賣') 
                          ? 'text-green-600' 
                          : transaction.transaction_type.includes('買進') || transaction.transaction_type.includes('買入') || transaction.transaction_type.includes('買')
                          ? 'text-red-600'
                          : 'text-gray-900'
                      }`}>
                        {transaction.transaction_type}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {transaction.stock_code}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                        {transaction.stock_name}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.quantity}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${transaction.price.toFixed(2)}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.fee, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${transaction.transaction_amount.toFixed(2)}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.tax, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.securities_tax, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.financing_amount, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.margin, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.interest, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.borrowing_fee, 2, '$')}
                      </td>
                      <td className={`px-2 py-4 whitespace-nowrap text-sm font-medium ${
                        (transaction.net_amount || 0) < 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatNumber(transaction.net_amount, 2, '$')}
                      </td>
                      <td className={`px-2 py-4 whitespace-nowrap text-sm font-medium ${
                        (transaction.profit_loss || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatNumber(transaction.profit_loss, 2, '$')}
                      </td>
                      <td className={`px-2 py-4 whitespace-nowrap text-sm font-medium ${
                        (transaction.return_rate || 0) >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatPercentage(transaction.return_rate, 2)}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.holding_cost, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.settlement_date ? format(new Date(transaction.settlement_date), 'yyyy/MM/dd') : '-'}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(transaction.health_insurance, 2, '$')}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.currency || 'TWD'}
                      </td>
                      <td className="px-2 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* 小計行 */}
                  {sortedTransactions.length > 0 && (() => {
                    const totals = sortedTransactions.reduce((acc, t) => ({
                      quantity: acc.quantity + (t.quantity || 0),
                      fee: acc.fee + (t.fee || 0),
                      transaction_amount: acc.transaction_amount + (t.transaction_amount || 0),
                      tax: acc.tax + (t.tax || 0),
                      securities_tax: acc.securities_tax + (t.securities_tax || 0),
                      financing_amount: acc.financing_amount + (t.financing_amount || 0),
                      margin: acc.margin + (t.margin || 0),
                      interest: acc.interest + (t.interest || 0),
                      borrowing_fee: acc.borrowing_fee + (t.borrowing_fee || 0),
                      net_amount: acc.net_amount + (t.net_amount || 0),
                      profit_loss: acc.profit_loss + (t.profit_loss || 0),
                      holding_cost: acc.holding_cost + (t.holding_cost || 0),
                      health_insurance: acc.health_insurance + (t.health_insurance || 0),
                    }), {
                      quantity: 0,
                      fee: 0,
                      transaction_amount: 0,
                      tax: 0,
                      securities_tax: 0,
                      financing_amount: 0,
                      margin: 0,
                      interest: 0,
                      borrowing_fee: 0,
                      net_amount: 0,
                      profit_loss: 0,
                      holding_cost: 0,
                      health_insurance: 0,
                    });
                    
                    // 計算總報酬率
                    const totalReturnRate = totals.holding_cost > 0 
                      ? (totals.profit_loss / totals.holding_cost) * 100 
                      : 0;
                    
                    const formatTotalNumber = (value: number): string => {
                      if (value === 0) return '';
                      return value.toFixed(2);
                    };
                    
                    const formatTotalInt = (value: number): string => {
                      if (value === 0) return '';
                      return value.toString();
                    };
                    
                    return (
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 font-bold" colSpan={5}>小計</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalInt(totals.quantity)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right">-</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.fee)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.transaction_amount)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.tax)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.securities_tax)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.financing_amount)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.margin)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.interest)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.borrowing_fee)}</td>
                        <td className={`px-2 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          totals.net_amount >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>{formatTotalNumber(totals.net_amount)}</td>
                        <td className={`px-2 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          totals.profit_loss >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>{formatTotalNumber(totals.profit_loss)}</td>
                        <td className={`px-2 py-4 whitespace-nowrap text-sm text-right font-bold ${
                          totalReturnRate >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>{formatTotalNumber(totalReturnRate)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.holding_cost)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">{formatTotalNumber(totals.health_insurance)}</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                        <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
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
                  共 {transactions.length} 筆，第 {currentPage} / {totalPages} 頁
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

            {/* 統計資訊 */}
            <div className="mt-6 bg-gray-50 rounded-lg p-2 border border-gray-200">
              <table className="min-w-full border-collapse text-xs">
                <tbody>
                  {/* 第一行（金額類數據） */}
                  <tr>
                    <td rowSpan={2} className="px-2 py-1 text-center font-semibold text-gray-900 border border-gray-300 bg-white align-middle">台幣</td>
                    <td rowSpan={2} className="px-2 py-1 text-center font-semibold text-gray-900 border border-gray-300 bg-white align-middle">總計</td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-white">
                      <span className="text-gray-600">買入金額：</span>
                      <span className={`ml-1 ${
                        statistics.buyAmount >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.buyAmount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-white">
                      <span className="text-gray-600">賣出金額：</span>
                      <span className={`ml-1 ${
                        statistics.sellAmount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>{statistics.sellAmount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-white">
                      <span className="text-gray-600">差額：</span>
                      <span className={`ml-1 ${
                        statistics.difference >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.difference.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-white">
                      <span className="text-gray-600">淨收付差：</span>
                      <span className={`ml-1 ${
                        statistics.totalNetAmount >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.totalNetAmount.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-white">
                      <span className="text-gray-600">買/賣均價：</span>
                      <span className="ml-1">{statistics.buyAvgPrice > 0 ? statistics.buyAvgPrice.toFixed(2) : '--'} / {statistics.sellAvgPrice > 0 ? statistics.sellAvgPrice.toFixed(2) : '--'}</span>
                    </td>
                  </tr>
                  {/* 第二行（數量類數據） */}
                  <tr>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-blue-50">
                      <span className="text-gray-600">買入股數：</span>
                      <span className={`ml-1 ${
                        statistics.buyQuantity >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.buyQuantity.toLocaleString('zh-TW')}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-blue-50">
                      <span className="text-gray-600">賣出股數：</span>
                      <span className={`ml-1 ${
                        statistics.sellQuantity >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>{statistics.sellQuantity.toLocaleString('zh-TW')}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-blue-50">
                      <span className="text-gray-600">差股：</span>
                      <span className={`ml-1 ${
                        statistics.quantityDiff >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.quantityDiff.toLocaleString('zh-TW')}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-blue-50">
                      <span className="text-gray-600">損益：</span>
                      <span className={`ml-1 ${
                        statistics.totalProfitLoss >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>{statistics.totalProfitLoss.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                    <td className="px-2 py-1 text-left font-semibold text-gray-900 border border-gray-300 bg-blue-50">
                      <span className="text-gray-600">手續費/交易稅：</span>
                      <span className="ml-1">{statistics.totalFee.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {statistics.totalTax.toLocaleString('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
              className="relative mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white"
              style={{
                marginTop: `${Math.max(20, modalPosition.y)}px`,
                marginLeft: `${modalPosition.x}px`,
                transform: 'translateX(-50%)',
              }}
              onMouseDown={handleModalMouseDown}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-4 cursor-move">
                {editingTransaction ? '編輯交易記錄' : '新增交易記錄'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-2 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  <div className="-mr-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">交易帳號</label>
                    <select
                      value={formData.securities_account_id}
                      onChange={(e) => setFormData({ ...formData, securities_account_id: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    >
                      <option value="">請選擇</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_name} - {account.broker_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="-mx-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">成交日期 *</label>
                    <input
                      type="date"
                      required
                      value={formData.trade_date}
                      onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div className="-ml-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">種類 *</label>
                    <select
                      value={formData.transaction_type}
                      onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    >
                      {TRANSACTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">代號 *</label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={formData.stock_code}
                        onChange={(e) => setFormData({ ...formData, stock_code: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                        placeholder="輸入股票代號，系統會從本地股票資料帶出名稱"
                      />
                      {stockSearchLoading && (
                        <div className="absolute right-2 top-2 text-xs text-gray-400">搜尋中...</div>
                      )}
                      {stockSearchResults.length > 0 && (
                        <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto text-sm" style={{ width: 'calc(50% + 2cm)' }}>
                          {stockSearchResults.map((item) => (
                            <button
                              key={item.stock_code}
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  stock_code: item.stock_code,
                                  stock_name: item.stock_name,
                                });
                                setStockSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50"
                            >
                              <span className="font-mono mr-2">{item.stock_code}</span>
                              <span>{item.stock_name}</span>
                              {item.market_type && (
                                <span className="ml-2 text-xs text-gray-500">({item.market_type})</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">商品名稱 *</label>
                    <input
                      type="text"
                      required
                      value={formData.stock_name}
                      onChange={(e) => setFormData({ ...formData, stock_name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                      placeholder="輸入股票名稱"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">數量 *</label>
                    <input
                      type="number"
                      required
                      value={formData.quantity === '' ? '' : formData.quantity}
                      onChange={(e) => handleNumberChange('quantity', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">成交價 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price === '' ? '' : formData.price}
                      onChange={(e) => handleNumberChange('price', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">手續費</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.fee === '' ? '' : formData.fee}
                      onChange={(e) => handleNumberChange('fee', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                    <p className="mt-1 text-xs text-gray-500">留空將自動計算</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">成交價金</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.transaction_amount === '' ? '' : (typeof formData.transaction_amount === 'number' ? formData.transaction_amount.toFixed(2) : '')}
                      readOnly
                      className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                      style={{ width: 'calc(50% + 2cm)', cursor: 'not-allowed' }}
                    />
                    <p className="mt-1 text-xs text-gray-500">自動計算：數量 × 成交價</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">交易稅</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tax === '' ? '' : formData.tax}
                      onChange={(e) => handleNumberChange('tax', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">證所稅</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.securities_tax === '' ? '' : formData.securities_tax}
                      onChange={(e) => handleNumberChange('securities_tax', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">融資金額/券擔保品</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.financing_amount === '' ? '' : formData.financing_amount}
                      onChange={(e) => handleNumberChange('financing_amount', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">資自備款/券保證金</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.margin === '' ? '' : formData.margin}
                      onChange={(e) => handleNumberChange('margin', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">利息</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.interest === '' ? '' : formData.interest}
                      onChange={(e) => handleNumberChange('interest', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">借券費</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.borrowing_fee === '' ? '' : formData.borrowing_fee}
                      onChange={(e) => handleNumberChange('borrowing_fee', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">客戶淨收付 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.net_amount === '' ? '' : formData.net_amount}
                      onChange={(e) => handleNumberChange('net_amount', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">損益</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.profit_loss === '' ? '' : formData.profit_loss}
                      onChange={(e) => handleNumberChange('profit_loss', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">報酬率(%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.return_rate === '' ? '' : formData.return_rate}
                      onChange={(e) => handleNumberChange('return_rate', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">持有成本</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.holding_cost === '' ? '' : (typeof formData.holding_cost === 'number' ? formData.holding_cost.toFixed(2) : '')}
                      onChange={(e) => {
                        setHoldingCostManuallyEdited(true);
                        handleNumberChange('holding_cost', e.target.value);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                    <p className="mt-1 text-xs text-gray-500">可手動輸入，或自動計算：數量 × 成交價 + 手續費</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">交割日期</label>
                    <input
                      type="date"
                      value={formData.settlement_date}
                      onChange={(e) => setFormData({ ...formData, settlement_date: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                    {!editingTransaction && (
                      <p className="mt-1 text-xs text-gray-500">自動計算：成交日期 + 2 個交易日 (T+2，跳過週末和國定假日)</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">二代健保</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.health_insurance === '' ? '' : formData.health_insurance}
                      onChange={(e) => handleNumberChange('health_insurance', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">幣別</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                    >
                      <option value="TWD">台幣</option>
                      <option value="USD">美元</option>
                      <option value="CNY">人民幣</option>
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">買入原因</label>
                    <textarea
                      value={formData.buy_reason}
                      onChange={(e) => setFormData({ ...formData, buy_reason: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-md"
                      style={{ width: 'calc(50% + 2cm)' }}
                      rows={1}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTransaction(null);
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
              <p className="mb-4">確定要刪除此交易記錄嗎？此操作無法復原。</p>
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

export default Transactions;


