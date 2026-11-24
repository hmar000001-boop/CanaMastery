import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { SourceCitation } from '../types';

export function CitationCard({ source }: { source: SourceCitation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant='bodySmall' style={{ color: theme.colors.onSurfaceVariant }}>
        💡 {t('citation.hint', { section: source.title })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 10 },
});
