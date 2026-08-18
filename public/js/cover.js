(function () {
  var cover = document.getElementById('cover');
  var openBtn = document.getElementById('open-btn');
  var panel = document.querySelector('.cover__panel');
  if (!cover || !openBtn || !panel) return;

  openBtn.addEventListener('click', function () {
    cover.classList.add('cover--open');
    document.body.classList.remove('cover-active');

    panel.addEventListener('transitionend', function handler(e) {
      if (e.propertyName !== 'transform') return;
      cover.style.display = 'none';
      panel.removeEventListener('transitionend', handler);
    });
  });
})();
