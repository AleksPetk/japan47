import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/core';
import { spacing } from '@/constants/theme';

const KOFI_URL = 'https://ko-fi.com/japan47';

export function AndroidSupportActions() {
  const openKofi = async () => {
    try {
      const supported = await Linking.canOpenURL(KOFI_URL);
      if (!supported) throw new Error('Unsupported URL');
      await Linking.openURL(KOFI_URL);
    } catch {
      Alert.alert(
        'Unable to open Ko-fi',
        'Please try again later or open ko-fi.com/japan47 in your browser.',
      );
    }
  };

  return (
    <View style={styles.actions}>
      <Button label="Support on Ko-fi" icon="heart-outline" onPress={() => void openKofi()} />
      <Text style={styles.externalNote}>Ko-fi opens in your device’s external browser.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  externalNote: { color: '#AEBCB2', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
