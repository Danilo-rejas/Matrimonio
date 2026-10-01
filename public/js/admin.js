import {
  db, auth, CORREOS_GOOGLE, CORREOS_CONTRASENA,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup,
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch, serverTimestamp, Timestamp
} from './firebase-config.js?v=3';

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const panelView = $('panel-view');
const loginForm = $('login-form');
const loginStatus = $('login-status');
const logoutBtn = $('logout-btn');
const statsEl = $('stats');
const toastEl = $('toast');

// ---------- Estado ----------
const state = { invitados: [], mesas: [], rsvps: [] };
let detenerEscuchas = [];

// Enlace base de la invitación: la misma dirección del sitio sin "/admin"
const BASE_URL = window.location.href.replace(/admin(\.html)?(\?.*)?(#.*)?$/, '');
$('base-url').textContent = BASE_URL;

const PLANTILLA_DEFAULT =
`¡Hola {nombre}! 💛
Con mucha alegría queremos invitarte a nuestra boda, el sábado 12 de diciembre de 2026.

Hemos reservado {pases} para ti. Esta es tu invitación personal, ahí puedes ver todos los detalles y confirmar tu asistencia:
{enlace}

Con cariño,
Alondra & Julio`;

// Iconos de los botones (trazos estilo Lucide; WhatsApp relleno)
const svg = (d, relleno) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${relleno
  ? 'fill="currentColor"'
  : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;
const ICONO = {
  enlace: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  whatsapp: svg('<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 0 0-3.48-8.41Z"/>', true),
  editar: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  borrar: svg('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>'),
  telefono: svg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92Z"/>'),
  personas: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  mesa: svg('<circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="12" cy="20.5" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="20.5" cy="12" r="1.5"/>'),
  // Globo: marca a los niños y a las mesas de niños
  nino: svg('<path d="M12 15.5c3.3 0 6-2.8 6-6.3S15.3 3 12 3 6 5.7 6 9.2s2.7 6.3 6 6.3Z"/><path d="m11 15.5-.6 1.6h3.2l-.6-1.6"/><path d="M12 17.1c0 1.6-1.6 2.2-1 3.9"/>')
};

// Cuenta regresiva bajo los nombres: "faltan 73 días"
(function cuentaRegresiva() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(2026, 11, 12) - hoy) / 86400000);
  $('cuenta-regresiva').textContent = dias > 1 ? `faltan ${dias} días`
    : dias === 1 ? '¡es mañana!'
      : dias === 0 ? '¡hoy es el gran día!'
        : '¡recién casados!';
})();

// =====================================================================
// LOGIN
// =====================================================================
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Ingresando...';
  loginStatus.className = 'form-status';
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
  } catch (err) {
    console.error(err);
    loginStatus.textContent = err.code === 'auth/invalid-api-key' || err.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.'
      ? 'Falta pegar la configuración de Firebase en js/firebase-config.js.'
      : 'Correo o contraseña incorrectos.';
    loginStatus.className = 'form-status form-status--error';
  }
});

$('google-btn').addEventListener('click', async () => {
  loginStatus.textContent = 'Abriendo Google...';
  loginStatus.className = 'form-status';
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      loginStatus.textContent = '';
      return;
    }
    loginStatus.textContent = err.code === 'auth/operation-not-allowed'
      ? 'Falta activar Google en Firebase: Authentication → Sign-in method → Google.'
      : err.code === 'auth/unauthorized-domain'
        ? 'Este dominio no está autorizado en Firebase (Authentication → Settings → Dominios autorizados).'
        : 'No se pudo entrar con Google.';
    loginStatus.className = 'form-status form-status--error';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

function correoAutorizado(user) {
  const correo = (user.email || '').toLowerCase();
  const enLista = (lista) => lista.map((c) => c.toLowerCase()).includes(correo);
  const conContrasena = user.providerData.some((p) => p.providerId === 'password');
  return (user.emailVerified && enLista(CORREOS_GOOGLE))
    || (conContrasena && enLista(CORREOS_CONTRASENA));
}

onAuthStateChanged(auth, (user) => {
  if (user && !correoAutorizado(user)) {
    signOut(auth);
    loginStatus.textContent = `La cuenta ${user.email} no está autorizada para este panel.`;
    loginStatus.className = 'form-status form-status--error';
    return;
  }
  if (user) {
    loginView.style.display = 'none';
    panelView.style.display = 'grid';
    $('user-email').textContent = user.email || '';
    escuchar();
  } else {
    loginView.style.display = 'block';
    panelView.style.display = 'none';
    detenerEscuchas.forEach((fn) => fn());
    detenerEscuchas = [];
  }
});

// =====================================================================
// DATOS (tiempo real: cada cambio en Firestore vuelve a dibujar el panel)
// =====================================================================
function escuchar() {
  if (detenerEscuchas.length) return;

  const aLista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const onError = (err) => {
    console.error(err);
    toast('No se pudieron leer los datos. Revisa las reglas de Firestore.');
  };

  detenerEscuchas.push(
    onSnapshot(query(collection(db, 'invitados'), orderBy('nombre')), (snap) => {
      state.invitados = aLista(snap);
      render();
    }, onError),
    onSnapshot(query(collection(db, 'mesas'), orderBy('orden')), (snap) => {
      state.mesas = aLista(snap);
      render();
    }, onError),
    onSnapshot(query(collection(db, 'rsvps'), orderBy('creadoEn', 'desc')), (snap) => {
      state.rsvps = aLista(snap);
      render();
    }, onError)
  );
}

// Última respuesta de cada invitado (los rsvps vienen ordenados del más nuevo al más viejo)
function respuestaDe(invitadoId) {
  return state.rsvps.find((r) => r.invitadoId === invitadoId) || null;
}

// 'confirmo' | 'no_asiste' | 'sin_respuesta'
function estadoDe(inv) {
  const r = respuestaDe(inv.id);
  if (!r) return 'sin_respuesta';
  return r.asiste === false ? 'no_asiste' : 'confirmo';
}

// Pases que ocupan silla: los confirmados; si no respondió, los reservados
// Pases reservados a un invitado (adultos + niños)
function pasesDe(inv) {
  return (Number(inv.maxAdultos) || 0) + (Number(inv.maxNinos) || 0);
}

// "2 adultos y 1 niño"
function personasTxt(a, n) {
  const partes = [];
  if (a) partes.push(`${a} ${a === 1 ? 'adulto' : 'adultos'}`);
  if (n) partes.push(`${n} ${n === 1 ? 'niño' : 'niños'}`);
  return partes.join(' y ') || '0 pases';
}

function pasesTxt(inv) {
  return personasTxt(Number(inv.maxAdultos) || 0, Number(inv.maxNinos) || 0);
}

// Para el mensaje de WhatsApp: "2 pases" o, si hay niños, "3 pases (2 adultos y 1 niño)"
function pasesMensaje(inv) {
  const total = pasesDe(inv);
  const txt = `${total} ${total === 1 ? 'pase' : 'pases'}`;
  return Number(inv.maxNinos) ? `${txt} (${pasesTxt(inv)})` : txt;
}

function pasesOcupados(inv) {
  const r = respuestaDe(inv.id);
  if (!r) return pasesDe(inv);
  return r.asiste === false ? 0 : Number(r.cantidadPases) || 0;
}

// Lo mismo, separado en adultos y niños
function ocupaDe(inv) {
  const r = respuestaDe(inv.id);
  if (!r) return { adultos: Number(inv.maxAdultos) || 0, ninos: Number(inv.maxNinos) || 0 };
  if (r.asiste === false) return { adultos: 0, ninos: 0 };
  const ninos = Number(r.pasesNinos) || 0;
  const adultos = r.pasesAdultos != null ? Number(r.pasesAdultos) || 0 : Math.max(0, (Number(r.cantidadPases) || 0) - ninos);
  return { adultos, ninos };
}

function enlaceDe(inv) {
  return `${BASE_URL}?inv=${encodeURIComponent(inv.codigo)}`;
}

function telefonoWa(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 8) d = '591' + d; // número boliviano sin código de país
  return d;
}

