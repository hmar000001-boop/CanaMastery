import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useIAP, type Purchase } from 'expo-iap';
import { Screen } from '../src/components/Screen';
import { GUIDE_EDITION, PREMIUM_PRODUCT_ID } from '../src/config';
import { usePremium } from '../src/store/premium';

export default function PremiumScreen() {
  const { t } = useTranslation(); const theme = useTheme(); const router = useRouter(); const unlocked = usePremium((s) => s.unlocked); const unlock = usePremium((s) => s.unlock); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null); const [restoreRequested, setRestoreRequested] = useState(false);
  const { connected, products, availablePurchases, fetchProducts, getAvailablePurchases, requestPurchase, finishTransaction } = useIAP({
    onPurchaseSuccess: (purchase: Purchase) => { void (async () => { try { if (purchase.productId !== PREMIUM_PRODUCT_ID) return; await unlock(); await finishTransaction({ purchase, isConsumable: false }); setRestoreRequested(false); setNotice(t('premium.purchaseSuccess')); } catch (error) { Alert.alert('CanaMastery', error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } })(); },
    onPurchaseError: () => setBusy(false),
    onError: () => setBusy(false),
  });
  useEffect(() => { if (!connected) return; void fetchProducts({ skus: [PREMIUM_PRODUCT_ID], type: 'in-app' }).catch(() => undefined); void getAvailablePurchases().catch(() => undefined); }, [connected, fetchProducts, getAvailablePurchases]);
  const hasPremiumPurchase = availablePurchases.some((p) => p.productId === PREMIUM_PRODUCT_ID);
  useEffect(() => { if (hasPremiumPurchase && !unlocked) void unlock(); }, [hasPremiumPurchase, unlock, unlocked]);
  const product = products.find((p) => p.id === PREMIUM_PRODUCT_ID); const price = product?.displayPrice; const displayNotice = restoreRequested && hasPremiumPurchase && unlocked ? t('premium.restoreSuccess') : notice;
  const buy = async () => { setRestoreRequested(false); if (!connected || !product) { setNotice(t('premium.unavailable')); return; } setBusy(true); try { await requestPurchase({ request: Platform.OS === 'ios' ? { apple: { sku: PREMIUM_PRODUCT_ID } } : { google: { skus: [PREMIUM_PRODUCT_ID] } }, type: 'in-app' }); } catch { setBusy(false); setNotice(t('premium.unavailable')); } };
  const restore = async () => { setBusy(true); setNotice(null); setRestoreRequested(true); try { await getAvailablePurchases(); setNotice(t('premium.noPurchase')); } catch { setNotice(t('premium.unavailable')); } finally { setBusy(false); } };
  return <Screen><Stack.Screen options={{ title: t('premium.title') }} /><View style={styles.hero}><Text style={styles.logo}>⭐</Text><Text variant='displaySmall' style={{ color: theme.colors.secondary, fontWeight: '800', textAlign: 'center' }}>{t('premium.title')}</Text><Text variant='bodyLarge' style={styles.center}>{t('premium.subtitle')}</Text></View><View style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}><Text variant='bodyLarge'>{t('premium.benefits')}</Text><View style={styles.bullets}><Text>✓ {t('tabs.learn')} — full course</Text><Text>✓ {t('tabs.exams')} — complete practice library</Text><Text>✓ {t('tabs.review')} — full review workflow</Text><Text>✓ Offline after purchase</Text></View><Text variant='bodySmall' style={{ color: theme.colors.onSurfaceVariant }}>{t('premium.purchaseNote')}</Text></View>{displayNotice ? <Text variant='bodyMedium' style={{ textAlign: 'center' }}>{displayNotice}</Text> : null}{unlocked ? <Button mode='contained' onPress={() => router.back()}>{t('common.continue')}</Button> : <><Button disabled={busy} mode='contained' onPress={buy}>{busy ? t('premium.buying') : price ? `${t('premium.unlock')} · ${price}` : t('premium.unlock')}</Button><Button disabled={busy} mode='outlined' onPress={restore}>{busy ? t('premium.restoring') : t('premium.restore')}</Button></>}<Text variant='bodySmall' style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{t('content.originality')}</Text><Text variant='labelSmall' style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>{GUIDE_EDITION}</Text></Screen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: 8 }, logo: { fontSize: 54 }, center: { textAlign: 'center' }, card: { borderRadius: 22, padding: 18, gap: 12 }, bullets: { gap: 8 } });
