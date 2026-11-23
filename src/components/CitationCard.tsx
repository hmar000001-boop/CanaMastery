import { Linking, StyleSheet, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { SourceCitation } from '../types';

export function CitationCard({ source }: { source: SourceCitation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}> 
    <Text variant='labelLarge'>{t('citation.source')}</Text>
    <Text variant='bodySmall'>{source.guideTitle}</Text>
    <Text variant='bodySmall'>{source.title}</Text>
    <Text variant='labelSmall' style={{ color: theme.colors.onSurfaceVariant }}>{t('citation.checked', { date: source.checkedOn })}</Text>
    <Button compact mode='text' onPress={() => void Linking.openURL(source.url)} contentStyle={styles.button}>{t('citation.open')}</Button>
  </View>;
}
const styles = StyleSheet.create({ card: { borderRadius: 16, padding: 12, gap: 4 }, button: { alignSelf: 'flex-start' } });
