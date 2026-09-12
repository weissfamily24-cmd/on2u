import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, sizes, space } from '@/theme/tokens';

// TODO: Screen aus prototype/index.html übertragen (siehe docs/screens.md, Zeile "feed").
export default function Screen() {
  return (
    <View style={s.root}><Text style={s.t}>feed</Text><Text style={s.sub}>Noch nicht gebaut. Referenz: prototype/index.html</Text></View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: space.edge },
  t: { fontFamily: fonts.semibold, fontSize: sizes.screenTitle, color: colors.text, textTransform: 'capitalize' },
  sub: { fontFamily: fonts.regular, fontSize: sizes.meta, color: colors.muted, marginTop: 8, textAlign: 'center' },
});
