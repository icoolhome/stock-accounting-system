import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  last_login_at: string | null;
  created_at: string;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  todayNewUsers: number;
}

interface Admin {
  id: number;
  email: string;
  role: string;
  created_at: string;
}

interface SystemLog {
  id: number;
  log_type: string;
  log_level: string;
  message: string;
  details: string | null;
  created_at: string;
}

const Admin = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 用戶管理
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ totalUsers: 0, activeUsers: 0, todayNewUsers: 0 });
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [userTotal, setUserTotal] = useState(0);

  // 管理員設定
  const [currentAdmin, setCurrentAdmin] = useState<{ id: number; email: string; role: string } | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [showEditAdminModal, setShowEditAdminModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '' });
  const [editAdmin, setEditAdmin] = useState({ email: '', password: '' });
  const [updateAdminForm, setUpdateAdminForm] = useState({ email: '', password: '' });

  // 系統診斷
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logTotal, setLogTotal] = useState(0);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUserStats();
      fetchUsers();
      fetchCurrentAdmin();
      fetchAdmins();
      fetchLogs();
    }
  }, [user, userPage, userPageSize, userSearch, logPage, logPageSize]);

  // 用戶管理
  const fetchUserStats = async () => {
    try {
      const response = await axios.get('/api/admin/users/stats');
      setUserStats(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取用戶統計失敗');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/users', {
        params: {
          page: userPage,
          pageSize: userPageSize,
          search: userSearch,
        },
      });
      setUsers(response.data.data.users);
      setUserTotal(response.data.data.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取用戶列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('確定要刪除該用戶嗎？')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/users/${userId}`);
      setSuccess('用戶已刪除');
      fetchUsers();
      fetchUserStats();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除用戶失敗');
      setTimeout(() => setError(''), 3000);
    }
  };

  // 管理員設定
  const fetchCurrentAdmin = async () => {
    try {
      const response = await axios.get('/api/admin/admin/current');
      setCurrentAdmin(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取當前管理員資訊失敗');
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await axios.get('/api/admin/admin/list');
      setAdmins(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取管理員列表失敗');
    }
  };

  const handleAddAdmin = async () => {
    try {
      setLoading(true);
      await axios.post('/api/admin/admin/create', newAdmin);
      setSuccess('管理員已創建');
      setShowAddAdminModal(false);
      setNewAdmin({ email: '', password: '' });
      fetchAdmins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '創建管理員失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleEditAdmin = (admin: Admin) => {
    if (!window.confirm('確定要編輯該管理員嗎？')) {
      return;
    }
    setEditingAdmin(admin);
    setEditAdmin({ email: admin.email, password: '' });
    setShowEditAdminModal(true);
  };

  const handleUpdateAdmin = async () => {
    if (!editingAdmin) return;

    try {
      setLoading(true);
      // 只發送非空字段
      const updateData: any = {};
      if (editAdmin.email && editAdmin.email.trim() !== '') {
        updateData.email = editAdmin.email.trim();
      }
      if (editAdmin.password && editAdmin.password.trim() !== '') {
        updateData.password = editAdmin.password.trim();
      }
      await axios.put(`/api/admin/admin/${editingAdmin.id}`, updateData);
      setSuccess('管理員已更新');
      setShowEditAdminModal(false);
      setEditingAdmin(null);
      setEditAdmin({ email: '', password: '' });
      fetchAdmins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '更新管理員失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCurrentAdmin = async () => {
    try {
      setLoading(true);
      // 只發送非空字段
      const updateData: any = {};
      if (updateAdminForm.email && updateAdminForm.email.trim() !== '') {
        updateData.email = updateAdminForm.email.trim();
      }
      if (updateAdminForm.password && updateAdminForm.password.trim() !== '') {
        updateData.password = updateAdminForm.password.trim();
      }
      await axios.put('/api/admin/admin/current', updateData);
      setSuccess('設定已更新，請重新登入');
      setUpdateAdminForm({ email: '', password: '' });
      setTimeout(() => {
        setSuccess('');
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || '更新設定失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 系統診斷
  const [purging, setPurging] = useState(false);

  const handleDiagnostics = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/admin/diagnostics');
      setDiagnostics(response.data.data);
      setSuccess('系統診斷完成');
      fetchLogs();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '系統診斷失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/admin/logs', {
        params: {
          page: logPage,
          pageSize: logPageSize,
        },
      });
      setLogs(response.data.data.logs);
      setLogTotal(response.data.data.pagination.total);
    } catch (err: any) {
      setError(err.response?.data?.message || '獲取日誌列表失敗');
    }
  };

  const handleDeleteLog = async (logId: number) => {
    if (!window.confirm('確定要刪除該日誌嗎？')) {
      return;
    }

    try {
      await axios.delete(`/api/admin/logs/${logId}`);
      setSuccess('日誌已刪除');
      fetchLogs();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除日誌失敗');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleExportLogs = async () => {
    try {
      setLoading(true);
      // 獲取所有日誌
      const response = await axios.get('/api/admin/logs/all');
      const allLogs = response.data.data;

      if (allLogs.length === 0) {
        setError('沒有日誌可匯出');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // 準備Excel數據
      const excelData = allLogs.map((log: SystemLog) => {
        let detailsText = '';
        if (log.details) {
          try {
            const detailsObj = JSON.parse(log.details);
            if (detailsObj.checks && Array.isArray(detailsObj.checks)) {
              detailsText = detailsObj.checks.map((check: any) => 
                `${check.name}: ${check.status} - ${check.message}`
              ).join('; ');
            } else {
              detailsText = typeof detailsObj === 'string' ? detailsObj : JSON.stringify(detailsObj);
            }
          } catch {
            detailsText = log.details;
          }
        }

        return {
          'ID': log.id,
          '時間': log.created_at ? format(new Date(log.created_at), 'yyyy/MM/dd HH:mm:ss') : '',
          '類型': log.log_type || '',
          '級別': log.log_level || '',
          '訊息': log.message || '',
          '詳細資訊': detailsText,
        };
      });

      // 創建工作簿
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // 設置列寬
      const colWidths = [
        { wch: 8 },  // ID
        { wch: 20 }, // 時間
        { wch: 15 }, // 類型
        { wch: 10 }, // 級別
        { wch: 40 }, // 訊息
        { wch: 60 }, // 詳細資訊
      ];
      ws['!cols'] = colWidths;

      // 添加工作表到工作簿
      XLSX.utils.book_append_sheet(wb, ws, '系統日誌');

      // 生成文件名（包含日期）
      const fileName = `系統日誌_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.xlsx`;

      // 下載文件
      XLSX.writeFile(wb, fileName);
      setSuccess('日誌匯出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || '匯出日誌失敗');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 刪除全部業務數據（不含用戶與管理員帳號）
  const handlePurgeAllData = async () => {
    const first = window.confirm(
      '此操作將刪除所有交易、庫存、交割、股息、銀行帳戶、幣別設定、系統日誌與證交所除權除息資料，且無法復原。確定要繼續嗎？'
    );
    if (!first) return;
    const second = window.confirm('再次確認：確定要刪除全部業務數據嗎？此動作無法還原，請謹慎操作。');
    if (!second) return;

    try {
      setPurging(true);
      const response = await axios.post('/api/admin/purge');
      setSuccess(response.data?.message || '已刪除全部業務數據');
      // 重新載入基本統計與日誌
      fetchUserStats();
      fetchUsers();
      fetchLogs();
    } catch (err: any) {
      setError(err.response?.data?.message || '刪除全部數據失敗');
    } finally {
      setPurging(false);
      setTimeout(() => {
        setSuccess('');
        setError('');
      }, 3000);
    }
  };

  // 搜尋用戶（使用 debounce）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'users') {
        setUserPage(1);
        fetchUsers();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [userSearch]);

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          您沒有權限訪問此頁面
        </div>
      </div>
    );
  }

  const userTotalPages = Math.ceil(userTotal / userPageSize);
  const logTotalPages = Math.ceil(logTotal / logPageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">後台管理</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* 標籤頁 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            用戶管理
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admin'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            管理員設定
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'diagnostics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            系統診斷
          </button>
        </nav>
      </div>

      {/* 用戶管理 */}
      {activeTab === 'users' && (
        <div>
          {/* 統計資訊 */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">註冊用戶總數</div>
              <div className="text-2xl font-bold text-gray-800">{userStats.totalUsers}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">活躍用戶</div>
              <div className="text-2xl font-bold text-gray-800">{userStats.activeUsers}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-500">今日新增</div>
              <div className="text-2xl font-bold text-gray-800">{userStats.todayNewUsers}</div>
            </div>
          </div>

          {/* 搜尋 */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="搜尋用戶（郵箱或用戶名）"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 用戶列表 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    郵箱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    用戶名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    最後登入
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    註冊時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      載入中...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      沒有用戶資料
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role === 'admin' ? '系統管理員' : '一般用戶'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.last_login_at ? new Date(user.last_login_at).toLocaleString('zh-TW') : '從未登入'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleString('zh-TW')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteUser(user.id)}
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

          {/* 分頁 */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">每頁顯示：</span>
              <select
                value={userPageSize}
                onChange={(e) => {
                  setUserPageSize(Number(e.target.value));
                  setUserPage(1);
                }}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">
                共 {userTotal} 筆，第 {userPage} / {userTotalPages} 頁
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setUserPage(Math.max(1, userPage - 1))}
                disabled={userPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                上一頁
              </button>
              {Array.from({ length: userTotalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setUserPage(page)}
                  className={`px-3 py-1 border rounded-md text-sm ${
                    userPage === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setUserPage(Math.min(userTotalPages, userPage + 1))}
                disabled={userPage === userTotalPages}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                下一頁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 管理員設定 */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          {/* 當前管理員帳戶 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">當前管理員帳戶</h2>
            {currentAdmin && (
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600">郵箱：</span>
                  <span className="text-gray-800 font-medium">{currentAdmin.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">權限：</span>
                  <span className="text-gray-800 font-medium">系統管理員</span>
                </div>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-md font-semibold text-gray-800 mb-4">更新當前管理員設定</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    新郵箱（留空表示不更改）
                  </label>
                  <input
                    type="email"
                    value={updateAdminForm.email}
                    onChange={(e) => setUpdateAdminForm({ ...updateAdminForm, email: e.target.value })}
                    className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="留空表示不更改"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    新密碼（留空表示不更改，8-12位）
                  </label>
                  <input
                    type="password"
                    value={updateAdminForm.password}
                    onChange={(e) => setUpdateAdminForm({ ...updateAdminForm, password: e.target.value })}
                    className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="留空表示不更改"
                  />
                </div>
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded text-sm">
                  注意：更改管理員設定後，您可能需要重新登入，請確保記住新的登入訊息。
                </div>
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded text-sm">
                  <strong>權限說明：</strong>
                  <br />
                  系統管理員：可以管理所有用戶、查看統計數據、修改系統設定。
                  <br />
                  一般用戶：只能管理自己的交易記錄、庫存管理、投資組合、圖表分析、歷史收益、系統設定。
                </div>
                <button
                  onClick={handleUpdateCurrentAdmin}
                  disabled={loading || (!updateAdminForm.email && !updateAdminForm.password)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  更新
                </button>
              </div>
            </div>
          </div>

          {/* 管理員列表 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">管理員列表</h2>
              <button
                onClick={() => setShowAddAdminModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                新增管理員
              </button>
            </div>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    郵箱
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    密碼
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    權限
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    創建時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.map((admin) => (
                  <tr key={admin.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{admin.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">******</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        系統管理員
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(admin.created_at).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEditAdmin(admin)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        編輯
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 新增管理員模態框 */}
          {showAddAdminModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-bold text-gray-900 mb-4">新增管理員</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">郵箱</label>
                    <input
                      type="email"
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">密碼（8-12位）</label>
                    <input
                      type="password"
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowAddAdminModal(false);
                        setNewAdmin({ email: '', password: '' });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleAddAdmin}
                      disabled={loading || !newAdmin.email || !newAdmin.password}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      新增
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 編輯管理員模態框 */}
          {showEditAdminModal && editingAdmin && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-bold text-gray-900 mb-4">編輯管理員</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      郵箱（留空表示不更改）
                    </label>
                    <input
                      type="email"
                      value={editAdmin.email}
                      onChange={(e) => setEditAdmin({ ...editAdmin, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`當前: ${editingAdmin.email}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      新密碼（留空表示不更改，8-12位）
                    </label>
                    <input
                      type="password"
                      value={editAdmin.password}
                      onChange={(e) => setEditAdmin({ ...editAdmin, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="留空表示不更改"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowEditAdminModal(false);
                        setEditingAdmin(null);
                        setEditAdmin({ email: '', password: '' });
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleUpdateAdmin}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      確定
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 系統診斷 */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">系統診斷</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDiagnostics}
                  disabled={loading || purging}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? '診斷中...' : '執行診斷'}
                </button>
                <button
                  onClick={handlePurgeAllData}
                  disabled={loading || purging}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  title="刪除所有業務數據（不含用戶/管理員）"
                >
                  {purging ? '刪除中...' : '刪除全部數據'}
                </button>
              </div>
            </div>

            {diagnostics && (
              <div className="mt-6">
                <h3 className="text-md font-semibold text-gray-800 mb-4">診斷結果</h3>
                <div className="space-y-2">
                  {diagnostics.checks.map((check: any, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded ${
                        check.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <strong>{check.name}:</strong> {check.message}
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-gray-500">
                  診斷時間：{new Date(diagnostics.timestamp).toLocaleString('zh-TW')}
                </div>
              </div>
            )}
          </div>

          {/* 日誌管理 */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">日誌管理</h2>
              <button
                onClick={handleExportLogs}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                title="匯出所有日誌到Excel"
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
            </div>

            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    時間
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    類型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    級別
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    訊息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString('zh-TW')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.log_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          log.log_level === 'error'
                            ? 'bg-red-100 text-red-800'
                            : log.log_level === 'warning'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {log.log_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{log.message}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 分頁 */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">每頁顯示：</span>
                <select
                  value={logPageSize}
                  onChange={(e) => {
                    setLogPageSize(Number(e.target.value));
                    setLogPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-700">
                  共 {logTotal} 筆，第 {logPage} / {logTotalPages} 頁
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setLogPage(Math.max(1, logPage - 1))}
                  disabled={logPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  上一頁
                </button>
                {Array.from({ length: logTotalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setLogPage(page)}
                    className={`px-3 py-1 border rounded-md text-sm ${
                      logPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setLogPage(Math.min(logTotalPages, logPage + 1))}
                  disabled={logPage === logTotalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                >
                  下一頁
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

