import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WelcomeGuide = () => {
  const navigate = useNavigate();
  const [hasSeenGuide, setHasSeenGuide] = useState(false);

  useEffect(() => {
    // 檢查是否已經看過提示
    const seen = localStorage.getItem('hasSeenWelcomeGuide');
    setHasSeenGuide(!!seen);
  }, []);

  const handleMarkAsRead = () => {
    localStorage.setItem('hasSeenWelcomeGuide', 'true');
    setHasSeenGuide(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">使用指南</h1>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b border-blue-200">
          <h2 className="text-xl font-bold text-gray-800">歡迎使用股票記帳系統</h2>
        </div>
        
        <div className="px-6 py-6">
          <p className="text-gray-700 mb-6 font-medium">為了讓您快速開始使用系統，請按照以下步驟進行初始設定：</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-blue-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">新增證券帳戶</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">系統設定</span> → <span className="font-medium">帳戶相關</span> → 
                  點擊<span className="font-medium">前往證券帳戶管理</span> → <span className="font-medium">新增證券帳戶</span>
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  前往設定 →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-green-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">新增銀行帳戶</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">銀行帳戶</span> → <span className="font-medium">新增銀行帳戶</span>
                </p>
                <button
                  onClick={() => navigate('/bank-accounts')}
                  className="text-sm text-green-600 hover:text-green-800 font-medium"
                >
                  前往銀行帳戶 →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-purple-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">更新股票資料</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">系統設定</span> → <span className="font-medium">API設定</span> → 
                  點擊<span className="font-medium">更新股票資料</span> → <span className="font-medium">保存設定</span>
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  前往設定 →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-yellow-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-600 text-white rounded-full flex items-center justify-center font-bold">
                4
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">新增交易記錄</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">交易記錄</span> → <span className="font-medium">新增交易記錄</span>
                </p>
                <button
                  onClick={() => navigate('/transactions')}
                  className="text-sm text-yellow-600 hover:text-yellow-800 font-medium"
                >
                  前往交易記錄 →
                </button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-red-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold">
                5
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">新增交割記錄</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">交割管理</span> → <span className="font-medium">新增交割記錄</span>
                </p>
                <button
                  onClick={() => navigate('/settlements')}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  前往交割管理 →
                </button>
                <div className="mt-4 flex justify-center">
                  <img 
                    src="/qrcode.png" 
                    alt="讚賞碼" 
                    className="max-w-xs w-full h-auto"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white rounded-lg border border-indigo-100 hover:shadow-md transition-shadow">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                6
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-medium mb-1">新增銀行明細</p>
                <p className="text-sm text-gray-600 mb-2">
                  進入<span className="font-medium">銀行帳戶</span> → <span className="font-medium">新增銀行明細</span>
                </p>
                <button
                  onClick={() => navigate('/bank-accounts')}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  前往銀行帳戶 →
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {!hasSeenGuide && (
          <div className="px-6 py-4 bg-gray-50 border-t border-blue-200 flex items-center justify-end gap-3 rounded-b-lg">
            <button
              onClick={handleMarkAsRead}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              我已了解
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeGuide;





