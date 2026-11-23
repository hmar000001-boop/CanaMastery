import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { Panel } from './Panel';

export function PaywallCard({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation(); const router = useRouter(); const theme = useTheme();
  return <Panel style={styles.panel}>
    <View style={styles.row}><Text style={styles.icon}>⭐</Text><View style={styles.grow}><Text variant={compact ? 'titleMedium' : 'headlineSmall'} style={{ color: theme.colors.secondary }}>{t('premium.title')}</Text><Text variant='bodyMedium'>{t('premium.subtitle')}</Text></View></View>
    {!compact ? <Text variant='bodySmall'>{t('premium.benefits')}</Text> : null}
    <Button mode='contained' onPress={() => router.push('/premium')}>{t('premium.unlock')}</Button>
  </Panel>;
}
const styles = StyleSheet.create({ panel: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, grow: { flex: 1, gap: 4 }, icon: { fontSize: 34 } });
