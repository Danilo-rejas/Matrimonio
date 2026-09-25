// Música de fondo: arranca al abrir la invitación (toque del sobre) y se
// puede pausar o reanudar con el botón flotante.
(function () {
  var audio = document.getElementById('musica');
  var btn = document.getElementById('music-btn');
  var openBtn = document.getElementById('open-btn');
  if (!audio || !btn) return;

  audio.volume = 0.55;

  function refrescar() {
    var sonando = !audio.paused;
    btn.classList.toggle('is-playing', sonando);
    btn.setAttribute('aria-pressed', sonando ? 'true' : 'false');
    btn.setAttribute('aria-label', sonando ? 'Pausar música' : 'Reproducir música');
  }

  function reproducir() {
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* el navegador pidió un gesto: el botón sigue disponible */ });
  }

  btn.addEventListener('click', function () {
    if (audio.paused) reproducir();
    else audio.pause();
  });

  // Al abrir el sobre ya hubo un toque del usuario: los navegadores permiten sonar
  if (openBtn) openBtn.addEventListener('click', reproducir, { once: true });

  audio.addEventListener('play', refrescar);
  audio.addEventListener('pause', refrescar);
  audio.addEventListener('ended', refrescar);
  refrescar();
})();
