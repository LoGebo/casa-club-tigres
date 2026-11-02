import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session } = useAuth();
  if (!session) return <Redirect href="/login" />;
  if (session.cambiar_pin) return <Redirect href="/cambiar-pin" />; // PIN temporal: primero elige el suyo
  return <Redirect href={session.rol === 'jugadora' ? '/jugadora/inicio' : session.rol === 'seguridad' ? '/seguridad/escanear' : '/coord/hoy'} />;
}
