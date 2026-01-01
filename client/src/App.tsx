import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SecuritiesAccount from './pages/SecuritiesAccount';
import Transactions from './pages/Transactions';
import Settlements from './pages/Settlements';
import BankAccounts from './pages/BankAccounts';
import Holdings from './pages/Holdings';
import Portfolio from './pages/Portfolio';
import Dividends from './pages/Dividends';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <PrivateRoute>
                <Layout>
                  <Transactions />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/settlements"
            element={
              <PrivateRoute>
                <Layout>
                  <Settlements />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/bank-accounts"
            element={
              <PrivateRoute>
                <Layout>
                  <BankAccounts />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/holdings"
            element={
              <PrivateRoute>
                <Layout>
                  <Holdings />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/portfolio"
            element={
              <PrivateRoute>
                <Layout>
                  <Portfolio />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/dividends"
            element={
              <PrivateRoute>
                <Layout>
                  <Dividends />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/securities-accounts"
            element={
              <PrivateRoute>
                <Layout>
                  <SecuritiesAccount />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <Layout>
                  <Admin />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

