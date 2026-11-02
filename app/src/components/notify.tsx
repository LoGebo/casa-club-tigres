// Aviso breve tipo toast (funciona igual en iOS, Android y web). Uso: notify('Guardado ✓')
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';

type Fn = (m: string) => void;
let push: Fn = () => {};
export const notify = (m: string) => push(m);

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    push = (m) => { setMsg(m); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 2600); };
    return () => clearTimeout(timer);
  }, []);
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', paddingHorizontal: 24 }}>
      <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOut.duration(150)} style={{ backgroundColor: 'rgba(28,28,30,0.94)', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, maxWidth: 420 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '500', textAlign: 'center' }}>{msg}</Text>
      </Animated.View>
    </View>
  );
}

/** Ejecuta una acción y muestra el error como aviso si falla */
export async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try { return await fn(); } catch (e) { notify(e instanceof Error ? e.message : 'Algo salió mal'); }
}
