import { useState, useEffect } from 'react';
import axios from 'axios';

interface SecuritiesAccount {
  id: number;
  account_name: string;
  broker_name: string;
  account_number: string;
  created_at: string;
}

const SecuritiesAccount = () => {
  const [accounts, setAccounts] = useState<SecuritiesAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SecuritiesAccount | null>(null);
  const [formData, setFormData] = useState({
    account_name: '',
    broker_name: '',
    account_number: '',
  });
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await axios.get('/api/securities-accounts');
      setAccounts(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取證券帳戶失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingAccount) {
        await axios.put(`/api/securities-accounts/${editingAccount.id}`, formData);
      } else {
        await axios.post('/api/securities-accounts', formData);
      }
      setShowModal(false);
      setEditingAccount(null);
      setFormData({ account_name: '', broker_name: '', account_number: '' });
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失敗');
    }
  };

  const handleEdit = (account: SecuritiesAccount) => {
    setEditingAccount(account);
    setFormData({
      account_name: account.account_name,
      broker_name: account.broker_name,
      account_number: account.account_number,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/securities-accounts/${id}`);
      setDeleteConfirm(null);
      fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除失敗');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({ account_name: '', broker_name: '', account_number: '' });
    setError('');
  };

  if (loading) {
    return <div className="text-center py-8">載入中...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">證券帳戶管理</h1>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            新增證券帳戶
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            尚無證券帳戶，請點擊「新增證券帳戶」按鈕新增
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    帳戶名稱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    券商名稱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    帳戶號碼
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.account_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.broker_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.account_number}
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 新增/編輯模態框 */}
        {showModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {editingAccount ? '編輯證券帳戶' : '新增證券帳戶'}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    帳戶名稱 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.account_name}
                    onChange={(e) =>
                      setFormData({ ...formData, account_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="請輸入帳戶名稱"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    券商名稱 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.broker_name}
                    onChange={(e) =>
                      setFormData({ ...formData, broker_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="請輸入券商名稱"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    帳戶號碼 *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.account_number}
                    onChange={(e) =>
                      setFormData({ ...formData, account_number: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="請輸入帳戶號碼"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={handleCancel}
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
              <p className="mb-4">確定要刪除此證券帳戶嗎？此操作無法復原。</p>
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

      {/* 右下角錯誤懸浮視窗 */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <div className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-start space-x-3">
            <span className="mt-0.5">⚠</span>
            <div className="flex-1 text-sm">{error}</div>
            <button
              type="button"
              onClick={() => setError('')}
              className="ml-2 text-white/80 hover:text-white text-sm"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecuritiesAccount;