function mensajeWa(inv) {
  const plantilla = localStorage.getItem('wa_plantilla') || PLANTILLA_DEFAULT;
  const pases = pasesMensaje(inv);
  return plantilla
    .replaceAll('{nombre}', inv.nombre)
    .replaceAll('{pases}', pases)
    .replaceAll('{enlace}', enlaceDe(inv));
}

function urlWa(inv) {
  const tel = telefonoWa(inv.telefono);
  const texto = encodeURIComponent(mensajeWa(inv));
  return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

// Lo único que el invitado puede leer con su código (ver firestore.rules)
function enlacePublico(invitadoId, datos) {
  return { invitadoId, nombre: datos.nombre, maxAdultos: datos.maxAdultos, maxNinos: datos.maxNinos };
}

function nuevoCodigo() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36)).join('').slice(0, 10);
}

function fechaDe(valor) {
  if (!valor) return null;
  if (valor instanceof Timestamp) return valor.toDate();
  if (typeof valor.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return isNaN(d) ? null : d;
}

// =====================================================================
// RENDER GENERAL
// =====================================================================
function render() {
  renderStats();
  renderInvitados();
  renderAsistencia();
  renderMesas();
  renderRespuestas();
}

function renderStats() {
  const total = state.invitados.length;
  const confirmados = state.invitados.filter((i) => estadoDe(i) === 'confirmo');
  const personas = confirmados.reduce((s, i) => s + pasesOcupados(i), 0);
  statsEl.innerHTML = `<strong>${total}</strong> invitados · <strong>${confirmados.length}</strong> confirmaron · <strong>${personas}</strong> personas`;
}

// Iniciales para el avatar: "Familia Pérez López" → "FP"
function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((p) => p[0]);
  return (letras.join('') || '?').toUpperCase();
}

// Color del avatar (1-4), siempre el mismo para el mismo nombre
function tonoAvatar(nombre) {
  let h = 0;
  for (const c of String(nombre || '')) h = (h * 31 + c.charCodeAt(0)) % 997;
  return (h % 4) + 1;
}

// =====================================================================
// PESTAÑAS
// =====================================================================
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('is-active', t === btn));
  document.querySelectorAll('.tab-panel').forEach((p) =>
    p.classList.toggle('is-active', p.id === `tab-${btn.dataset.tab}`)
  );
  $('page-title').textContent = btn.dataset.titulo || btn.textContent.trim();
  window.scrollTo({ top: 0 });
});

// =====================================================================
// PARTE 1 · INVITADOS + ENLACE ÚNICO + WHATSAPP
// =====================================================================
const invForm = $('inv-form');
const invStatus = $('inv-status');

$('wa-plantilla').value = localStorage.getItem('wa_plantilla') || PLANTILLA_DEFAULT;
$('wa-guardar').addEventListener('click', () => {
  localStorage.setItem('wa_plantilla', $('wa-plantilla').value);
  render();
  toast('Mensaje guardado');
});
$('wa-restaurar').addEventListener('click', () => {
  localStorage.removeItem('wa_plantilla');
  $('wa-plantilla').value = PLANTILLA_DEFAULT;
  render();
  toast('Mensaje restaurado');
});

invForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('inv-id').value;
  const datos = {
    nombre: $('inv-nombre').value.trim(),
    telefono: $('inv-telefono').value.trim(),
    maxAdultos: Number($('inv-adultos').value) || 0,
    maxNinos: Number($('inv-ninos').value) || 0,
    notas: $('inv-notas').value.trim()
  };
  if (!datos.nombre) return;
  if (datos.maxAdultos + datos.maxNinos === 0) {
    invStatus.textContent = 'Indica al menos un pase (adultos o niños).';
    invStatus.className = 'form-status form-status--error';
    return;
  }

  invStatus.textContent = 'Guardando...';
  invStatus.className = 'form-status';

  try {
    const batch = writeBatch(db);
    if (id) {
      const inv = state.invitados.find((i) => i.id === id);
      batch.update(doc(db, 'invitados', id), datos);
      // El enlace público guarda solo nombre y pases: mantenerlo sincronizado
      batch.set(doc(db, 'enlaces', inv.codigo), enlacePublico(id, datos));
    } else {
      const codigo = nuevoCodigo();
      const ref = doc(collection(db, 'invitados'));
      batch.set(ref, { ...datos, codigo, mesaId: null, mesaNinosId: null, creadoEn: serverTimestamp() });
      batch.set(doc(db, 'enlaces', codigo), enlacePublico(ref.id, datos));
    }
    await batch.commit();
  } catch (err) {
    console.error(err);
    invStatus.textContent = 'No se pudo guardar. Revisa la configuración y las reglas de Firebase.';
    invStatus.className = 'form-status form-status--error';
    return;
  }
  invStatus.textContent = '';
  cancelarEdicion();
  toast(id ? 'Invitado actualizado' : 'Invitado agregado');
});

