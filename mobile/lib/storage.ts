import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'japan47.mobile.tokens';

export type AuthTokens = { access: string; refresh: string };

export const tokenStorage = {
  async get(): Promise<AuthTokens | null> {
    try {
      const value = await SecureStore.getItemAsync(TOKEN_KEY);
      return value ? JSON.parse(value) as AuthTokens : null;
    } catch {
      return null;
    }
  },
  async set(tokens: AuthTokens) {
    await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};
