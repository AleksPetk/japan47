import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { ErrorCode, useIAP, type Product, type Purchase } from 'expo-iap';
import { Button } from '@/components/core';
import { colors, spacing, typography } from '@/constants/theme';
import { IOS_SUPPORT_PRODUCT_IDS } from '@/lib/support-product-ids';

type FinishTransaction = (args: { purchase: Purchase; isConsumable?: boolean }) => Promise<void>;

export function IosSupportActions() {
  const finishTransactionRef = useRef<FinishTransaction | null>(null);
  const userInitiatedProductIdRef = useRef<string | null>(null);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const handlePurchaseSuccess = useCallback(async (purchase: Purchase) => {
    const isUserInitiated = userInitiatedProductIdRef.current === purchase.productId;

    try {
      await finishTransactionRef.current?.({ purchase, isConsumable: true });
    } catch {
      if (isUserInitiated) {
        Alert.alert(
          'Unable to complete support',
          'Your purchase may still be processing. Please reopen this screen in a moment.',
        );
      }
      return;
    } finally {
      if (userInitiatedProductIdRef.current === purchase.productId) {
        userInitiatedProductIdRef.current = null;
        setLoadingProductId(null);
      }
    }

    if (isUserInitiated) {
      Alert.alert(
        'Thank you!',
        'Your support helps keep Japan47 free for everyone.',
      );
    }
  }, []);

  const handlePurchaseError = useCallback((error: { code?: ErrorCode; message?: string }) => {
    if (userInitiatedProductIdRef.current) {
      userInitiatedProductIdRef.current = null;
      setLoadingProductId(null);
    }

    if (error.code === ErrorCode.UserCancelled) {
      return;
    }

    Alert.alert(
      'Support unavailable',
      'The App Store could not complete this support purchase. Please try again.',
    );
  }, []);

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getAvailablePurchases,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: handlePurchaseSuccess,
    onPurchaseError: handlePurchaseError,
  });

  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

  const loadCatalog = useCallback(async () => {
    setCatalogState('loading');
    setCatalogError(null);

    try {
      await fetchProducts({
        skus: [...IOS_SUPPORT_PRODUCT_IDS],
        type: 'in-app',
      });
      await getAvailablePurchases({ alsoPublishToEventListenerIOS: true });
      setCatalogState('ready');
    } catch {
      setCatalogState('error');
      setCatalogError('Unable to load support options. Please try again.');
    }
  }, [fetchProducts, getAvailablePurchases]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    void loadCatalog();
  }, [connected, loadCatalog]);

  const orderedProducts = useMemo(() => {
    return IOS_SUPPORT_PRODUCT_IDS
      .map((productId) => products.find((product) => product.id === productId))
      .filter((product): product is Product => Boolean(product));
  }, [products]);

  const purchaseTier = async (productId: string) => {
    if (loadingProductId) {
      return;
    }

    userInitiatedProductIdRef.current = productId;
    setLoadingProductId(productId);

    try {
      await requestPurchase({
        request: {
          apple: { sku: productId },
        },
        type: 'in-app',
      });
    } catch {
      userInitiatedProductIdRef.current = null;
      setLoadingProductId(null);
      Alert.alert(
        'Support unavailable',
        'The App Store could not start this support purchase. Please try again.',
      );
    }
  };

  const retryCatalog = async () => {
    if (!connected) {
      const reconnected = await reconnect();
      if (!reconnected) {
        setCatalogState('error');
        setCatalogError('Unable to connect to the App Store. Please try again.');
        return;
      }
    }

    await loadCatalog();
  };

  if (!connected || catalogState === 'loading') {
    return (
      <View style={styles.stateBlock}>
        <ActivityIndicator color={colors.surface} />
        <Text style={styles.stateText}>Loading support options…</Text>
      </View>
    );
  }

  if (catalogState === 'error' || orderedProducts.length === 0) {
    return (
      <View style={styles.stateBlock}>
        <Text style={styles.stateText}>
          {catalogError ?? 'Support options are not available right now.'}
        </Text>
        <Button label="Try again" icon="refresh-outline" onPress={() => void retryCatalog()} />
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      {orderedProducts.map((product) => (
        <Button
          key={product.id}
          label={`${product.title} — ${product.displayPrice}`}
          icon="heart-outline"
          disabled={Boolean(loadingProductId)}
          onPress={() => void purchaseTier(product.id)}
        />
      ))}
      <Text style={styles.storeNote}>Support is processed securely through the App Store.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  stateBlock: { gap: spacing.md, alignItems: 'center' },
  stateText: {
    color: '#D5DED7',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: typography.body,
  },
  storeNote: {
    color: '#AEBCB2',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