$('inv-cancel').addEventListener('click', cancelarEdicion);

function cancelarEdicion() {
  invForm.reset();
  $('inv-id').value = '';
  $('inv-adultos').value = 2;
  $('inv-ninos').value = 0;
  $('inv-form-title').textContent = 'Agregar invitado';
  $('inv-submit').querySelector('span').textContent = 'Guardar invitado';
  $('inv-cancel').style.display = 'none';
}

function editarInvitado(inv) {
  $('inv-id').value = inv.id;
  $('inv-nombre').value = inv.nombre;
  $('inv-telefono').value = inv.telefono || '';
  $('inv-adultos').value = inv.maxAdultos ?? 0;
  $('inv-ninos').value = inv.maxNinos ?? 0;
  $('inv-notas').value = inv.notas || '';
  $('inv-form-title').textContent = 'Editar invitado';
  $('inv-submit').querySelector('span').textContent = 'Guardar cambios';
  $('inv-cancel').style.display = '';
  document.querySelector('.tab[data-tab="invitados"]').click();
  invForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function eliminarInvitado(inv) {
  if (!confirm(`¿Eliminar a "${inv.nombre}"? Su enlace dejará de funcionar.`)) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'invitados', inv.id));
    if (inv.codigo) batch.delete(doc(db, 'enlaces', inv.codigo));
    await batch.commit();
    toast('Invitado eliminado');
  } catch (err) {
    console.error(err);
    toast('No se pudo eliminar');
  }
}

$('inv-buscar').addEventListener('input', renderInvitados);
$('inv-filtro').addEventListener('change', renderInvitados);

const ETIQUETA = {
  confirmo: ['Confirmó', 'badge--ok'],
  no_asiste: ['No asistirá', 'badge--no'],
  sin_respuesta: ['Sin respuesta', 'badge--pending']
};

function badge(estado) {
  const [texto, clase] = ETIQUETA[estado];
  return `<span class="badge ${clase}">${texto}</span>`;
}

function renderInvitados() {
  const tbody = $('inv-tbody');
  const q = $('inv-buscar').value.trim().toLowerCase();
  const filtro = $('inv-filtro').value;

  const lista = state.invitados.filter((inv) => {
    if (q && !`${inv.nombre} ${inv.telefono || ''} ${inv.notas || ''}`.toLowerCase().includes(q)) return false;
    if (filtro === 'sin_telefono') return !telefonoWa(inv.telefono);
    if (filtro !== 'todos') return estadoDe(inv) === filtro;
    return true;
  });

  tbody.innerHTML = '';
  if (!lista.length) {
    const msg = state.invitados.length
      ? 'Ningún invitado coincide.'
      : 'Aún no hay invitados. Agrega el primero con el formulario.';
    tbody.innerHTML = `<tr><td colspan="7" class="empty">${msg}</td></tr>`;
    return;
  }

  for (const inv of lista) {
    const estado = estadoDe(inv);
    const r = respuestaDe(inv.id);
    const mesa = state.mesas.find((m) => m.id === inv.mesaId);
    const mesaNinos = state.mesas.find((m) => m.id === inv.mesaNinosId);
    // Si los niños se sientan en otra mesa, se indica debajo
    const ninosAparte = ocupaDe(inv).ninos > 0 && (mesa || mesaNinos) && mesaNinos !== mesa
      ? `<span class="sub">Niños: ${mesaNinos ? esc(mesaNinos.nombre) : 'sin mesa'}</span>` : '';
    const confirmoDistinto = estado === 'confirmo' && r.cantidadPases !== pasesDe(inv);
    const tr = document.createElement('tr');
    // Las clases c-* ubican cada celda cuando la tabla se ve como tarjetas (celular)
    tr.innerHTML = `
      <td class="c-guest">
        <div class="guest">
          <span class="avatar avatar--${tonoAvatar(inv.nombre)}">${esc(iniciales(inv.nombre))}</span>
          <div>
            <strong>${esc(inv.nombre)}</strong>
            ${inv.notas ? `<span class="sub">${esc(inv.notas)}</span>` : ''}
          </div>
        </div>
      </td>
      <td class="c-tel ${inv.telefono ? '' : 'is-vacio'}"><span class="solo-cel">${ICONO.telefono}</span>${esc(inv.telefono || '') || '<span class="sub">—</span>'}</td>
      <td class="c-pases"><span class="solo-cel">${ICONO.personas}</span><span class="pases-n">${pasesDe(inv)}</span><span class="sub">${pasesTxt(inv)}</span>${confirmoDistinto ? `<span class="sub">confirmó ${r.cantidadPases}</span>` : ''}</td>
      <td class="c-estado">${badge(estado)}</td>
      <td class="c-mesa ${mesa || mesaNinos ? '' : 'is-vacio'}"><span class="solo-cel">${ICONO.mesa}</span>${mesa ? `<span>${esc(mesa.nombre)}</span>` : '<span class="sub">—</span>'}${ninosAparte}</td>
      <td class="c-enlace nowrap">
        <button class="btn-mini" data-act="copiar" title="Copiar enlace">${ICONO.enlace}<span>Copiar<span class="solo-pc"> enlace</span></span></button>
        <a class="btn-mini btn-mini--wa" href="${urlWa(inv)}" target="_blank" rel="noopener">${ICONO.whatsapp}<span>WhatsApp</span></a>
      </td>
      <td class="c-acc nowrap">
        <button class="btn-icon" data-act="editar" title="Editar" aria-label="Editar a ${esc(inv.nombre)}">${ICONO.editar}</button>
        <button class="btn-icon btn-icon--danger" data-act="eliminar" title="Eliminar" aria-label="Eliminar a ${esc(inv.nombre)}">${ICONO.borrar}</button>
      </td>
    `;
    tr.querySelector('[data-act="copiar"]').addEventListener('click', () => copiar(enlaceDe(inv)));
    tr.querySelector('[data-act="editar"]').addEventListener('click', () => editarInvitado(inv));
    tr.querySelector('[data-act="eliminar"]').addEventListener('click', () => eliminarInvitado(inv));
    tbody.appendChild(tr);
  }
}

