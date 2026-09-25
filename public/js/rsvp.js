import { db, collection, doc, getDoc, addDoc, serverTimestamp } from './firebase-config.js';

const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('rsvp-status');
const submitBtn = document.getElementById('rsvp-submit');
const successEl = document.getElementById('rsvp-success');
const successTitle = document.getElementById('rsvp-success-title');
const successText = document.getElementById('rsvp-success-text');
const invalidEl = document.getElementById('rsvp-invalid');
const greetingEl = document.getElementById('rsvp-greeting');
const selectAdultos = document.getElementById('pasesAdultos');
const selectNinos = document.getElementById('pasesNinos');
const campoPases = document.getElementById('campo-pases');
const campoNombres = document.getElementById('campo-nombres');
const nombresInput = document.getElementById('nombresAsistentes');

function llenarOpciones(select, max) {
  select.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  select.value = max;
}

function asiste() {
  return form.querySelector('input[name="asiste"]:checked').value === 'si';
}

function actualizarCampos() {
  const va = asiste();
  campoPases.hidden = !va;
  campoNombres.hidden = !va;
  nombresInput.required = va;
}

// El código viene en el enlace personal: ?inv=CODIGO  (también se acepta ?i=)
function codigoDelEnlace() {
  const params = new URLSearchParams(window.location.search);
  return params.get('inv') || params.get('i');
}

async function init() {
  const codigo = codigoDelEnlace();
  if (!codigo) {
    invalidEl.hidden = false;
    return;
  }

  // La colección "enlaces" solo guarda nombre y pases: es lo único que el
  // invitado puede ver con su código (ver firestore.rules).
  let invitado = null;
  try {
    const snap = await getDoc(doc(db, 'enlaces', codigo));
    if (snap.exists()) invitado = { codigo, ...snap.data() };
  } catch (err) {
    console.error(err);
  }
  if (!invitado) {
    invalidEl.hidden = false;
    return;
  }

  greetingEl.textContent = `Confirmando para: ${invitado.nombre}`;
  llenarOpciones(selectAdultos, Number(invitado.maxAdultos) || 0);
  llenarOpciones(selectNinos, Number(invitado.maxNinos) || 0);
  form.hidden = false;
  form.querySelectorAll('input[name="asiste"]').forEach((r) => r.addEventListener('change', actualizarCampos));
  actualizarCampos();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const va = asiste();
    const pasesAdultos = va ? Number(selectAdultos.value) : 0;
    const pasesNinos = va ? Number(selectNinos.value) : 0;
    const nombresAsistentes = nombresInput.value.trim() || invitado.nombre;
    const mensaje = document.getElementById('mensaje').value.trim();

    if (va && pasesAdultos + pasesNinos === 0) {
      statusEl.textContent = 'Elige al menos un pase, o marca "No podré asistir".';
      statusEl.className = 'form-status form-status--error';
      return;
    }
    if (va && !nombresInput.value.trim()) {
      statusEl.textContent = 'Por favor escribe los nombres de los asistentes.';
      statusEl.className = 'form-status form-status--error';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Enviando...';
    statusEl.className = 'form-status';

    try {
      await addDoc(collection(db, 'rsvps'), {
        invitadoId: invitado.invitadoId,
        asiste: va,
        pasesAdultos,
        pasesNinos,
        cantidadPases: pasesAdultos + pasesNinos,
        nombresAsistentes,
        mensaje,
        creadoEn: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Hubo un problema al enviar tu confirmación. Intenta de nuevo.';
      statusEl.className = 'form-status form-status--error';
      submitBtn.disabled = false;
      return;
    }

    if (!va) {
      successTitle.textContent = 'Te vamos a extrañar';
      successText.textContent = 'Gracias por avisarnos. Sabemos que estarás con nosotros de corazón.';
    }
    form.reset();
    form.hidden = true;
    successEl.hidden = false;
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

init();
