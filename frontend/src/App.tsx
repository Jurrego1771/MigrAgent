import { Component, ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Typography, Button, alpha } from '@mui/material';
import Layout from './components/common/Layout';
import DashboardPage from './pages/DashboardPage';
import MigrationsPage from './pages/MigrationsPage';
import MigrationDetailPage from './pages/MigrationDetailPage';
import MigrationWizardPage from './pages/MigrationWizardPage';
import TemplatesPage from './pages/TemplatesPage';
import AlertsPage from './pages/AlertsPage';
import SettingsPage from './pages/SettingsPage';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
          <Typography variant="h6" color="error" fontWeight={700}>
            Error de renderizado
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {err.message}
          </Typography>
          <Box
            component="pre"
            sx={{
              p: 2, borderRadius: 2, fontSize: '0.72rem',
              background: alpha('#f44336', 0.06),
              border: '1px solid rgba(244,67,54,0.2)',
              maxWidth: '100%', overflowX: 'auto', whiteSpace: 'pre-wrap',
            }}
          >
            {err.stack}
          </Box>
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Recargar página
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <Layout>
      <ErrorBoundary>
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
      </ErrorBoundary>
    </Layout>
  );
}

export default App;
