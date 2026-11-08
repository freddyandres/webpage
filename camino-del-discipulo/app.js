(function () {
  'use strict';
  var PAGE_URL = 'https://elcaminodeldiscipulo.vercel.app/';
  var SHARE_TEXT = '📖 Te recomiendo «El Camino del Discípulo», un libro para crecer en la fe y permanecer fieles a Cristo hasta el final. Ya está en Amazon: ';

  // Barra superior sólida al hacer scroll
  var nav = document.querySelector('.nav');
  function onScroll() { nav.classList.toggle('is-solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Animación de aparición
  var targets = document.querySelectorAll('.section h2, .prose, .checks li, .path__step, .steps li, .quote blockquote, .verse');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    targets.forEach(function (el, i) {
      el.classList.add('reveal');
      el.style.transitionDelay = (i % 4) * 80 + 'ms';
      io.observe(el);
    });
  }

  // Compartir
  var status = document.getElementById('share-status');
  function say(msg) { status.textContent = msg; setTimeout(function () { status.textContent = ''; }, 3500); }

  document.getElementById('share-wa').href =
    'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT + PAGE_URL);

  document.getElementById('share-copy').addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PAGE_URL).then(function () { say('¡Enlace copiado! ✓'); },
        function () { say('Copia este enlace: ' + PAGE_URL); });
    } else {
      say('Copia este enlace: ' + PAGE_URL);
    }
  });

  var nativeBtn = document.getElementById('share-native');
  if (navigator.share) {
    nativeBtn.hidden = false;
    nativeBtn.addEventListener('click', function () {
      navigator.share({ title: 'El Camino del Discípulo', text: SHARE_TEXT, url: PAGE_URL }).catch(function () {});
    });
  }
})();