// =====================================================================
// PARTE 2 · ASISTENCIA
// =====================================================================
function renderAsistencia() {
  const grupos = { confirmo: [], no_asiste: [], sin_respuesta: [] };
  for (const inv of state.invitados) grupos[estadoDe(inv)].push(inv);

  const pasesInvitados = state.invitados.reduce((s, i) => s + pasesDe(i), 0);
  const personasConfirmadas = grupos.confirmo.reduce((s, i) => s + pasesOcupados(i), 0);
  const ninosConfirmados = grupos.confirmo.reduce((s, i) => s + ocupaDe(i).ninos, 0);
  const pasesPendientes = grupos.sin_respuesta.reduce((s, i) => s + pasesDe(i), 0);
  const sinEnlace = state.rsvps
    .filter((r) => !r.invitadoId && r.asiste !== false)
    .reduce((s, r) => s + (Number(r.cantidadPases) || 0), 0);

  $('stat-grid').innerHTML = [
    stat('Invitados', state.invitados.length, `${pasesInvitados} pases enviados`),
    stat('Confirmaron', grupos.confirmo.length,
      `${personasConfirmadas} personas${ninosConfirmados ? ` · ${ninosConfirmados} ${ninosConfirmados === 1 ? 'niño' : 'niños'}` : ''}`, 'ok'),
    stat('No asistirán', grupos.no_asiste.length, '', 'no'),
    stat('Sin respuesta', grupos.sin_respuesta.length, `${pasesPendientes} pases por confirmar`, 'pending'),
    sinEnlace ? stat('Sin enlace', sinEnlace, 'personas que confirmaron sin enlace personal') : ''
  ].join('');

  $('count-confirmo').textContent = grupos.confirmo.length;
  $('count-no').textContent = grupos.no_asiste.length;
  $('count-pendiente').textContent = grupos.sin_respuesta.length;

  $('list-confirmo').innerHTML = grupos.confirmo.map((inv) => {
    const r = respuestaDe(inv.id);
    const { adultos, ninos } = ocupaDe(inv);
    return `<li>
      <div class="person">
        <strong>${esc(inv.nombre)}</strong>
        <span class="sub">${ninos ? personasTxt(adultos, ninos) : `${adultos} ${adultos === 1 ? 'persona' : 'personas'}`} · ${esc(r.nombresAsistentes || '')}</span>
        ${r.mensaje ? `<span class="sub quote-mini">“${esc(r.mensaje)}”</span>` : ''}
      </div>
    </li>`;
  }).join('') || '<li class="empty">Nadie ha confirmado todavía.</li>';

  $('list-no').innerHTML = grupos.no_asiste.map((inv) => {
    const r = respuestaDe(inv.id);
    return `<li>
      <div class="person">
        <strong>${esc(inv.nombre)}</strong>
        ${r.mensaje ? `<span class="sub quote-mini">“${esc(r.mensaje)}”</span>` : ''}
      </div>
    </li>`;
  }).join('') || '<li class="empty">Nadie ha declinado.</li>';

  $('list-pendiente').innerHTML = grupos.sin_respuesta.map((inv) => `<li>
      <div class="person">
        <strong>${esc(inv.nombre)}</strong>
        <span class="sub">${pasesTxt(inv)}</span>
      </div>
      <a class="btn-mini btn-mini--wa" href="${urlWa(inv)}" target="_blank" rel="noopener" title="Recordar por WhatsApp">${ICONO.whatsapp}<span>Recordar</span></a>
    </li>`).join('') || '<li class="empty">¡Todos respondieron!</li>';
}

function stat(titulo, valor, detalle, tono) {
  return `<div class="stat ${tono ? `stat--${tono}` : ''}">
    <span class="stat__label">${titulo}</span>
    <span class="stat__value">${valor}</span>
    <span class="stat__detail">${detalle}</span>
  </div>`;
}

// =====================================================================
// PARTE 3 · MESAS (plano del salón: mesas e invitados arrastrables)
// =====================================================================
const plano = $('plano');
let mesaSeleccionada = null;   // id de la mesa abierta en el panel lateral
let arrastre = null;           // estado del arrastre en curso (mesa o invitado)
let renderPendiente = false;   // si llegan datos mientras se arrastra, se dibuja al soltar

// Posición inicial para una mesa nueva (en % del plano), en cuadrícula
function posicionLibre(indice) {
  const col = indice % 5;
  const fila = Math.floor(indice / 5);
  return { x: 14 + col * 18, y: 22 + (fila % 3) * 26 };
}

$('mesa-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = $('mesa-nombre').value.trim();
  const capacidad = Number($('mesa-capacidad').value) || 10;
  const forma = $('mesa-forma').value;
  const paraNinos = $('mesa-ninos').checked;
  if (!nombre) return;
  const orden = state.mesas.length ? Math.max(...state.mesas.map((m) => m.orden || 0)) + 1 : 1;
  const pos = posicionLibre(state.mesas.length);
  try {
    await addDoc(collection(db, 'mesas'), {
      nombre, capacidad, forma, paraNinos, orden, x: pos.x, y: pos.y, creadoEn: serverTimestamp()
    });
  } catch (err) {
    console.error(err);
    $('mesa-status').textContent = 'No se pudo crear la mesa.';
    $('mesa-status').className = 'form-status form-status--error';
    return;
  }
  $('mesa-status').textContent = '';
  $('mesa-form').reset();
  $('mesa-capacidad').value = 10;
  toast(paraNinos ? 'Mesa de niños agregada al plano' : 'Mesa agregada al plano');
});

// parte: 'adultos' (el invitado y sus acompañantes) o 'ninos' (sus niños, que
// pueden ir a otra mesa, por ejemplo una mesa de niños)
async function asignarMesa(invitadoId, mesaId, parte = 'adultos') {
  const inv = state.invitados.find((i) => i.id === invitadoId);
  const campo = parte === 'ninos' ? 'mesaNinosId' : 'mesaId';
  if (!inv || (inv[campo] || null) === (mesaId || null)) return;
  try {
    await updateDoc(doc(db, 'invitados', invitadoId), { [campo]: mesaId || null });
    const mesa = state.mesas.find((m) => m.id === mesaId);
    const quien = parte === 'ninos' ? `Niños de ${inv.nombre}` : inv.nombre;
    toast(mesa ? `${quien} → ${mesa.nombre}` : `${quien}: sin mesa`);
  } catch (err) {
    console.error(err);
    toast('No se pudo asignar');
  }
}

