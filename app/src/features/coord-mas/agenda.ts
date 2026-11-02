export const TIPOS_AGENDA = [['entrenamiento', 'Entrenamiento'], ['comida', 'Comida'], ['gym', 'Gimnasio'], ['escuela', 'Escuela'], ['fisioterapia', 'Fisioterapia'], ['estudio', 'Estudio'], ['transporte', 'Transporte'], ['otro', 'Otro']] as const;
export const TIPO_AGENDA: Record<string, string> = Object.fromEntries(TIPOS_AGENDA);
