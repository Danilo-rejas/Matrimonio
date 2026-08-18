import { supabase } from './supabase-config.js';

async function init() {
  const el = document.getElementById('cover-invitado');
  const nombreEl = document.getElementById('cover-invitado-nombre');
  const pasesEl = document.getElementById('cover-invitado-pases');
  if (!el || !nombreEl || !pasesEl) return;

  const codigo = new URLSearchParams(window.location.search).get('inv');
  if (!codigo) return;

  const { data: invitado, error } = await supabase
    .from('invitados')
    .select('nombre, max_adultos, max_ninos')
    .eq('codigo', codigo)
    .single();

  if (error || !invitado) return;

  const totalPases = invitado.max_adultos + invitado.max_ninos;

  nombreEl.textContent = invitado.nombre;
  pasesEl.textContent = totalPases === 1 ? '1 pase' : `${totalPases} pases`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('cover__invitado--visible'));
}

init();
