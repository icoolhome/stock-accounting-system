import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

// 動態導入頁面組件（代碼分割）
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SecuritiesAccount = lazy(() => import('./pages/SecuritiesAccount'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Settlements = lazy(() => import('./pages/Settlements'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));
const Holdings = lazy(() => import('./pages/Holdings'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Dividends = lazy(() => import('./pages/Dividends'));
const StockAnnouncements = lazy(() => import('./pages/StockAnnouncements'));
const WelcomeGuide = lazy(() => import('./pages/WelcomeGuide'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));

// 加載中的組件
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-gray-600">載入中...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Dashboard />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Transactions />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/settlements"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Settlements />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/bank-accounts"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <BankAccounts />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/holdings"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Holdings />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Portfolio />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/dividends"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Dividends />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/stock-announcements"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <StockAnnouncements />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/welcome-guide"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <WelcomeGuide />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/securities-accounts"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <SecuritiesAccount />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Settings />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <PrivateRoute>
                  <Layout>
                    <Suspense fallback={<LoadingFallback />}>
                      <Admin />
                    </Suspense>
                  </Layout>
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;

