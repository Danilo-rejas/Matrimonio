// Botón "Copiar número de cuenta" de la sección de regalos
(function () {
  var btn = document.getElementById('copiar-cuenta');
  var cuenta = document.getElementById('dato-cuenta');
  if (!btn || !cuenta) return;
  var original = btn.textContent;
  btn.addEventListener('click', function () {
    var texto = cuenta.textContent.trim();
    function listo() {
      btn.textContent = 'Copiado';
      btn.classList.add('is-ok');
      setTimeout(function () { btn.textContent = original; btn.classList.remove('is-ok'); }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(listo, function () { window.prompt('Copia el número de cuenta:', texto); });
    } else {
      window.prompt('Copia el número de cuenta:', texto);
    }
  });
})();
