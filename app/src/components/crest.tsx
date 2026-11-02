// Escudos de equipos (assets locales). Si no hay imagen, monograma con iniciales.
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { brand } from '@/constants/theme';

const IMG = {
  tigres: require('@/assets/crests/tigres.png'),
  rayadas: require('@/assets/crests/rayadas.png'),
  america: require('@/assets/crests/america.png'),
  pachuca: require('@/assets/crests/pachuca.png'),
  chivas: require('@/assets/crests/chivas.png'),
  'cruz azul': require('@/assets/crests/cruz-azul.png'),
  pumas: require('@/assets/crests/pumas.png'),
  atlas: require('@/assets/crests/atlas.png'),
  juarez: require('@/assets/crests/juarez.png'),
  necaxa: require('@/assets/crests/necaxa.png'),
  leon: require('@/assets/crests/leon.png'),
} as const;
const ALIAS: Record<string, keyof typeof IMG> = { monterrey: 'rayadas', guadalajara: 'chivas' };
const ABR: Record<string, string> = { tigres: 'TIG', rayadas: 'RAY', monterrey: 'RAY', america: 'AME', pachuca: 'PAC', chivas: 'CHI', guadalajara: 'CHI', 'cruz azul': 'CAZ', pumas: 'PUM', atlas: 'ATS', juarez: 'JUA', necaxa: 'NEC', leon: 'LEO', toluca: 'TOL', queretaro: 'QRO', puebla: 'PUE', santos: 'SAN', mazatlan: 'MAZ', tijuana: 'TIJ', 'san luis': 'SLP' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const esTigres = (s: string) => /tigres/i.test(s);
export const abbr = (team: string) => {
  const n = norm(team); const k = Object.keys(ABR).find((x) => n.includes(x));
  return k ? ABR[k] : n.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase();
};

export function Crest({ team, size = 32 }: { team: string; size?: number }) {
  const n = norm(team);
  const key = (Object.keys(IMG) as (keyof typeof IMG)[]).find((k) => n.includes(k)) ?? Object.keys(ALIAS).map((a) => (n.includes(a) ? ALIAS[a] : undefined)).find(Boolean);
  if (key) return <Image source={IMG[key]} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel={team} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: brand.gold, fontWeight: '700', fontSize: size * 0.36 }}>{abbr(team).slice(0, 2)}</Text>
    </View>
  );
}
