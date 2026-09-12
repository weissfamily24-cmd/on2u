import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { colors, fonts, sizes, radius, space } from '@/theme/tokens';
import { demoPlaces } from '@/lib/demo/places';
import { isMenuFresh } from '@/lib/data/freshness';
import { FreshBadge } from '@/components/FreshBadge';
import { HeartbeatPulse } from '@/components/HeartbeatPulse';

const BAMBERG = { latitude: 49.8917, longitude: 10.8870, latitudeDelta: 0.02, longitudeDelta: 0.02 };

// Karte: Finden. Frische Pins in Terrakotta und pulsierend, ungeprüfte grau.
export default function MapScreen() {
  const router = useRouter();
  const places = demoPlaces; // TODO(backend): durch Supabase-Query ersetzen, sortiert nach Entfernung
  const freshCount = places.filter(p => isMenuFresh(p.confirmations)).length;
  return (
    <View style={s.root}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={BAMBERG} userInterfaceStyle="dark" customMapStyle={darkMap}>
        {places.map(p => {
          const fresh = isMenuFresh(p.confirmations);
          return (
            <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} onPress={() => router.push(`/place/${p.id}`)} tracksViewChanges={false}>
              <View style={s.pinWrap}>
                {fresh && <HeartbeatPulse />}
                <View style={[s.pin, { backgroundColor: fresh ? colors.accent : colors.muted }]} />
                <Text style={s.pinLbl}>{p.name}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <View style={s.search}><Text style={s.searchTxt}>Restaurants und Bars in Bamberg</Text></View>
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.h2}>In deiner Nähe <Text style={s.small}>{places.length} Orte · {freshCount} mit aktueller Karte</Text></Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.edge, gap: 10 }}>
          {places.map(p => (
            <Pressable key={p.id} style={s.card} onPress={() => router.push(`/place/${p.id}`)}>
              <View style={s.img}><View style={{ position: 'absolute', left: 8, bottom: 8 }}><FreshBadge fresh={isMenuFresh(p.confirmations)} /></View></View>
              <View style={{ padding: 12 }}>
                <Text style={s.n}>{p.name}</Text>
                <View style={s.m}><Text style={s.mt}>{p.category} · {p.distanceLabel}</Text><Text style={s.mt}>♥ {p.rating.toFixed(1).replace('.', ',')}</Text></View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#131110' },
  search: { position: 'absolute', top: 56, left: space.edge, right: space.edge, height: 46, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 16 },
  searchTxt: { fontFamily: fonts.regular, fontSize: sizes.body, color: colors.text2 },
  pinWrap: { alignItems: 'center', justifyContent: 'center', width: 120, height: 44 },
  pin: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: colors.bg },
  pinLbl: { fontFamily: fonts.medium, fontSize: sizes.badge, color: colors.text, backgroundColor: 'rgba(12,12,12,.7)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingBottom: 14, backgroundColor: 'rgba(12,12,12,.92)' },
  handle: { width: 36, height: 4, backgroundColor: colors.line, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  h2: { fontFamily: fonts.semibold, fontSize: sizes.section, color: colors.text, paddingHorizontal: space.edge, paddingBottom: 10 },
  small: { fontFamily: fonts.regular, fontSize: sizes.secondary, color: colors.muted },
  card: { width: 220, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  img: { height: 110, backgroundColor: colors.surface2 },
  n: { fontFamily: fonts.semibold, fontSize: sizes.body, color: colors.text },
  m: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  mt: { fontFamily: fonts.regular, fontSize: sizes.secondary, color: colors.text2 },
});

// Dunkler Kartenstil in Markenfarben (Google Maps JSON-Format).
const darkMap = [
  { elementType: 'geometry', stylers: [{ color: '#131110' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5a544d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#131110' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#221f1b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e2a30' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];
