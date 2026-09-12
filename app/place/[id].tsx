import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts, sizes, radius, space } from '@/theme/tokens';
import { demoPlaces } from '@/lib/demo/places';
import { isMenuFresh, freshnessLabel, formatPrice } from '@/lib/data/freshness';
import { Icon } from '@/components/Icon';

// Lokal: Entscheiden. Bestätigungs-Block direkt unter dem Titel, Speisekarte, dann Scan-CTA.
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const place = demoPlaces.find(p => p.id === id);
  if (!place) return <View style={s.root}><Text style={s.body}>Dieses Lokal gibt es nicht mehr. Zurück zur Karte.</Text></View>;
  const fresh = isMenuFresh(place.confirmations);
  const guests = place.confirmations.filter(c => c.by === 'guest').length;
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={s.hero}>
        <Pressable style={s.back} onPress={() => router.back()}><Icon name="back" color={colors.text} size={20} /></Pressable>
      </View>
      <View style={{ padding: space.edge }}>
        <Text style={s.h1}>{place.name}</Text>
        <Text style={s.meta}>♥ {place.rating.toFixed(1).replace('.', ',')}   {place.category}   {place.distanceLabel}</Text>
        <View style={[s.fresh, { borderColor: fresh ? 'rgba(143,176,138,.35)' : colors.line }]}>
          <View style={[s.ico, { backgroundColor: fresh ? 'rgba(143,176,138,.15)' : 'rgba(196,173,142,.15)' }]}>
            <Icon name={fresh ? 'check' : 'scan'} color={fresh ? colors.ok : colors.accentSoft} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.freshB}>{fresh ? 'Speisekarte bestätigt' : 'Speisekarte ungeprüft'}</Text>
            <Text style={s.freshS}>{freshnessLabel(place)}{fresh ? ` · vom Inhaber${guests ? ` und ${guests} Gäste${guests > 1 ? 'n' : ''}` : ''}` : ' · Preise können abweichen'}</Text>
          </View>
        </View>
        <Text style={s.h3}>Speisekarte</Text>
        <View style={s.menu}>
          {place.menu.map(m => (
            <View key={m.id} style={s.it}>
              <View style={{ flex: 1 }}><Text style={s.d}>{m.name}</Text>{m.description ? <Text style={s.desc}>{m.description}</Text> : null}</View>
              <Text style={s.p}>{formatPrice(m.priceCents, m.currency)}</Text>
            </View>
          ))}
        </View>
        <View style={s.cta}>
          <Pressable style={[s.btn, { backgroundColor: colors.accent }]} onPress={() => router.push('/(tabs)/scan')}>
            <Icon name="scan" color="#fff" size={18} /><Text style={[s.btnT, { color: '#fff' }]}>Am Tisch scannen</Text>
          </Pressable>
          <Pressable style={[s.btn, { backgroundColor: colors.surface2, borderColor: colors.line, borderWidth: 1 }]}>
            <Icon name="route" color={colors.text} size={18} /><Text style={s.btnT}>Route</Text>
          </Pressable>
        </View>
        <Text style={s.addr}>{place.address}, Bamberg</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 260, backgroundColor: colors.surface2 },
  back: { position: 'absolute', top: 52, left: 12, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(12,12,12,.7)', alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fonts.semibold, fontSize: sizes.placeTitle, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: sizes.meta, color: colors.text2, marginTop: 6 },
  body: { fontFamily: fonts.regular, fontSize: sizes.body, color: colors.text2, padding: space.edge, paddingTop: 80 },
  fresh: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderRadius: radius.button, padding: 12, marginTop: 14 },
  ico: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  freshB: { fontFamily: fonts.semibold, fontSize: sizes.meta, color: colors.text },
  freshS: { fontFamily: fonts.regular, fontSize: sizes.secondary, color: colors.text2 },
  h3: { fontFamily: fonts.semibold, fontSize: sizes.section, color: colors.text, marginTop: space.section },
  menu: { marginTop: 10, borderTopWidth: 1, borderTopColor: colors.line },
  it: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  d: { fontFamily: fonts.medium, fontSize: sizes.body, color: colors.text },
  desc: { fontFamily: fonts.regular, fontSize: sizes.secondary, color: colors.muted, marginTop: 2 },
  p: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.text },
  cta: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: radius.button },
  btnT: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.text },
  addr: { fontFamily: fonts.regular, fontSize: sizes.secondary, color: colors.muted, marginTop: 18 },
});
