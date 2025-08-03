import React from 'react';
import { useError, ErrorType } from '../contexts/ErrorContext';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export const ErrorNotifications: React.FC = () => {
  const { errors, removeError } = useError();

  const getIcon = (type: ErrorType) => {
    switch (type) {
      case 'error':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />;
      case 'retry':
        return <ArrowPathIcon className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'info':
      default:
        return <InformationCircleIcon className="w-5 h-5 text-blue-400" />;
    }
  };

  const getColorClasses = (type: ErrorType) => {
    switch (type) {
      case 'error':
        return 'bg-red-900/20 border-red-800';
      case 'warning':
        return 'bg-yellow-900/20 border-yellow-800';
      case 'retry':
        return 'bg-blue-900/20 border-blue-800';
      case 'info':
      default:
        return 'bg-blue-900/20 border-blue-800';
    }
  };

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 z-50 max-w-md w-full space-y-2">
      {errors.map((error) => (
        <div
          key={error.id}
          className={`${getColorClasses(error.type)} border rounded-lg p-4 shadow-lg backdrop-blur-sm transition-all duration-300 animate-slide-in-right`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(error.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100">
                {error.title}
              </p>
              <p className="text-sm text-gray-300 mt-1">
                {error.message}
              </p>
              {error.retryCount !== undefined && error.maxRetries !== undefined && (
                <p className="text-xs text-gray-400 mt-2">
                  Retry attempt {error.retryCount} of {error.maxRetries}
                </p>
              )}
            </div>
            {!error.autoHide && (
              <button
                onClick={() => removeError(error.id)}
                className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};