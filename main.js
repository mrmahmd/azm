// رابط التسجيل في الأكاديمية: ضع الرابط هنا وستتحدث كل أزرار «سجّل ابنك» تلقائيًا.
var REGISTRATION_URL = 'https://salla.sa/sorog/أكاديمية-عزم/p235152384';

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
  var revealables = document.querySelectorAll('.reveal');
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
  }

  /* شريط التقدم + الشريط العلوي + بارالاكس */
  var header = document.querySelector('.site-header');
  var progress = document.querySelector('.progress span');
  var navSections = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'), function (link) {
    return { link: link, section: document.getElementById(link.hash.slice(1)) };
  }).filter(function (item) { return item.section; });
  var currentLink = null;
  var layers = [].slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;
  var pending = [].slice.call(revealables);
  // كل قسم يصعد ويستقر في مكانه بالتزامن مع حركة التمرير
  var stages = [].slice.call(document.querySelectorAll('.section > .wrap, .cta > .wrap'));

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

    // تمييز آخر قسم وصل إلى الشريط، مع إبراز التذييل عند نهاية الصفحة.
    var marker = (header ? header.offsetHeight : 0) + 24;
    var atPageEnd = max > 0 && y >= max - 2;
    var nextLink = null;
    for (var i = navSections.length - 1; i >= 0; i--) {
      if (atPageEnd || navSections[i].section.getBoundingClientRect().top <= marker) {
        nextLink = navSections[i].link;
        break;
      }
    }
    if (nextLink !== currentLink) {
      if (currentLink) currentLink.removeAttribute('aria-current');
      if (nextLink) nextLink.setAttribute('aria-current', 'location');
      currentLink = nextLink;
    }
    if (reduceMotion) return;

    // دخول القسم التالي: يبدأ أسفل الشاشة منخفضًا وأصغر قليلًا وباهتًا، ثم يصعد ويكبر ويتضح مع التمرير
    stages.forEach(function (wrap) {
      var top = wrap.parentElement.getBoundingClientRect().top;
      var p = Math.max(0, Math.min(1, (vh - top) / (vh * 0.55)));
      var e = 1 - Math.pow(1 - p, 3);
      if (e >= 1) {
        if (wrap.style.transform) { wrap.style.transform = ''; wrap.style.opacity = ''; }
        return;
      }
      wrap.style.transform = 'translate3d(0,' + ((1 - e) * 90).toFixed(1) + 'px,0) scale(' + (0.94 + 0.06 * e).toFixed(4) + ')';
      wrap.style.opacity = (0.15 + 0.85 * e).toFixed(3);
    });

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
