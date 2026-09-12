import Svg, { Path, Circle, Rect } from 'react-native-svg';

type Name = 'pin' | 'play' | 'scan' | 'heart' | 'user' | 'check' | 'back' | 'route';
// Minimale Icon-Sammlung als SVG-Pfade, gleiche Linien wie im Prototyp.
export function Icon({ name, color, size = 22, fill = 'none' }: { name: Name; color: string; size?: number; fill?: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'pin' && <><Path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" {...p} /><Circle cx="12" cy="10" r="2.5" {...p} /></>}
      {name === 'play' && <><Rect x="4" y="3" width="16" height="18" rx="3" {...p} /><Path d="M10 9l5 3-5 3z" {...p} /></>}
      {name === 'scan' && <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" {...p} />}
      {name === 'heart' && <Path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" {...p} />}
      {name === 'user' && <><Circle cx="12" cy="8" r="4" {...p} /><Path d="M4 21a8 8 0 0 1 16 0" {...p} /></>}
      {name === 'check' && <Path d="M5 12l5 5L20 7" {...p} />}
      {name === 'back' && <Path d="M15 6l-6 6 6 6" {...p} />}
      {name === 'route' && <Path d="M3 11l18-8-8 18-2-8z" {...p} />}
    </Svg>
  );
}
