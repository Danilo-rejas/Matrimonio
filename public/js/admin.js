import { supabase } from './supabase-config.js';

const loginView = document.getElementById('login-view');
const panelView = document.getElementById('panel-view');
const loginForm = document.getElementById('login-form');
const loginStatus = document.getElementById('login-status');
const logoutBtn = document.getElementById('logout-btn');
const tbody = document.getElementById('rsvp-tbody');
const statsEl = document.getElementById('stats');

let channel = null;

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginStatus.textContent = 'Ingresando...';
  loginStatus.className = 'form-status';

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error(error);
    loginStatus.textContent = 'Correo o contraseña incorrectos.';
    loginStatus.className = 'form-status form-status--error';
  }
});

logoutBtn.addEventListener('click', () => supabase.auth.signOut());

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    loginView.style.display = 'none';
    panelView.style.display = 'block';
    loadRsvps();
    subscribeToChanges();
  } else {
    loginView.style.display = 'block';
    panelView.style.display = 'none';
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  }
});

async function loadRsvps() {
  const { data, error } = await supabase
    .from('rsvps')
    .select('*')
    .order('creado_en', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  renderRows(data);
}

function subscribeToChanges() {
  channel = supabase
    .channel('rsvps-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvps' }, () => {
      loadRsvps();
    })
    .subscribe();
}

function renderRows(rows) {
  tbody.innerHTML = '';
  let totalPases = 0;

  rows.forEach((row) => {
    totalPases += Number(row.cantidad_pases) || 0;

    const fecha = row.creado_en
      ? new Date(row.creado_en).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
      : '—';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td>${row.cantidad_pases ?? ''}</td>
      <td>${escapeHtml(row.nombres_asistentes || '')}</td>
      <td>${escapeHtml(row.mensaje || '')}</td>
      <td><input type="text" value="${escapeHtml(row.mesa || '')}" data-id="${row.id}" placeholder="Ej: Mesa 3"></td>
    `;
    tbody.appendChild(tr);
  });

  statsEl.textContent = `${rows.length} confirmaciones · ${totalPases} pases en total`;

  tbody.querySelectorAll('input[data-id]').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const id = e.target.getAttribute('data-id');
      const { error } = await supabase.from('rsvps').update({ mesa: e.target.value }).eq('id', id);
      if (error) console.error(error);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
