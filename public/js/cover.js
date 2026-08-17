(function () {
  var cover = document.getElementById('cover');
  var openBtn = document.getElementById('open-btn');
  if (!cover || !openBtn) return;

  openBtn.addEventListener('click', function () {
    cover.classList.add('cover--open');
    document.body.classList.remove('cover-active');

    cover.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'transform') return;
      cover.style.display = 'none';
      cover.removeEventListener('transitionend', handler);
    });
  });
})();
