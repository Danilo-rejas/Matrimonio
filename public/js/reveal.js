(function () {
  var targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (!('IntersectionObserver' in window) || !targets.length) {
    targets.forEach(function (el) { el.classList.add('reveal--visible'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal--visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '-10% 0px -10% 0px' });

  targets.forEach(function (el) { observer.observe(el); });

  // Seguro: si por lo que sea algún elemento nunca "entra" al observer
  // (tamaño 0, error de layout, etc.), no debe quedar invisible para siempre.
  setTimeout(function () {
    targets.forEach(function (el) {
      if (!el.classList.contains('reveal--visible')) {
        el.classList.add('reveal--visible');
      }
    });
  }, 4000);
})();