async function moverMesa(mesaId, x, y) {
  try {
    await updateDoc(doc(db, 'mesas', mesaId), { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar la posición');
  }
}

async function eliminarMesa(mesa) {
  const enMesa = state.invitados.filter((i) => i.mesaId === mesa.id || i.mesaNinosId === mesa.id);
  const aviso = enMesa.length ? ` Sus ${enMesa.length} invitado(s) quedarán sin mesa.` : '';
  if (!confirm(`¿Eliminar "${mesa.nombre}"?${aviso}`)) return;
  try {
    const batch = writeBatch(db);
    enMesa.forEach((inv) => {
      const cambios = {};
      if (inv.mesaId === mesa.id) cambios.mesaId = null;
      if (inv.mesaNinosId === mesa.id) cambios.mesaNinosId = null;
      batch.update(doc(db, 'invitados', inv.id), cambios);
    });
    batch.delete(doc(db, 'mesas', mesa.id));
    await batch.commit();
    if (mesaSeleccionada === mesa.id) seleccionarMesa(null);
    toast('Mesa eliminada');
  } catch (err) {
    console.error(err);
    toast('No se pudo eliminar');
  }
}

// ---- Panel lateral de la mesa seleccionada ----
$('detalle-cerrar').addEventListener('click', () => seleccionarMesa(null));
$('detalle-eliminar').addEventListener('click', () => {
  const mesa = state.mesas.find((m) => m.id === mesaSeleccionada);
  if (mesa) eliminarMesa(mesa);
});
$('detalle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!mesaSeleccionada) return;
  try {
    await updateDoc(doc(db, 'mesas', mesaSeleccionada), {
      nombre: $('detalle-nombre').value.trim() || 'Mesa',
      capacidad: Number($('detalle-capacidad').value) || 10,
      forma: $('detalle-forma').value,
      paraNinos: $('detalle-ninos').checked
    });
    toast('Mesa actualizada');
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar');
  }
});
$('detalle-add').addEventListener('change', (e) => {
  const [id, parte] = e.target.value.split('|');
  if (id && mesaSeleccionada) asignarMesa(id, mesaSeleccionada, parte);
  e.target.value = '';
});
$('sin-mesa-buscar').addEventListener('input', renderMesas);

function seleccionarMesa(id) {
  mesaSeleccionada = id;
  renderMesas();
}

// En el plano cada invitado ocupa hasta dos lugares: sus adultos (mesaId) y sus
// niños (mesaNinosId), para poder llevar a los niños a una mesa de niños.
// Los que dijeron que no, no ocupan lugar (ocupaDe les da 0).
function lugaresDe(inv) {
  const { adultos, ninos } = ocupaDe(inv);
  const lista = [];
  if (adultos) lista.push({ inv, parte: 'adultos', n: adultos, mesaId: inv.mesaId || null });
  if (ninos) lista.push({ inv, parte: 'ninos', n: ninos, mesaId: inv.mesaNinosId || null });
  return lista;
}

function lugares() {
  // Si su mesa ya no existe, el lugar vuelve a "Sin mesa"
  const mesas = new Set(state.mesas.map((m) => m.id));
  return state.invitados.flatMap(lugaresDe).map((l) => (mesas.has(l.mesaId) ? l : { ...l, mesaId: null }));
}

function ocupacionDe(mesa, todos) {
  const gente = todos.filter((l) => l.mesaId === mesa.id);
  const usadas = gente.reduce((s, l) => s + l.n, 0);
  const ninos = gente.filter((l) => l.parte === 'ninos').reduce((s, l) => s + l.n, 0);
  return { gente, usadas, ninos, libres: (Number(mesa.capacidad) || 0) - usadas };
}

// "3 niños" / "2 personas"
function cuantos(l) {
  if (l.parte === 'ninos') return `${l.n} ${l.n === 1 ? 'niño' : 'niños'}`;
  return `${l.n} ${l.n === 1 ? 'persona' : 'personas'}`;
}

function chipHtml(l, dentroDeMesa) {
  const estado = estadoDe(l.inv);
  const ninos = l.parte === 'ninos';
  return `<span class="chip chip--${estado === 'confirmo' ? 'ok' : 'pending'}${ninos ? ' chip--ninos' : ''}${dentroDeMesa ? ' chip--mini' : ''}"
      data-inv="${l.inv.id}" data-parte="${l.parte}" title="${ninos ? 'Niños de ' : ''}${esc(l.inv.nombre)} · ${cuantos(l)} · ${ETIQUETA[estado][0]}">
      ${ninos ? `<span class="chip__ico">${ICONO.nino}</span>` : ''}<span class="chip__nombre">${esc(l.inv.nombre)}</span><span class="chip__n">${l.n}</span>
    </span>`;
}

function renderMesas() {
  if (arrastre) { renderPendiente = true; return; }

  const todos = lugares();
  const sinMesa = todos.filter((l) => !l.mesaId);
  const totalSillas = state.mesas.reduce((s, m) => s + (Number(m.capacidad) || 0), 0);
  const ocupadas = todos.filter((l) => l.mesaId).reduce((s, l) => s + l.n, 0);
  const porSentar = sinMesa.reduce((s, l) => s + l.n, 0);
  const ninosPorSentar = sinMesa.filter((l) => l.parte === 'ninos').reduce((s, l) => s + l.n, 0);
  $('mesa-resumen').textContent =
    `${state.mesas.length} mesas · ${ocupadas} / ${totalSillas} sillas · ${porSentar} personas sin mesa`
    + (ninosPorSentar ? ` (${ninosPorSentar} ${ninosPorSentar === 1 ? 'niño' : 'niños'})` : '');

  // ---- Plano ----
  plano.querySelectorAll('.plano-mesa, .plano__vacio').forEach((el) => el.remove());
  if (!state.mesas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'plano__vacio';
    vacio.textContent = 'Agrega la primera mesa con el formulario de arriba y arrástrala a su lugar.';
    plano.appendChild(vacio);
  }

  state.mesas.forEach((mesa, idx) => {
    const { gente, usadas, libres } = ocupacionDe(mesa, todos);
    const pos = (mesa.x == null || mesa.y == null) ? posicionLibre(idx) : { x: mesa.x, y: mesa.y };
    const el = document.createElement('div');
    el.className = `plano-mesa plano-mesa--${mesa.forma === 'rect' ? 'rect' : 'redonda'}`;
    if (mesa.paraNinos) el.classList.add('plano-mesa--ninos');
    if (libres < 0) el.classList.add('plano-mesa--over');
    else if (libres === 0) el.classList.add('plano-mesa--full');
    if (mesa.id === mesaSeleccionada) el.classList.add('plano-mesa--sel');
    el.dataset.mesa = mesa.id;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;

    const max = mesa.forma === 'rect' ? 4 : 3;
    const visibles = gente.length > max ? gente.slice(0, max - 1) : gente;
    const resto = gente.length - visibles.length;
    el.innerHTML = `
      <div class="plano-mesa__nombre">${mesa.paraNinos ? ICONO.nino : ''}${esc(mesa.nombre)}</div>
      <div class="plano-mesa__cupo">${usadas} / ${mesa.capacidad}</div>
      <div class="plano-mesa__chips">
        ${visibles.map((l) => chipHtml(l, true)).join('')}
        ${resto > 0 ? `<span class="chip chip--mini chip--mas">+${resto}</span>` : ''}
      </div>
    `;
    plano.appendChild(el);
  });

  // ---- Lista "Sin mesa": primero los adultos, después los niños ----
  const q = $('sin-mesa-buscar').value.trim().toLowerCase();
  const filtrados = sinMesa.filter((l) => !q || l.inv.nombre.toLowerCase().includes(q));
  const chipsAdultos = filtrados.filter((l) => l.parte === 'adultos').map((l) => chipHtml(l, false)).join('');
  const chipsNinos = filtrados.filter((l) => l.parte === 'ninos').map((l) => chipHtml(l, false)).join('');
  $('count-sin-mesa').textContent = sinMesa.length;
  $('list-sin-mesa').innerHTML = (chipsAdultos && chipsNinos
    ? `${chipsAdultos}<p class="chips-grupo">${ICONO.nino}Niños</p>${chipsNinos}`
    : chipsAdultos + chipsNinos)
    || `<p class="empty">${sinMesa.length ? 'Nadie coincide.' : 'Todos tienen mesa.'}</p>`;

  // ---- Panel de detalle ----
  const detalle = $('mesa-detalle');
  const mesa = state.mesas.find((m) => m.id === mesaSeleccionada);
  if (!mesa) {
    detalle.hidden = true;
    mesaSeleccionada = null;
    return;
  }
  detalle.hidden = false;
  const { gente, usadas, ninos, libres } = ocupacionDe(mesa, todos);
  if (document.activeElement !== $('detalle-nombre')) $('detalle-nombre').value = mesa.nombre;
  if (document.activeElement !== $('detalle-capacidad')) $('detalle-capacidad').value = mesa.capacidad;
  $('detalle-forma').value = mesa.forma === 'rect' ? 'rect' : 'redonda';
  $('detalle-ninos').checked = !!mesa.paraNinos;
  // En una mesa mezclada se aclara cuántos son adultos y cuántos niños
  const mezcla = ninos && ninos < usadas ? ` · ${personasTxt(usadas - ninos, ninos)}` : '';
  $('detalle-ocupacion').textContent = (libres < 0
    ? `${usadas} de ${mesa.capacidad} sillas · ¡${-libres} de más!`
    : `${usadas} de ${mesa.capacidad} sillas · ${libres} libres`) + mezcla;
  $('detalle-lista').innerHTML = gente.map((l) => `<li>
      <div class="person">
        <strong>${l.parte === 'ninos' ? `<span class="ico-nino">${ICONO.nino}</span>Niños de ` : ''}${esc(l.inv.nombre)}</strong>
        <span class="sub">${cuantos(l)} · ${ETIQUETA[estadoDe(l.inv)][0]}</span>
      </div>
      <button type="button" class="btn-x" data-quitar="${l.inv.id}" data-parte="${l.parte}" title="Quitar de la mesa">×</button>
    </li>`).join('') || '<li class="empty">Mesa vacía</li>';
  $('detalle-lista').querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', () => asignarMesa(b.dataset.quitar, null, b.dataset.parte))
  );

  // Para sentar: en una mesa de niños aparecen primero los niños
  const opcion = (l) => `<option value="${l.inv.id}|${l.parte}">${esc(l.inv.nombre)} (${cuantos(l)})</option>`;
  const grupo = (titulo, parte) => {
    const lista = sinMesa.filter((l) => l.parte === parte);
    return lista.length ? `<optgroup label="${titulo}">${lista.map(opcion).join('')}</optgroup>` : '';
  };
  const grupos = [grupo('Adultos', 'adultos'), grupo('Niños', 'ninos')];
  if (mesa.paraNinos) grupos.reverse();
  $('detalle-add').innerHTML = `<option value="">+ Sentar ${mesa.paraNinos ? 'niños' : 'invitado'}…</option>` + grupos.join('');
}

