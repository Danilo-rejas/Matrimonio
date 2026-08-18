(function () {
  var LEAF_COUNT = 79;
  var SPAWN_COUNT = 30;
  var SPAWN_WINDOW = 1.6;
  var MIN_DURATION = 5.4;
  var MAX_DURATION = 8;

  var openBtn = document.getElementById('open-btn');
  var layer = document.getElementById('cover-leaves-layer');
  if (!openBtn || !layer) return;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return min + Math.random() * (max - min); }

  function spawnLeaf() {
    var depth = Math.random();
    var num = String(Math.floor(rand(1, LEAF_COUNT + 1))).padStart(2, '0');

    var size = lerp(34, 92, depth);
    var blur = lerp(2.6, 0, depth);
    var duration = lerp(MAX_DURATION, MIN_DURATION, depth);
    var delay = Math.pow(Math.random(), 1.8) * SPAWN_WINDOW;

    var wrap = document.createElement('div');
    wrap.className = 'cover-leaf';
    wrap.style.left = rand(-2, 98) + '%';
    wrap.style.width = size + 'px';
    wrap.style.setProperty('--leaf-drift', rand(-70, 70) + 'px');
    wrap.style.setProperty('--leaf-rot-start', rand(-25, 25) + 'deg');
    wrap.style.setProperty('--leaf-rot-amount', (rand(120, 320) * (Math.random() < 0.5 ? -1 : 1)) + 'deg');
    wrap.style.setProperty('--leaf-opacity', lerp(0.55, 1, depth));
    wrap.style.animationDuration = duration + 's';
    wrap.style.animationDelay = delay + 's';

    var img = document.createElement('img');
    img.src = 'img/leaves/leaf-' + num + '.png';
    img.alt = '';
    if (blur > 0.05) img.style.filter = 'blur(' + blur.toFixed(2) + 'px)';

    wrap.appendChild(img);
    layer.appendChild(wrap);
    wrap.addEventListener('animationend', function () { wrap.remove(); });
  }

  openBtn.addEventListener('click', function () {
    for (var i = 0; i < SPAWN_COUNT; i++) spawnLeaf();
  });
})();
