import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface FancyAlertButton {
  text: string;
  onPress: () => void;
  style?: 'primary' | 'danger' | 'secondary';
}

interface FancyAlertProps {
  title: string;
  message: string;
  buttons: FancyAlertButton[];
  onDismiss?: () => void;
}

export const FancyAlert: React.FC<FancyAlertProps> = ({
  title,
  message,
  buttons,
  onDismiss,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss?.();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onDismiss]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onDismiss?.();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-900 dark:text-white">
          {title}
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          {message}
        </p>
        <div className="flex gap-3 flex-col">
          {buttons.map((button, idx) => (
            <button type="button"
              key={idx}
              onClick={() => {
                button.onPress();
                onDismiss?.();
              }}
              data-cy="alert-button"
              data-cy-style={button.style ?? 'primary'}
              className={`py-3 px-4 rounded-lg font-semibold transition-opacity ${
                button.style === 'danger'
                  ? 'bg-game-danger text-white hover:opacity-90'
                  : button.style === 'secondary'
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:opacity-90'
                    : 'bg-game-blue text-white hover:opacity-90'
              }`}
            >
              {button.text}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};
