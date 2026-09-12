import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors } from '@/theme/tokens';

// Pulsierender Ring um frische Pins. Einziges Motion-Motiv der App: Herzschlag.
export function HeartbeatPulse({ size = 16 }: { size?: number }) {
  const t = useSharedValue(0);
  useEffect(() => { t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false); }, []);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + t.value * 1.6 }], opacity: 0.9 * (1 - t.value) }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.accent }, ring]} />
  );
}
