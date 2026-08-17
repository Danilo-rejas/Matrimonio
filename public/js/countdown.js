(function () {
  const el = document.querySelector('.countdown');
  if (!el) return;

  const target = new Date(el.dataset.target).getTime();
  const values = {
    days: el.querySelector('[data-unit="days"]'),
    hours: el.querySelector('[data-unit="hours"]'),
    minutes: el.querySelector('[data-unit="minutes"]'),
    seconds: el.querySelector('[data-unit="seconds"]'),
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    values.days.textContent = pad(days);
    values.hours.textContent = pad(hours);
    values.minutes.textContent = pad(minutes);
    values.seconds.textContent = pad(seconds);
  }

  tick();
  setInterval(tick, 1000);
})();