// ---- Arrastrar y soltar (funciona con mouse y con el dedo) ----
document.addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  const chip = e.target.closest('.chip[data-inv]');
  const mesaEl = e.target.closest('.plano-mesa');
  if (!chip && !mesaEl) return;
  if (chip && !chip.closest('#tab-mesas')) return;

  if (chip) {
    arrastre = { tipo: 'invitado', id: chip.dataset.inv, parte: chip.dataset.parte, origen: chip, x0: e.clientX, y0: e.clientY, movido: false, ghost: null };
  } else {
    const rect = plano.getBoundingClientRect();
    arrastre = {
      tipo: 'mesa', id: mesaEl.dataset.mesa, el: mesaEl, rect,
      x0: e.clientX, y0: e.clientY, movido: false,
      x: parseFloat(mesaEl.style.left), y: parseFloat(mesaEl.style.top)
    };
  }
  e.preventDefault();
});

document.addEventListener('pointermove', (e) => {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x0;
  const dy = e.clientY - arrastre.y0;
  if (!arrastre.movido && Math.hypot(dx, dy) < 5) return;
  arrastre.movido = true;

  if (arrastre.tipo === 'mesa') {
    const { rect } = arrastre;
    arrastre.x = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
    arrastre.y = Math.min(94, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100));
    arrastre.el.style.left = `${arrastre.x}%`;
    arrastre.el.style.top = `${arrastre.y}%`;
    arrastre.el.classList.add('plano-mesa--dragging');
    return;
  }

  if (!arrastre.ghost) {
    const ghost = arrastre.origen.cloneNode(true);
    ghost.classList.add('chip--ghost');
    ghost.classList.remove('chip--mini');
    document.body.appendChild(ghost);
    arrastre.ghost = ghost;
    arrastre.origen.classList.add('chip--origen');
    document.body.classList.add('is-dragging-chip');
  }
  arrastre.ghost.style.left = `${e.clientX}px`;
  arrastre.ghost.style.top = `${e.clientY}px`;

  document.querySelectorAll('.drop-hover').forEach((el) => el.classList.remove('drop-hover'));
  const destino = destinoEn(e.clientX, e.clientY);
  if (destino) destino.classList.add('drop-hover');
});

