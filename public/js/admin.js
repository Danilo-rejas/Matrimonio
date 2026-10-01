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
function pasesTxt(inv) {
  const a = Number(inv.maxAdultos) || 0;
  const n = Number(inv.maxNinos) || 0;
  const partes = [];
  if (a) partes.push(`${a} ${a === 1 ? 'adulto' : 'adultos'}`);
  if (n) partes.push(`${n} ${n === 1 ? 'niño' : 'niños'}`);
  return partes.join(' y ') || '0 pases';
}

function pasesOcupados(inv) {
  const r = respuestaDe(inv.id);
  if (!r) return pasesDe(inv);
  return r.asiste === false ? 0 : Number(r.cantidadPases) || 0;
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
  const pases = pasesTxt(inv);
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
      batch.set(ref, { ...datos, codigo, mesaId: null, creadoEn: serverTimestamp() });
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
  $('inv-submit').textContent = 'Guardar';
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
  $('inv-submit').textContent = 'Guardar cambios';
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
    const confirmoDistinto = estado === 'confirmo' && r.cantidadPases !== pasesDe(inv);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="guest">
          <span class="avatar">${esc(iniciales(inv.nombre))}</span>
          <div>
            <strong>${esc(inv.nombre)}</strong>
            ${inv.notas ? `<span class="sub">${esc(inv.notas)}</span>` : ''}
          </div>
        </div>
      </td>
      <td>${esc(inv.telefono || '') || '<span class="sub">—</span>'}</td>
      <td>${pasesDe(inv)}<div class="sub">${pasesTxt(inv)}</div>${confirmoDistinto ? `<div class="sub">confirmó ${r.cantidadPases}</div>` : ''}</td>
      <td>${badge(estado)}</td>
      <td>${mesa ? esc(mesa.nombre) : '<span class="sub">—</span>'}</td>
      <td class="nowrap">
        <button class="btn-mini" data-act="copiar" title="Copiar enlace">Copiar enlace</button>
        <a class="btn-mini btn-mini--wa" href="${urlWa(inv)}" target="_blank" rel="noopener">WhatsApp</a>
      </td>
      <td class="nowrap">
        <button class="btn-link" data-act="editar">Editar</button>
        <button class="btn-link btn-link--danger" data-act="eliminar">Eliminar</button>
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
  const pasesPendientes = grupos.sin_respuesta.reduce((s, i) => s + pasesDe(i), 0);
  const sinEnlace = state.rsvps
    .filter((r) => !r.invitadoId && r.asiste !== false)
    .reduce((s, r) => s + (Number(r.cantidadPases) || 0), 0);

  $('stat-grid').innerHTML = [
    stat('Invitados', state.invitados.length, `${pasesInvitados} pases enviados`),
    stat('Confirmaron', grupos.confirmo.length, `${personasConfirmadas} personas`, 'ok'),
    stat('No asistirán', grupos.no_asiste.length, '', 'no'),
    stat('Sin respuesta', grupos.sin_respuesta.length, `${pasesPendientes} pases por confirmar`, 'pending'),
    sinEnlace ? stat('Sin enlace', sinEnlace, 'personas que confirmaron sin enlace personal') : ''
  ].join('');

  $('count-confirmo').textContent = grupos.confirmo.length;
  $('count-no').textContent = grupos.no_asiste.length;
  $('count-pendiente').textContent = grupos.sin_respuesta.length;

  $('list-confirmo').innerHTML = grupos.confirmo.map((inv) => {
    const r = respuestaDe(inv.id);
    const n = r.cantidadPases;
    return `<li>
      <div class="person">
        <strong>${esc(inv.nombre)}</strong>
        <span class="sub">${n} ${n === 1 ? 'persona' : 'personas'}${r.pasesAdultos != null ? ` (${r.pasesAdultos} adultos, ${r.pasesNinos || 0} niños)` : ''} · ${esc(r.nombresAsistentes || '')}</span>
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
      <a class="btn-mini btn-mini--wa" href="${urlWa(inv)}" target="_blank" rel="noopener" title="Recordar por WhatsApp">Recordar</a>
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
  if (!nombre) return;
  const orden = state.mesas.length ? Math.max(...state.mesas.map((m) => m.orden || 0)) + 1 : 1;
  const pos = posicionLibre(state.mesas.length);
  try {
    await addDoc(collection(db, 'mesas'), {
      nombre, capacidad, forma, orden, x: pos.x, y: pos.y, creadoEn: serverTimestamp()
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
  toast('Mesa agregada al plano');
});

async function asignarMesa(invitadoId, mesaId) {
  const inv = state.invitados.find((i) => i.id === invitadoId);
  if (!inv || (inv.mesaId || null) === (mesaId || null)) return;
  try {
    await updateDoc(doc(db, 'invitados', invitadoId), { mesaId: mesaId || null });
    const mesa = state.mesas.find((m) => m.id === mesaId);
    toast(mesa ? `${inv.nombre} → ${mesa.nombre}` : `${inv.nombre} sin mesa`);
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
  const enMesa = state.invitados.filter((i) => i.mesaId === mesa.id);
  const aviso = enMesa.length ? ` Sus ${enMesa.length} invitado(s) quedarán sin mesa.` : '';
  if (!confirm(`¿Eliminar "${mesa.nombre}"?${aviso}`)) return;
  try {
    const batch = writeBatch(db);
    enMesa.forEach((inv) => batch.update(doc(db, 'invitados', inv.id), { mesaId: null }));
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
      forma: $('detalle-forma').value
    });
    toast('Mesa actualizada');
  } catch (err) {
    console.error(err);
    toast('No se pudo guardar');
  }
});
$('detalle-add').addEventListener('change', (e) => {
  if (e.target.value && mesaSeleccionada) asignarMesa(e.target.value, mesaSeleccionada);
  e.target.value = '';
});
$('sin-mesa-buscar').addEventListener('input', renderMesas);

function seleccionarMesa(id) {
  mesaSeleccionada = id;
  renderMesas();
}

function sentables() {
  // Solo se sientan los que no dijeron que no
  return state.invitados.filter((i) => estadoDe(i) !== 'no_asiste');
}

function ocupacionDe(mesa) {
  const gente = sentables().filter((i) => i.mesaId === mesa.id);
  const usadas = gente.reduce((s, i) => s + pasesOcupados(i), 0);
  return { gente, usadas, libres: (Number(mesa.capacidad) || 0) - usadas };
}

function chipHtml(inv, dentroDeMesa) {
  const n = pasesOcupados(inv);
  const estado = estadoDe(inv);
  return `<span class="chip chip--${estado === 'confirmo' ? 'ok' : 'pending'} ${dentroDeMesa ? 'chip--mini' : ''}"
      data-inv="${inv.id}" title="${esc(inv.nombre)} · ${n} ${n === 1 ? 'persona' : 'personas'} · ${ETIQUETA[estado][0]}">
      <span class="chip__nombre">${esc(inv.nombre)}</span><span class="chip__n">${n}</span>
    </span>`;
}

function renderMesas() {
  if (arrastre) { renderPendiente = true; return; }

  const lista = sentables();
  const sinMesa = lista.filter((i) => !i.mesaId);
  const totalSillas = state.mesas.reduce((s, m) => s + (Number(m.capacidad) || 0), 0);
  const ocupadas = lista.filter((i) => i.mesaId).reduce((s, i) => s + pasesOcupados(i), 0);
  const porSentar = sinMesa.reduce((s, i) => s + pasesOcupados(i), 0);
  $('mesa-resumen').textContent =
    `${state.mesas.length} mesas · ${ocupadas} / ${totalSillas} sillas · ${porSentar} personas sin mesa`;

  // ---- Plano ----
  plano.querySelectorAll('.plano-mesa, .plano__vacio').forEach((el) => el.remove());
  if (!state.mesas.length) {
    const vacio = document.createElement('p');
    vacio.className = 'plano__vacio';
    vacio.textContent = 'Agrega la primera mesa con el formulario de arriba y arrástrala a su lugar.';
    plano.appendChild(vacio);
  }

  state.mesas.forEach((mesa, idx) => {
    const { gente, usadas, libres } = ocupacionDe(mesa);
    const pos = (mesa.x == null || mesa.y == null) ? posicionLibre(idx) : { x: mesa.x, y: mesa.y };
    const el = document.createElement('div');
    el.className = `plano-mesa plano-mesa--${mesa.forma === 'rect' ? 'rect' : 'redonda'}`;
    if (libres < 0) el.classList.add('plano-mesa--over');
    else if (libres === 0) el.classList.add('plano-mesa--full');
    if (mesa.id === mesaSeleccionada) el.classList.add('plano-mesa--sel');
    el.dataset.mesa = mesa.id;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;

    const max = mesa.forma === 'rect' ? 6 : 4;
    const visibles = gente.slice(0, max);
    const resto = gente.length - visibles.length;
    el.innerHTML = `
      <div class="plano-mesa__nombre">${esc(mesa.nombre)}</div>
      <div class="plano-mesa__cupo">${usadas} / ${mesa.capacidad}</div>
      <div class="plano-mesa__chips">
        ${visibles.map((inv) => chipHtml(inv, true)).join('')}
        ${resto > 0 ? `<span class="chip chip--mini chip--mas">+${resto}</span>` : ''}
      </div>
    `;
    plano.appendChild(el);
  });

  // ---- Lista "Sin mesa" ----
  const q = $('sin-mesa-buscar').value.trim().toLowerCase();
  const filtrados = sinMesa.filter((i) => !q || i.nombre.toLowerCase().includes(q));
  $('count-sin-mesa').textContent = sinMesa.length;
  $('list-sin-mesa').innerHTML = filtrados.map((inv) => chipHtml(inv, false)).join('')
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
  const { gente, usadas, libres } = ocupacionDe(mesa);
  if (document.activeElement !== $('detalle-nombre')) $('detalle-nombre').value = mesa.nombre;
  if (document.activeElement !== $('detalle-capacidad')) $('detalle-capacidad').value = mesa.capacidad;
  $('detalle-forma').value = mesa.forma === 'rect' ? 'rect' : 'redonda';
  $('detalle-ocupacion').textContent = libres < 0
    ? `${usadas} de ${mesa.capacidad} sillas · ¡${-libres} de más!`
    : `${usadas} de ${mesa.capacidad} sillas · ${libres} libres`;
  $('detalle-lista').innerHTML = gente.map((inv) => `<li>
      <div class="person">
        <strong>${esc(inv.nombre)}</strong>
        <span class="sub">${pasesOcupados(inv)} ${pasesOcupados(inv) === 1 ? 'persona' : 'personas'} · ${ETIQUETA[estadoDe(inv)][0]}</span>
      </div>
      <button type="button" class="btn-x" data-quitar="${inv.id}" title="Quitar de la mesa">×</button>
    </li>`).join('') || '<li class="empty">Mesa vacía</li>';
  $('detalle-lista').querySelectorAll('[data-quitar]').forEach((b) =>
    b.addEventListener('click', () => asignarMesa(b.dataset.quitar, null))
  );
  $('detalle-add').innerHTML = '<option value="">+ Sentar invitado…</option>'
    + sinMesa.map((inv) => `<option value="${inv.id}">${esc(inv.nombre)} (${pasesOcupados(inv)})</option>`).join('');
}

// ---- Arrastrar y soltar (funciona con mouse y con el dedo) ----
document.addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  const chip = e.target.closest('.chip[data-inv]');
  const mesaEl = e.target.closest('.plano-mesa');
  if (!chip && !mesaEl) return;
  if (chip && !chip.closest('#tab-mesas')) return;

  if (chip) {
    arrastre = { tipo: 'invitado', id: chip.dataset.inv, origen: chip, x0: e.clientX, y0: e.clientY, movido: false, ghost: null };
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
      if (destino && destino.classList.contains('plano-mesa')) asignarMesa(a.id, destino.dataset.mesa);
      else if (destino && destino.id === 'sin-mesa') asignarMesa(a.id, null);
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
    tr.innerHTML = `
      <td class="nowrap">${fecha}</td>
      <td>${inv ? esc(inv.nombre) : '<span class="sub">sin enlace</span>'}</td>
      <td>${row.asiste === false ? badge('no_asiste') : badge('confirmo')}</td>
      <td>${row.pasesAdultos ?? row.cantidadPases ?? ''}</td>
      <td>${row.pasesNinos ?? 0}</td>
      <td>${esc(row.nombresAsistentes || '')}</td>
      <td>${esc(row.mensaje || '')}</td>
      <td><button class="btn-link btn-link--danger">Borrar</button></td>
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

// CSV sencillo con soporte de comillas y saltos de línea dentro de campos
function parseCsv(texto) {
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
    } else if (c === ',') {
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
  return div.innerHTML;
}
