import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/common/Layout';
import DashboardPage from './pages/DashboardPage';
import MigrationsPage from './pages/MigrationsPage';
import MigrationDetailPage from './pages/MigrationDetailPage';
import MigrationWizardPage from './pages/MigrationWizardPage';
import TemplatesPage from './pages/TemplatesPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/migrations" element={<MigrationsPage />} />
        <Route path="/migrations/new" element={<MigrationWizardPage />} />
        <Route path="/migrations/:id" element={<MigrationDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