function destinoEn(x, y) {
  if (arrastre && arrastre.ghost) arrastre.ghost.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  if (arrastre && arrastre.ghost) arrastre.ghost.style.display = '';
  if (!el) return null;
  return el.closest('.plano-mesa') || el.closest('#sin-mesa');
}

function terminarArrastre(e) {
  if (!arrastre) return;
  const a = arrastre;
  arrastre = null;
  document.querySelectorAll('.drop-hover').forEach((el) => el.classList.remove('drop-hover'));
  document.body.classList.remove('is-dragging-chip');

  if (a.tipo === 'mesa') {
    a.el.classList.remove('plano-mesa--dragging');
    if (a.movido) moverMesa(a.id, a.x, a.y);
    else seleccionarMesa(a.id === mesaSeleccionada ? null : a.id);
  } else {
    if (a.ghost) a.ghost.remove();
    a.origen.classList.remove('chip--origen');
    if (a.movido && e) {
      const destino = destinoEn(e.clientX, e.clientY);
      if (destino && destino.classList.contains('plano-mesa')) asignarMesa(a.id, destino.dataset.mesa, a.parte);
      else if (destino && destino.id === 'sin-mesa') asignarMesa(a.id, null, a.parte);
    }
  }

  if (renderPendiente) {
    renderPendiente = false;
    render();
  }
}

document.addEventListener('pointerup', terminarArrastre);
document.addEventListener('pointercancel', () => terminarArrastre(null));

// =====================================================================
// RESPUESTAS CRUDAS DEL FORMULARIO
// =====================================================================
function renderRespuestas() {
  const tbody = $('rsvp-tbody');
  tbody.innerHTML = '';
  if (!state.rsvps.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Todavía no hay respuestas.</td></tr>';
    return;
  }
  for (const row of state.rsvps) {
    const inv = state.invitados.find((i) => i.id === row.invitadoId);
    const f = fechaDe(row.creadoEn);
    const fecha = f ? f.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const tr = document.createElement('tr');
    // data-label: título de cada dato cuando la tabla se apila en el celular
    tr.innerHTML = `
      <td class="nowrap" data-label="Fecha">${fecha}</td>
      <td data-label="Invitado"><strong>${inv ? esc(inv.nombre) : '<span class="sub">sin enlace</span>'}</strong></td>
      <td data-label="Asiste">${row.asiste === false ? badge('no_asiste') : badge('confirmo')}</td>
      <td data-label="Adultos">${row.pasesAdultos ?? row.cantidadPases ?? ''}</td>
      <td data-label="Niños">${row.pasesNinos ?? 0}</td>
      <td data-label="Nombres" class="${row.nombresAsistentes ? '' : 'is-vacio'}">${esc(row.nombresAsistentes || '')}</td>
      <td data-label="Mensaje" class="${row.mensaje ? '' : 'is-vacio'}">${row.mensaje ? `<span class="quote-mini">“${esc(row.mensaje)}”</span>` : ''}</td>
      <td class="c-acc"><button class="btn-icon btn-icon--danger" title="Borrar respuesta" aria-label="Borrar respuesta">${ICONO.borrar}</button></td>
    `;
    tr.querySelector('button').addEventListener('click', async () => {
      if (!confirm('¿Borrar esta respuesta?')) return;
      try {
        await deleteDoc(doc(db, 'rsvps', row.id));
      } catch (err) {
        console.error(err);
        toast('No se pudo borrar');
      }
    });
    tbody.appendChild(tr);
  }
}

// =====================================================================
// IMPORTAR CSV DE SUPABASE (migración, se usa una sola vez)
// =====================================================================
$('csv-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const estado = $('csv-status');
  estado.textContent = 'Leyendo archivo...';
  estado.className = 'form-status';

  try {
    const filas = parseCsv(await file.text());
    if (!filas.length) throw new Error('El archivo está vacío.');

    const columnas = Object.keys(filas[0]);
    const tiene = (c) => columnas.includes(c);
    if (!tiene('cantidad_pases') || !tiene('nombres_asistentes')) {
      throw new Error('No parece el CSV de la tabla rsvps de Supabase (faltan cantidad_pases / nombres_asistentes).');
    }

    const yaImportadas = new Set(state.rsvps.map((r) => r.importadoDe).filter(Boolean));
    let nuevas = 0;
    let batch = writeBatch(db);
    let enBatch = 0;

    for (const fila of filas) {
      const origen = fila.id || `${fila.creado_en}|${fila.nombres_asistentes}`;
      if (yaImportadas.has(origen)) continue;
      const f = fechaDe(fila.creado_en);
      const pasesAdultos = fila.pases_adultos !== undefined ? Number(fila.pases_adultos) || 0 : Number(fila.cantidad_pases) || 0;
      const pasesNinos = Number(fila.pases_ninos) || 0;
      batch.set(doc(collection(db, 'rsvps')), {
        pasesAdultos,
        pasesNinos,
        cantidadPases: pasesAdultos + pasesNinos,
        nombresAsistentes: fila.nombres_asistentes || '',
        mensaje: fila.mensaje || '',
        asiste: !(String(fila.asiste || 'true').toLowerCase() === 'false' || fila.asiste === 'f'),
        invitadoId: null,
        mesaAntigua: fila.mesa || '',
        importadoDe: origen,
        creadoEn: f ? Timestamp.fromDate(f) : serverTimestamp()
      });
      nuevas++;
      enBatch++;
      if (enBatch === 400) {
        await batch.commit();
        batch = writeBatch(db);
        enBatch = 0;
      }
    }
    if (enBatch) await batch.commit();

    estado.textContent = `Listo: ${nuevas} respuestas importadas (${filas.length - nuevas} ya existían).`;
    estado.className = 'form-status form-status--ok';
  } catch (err) {
    console.error(err);
    estado.textContent = `No se pudo importar: ${err.message}`;
    estado.className = 'form-status form-status--error';
  }
  e.target.value = '';
});

