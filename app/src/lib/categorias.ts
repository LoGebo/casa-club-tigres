// Categorías del club (configurables por Coordinación). «Sub-XX» = fuerzas básicas; el resto = profesional.
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';

export const nivelDe = (c?: string | null) => (!c ? '' : /^sub/i.test(c) ? 'Fuerzas básicas' : 'Profesional');

export function useCategorias() {
  const [cats, setCats] = useState<string[]>([]);
  useEffect(() => { api<{ categorias?: string }>('/config').then((c) => setCats((c.categorias ?? '').split(',').map((x) => x.trim()).filter(Boolean))).catch(() => {}); }, []);
  return cats;
}
