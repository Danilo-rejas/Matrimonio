import { supabase } from './supabase-config.js';

const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('rsvp-status');
const submitBtn = document.getElementById('rsvp-submit');
const successEl = document.getElementById('rsvp-success');
const invalidEl = document.getElementById('rsvp-invalid');
const greetingEl = document.getElementById('rsvp-greeting');
const selectAdultos = document.getElementById('pasesAdultos');
const selectNinos = document.getElementById('pasesNinos');

function llenarOpciones(select, max) {
  select.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
}

async function init() {
  const codigo = new URLSearchParams(window.location.search).get('inv');

  if (!codigo) {
    invalidEl.hidden = false;
    return;
  }

  const { data: invitado, error } = await supabase
    .from('invitados')
    .select('*')
    .eq('codigo', codigo)
    .single();

  if (error || !invitado) {
    invalidEl.hidden = false;
    return;
  }

  greetingEl.textContent = `Confirmando para: ${invitado.nombre}`;
  llenarOpciones(selectAdultos, invitado.max_adultos);
  llenarOpciones(selectNinos, invitado.max_ninos);
  form.hidden = false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const pasesAdultos = Number(selectAdultos.value);
    const pasesNinos = Number(selectNinos.value);
    const nombresAsistentes = document.getElementById('nombresAsistentes').value.trim();
    const mensaje = document.getElementById('mensaje').value.trim();

    if (!nombresAsistentes) {
      statusEl.textContent = 'Por favor escribe los nombres de los asistentes.';
      statusEl.className = 'form-status form-status--error';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Enviando...';
    statusEl.className = 'form-status';

    const { error: insertError } = await supabase.from('rsvps').insert({
      invitado_id: invitado.id,
      pases_adultos: pasesAdultos,
      pases_ninos: pasesNinos,
      cantidad_pases: pasesAdultos + pasesNinos,
      nombres_asistentes: nombresAsistentes,
      mensaje
    });

    if (insertError) {
      console.error(insertError);
      statusEl.textContent = 'Hubo un problema al enviar tu confirmación. Intenta de nuevo.';
      statusEl.className = 'form-status form-status--error';
      submitBtn.disabled = false;
      return;
    }

    form.reset();
    form.hidden = true;
    successEl.hidden = false;
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

init();
