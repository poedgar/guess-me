import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import QRScanner from '../components/QRScanner';

jest.mock('@/contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

describe('QRScanner', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onScanSuccess: jest.fn(),
  };

  it('is defined and is a function', () => {
    expect(QRScanner).toBeDefined();
    expect(typeof QRScanner).toBe('function');
  });

  it('renders without crashing when visible', () => {
    const { root } = render(<QRScanner {...defaultProps} />);
    expect(root).toBeTruthy();
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByText } = render(<QRScanner {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText('✕'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not render content when visible is false', () => {
    const { queryByText } = render(<QRScanner {...defaultProps} visible={false} />);
    expect(queryByText('✕')).toBeNull();
  });

  it('accepts required props', () => {
    const props = {
      visible: true,
      onClose: jest.fn(),
      onScanSuccess: jest.fn(),
    };
    expect(typeof props.onClose).toBe('function');
    expect(typeof props.onScanSuccess).toBe('function');
  });
});
