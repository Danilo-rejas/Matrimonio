import { db, collection, doc, getDoc, addDoc, serverTimestamp } from './firebase-config.js?v=3';

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
const campoAdultos = document.getElementById('campo-adultos');
const campoNinos = document.getElementById('campo-ninos');
const labelAdultos = document.getElementById('label-adultos');
const campoNombres = document.getElementById('campo-nombres');
const labelNombres = document.getElementById('label-nombres');
const nombresInput = document.getElementById('nombresAsistentes');

// Opciones de min a max (marcado max). Si solo hay un número posible,
// queda fijo: se ve, pero no se puede cambiar.
function llenarOpciones(select, min, max) {
  select.innerHTML = '';
  for (let i = min; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
  select.value = max;
  select.disabled = min >= max;
}

function prepararPases(invitado) {
  const maxA = Number(invitado.maxAdultos) || 0;
  const maxN = Number(invitado.maxNinos) || 0;
  // Sin pases de niños ese campo no aparece, y el otro se llama solo "Pases"
  campoAdultos.hidden = maxA === 0;
  campoNinos.hidden = maxN === 0;
  campoPases.classList.toggle('rsvp-pases--uno', !maxA || !maxN);
  labelAdultos.textContent = maxN ? 'Pases para adultos' : (maxA === 1 ? 'Pase' : 'Pases');
  // Quien confirma que va, va con al menos una persona (un adulto si los hay)
  llenarOpciones(selectAdultos, maxA ? 1 : 0, maxA);
  llenarOpciones(selectNinos, maxA ? 0 : Math.min(1, maxN), maxN);
  if (maxA + maxN === 1) {
    labelNombres.textContent = 'Nombre de quien asistirá';
    nombresInput.placeholder = 'Escribe tu nombre completo';
  }
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
  prepararPases(invitado);
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
