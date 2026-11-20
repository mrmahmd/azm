// رابط التسجيل في الأكاديمية: ضع الرابط هنا وستتحدث كل أزرار «سجّل ابنك» تلقائيًا.
var REGISTRATION_URL = '';

(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* رابط التسجيل */
  if (REGISTRATION_URL) {
    document.querySelectorAll('[data-register]').forEach(function (a) {
      a.href = REGISTRATION_URL;
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* قائمة الهاتف */
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('main-nav');
  if (btn && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); btn.focus(); }
    });
  }

  /* ظهور العناصر عند التمرير */
  var revealables = document.querySelectorAll('.reveal, .seats');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealables.forEach(function (el) { io.observe(el); });

    // مقاعد العرض تظهر واحدة تلو الأخرى
    document.querySelectorAll('.seats-row i').forEach(function (dot, i) {
      dot.style.transitionDelay = (0.25 + i * 0.04) + 's';
    });
  }

  /* عدّاد السعر */
  var counter = document.querySelector('[data-count]');
  if (counter && !reduceMotion && 'IntersectionObserver' in window) {
    var target = parseInt(counter.getAttribute('data-count'), 10);
    var fmt = new Intl.NumberFormat('ar-SA');
    var started = false;
    new IntersectionObserver(function (entries, obs) {
      if (!entries[0].isIntersecting || started) return;
      started = true; obs.disconnect();
      var from = 475, t0 = performance.now(), dur = 1400;
      (function tick(now) {
        var k = Math.min(1, (now - t0) / dur);
        var eased = 1 - Math.pow(1 - k, 3);
        counter.textContent = fmt.format(Math.round(from + (target - from) * eased));
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: 0.5 }).observe(counter);
  }

  /* شريط التقدم + الشريط العلوي + بارالاكس */
  var header = document.querySelector('.site-header');
  var progress = document.querySelector('.progress span');
  var heroCopy = document.querySelector('[data-hero-copy]');
  var layers = [].slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;
  var pending = [].slice.call(revealables);

  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;

    // احتياط: أي عنصر وصل للشاشة أو تجاوزها يظهر حتى لو فات المراقب (تمرير سريع أو قفزة رابط)
    if (pending.length) {
      pending = pending.filter(function (el) {
        if (el.classList.contains('in')) return false;
        if (el.getBoundingClientRect().top < vh * 0.95) { el.classList.add('in'); return false; }
        return true;
      });
    }

    if (header) header.classList.toggle('scrolled', y > 10);
    if (progress) progress.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);
    if (reduceMotion) return;

    // الواجهة الأولى: النص يبتعد ببطء ويخفت عند النزول
    if (heroCopy && y < vh * 1.2) {
      var k = Math.min(1, y / (vh * 0.9));
      heroCopy.style.transform = 'translate3d(0,' + (y * 0.18).toFixed(1) + 'px,0)';
      heroCopy.style.opacity = (1 - k * 0.85).toFixed(3);
    }

    // الصور تتحرك داخل إطارها بسرعة مختلفة عن الصفحة
    layers.forEach(function (img) {
      var frame = img.parentElement.getBoundingClientRect();
      if (frame.bottom < -100 || frame.top > vh + 100) return;
      var speed = parseFloat(img.getAttribute('data-parallax')) || 0;
      var scale = parseFloat(img.getAttribute('data-scale')) || 1.12;
      var center = frame.top + frame.height / 2 - vh / 2;
      var shift = Math.max(-1, Math.min(1, center / vh)) * speed * frame.height * 2.2;
      img.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0) scale(' + scale + ')';
    });
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();

  /* عرض الصور مكبرة */
  var box = document.querySelector('.lightbox');
  if (box && typeof box.showModal === 'function') {
    var boxImg = box.querySelector('img');
    document.querySelectorAll('[data-full]').forEach(function (shot) {
      shot.addEventListener('click', function () {
        var src = shot.querySelector('img');
        boxImg.src = shot.getAttribute('data-full');
        boxImg.alt = src ? src.alt : '';
        box.showModal();
      });
    });
    box.querySelector('.lightbox-close').addEventListener('click', function () { box.close(); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  }
})();
