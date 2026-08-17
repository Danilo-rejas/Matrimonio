import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Estos dos valores son PÚBLICOS a propósito (están hechos para ir en el
// frontend). Los encuentras en: Supabase > Configuración del proyecto > API.
// NUNCA pongas aquí la contraseña de la base de datos.
const SUPABASE_URL = 'https://vwwepwgiroxsqxxmdhzm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lnAlvzwgacQX5ed_U9aGDw_eGOH6HA_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
