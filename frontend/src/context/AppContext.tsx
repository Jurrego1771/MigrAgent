import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Alert as MuiAlert, Snackbar } from '@mui/material';

interface Notification {
  id: string;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  notifications: Notification[];
  showNotification: (message: string, severity?: Notification['severity']) => void;
  hideNotification: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (message: string, severity: Notification['severity'] = 'info') => {
      const id = Date.now().toString();
      setNotifications((prev) => [...prev, { id, message, severity }]);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 5000);
    },
    []
  );

  const hideNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{ notifications, showNotification, hideNotification }}>
      {children}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          style={{ bottom: 24 + index * 60 }}
        >
          <MuiAlert
            severity={notification.severity}
            onClose={() => hideNotification(notification.id)}
            variant="filled"
          >
            {notification.message}
          </MuiAlert>
        </Snackbar>
      ))}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
