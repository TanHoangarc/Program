
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CustomDialog, DialogType } from '../components/CustomDialog';

interface NotificationContextType {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  notify: (message: string, type: DialogType, title?: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: DialogType;
    title?: string;
    message: string;
    resolve: (value: any) => void;
  } | null>(null);

  const showDialog = useCallback((message: string, type: DialogType, title?: string) => {
    return new Promise<any>((resolve) => {
      setDialog({
        isOpen: true,
        type,
        title,
        message,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialog) {
      dialog.resolve(true);
      setDialog(null);
    }
  }, [dialog]);

  const handleCancel = useCallback(() => {
    if (dialog) {
      dialog.resolve(false);
      setDialog(null);
    }
  }, [dialog]);

  const alert = useCallback((message: string, title?: string) => {
    return showDialog(message, 'alert', title);
  }, [showDialog]);

  const confirm = useCallback((message: string, title?: string) => {
    return showDialog(message, 'confirm', title);
  }, [showDialog]);

  const notify = useCallback((message: string, type: DialogType, title?: string) => {
    return showDialog(message, type, title);
  }, [showDialog]);

  return (
    <NotificationContext.Provider value={{ alert, confirm, notify }}>
      {children}
      {dialog && (
        <CustomDialog
          isOpen={dialog.isOpen}
          type={dialog.type}
          title={dialog.title}
          message={dialog.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
