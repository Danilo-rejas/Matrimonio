import { supabase } from './supabase-config.js';

async function init() {
  const el = document.getElementById('cover-invitado');
  if (!el) return;

  const codigo = new URLSearchParams(window.location.search).get('inv');
  if (!codigo) return;

  const { data: invitado, error } = await supabase
    .from('invitados')
    .select('nombre, max_adultos, max_ninos')
    .eq('codigo', codigo)
    .single();

  if (error || !invitado) return;

  const totalPases = invitado.max_adultos + invitado.max_ninos;
  const textoPases = totalPases === 1 ? '1 pase' : `${totalPases} pases`;

  el.textContent = `Invitación para ${invitado.nombre} · ${textoPases}`;
  el.hidden = false;
}

init();
