import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import ConfirmationDialog from '../components/ConfirmationDialog';

const DialogContext = createContext({
  showDialog: async () => null,
});

const dialogRef = {
  show: null,
};

const DEFAULT_BUTTON = { text: 'OK', variant: 'primary', value: 0 };

const mapAlertButtonsToDialog = (buttons = []) => {
  if (!buttons.length) {
    return [{ text: DEFAULT_BUTTON.text, variant: DEFAULT_BUTTON.variant, value: DEFAULT_BUTTON.value }];
  }

  return buttons.map((btn, index) => {
    let variant = 'primary';
    if (btn.style === 'destructive') {
      variant = 'danger';
    } else if (btn.style === 'cancel') {
      variant = 'secondary';
    }

    return {
      text: btn.text || DEFAULT_BUTTON.text,
      variant,
      value: index,
      original: btn,
    };
  });
};

export const DialogProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    visible: false,
    title: '',
    message: '',
    buttons: [],
    dismissible: true,
  });
  const resolveRef = useRef(null);
  const buttonsRef = useRef([]);

  const closeDialog = useCallback((value = null) => {
    setDialogState((prev) => ({ ...prev, visible: false }));
    const resolver = resolveRef.current;
    const originalButtons = buttonsRef.current;

    // Reset refs first to avoid duplicate calls
    resolveRef.current = null;
    buttonsRef.current = [];

    if (resolver) {
      if (typeof value === 'number' && originalButtons[value] && originalButtons[value].original?.onPress) {
        try {
          originalButtons[value].original.onPress();
        } catch (error) {
          console.warn('Dialog button onPress failed:', error);
        }
      }

      const resolvedText =
        typeof value === 'number' && originalButtons[value]
          ? originalButtons[value].text
          : null;

      resolver(resolvedText);
    }
  }, []);

  const showDialog = useCallback(({ title, message, buttons, dismissible = true }) => {
    return new Promise((resolve) => {
      const mappedButtons = mapAlertButtonsToDialog(buttons);
      buttonsRef.current = mappedButtons;
      resolveRef.current = resolve;
      setDialogState({
        visible: true,
        title: title || 'Notice',
        message: message || '',
        buttons: mappedButtons,
        dismissible,
      });
    });
  }, []);

  useEffect(() => {
    dialogRef.show = showDialog;
    return () => {
      dialogRef.show = null;
    };
  }, [showDialog]);

  return (
    <DialogContext.Provider value={{ showDialog }}>
      {children}
      <ConfirmationDialog
        visible={dialogState.visible}
        title={dialogState.title}
        message={dialogState.message}
        buttons={dialogState.buttons}
        dismissible={dialogState.dismissible}
        onResult={(value) => {
          if (dialogState.visible) {
            closeDialog(typeof value === 'number' ? value : null);
          }
        }}
      />
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);

export const showAppDialog = (title, message, buttons, options = {}) => {
  if (dialogRef.show) {
    return dialogRef.show({ title, message, buttons, dismissible: options.dismissible !== false });
  }

  // Fallback to native alert if provider not mounted
  Alert.alert(title, message, buttons);
  return Promise.resolve(null);
};
