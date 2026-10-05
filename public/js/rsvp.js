import { db, doc, getDoc, setDoc, serverTimestamp } from './firebase-config.js?v=3';

const form = document.getElementById('rsvp-form');
const statusEl = document.getElementById('rsvp-status');
const submitBtn = document.getElementById('rsvp-submit');
const rsvpSection = document.getElementById('rsvp');
// Foto del cierre: su mensaje cambia según la respuesta
const cierre = document.getElementById('cierre');
const cierreTexto = document.getElementById('cierre-texto');
const cierreEyebrow = document.getElementById('cierre-eyebrow');
const cierreTitulo = document.getElementById('cierre-titulo');
const cierreDetalle = document.getElementById('cierre-detalle');
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

// Una vez que respondió (al enviar, o cada vez que vuelve a abrir su enlace):
// la sección del formulario desaparece y el agradecimiento va en la foto del
// cierre, según lo que respondió. Se responde una sola vez.
function mostrarRespuesta(invitado, r) {
  if (r.asiste === false) {
    cierreEyebrow.textContent = 'Gracias por avisarnos';
    cierreTitulo.textContent = 'Te extrañaremos';
    cierreDetalle.textContent = 'Sentiremos tu ausencia, pero te llevaremos en el corazón ese día.';
  } else {
    const adultos = Number(r.pasesAdultos ?? r.cantidadPases) || 0;
    const ninos = Number(r.pasesNinos) || 0;
    const total = adultos + ninos;
    cierreEyebrow.textContent = 'Gracias por confirmar';
    cierreTitulo.textContent = total > 1 ? 'Los esperamos' : 'Te esperamos';
    cierreDetalle.textContent = total > 1
      ? `Reservamos ${lugaresTxt(adultos, ninos)} a nombre de ${invitado.nombre}.`
      : 'Tu lugar ya está reservado.';
  }
  cierreDetalle.hidden = false;
  rsvpSection.hidden = true;
}

// Justo después de enviar: baja a la foto del cierre y su mensaje aparece suave
function irAlCierre() {
  cierre.classList.add('reveal--visible');
  cierreTexto.classList.remove('foto-banner__inner--respuesta');
  void cierreTexto.offsetWidth; // reinicia la animación
  cierreTexto.classList.add('foto-banner__inner--respuesta');
  cierre.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// La respuesta se guarda con el código del enlace como id (rsvps/CODIGO):
// así se sabe si ya respondió y las reglas no dejan responder otra vez.
async function respuestaPrevia(codigo) {
  try {
    const snap = await getDoc(doc(db, 'rsvps', codigo));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error(err);
    return null;
  }
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

  const previa = await respuestaPrevia(codigo);
  if (previa) {
    mostrarRespuesta(invitado, previa);
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

    const respuesta = {
      invitadoId: invitado.invitadoId,
      asiste: va,
      pasesAdultos,
      pasesNinos,
      cantidadPases: pasesAdultos + pasesNinos,
      nombresAsistentes,
      mensaje,
      creadoEn: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'rsvps', invitado.codigo), respuesta);
    } catch (err) {
      console.error(err);
      // Si ya había respondido (por ejemplo desde otro celular), se muestra esa respuesta
      const previaAlEnviar = await respuestaPrevia(invitado.codigo);
      if (previaAlEnviar) {
        mostrarRespuesta(invitado, previaAlEnviar);
        irAlCierre();
        return;
      }
      statusEl.textContent = 'Hubo un problema al enviar tu confirmación. Intenta de nuevo.';
      statusEl.className = 'form-status form-status--error';
      submitBtn.disabled = false;
      return;
    }

    form.reset();
    mostrarRespuesta(invitado, respuesta);
    irAlCierre();
  });
}

init();
