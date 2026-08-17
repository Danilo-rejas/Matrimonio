import { supabase } from './supabase-config.js';

const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('rsvp-status');
const submitBtn = document.getElementById('rsvp-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const cantidadPases = Number(document.getElementById('cantidadPases').value);
  const nombresAsistentes = document.getElementById('nombresAsistentes').value.trim();
  const mensaje = document.getElementById('mensaje').value.trim();

  if (!cantidadPases || !nombresAsistentes) {
    statusEl.textContent = 'Por favor completa la cantidad de pases y los nombres.';
    statusEl.className = 'form-status form-status--error';
    return;
  }

  submitBtn.disabled = true;
  statusEl.textContent = 'Enviando...';
  statusEl.className = 'form-status';

  const { error } = await supabase.from('rsvps').insert({
    cantidad_pases: cantidadPases,
    nombres_asistentes: nombresAsistentes,
    mensaje
  });

  if (error) {
    console.error(error);
    statusEl.textContent = 'Hubo un problema al enviar tu confirmación. Intenta de nuevo.';
    statusEl.className = 'form-status form-status--error';
    submitBtn.disabled = false;
    return;
  }

  statusEl.textContent = '¡Gracias por confirmar! Los esperamos.';
  statusEl.className = 'form-status form-status--ok';
  form.reset();
});
