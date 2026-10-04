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
const nombresInput = document.getElementById('nombresAsistentes');

// Invitación para una sola persona: no hay pases que elegir ni nombres que
// escribir; solo dice si va o no, y la respuesta se guarda con su nombre.
let individual = false;

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
  individual = maxA + maxN === 1;
}

function asiste() {
  return form.querySelector('input[name="asiste"]:checked').value === 'si';
}

function actualizarCampos() {
  const va = asiste();
  campoPases.hidden = !va || individual;
  campoNombres.hidden = !va || individual;
  nombresInput.required = va && !individual;
}

// "3 lugares (2 adultos y 1 niño)" / "2 lugares"
function lugaresTxt(adultos, ninos) {
  const total = adultos + ninos;
  const base = `${total} ${total === 1 ? 'lugar' : 'lugares'}`;
  if (!ninos || !adultos) return base;
  return `${base} (${adultos} ${adultos === 1 ? 'adulto' : 'adultos'} y ${ninos} ${ninos === 1 ? 'niño' : 'niños'})`;
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
    const nombresAsistentes = individual ? invitado.nombre : (nombresInput.value.trim() || invitado.nombre);
    const mensaje = document.getElementById('mensaje').value.trim();

    if (va && pasesAdultos + pasesNinos === 0) {
      statusEl.textContent = 'Elige al menos un pase, o marca "No podré asistir".';
      statusEl.className = 'form-status form-status--error';
      return;
    }
    if (va && !individual && !nombresInput.value.trim()) {
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

    // Mensaje concreto (qué quedó registrado); el agradecimiento y el
    // "Los esperamos" ya están en el cierre de la invitación.
    if (va) {
      successTitle.textContent = '¡Confirmado!';
      successText.textContent = individual
        ? 'Tu lugar ya está reservado.'
        : `Reservamos ${lugaresTxt(pasesAdultos, pasesNinos)} a nombre de ${invitado.nombre}.`;
    } else {
      successTitle.textContent = 'Te vamos a extrañar';
      successText.textContent = 'Lamentamos que no puedas acompañarnos. Te tendremos presentes ese día.';
    }
    form.reset();
    form.hidden = true;
    successEl.hidden = false;
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

init();
