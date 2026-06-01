import React, { useState, useCallback } from 'react';
import { FancyAlert, FancyAlertButton } from '../components/ui/FancyAlert';

interface AlertState {
  title: string;
  message: string;
  buttons: FancyAlertButton[];
}

export function useAlert() {
  const [alert, setAlert] = useState<AlertState | null>(null);

  const showAlert = useCallback((
    title: string,
    message: string,
    buttons?: FancyAlertButton[],
  ) => {
    setAlert({
      title,
      message,
      buttons: buttons ?? [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    });
  }, []);

  const closeAlert = useCallback(() => setAlert(null), []);

  const AlertModal = alert ? (
    <FancyAlert
      title={alert.title}
      message={alert.message}
      buttons={alert.buttons}
      onDismiss={closeAlert}
    />
  ) : null;

  return { showAlert, closeAlert, AlertModal };
}
