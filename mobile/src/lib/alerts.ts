import { Alert, Platform } from 'react-native';

// Alert.alert is a native-only API — it silently does nothing on web (no
// warning, no fallback), so every confirmation/notification built on it was
// invisible there: sign-out, delete-account, sign-in/sign-up errors, the
// "check your email" message after signing up. window.alert/window.confirm
// are the direct web equivalents for the simple cases this app needs.

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