// =====================================================================
// IMPORTAR LISTA DE INVITADOS (Excel guardado como CSV)
// =====================================================================
// Columnas: Invitado (o Nombre), Adultos, Niños y, si hay, Teléfono/WhatsApp y Notas.
// Las demás columnas (ej. "Total personas") se ignoran. Los nombres que ya
// están en la lista se saltan, así que se puede repetir sin duplicar.
const COLUMNAS_INV = {
  nombre: ['invitado', 'invitados', 'nombre'],
  maxAdultos: ['adultos', 'pasesadultos'],
  maxNinos: ['ninos', 'pasesninos'],
  telefono: ['telefono', 'whatsapp', 'celular'],
  notas: ['notas', 'nota']
};
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const claveNombre = (n) => sinAcentos(n).replace(/\s+/g, ' ').trim();
const pasesCsv = (v) => Math.min(20, Math.max(0, Math.floor(Number(v) || 0)));

$('inv-csv-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const estado = $('inv-csv-status');
  estado.textContent = 'Leyendo archivo...';
  estado.className = 'form-status';

  try {
    const filas = parseCsv(await leerTexto(file));
    if (!filas.length) throw new Error('El archivo está vacío.');

    // Qué columna del archivo corresponde a cada dato
    const col = {};
    for (const h of Object.keys(filas[0])) {
      const k = sinAcentos(h).replace(/[^a-z]/g, '');
      for (const [campo, nombres] of Object.entries(COLUMNAS_INV)) {
        if (!col[campo] && nombres.includes(k)) col[campo] = h;
      }
    }
    if (!col.nombre || !col.maxAdultos) {
      throw new Error('El archivo necesita al menos las columnas "Invitado" y "Adultos".');
    }

    const existentes = new Set(state.invitados.map((i) => claveNombre(i.nombre)));
    const codigos = new Set(state.invitados.map((i) => i.codigo));
    const nuevos = [];
    const sinPases = [];
    let repetidos = 0;
    for (const fila of filas) {
      const nombre = String(fila[col.nombre] || '').replace(/\s+/g, ' ').trim();
      if (!nombre || claveNombre(nombre) === 'total') continue; // fila de totales de Excel
      const datos = {
        nombre,
        telefono: col.telefono ? String(fila[col.telefono] || '').trim() : '',
        maxAdultos: pasesCsv(fila[col.maxAdultos]),
        maxNinos: col.maxNinos ? pasesCsv(fila[col.maxNinos]) : 0,
        notas: col.notas ? String(fila[col.notas] || '').trim() : ''
      };
      if (datos.maxAdultos + datos.maxNinos === 0) { sinPases.push(nombre); continue; }
      if (existentes.has(claveNombre(nombre))) { repetidos++; continue; }
      existentes.add(claveNombre(nombre));
      nuevos.push(datos);
    }

    const avisoSinPases = sinPases.length ? ` Sin pases (no se cargaron): ${sinPases.join(', ')}.` : '';
    if (!nuevos.length) {
      estado.textContent = `No hay invitados nuevos (${repetidos} ya estaban en la lista).${avisoSinPases}`;
      return;
    }
    const personas = nuevos.reduce((s, d) => s + pasesDe(d), 0);
    const conTelefono = nuevos.filter((d) => telefonoWa(d.telefono)).length;
    if (!confirm(`Se agregarán ${nuevos.length} invitados (${personas} personas, ${conTelefono} con teléfono).`
      + (repetidos ? ` ${repetidos} ya estaban en la lista y se saltan.` : '') + ' ¿Continuar?')) {
      estado.textContent = 'Importación cancelada.';
      return;
    }

    estado.textContent = `Guardando ${nuevos.length} invitados...`;
    let batch = writeBatch(db);
    let enBatch = 0;
    for (const datos of nuevos) {
      let codigo = nuevoCodigo();
      while (codigos.has(codigo)) codigo = nuevoCodigo();
      codigos.add(codigo);
      const ref = doc(collection(db, 'invitados'));
      batch.set(ref, { ...datos, codigo, mesaId: null, mesaNinosId: null, creadoEn: serverTimestamp() });
      batch.set(doc(db, 'enlaces', codigo), enlacePublico(ref.id, datos));
      enBatch += 2;
      if (enBatch >= 400) {
        await batch.commit();
        batch = writeBatch(db);
        enBatch = 0;
      }
    }
    if (enBatch) await batch.commit();

    estado.textContent = `Listo: ${nuevos.length} invitados agregados con su enlace`
      + (repetidos ? ` (${repetidos} ya existían).` : '.') + avisoSinPases;
    estado.className = 'form-status form-status--ok';
  } catch (err) {
    console.error(err);
    estado.textContent = `No se pudo importar: ${err.message}`;
    estado.className = 'form-status form-status--error';
  } finally {
    e.target.value = '';
  }
});

// Excel guarda el CSV en UTF-8 o en ANSI (Windows-1252) según la opción
// elegida: se prueban ambos para no romper tildes ni eñes.
async function leerTexto(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

// CSV sencillo con soporte de comillas y saltos de línea dentro de campos.
// Acepta coma o punto y coma (Excel en español guarda con punto y coma).
function parseCsv(texto) {
  const primera = texto.split(/\r?\n/, 1)[0];
  const sep = primera.split(';').length > primera.split(',').length ? ';' : ',';
  const filas = [];
  let campo = '';
  let fila = [];
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === sep) {
      fila.push(campo); campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((v) => v !== '')) filas.push(fila);
      fila = [];
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length) { fila.push(campo); if (fila.some((v) => v !== '')) filas.push(fila); }
  if (filas.length < 2) return [];
  const cab = filas[0].map((h) => h.trim().replace(/^﻿/, ''));
  return filas.slice(1).map((f) => Object.fromEntries(cab.map((h, i) => [h, f[i] ?? ''])));
}

// =====================================================================
// UTILIDADES
// =====================================================================
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Enlace copiado');
  } catch {
    prompt('Copia el enlace:', texto);
  }
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML.replace(/"/g, '&quot;'); // también sirve dentro de atributos
}
