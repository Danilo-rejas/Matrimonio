// Efectos de las fotos de la invitación: parallax del banner del jardín,
// galería "Nuestra historia" con visor a pantalla completa.
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Parallax suave del banner (la foto se desplaza más lento que el scroll)
  var banner = document.querySelector('.foto-banner');
  var bannerImg = banner && banner.querySelector('.foto-banner__img');
  if (banner && bannerImg && !reduce) {
    var ticking = false;
    function mover() {
      ticking = false;
      var r = banner.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      if (r.bottom < 0 || r.top > vh) return;
      // -1 (arriba) … 1 (abajo) según la posición del banner en la pantalla
      var p = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2);
      bannerImg.style.transform = 'translate3d(0,' + (p * -12).toFixed(2) + '%,0) scale(1.18)';
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(mover); }
    }, { passive: true });
    window.addEventListener('resize', mover);
    mover();
  }

  // ---- Visor de fotos (lightbox)
  var fotos = document.querySelectorAll('.historia__foto');
  if (!fotos.length) return;

  var visor = document.createElement('div');
  visor.className = 'visor';
  visor.innerHTML = '<button class="visor__cerrar" type="button" aria-label="Cerrar">×</button>' +
    '<button class="visor__nav visor__nav--prev" type="button" aria-label="Anterior">‹</button>' +
    '<figure class="visor__fig"><img class="visor__img" alt=""><figcaption class="visor__pie"></figcaption></figure>' +
    '<button class="visor__nav visor__nav--next" type="button" aria-label="Siguiente">›</button>';
  document.body.appendChild(visor);

  var img = visor.querySelector('.visor__img');
  var pie = visor.querySelector('.visor__pie');
  var actual = 0;

  function mostrar(i) {
    actual = (i + fotos.length) % fotos.length;
    var f = fotos[actual];
    var src = f.getAttribute('data-full') || f.querySelector('img').src;
    img.classList.remove('is-in');
    img.src = src;
    pie.textContent = f.getAttribute('data-pie') || '';
    requestAnimationFrame(function () { img.classList.add('is-in'); });
  }

  function abrir(i) {
    mostrar(i);
    visor.classList.add('is-open');
    document.body.classList.add('visor-abierto');
  }

  function cerrar() {
    visor.classList.remove('is-open');
    document.body.classList.remove('visor-abierto');
  }

  fotos.forEach(function (f, i) {
    f.addEventListener('click', function () { abrir(i); });
    f.setAttribute('tabindex', '0');
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter') abrir(i); });
  });

  visor.querySelector('.visor__cerrar').addEventListener('click', cerrar);
  visor.querySelector('.visor__nav--prev').addEventListener('click', function () { mostrar(actual - 1); });
  visor.querySelector('.visor__nav--next').addEventListener('click', function () { mostrar(actual + 1); });
  visor.addEventListener('click', function (e) { if (e.target === visor) cerrar(); });
  document.addEventListener('keydown', function (e) {
    if (!visor.classList.contains('is-open')) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
    if (e.key === 'ArrowRight') mostrar(actual + 1);
  });

  // Deslizar con el dedo para cambiar de foto
  var x0 = null;
  visor.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) mostrar(actual + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
