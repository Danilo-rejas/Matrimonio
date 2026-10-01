import { db, doc, getDoc } from './firebase-config.js?v=3';

// Muestra "Invitación para <nombre> · N pases" en la portada cuando se abre
// con el enlace personal (?inv=CODIGO).
async function init() {
  const el = document.getElementById('cover-invitado');
  const nombreEl = document.getElementById('cover-invitado-nombre');
  const pasesEl = document.getElementById('cover-invitado-pases');
  if (!el || !nombreEl || !pasesEl) return;

  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('inv') || params.get('i');
  if (!codigo) return;

  let invitado = null;
  try {
    const snap = await getDoc(doc(db, 'enlaces', codigo));
    if (snap.exists()) invitado = snap.data();
  } catch (err) {
    console.error(err);
  }
  if (!invitado) return;

  const totalPases = (Number(invitado.maxAdultos) || 0) + (Number(invitado.maxNinos) || 0);

  nombreEl.textContent = invitado.nombre;
  pasesEl.textContent = totalPases === 1 ? '1 pase' : `${totalPases} pases`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('cover__invitado--visible'));
}

init();
