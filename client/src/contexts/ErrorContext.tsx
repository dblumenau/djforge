import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ErrorType = 'error' | 'warning' | 'info' | 'retry';

export interface ErrorNotification {
  id: string;
  type: ErrorType;
  title: string;
  message: string;
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
  autoHide?: boolean;
  duration?: number;
}

interface ErrorContextType {
  errors: ErrorNotification[];
  addError: (error: Omit<ErrorNotification, 'id' | 'timestamp'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  updateError: (id: string, updates: Partial<ErrorNotification>) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorNotification[]>([]);

  const addError = useCallback((error: Omit<ErrorNotification, 'id' | 'timestamp'>) => {
    const newError: ErrorNotification = {
      ...error,
      id: `error-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    setErrors(prev => [...prev, newError]);

    // Auto-hide after duration if specified
    if (error.autoHide && error.duration) {
      setTimeout(() => {
        removeError(newError.id);
      }, error.duration);
    }

    return newError.id;
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const updateError = useCallback((id: string, updates: Partial<ErrorNotification>) => {
    setErrors(prev => prev.map(error => 
      error.id === id ? { ...error, ...updates } : error
    ));
  }, []);

  return (
    <ErrorContext.Provider value={{ errors, addError, removeError, clearErrors, updateError }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};