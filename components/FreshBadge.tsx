import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, sizes } from '@/theme/tokens';

// Der grüne Punkt. Das Produkt. Nur zwei Zustände, absichtlich.
export function FreshBadge({ fresh }: { fresh: boolean }) {
  return (
    <View style={s.wrap}>
      {fresh && <View style={s.dot} />}
      <Text style={[s.txt, { color: fresh ? colors.ok : colors.accentSoft }]}>{fresh ? 'Karte aktuell' : 'Karte ungeprüft'}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(12,12,12,.75)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ok },
  txt: { fontFamily: fonts.medium, fontSize: sizes.badge },
});
