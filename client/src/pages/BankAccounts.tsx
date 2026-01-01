import { useState, useEffect } from 'react';
import axios from 'axios';
import { format, addDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths, subYears } from 'date-fns';
import * as XLSX from 'xlsx';

interface SecuritiesAccount {
  id: number;
  account_name: string;
  broker_name: string;
}

interface BankAccount {
  id: number;
  securities_account_id?: number;
  securities_account_name?: string;
  broker_name?: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
}

interface BankTransaction {
  id: number;
  bank_account_id: number;
  bank_name?: string;
  account_number?: string;
  account_type?: string;
  transaction_date: string;
  description?: string;
  deposit_amount: number;
  withdrawal_amount: number;
}

const ACCOUNT_TYPES = ['儲蓄帳戶', '支票帳戶', '投資帳戶', '信用卡帳戶', '其他帳戶'];

const BankAccounts = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [securitiesAccounts, setSecuritiesAccounts] = useState<SecuritiesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // 銀行明細相關狀態
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
  const [deleteTransactionConfirm, setDeleteTransactionConfirm] = useState<number | null>(null);
  const [transactionCurrentPage, setTransactionCurrentPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(10);
  const [transactionFilters, setTransactionFilters] = useState({
    bankAccountId: '',
    startDate: '',
    endDate: '',
    quickRange: '',
  });
  const [expandedTransactionId, setExpandedTransactionId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    securities_account_id: '',
    bank_name: '',
    account_number: '',
    account_type: '儲蓄帳戶',
    balance: '' as number | '',
    currency: 'TWD',
  });

  const [transactionFormData, setTransactionFormData] = useState({
    bank_account_id: '',
    transaction_date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: '' as number | '', // 合併存入/支出：正數為存入，負數為支出
  });

  // 銀行明細查詢區間快捷選擇
  const handleTransactionDateRangeChange = (range: string) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (range) {
      case 'today': {
        const d = format(today, 'yyyy-MM-dd');
        startDate = d;
        endDate = d;
        break;
      }
      case 'last3days': {
        const start = addDays(today, -2);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      }
      case 'thisMonth': {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');
        break;
      }
      case 'thisQuarter': {
        const start = startOfQuarter(today);
        const end = endOfQuarter(today);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');
        break;
      }
      case 'lastHalfYear': {
        const start = subMonths(today, 6);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      }
      case 'lastYear': {
        const start = subYears(today, 1);
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      }
      default: {
        startDate = transactionFilters.startDate;
        endDate = transactionFilters.endDate;
      }
    }

    setTransactionFilters((prev) => ({
      ...prev,
      quickRange: range,
      startDate,
      endDate,
    }));
  };

  useEffect(() => {
    fetchSecuritiesAccounts();
    fetchAccounts();
    fetchBankTransactions();
  }, [currentPage, pageSize, transactionCurrentPage, transactionPageSize, transactionFilters]);

  const fetchSecuritiesAccounts = async () => {
    try {
      const response = await axios.get('/api/securities-accounts');
      setSecuritiesAccounts(response.data.data);
    } catch (err: any) {
      console.error('獲取證券帳戶失敗:', err);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/bank-accounts');
      setAccounts(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取銀行帳戶失敗');
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
        securities_account_id: formData.securities_account_id || null,
        balance: formData.balance === '' ? 0 : parseFloat(formData.balance.toString()),
      };

      if (editingAccount) {
        await axios.put(`/api/bank-accounts/${editingAccount.id}`, data);
      } else {
        await axios.post('/api/bank-accounts', data);
      }
      setShowModal(false);
      setEditingAccount(null);
      resetForm();
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      securities_account_id: account.securities_account_id?.toString() || '',
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_type: account.account_type,
      balance: account.balance,
      currency: account.currency,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/bank-accounts/${id}`);
      setDeleteConfirm(null);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
  };

  const resetForm = () => {
    setFormData({
      securities_account_id: '',
      bank_name: '',
      account_number: '',
      account_type: '儲蓄帳戶',
      balance: '' as number | '',
      currency: 'TWD',
    });
  };

  // 銀行明細相關函數
  const fetchBankTransactions = async () => {
    try {
      const params: any = {};
      if (transactionFilters.bankAccountId) {
        params.bankAccountId = transactionFilters.bankAccountId;
      }
      if (transactionFilters.startDate) {
        params.startDate = transactionFilters.startDate;
      }
      if (transactionFilters.endDate) {
        params.endDate = transactionFilters.endDate;
      }

      const response = await axios.get('/api/bank-transactions', { params });
      setBankTransactions(response.data.data || []);
    } catch (err: any) {
      console.error('獲取銀行明細失敗:', err);
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const amount = transactionFormData.amount === '' ? 0 : parseFloat(transactionFormData.amount.toString());
      const data = {
        bank_account_id: transactionFormData.bank_account_id,
        transaction_date: transactionFormData.transaction_date,
        description: transactionFormData.description,
        deposit_amount: amount > 0 ? amount : 0,
        withdrawal_amount: amount < 0 ? Math.abs(amount) : 0,
      };

      if (editingTransaction) {
        await axios.put(`/api/bank-transactions/${editingTransaction.id}`, data);
      } else {
        await axios.post('/api/bank-transactions', data);
      }
      setShowTransactionModal(false);
      setEditingTransaction(null);
      resetTransactionForm();
      fetchBankTransactions();
      fetchAccounts(); // 刷新銀行帳戶列表以獲取最新餘額
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleTransactionEdit = (transaction: BankTransaction) => {
    setEditingTransaction(transaction);
    // 將存入/支出轉換為單一值：存入為正數，支出為負數
    const amount = transaction.deposit_amount > 0 
      ? transaction.deposit_amount 
      : (transaction.withdrawal_amount > 0 ? -transaction.withdrawal_amount : '');
    setTransactionFormData({
      bank_account_id: transaction.bank_account_id.toString(),
      transaction_date: transaction.transaction_date,
      description: transaction.description || '',
      amount: amount as number | '',
    });
    setShowTransactionModal(true);
  };

  const handleTransactionDelete = async (id: number) => {
    try {
      await axios.delete(`/api/bank-transactions/${id}`);
      setDeleteTransactionConfirm(null);
      fetchBankTransactions();
      fetchAccounts(); // 刷新銀行帳戶列表以獲取最新餘額
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
  };

  const resetTransactionForm = () => {
    setTransactionFormData({
      bank_account_id: '',
      transaction_date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: '' as number | '',
    });
  };

  // 導出Excel功能
  const exportTransactionsToExcel = () => {
    const excelData = bankTransactions.map((transaction) => ({
      '帳號': transaction.account_number || '-',
      '帳戶名稱': transaction.bank_name ? `${transaction.bank_name} - ${transaction.account_type || ''}` : '-',
      '帳務日期': transaction.transaction_date ? format(new Date(transaction.transaction_date), 'yyyy/MM/dd') : '',
      '摘要': transaction.description || '-',
      '存入': transaction.deposit_amount || 0,
      '支出': transaction.withdrawal_amount || 0,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    const colWidths = [
      { wch: 20 }, // 帳號
      { wch: 25 }, // 帳戶名稱
      { wch: 12 }, // 帳務日期
      { wch: 30 }, // 摘要
      { wch: 12 }, // 存入
      { wch: 12 }, // 支出
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, '銀行明細');

    const dateRange = transactionFilters.startDate && transactionFilters.endDate
      ? `${transactionFilters.startDate}_${transactionFilters.endDate}`
      : format(new Date(), 'yyyy-MM-dd');
    const fileName = `銀行明細_${dateRange}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const totalPages = Math.ceil(accounts.length / pageSize);
  const paginatedAccounts = accounts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const transactionTotalPages = Math.ceil(bankTransactions.length / transactionPageSize);
  const paginatedTransactions = bankTransactions.slice(
    (transactionCurrentPage - 1) * transactionPageSize,
    transactionCurrentPage * transactionPageSize
  );

  // 銀行明細總存入 / 總支出（依目前篩選結果計算）
  const totalDeposit = bankTransactions.reduce(
    (sum, t) => sum + (t.deposit_amount || 0),
    0
  );
  const totalWithdrawal = bankTransactions.reduce(
    (sum, t) => sum + (t.withdrawal_amount || 0),
    0
  );

  const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
  const [selectedBankTransactionId, setSelectedBankTransactionId] = useState<number | null>(null);

  if (loading && accounts.length === 0) {
    return <div className="text-center py-8">載入中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">銀行帳戶管理</h1>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            新增銀行帳戶
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {paginatedAccounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">尚無銀行帳戶，請點擊「新增銀行帳戶」按鈕新增</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">證券帳戶名稱</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">銀行名稱</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">證券帳號</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳戶類型</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">銀行餘額</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">幣別</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedAccounts.map((account) => {
                    const isSelected = selectedBankAccountId === account.id;
                    return (
                    <tr
                      key={account.id}
                      onClick={() => setSelectedBankAccountId(account.id)}
                      className={`cursor-pointer ${
                        isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.securities_account_name ? `${account.securities_account_name} - ${account.broker_name}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.bank_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.account_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.account_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${account.balance.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {account.currency}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(account)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                        >
                          編輯
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(account.id)}
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

            {/* 總存入 / 總支出 */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-sm">
                <span className="font-medium text-gray-700 mr-2">總存入：</span>
                <span className="text-gray-900">${totalDeposit.toFixed(2)}</span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md px-4 py-3 text-sm">
                <span className="font-medium text-gray-700 mr-2">總支出：</span>
                <span className="text-green-700">${totalWithdrawal.toFixed(2)}</span>
              </div>
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
                  共 {accounts.length} 筆，第 {currentPage} / {totalPages} 頁
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

        {/* 銀行明細區域 */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">銀行明細</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={exportTransactionsToExcel}
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
                  resetTransactionForm();
                  setShowTransactionModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                新增銀行明細
              </button>
            </div>
          </div>

          {/* 銀行明細篩選 */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">銀行帳戶</label>
              <select
                value={transactionFilters.bankAccountId}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, bankAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">全部</option>
                {accounts.map((account) => (
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
                value={transactionFilters.startDate}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
              <input
                type="date"
                value={transactionFilters.endDate}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">查詢區間</label>
              <select
                value={transactionFilters.quickRange}
                onChange={(e) => handleTransactionDateRangeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">全部</option>
                <option value="today">今日</option>
                <option value="last3days">近三日</option>
                <option value="thisMonth">本月</option>
                <option value="thisQuarter">本季</option>
                <option value="lastHalfYear">近半年</option>
                <option value="lastYear">近一年</option>
              </select>
            </div>
          </div>

          {/* 銀行明細列表 */}
          {paginatedTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">尚無銀行明細，請點擊「新增銀行明細」按鈕新增</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳號</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳戶名稱</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">帳務日期</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">摘要</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">存入/支出</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedTransactions.map((transaction) => {
                      const account = accounts.find(acc => acc.id === transaction.bank_account_id);
                      const isExpanded = expandedTransactionId === transaction.id;
                      const isSelected = selectedBankTransactionId === transaction.id;
                      return (
                        <>
                          <tr
                            key={transaction.id}
                            onClick={() => setSelectedBankTransactionId(transaction.id)}
                            className={`cursor-pointer ${
                              isSelected ? 'bg-blue-300' : 'hover:bg-gray-50'
                            }`}
                          >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.account_number || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.bank_name ? `${transaction.bank_name} - ${transaction.account_type || ''}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {transaction.transaction_date ? format(new Date(transaction.transaction_date), 'yyyy/MM/dd') : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {transaction.deposit_amount > 0 ? (
                            <span className="text-gray-900">${transaction.deposit_amount.toFixed(2)}</span>
                          ) : transaction.withdrawal_amount > 0 ? (
                            <span className="text-green-600">${transaction.withdrawal_amount.toFixed(2)}</span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setExpandedTransactionId(expandedTransactionId === transaction.id ? null : transaction.id)}
                            className="text-gray-500 hover:text-gray-700 text-lg"
                            title={expandedTransactionId === transaction.id ? '收起' : '展開'}
                          >
                            {expandedTransactionId === transaction.id ? '▲' : '﹀'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleTransactionEdit(transaction)}
                            className="text-blue-600 hover:text-blue-900 mr-4"
                          >
                            編輯
                          </button>
                          <button
                            onClick={() => setDeleteTransactionConfirm(transaction.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            刪除
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${transaction.id}-detail`} className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-3 text-sm">
                            <div className="space-y-1">
                              <div className="text-gray-700">
                                <span className="font-medium">幣別：</span>
                                <span>{account?.currency || 'TWD'}</span>
                              </div>
                              <div className="text-gray-700">
                                <span className="font-medium">帳戶餘額：</span>
                                <span>{account ? `$${account.balance.toFixed(2)}` : '-'}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 銀行明細分頁 */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">每頁顯示：</span>
                  <select
                    value={transactionPageSize}
                    onChange={(e) => {
                      setTransactionPageSize(Number(e.target.value));
                      setTransactionCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-700">
                    共 {bankTransactions.length} 筆，第 {transactionCurrentPage} / {transactionTotalPages} 頁
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setTransactionCurrentPage(Math.max(1, transactionCurrentPage - 1))}
                    disabled={transactionCurrentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    上一頁
                  </button>
                  {Array.from({ length: transactionTotalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setTransactionCurrentPage(page)}
                      className={`px-3 py-1 border rounded-md text-sm ${
                        transactionCurrentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setTransactionCurrentPage(Math.min(transactionTotalPages, transactionCurrentPage + 1))}
                    disabled={transactionCurrentPage === transactionTotalPages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                  >
                    下一頁
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* 新增/編輯銀行明細模態框 */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {editingTransaction ? '編輯銀行明細' : '新增銀行明細'}
              </h3>
              <form onSubmit={handleTransactionSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">銀行帳戶 *</label>
                    <select
                      value={transactionFormData.bank_account_id}
                      onChange={(e) => setTransactionFormData({ ...transactionFormData, bank_account_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">請選擇</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.bank_name} - {account.account_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">帳務日期 *</label>
                    <input
                      type="date"
                      required
                      value={transactionFormData.transaction_date}
                      onChange={(e) => setTransactionFormData({ ...transactionFormData, transaction_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
                    <input
                      type="text"
                      value={transactionFormData.description}
                      onChange={(e) => setTransactionFormData({ ...transactionFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="請輸入摘要"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">存入/支出 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={transactionFormData.amount === '' ? '' : transactionFormData.amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTransactionFormData({ ...transactionFormData, amount: val === '' ? '' as number | '' : (parseFloat(val) || '' as number | '') });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="正數為存入，負數為支出（例：1000 或 -500）"
                    />
                    <p className="mt-1 text-xs text-gray-500">提示：輸入正數表示存入，輸入負數表示支出</p>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransactionModal(false);
                      setEditingTransaction(null);
                      resetTransactionForm();
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

        {/* 新增/編輯模態框 */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {editingAccount ? '編輯銀行帳戶' : '新增銀行帳戶'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">證券帳戶名稱（選填）</label>
                    <select
                      value={formData.securities_account_id}
                      onChange={(e) => setFormData({ ...formData, securities_account_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">請選擇</option>
                      {securitiesAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.account_name} - {account.broker_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">銀行名稱 *</label>
                    <input
                      type="text"
                      required
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="請輸入銀行名稱"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">證券帳號 *</label>
                    <input
                      type="text"
                      required
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="請輸入證券帳號"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">帳戶類型 *</label>
                    <select
                      value={formData.account_type}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">銀行餘額 *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.balance === '' ? '' : formData.balance}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setFormData({ ...formData, balance: '' as number | '' });
                        } else {
                          const numVal = parseFloat(val);
                          setFormData({ ...formData, balance: isNaN(numVal) ? '' as number | '' : numVal });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="例：10000"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      注意事項：新增銀行帳戶的銀行為交割帳戶扣款用交割銀行帳戶。
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">幣別 *</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="TWD">台幣</option>
                      <option value="USD">美元</option>
                      <option value="CNY">人民幣</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingAccount(null);
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
              <p className="mb-4">確定要刪除此銀行帳戶嗎？此操作無法復原。</p>
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

        {/* 刪除銀行明細確認模態框 */}
        {deleteTransactionConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">確認刪除</h3>
              <p className="mb-4">確定要刪除此銀行明細嗎？此操作無法復原。</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setDeleteTransactionConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  取消
                </button>
                <button
                  onClick={() => handleTransactionDelete(deleteTransactionConfirm)}
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

export default BankAccounts;


