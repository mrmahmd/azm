/* بوابة أكاديمية عزم: الدخول، وتسجيل ولي الأمر، وتفعيل الطاقم */
(function () {
  'use strict';

  var C = window.AZM_CONFIG;
  // صفحتان منفصلتان: /portal لأولياء الأمور و /staff للطاقم
  var MODE = window.AZM_MODE === 'staff' ? 'staff' : 'parent';
  var OTHER_PAGE = MODE === 'staff' ? '../portal/' : '../staff/';
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  var LOGO = '../assets/azm-logo.webp';
  var WA = 'https://wa.me/' + C.academyWhatsapp;

  var session = null, profile = null, activation = null, kidCount = 1;

  /* ---------- أدوات ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? e.value.trim() : ''; }
  function emailOf(username) { return username.toLowerCase() + C.usernameDomain; }
  function validUsername(u) { return /^[a-z0-9._]{4,20}$/.test(u); }
  function validPhone(p) { return /^05\d{8}$/.test(p); }
  // الأرقام العربية إلى إنجليزية، والجوال إلى صيغة 05XXXXXXXX
  function toDigits(s) { return String(s || '').replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }).replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x6f0; }); }
  function normPhone(s) {
    var d = toDigits(s).replace(/\D/g, '');
    if (/^009665\d{8}$/.test(d)) return '0' + d.slice(5);
    if (/^9665\d{8}$/.test(d)) return '0' + d.slice(3);
    if (/^5\d{8}$/.test(d)) return '0' + d;
    return d;
  }
  function normOrder(s) { return toDigits(s).replace(/\D/g, ''); }
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  function fmt(s) { var p = s.split('-'); return +p[2] + ' ' + MONTHS[+p[1] - 1]; }
  function daysLeft(end) { var t = new Date(); t.setHours(0, 0, 0, 0); var p = end.split('-'); return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - t) / 864e5); }
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('show'); }, 2800); }
  function setError(id, msg) { var e = $(id); if (e) e.textContent = msg || ''; }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'لحظة…'; } else if (btn.dataset.label) btn.textContent = btn.dataset.label; }

  // رسائل الأخطاء بالعربي بدل رسائل الخادم
  function friendly(err) {
    var m = (err && (err.message || err.error_description || err.msg)) || String(err || '');
    if (/Invalid login credentials/i.test(m)) return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    if (/already registered|already exists|duplicate key.*username/i.test(m)) return 'اسم المستخدم مستخدم، اختر اسم ثاني.';
    if (/invalid username/i.test(m)) return 'اسم المستخدم غير صالح.';
    if (/invalid, used or expired code/i.test(m)) return 'رمز التفعيل غير صحيح أو مستخدم أو منتهي. اطلب رمز جديد من الدعم الفني.';
    if (/rate limit|too many/i.test(m)) return 'محاولات كثيرة. انتظر شوي وحاول مرة ثانية.';
    if (/Password should be/i.test(m)) return 'كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل وفيها رقم.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.';
    return 'صار خطأ غير متوقع. حاول مرة ثانية، ولو تكرر تواصل معنا.';
  }

  /* ---------- القطع المشتركة ---------- */
  function card(inner) { return '<div class="auth"><div class="auth-card">' + inner + '</div></div>'; }
  function head(icon, color, title, sub) {
    return (icon ? '<div class="big-icon" style="--c:' + color + '">' + icon + '</div>' : '<img src="' + LOGO + '" alt="أكاديمية عزم">') +
      '<h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '');
  }
  function passFields(prefix) {
    return '<div class="field"><label for="' + prefix + '1">كلمة المرور</label><input id="' + prefix + '1" type="password" dir="ltr" autocomplete="new-password"></div>' +
      '<div class="field"><label for="' + prefix + '2">تأكيد كلمة المرور</label><input id="' + prefix + '2" type="password" dir="ltr" autocomplete="new-password"></div>' +
      '<ul class="rules" data-rules="' + prefix + '"><li data-r="len">8 أحرف على الأقل</li><li data-r="num">فيها رقم واحد على الأقل</li><li data-r="same">الكلمتان متطابقتان</li></ul>';
  }
  function userField(id) {
    return '<div class="field"><label for="' + id + '">اسم المستخدم</label><input id="' + id + '" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="مثال: ahmed_salem"><span class="hint" data-user-msg>أحرف إنجليزية صغيرة وأرقام و . أو _ (من 4 إلى 20)</span></div>';
  }
  function kidFields(i) {
    return '<fieldset class="kid-box"><legend>الابن ' + (i + 1) + '</legend><div class="form-grid two">' +
      '<div class="field"><label for="k-name-' + i + '">اسم اللاعب كاملًا</label><input id="k-name-' + i + '"></div>' +
      '<div class="field"><label for="k-birth-' + i + '">تاريخ الميلاد</label><input id="k-birth-' + i + '" type="date"></div>' +
      '<div class="field full"><label for="k-health-' + i + '">ملاحظات صحية (اختياري)</label><input id="k-health-' + i + '" placeholder="حساسية، ربو، إصابة سابقة…"></div></div></fieldset>';
  }
  function kidsFields() {
    var kids = ''; for (var i = 0; i < kidCount; i++) kids += kidFields(i);
    return '<div id="kids">' + kids + '</div><button type="button" class="btn btn-ghost btn-block" id="add-kid">+ أضف ابن آخر</button>';
  }
  function phoneField(id) {
    return '<div class="field"><label for="' + id + '">رقم الجوال <span class="req">يكون اسم المستخدم</span></label><input id="' + id + '" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX"><span class="hint" data-user-msg>تدخل به البوابة، ونتواصل معك عليه بالواتساب.</span></div>';
  }
  function logoutLink() { return '<p class="auth-help"><a href="#" data-logout>تسجيل الخروج</a></p>'; }

  /* ---------- فحوصات الحقول أثناء الكتابة ---------- */
  function watchPassword(prefix, onChange) {
    var a = $(prefix + '1'), b = $(prefix + '2'), ul = document.querySelector('[data-rules="' + prefix + '"]'), ok = false;
    function check() {
      var r = { len: a.value.length >= 8, num: /\d/.test(a.value), same: !!a.value && a.value === b.value };
      ul.querySelectorAll('li').forEach(function (li) { li.classList.toggle('ok', !!r[li.dataset.r]); });
      ok = r.len && r.num && r.same; if (onChange) onChange();
    }
    a.addEventListener('input', check); b.addEventListener('input', check);
    return function () { return ok; };
  }
  function watchUsername(input, onChange) {
    var msg = input.parentNode.querySelector('[data-user-msg]'), ok = false, timer = null, seq = 0;
    function show(cls, text) { msg.className = 'hint' + (cls ? ' ' + cls : ''); msg.textContent = text; }
    input.addEventListener('input', function () {
      input.value = input.value.toLowerCase().replace(/\s/g, '');
      var v = input.value; ok = false; if (onChange) onChange();
      clearTimeout(timer);
      if (!v) return show('', 'أحرف إنجليزية صغيرة وأرقام و . أو _ (من 4 إلى 20)');
      if (!validUsername(v)) return show('bad', 'أحرف إنجليزية صغيرة وأرقام و . أو _ فقط، من 4 إلى 20');
      show('', 'نتحقق…');
      var mine = ++seq;
      timer = setTimeout(function () {
        sb.rpc('username_available', { p_username: v }).then(function (res) {
          if (mine !== seq) return;
          if (res.error) return show('bad', 'تعذّر التحقق الآن');
          ok = res.data === true;
          show(ok ? 'good' : 'bad', ok ? '✓ «' + v + '» متاح' : '✗ «' + v + '» مستخدم، جرّب اسم ثاني');
          if (onChange) onChange();
        });
      }, 350);
    });
    return function () { return ok; };
  }
  // رقم الجوال هو اسم مستخدم ولي الأمر، فنتأكد إنه مو مسجّل قبل
  function watchPhone(input, onChange) {
    var msg = input.parentNode.querySelector('[data-user-msg]'), ok = false, timer = null, seq = 0;
    function show(cls, text) { msg.className = 'hint' + (cls ? ' ' + cls : ''); msg.textContent = text; }
    input.addEventListener('input', function () {
      var v = normPhone(input.value); ok = false; if (onChange) onChange();
      clearTimeout(timer);
      if (!input.value.trim()) return show('', 'تدخل به البوابة، ونتواصل معك عليه بالواتساب.');
      if (!validPhone(v)) return show('bad', 'رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام.');
      show('', 'نتحقق…');
      var mine = ++seq;
      timer = setTimeout(function () {
        sb.rpc('username_available', { p_username: v }).then(function (res) {
          if (mine !== seq) return;
          if (res.error) return show('bad', 'تعذّر التحقق الآن');
          ok = res.data === true;
          show(ok ? 'good' : 'bad', ok ? '✓ الرقم ' + v + ' جاهز' : '✗ الرقم ' + v + ' عنده حساب. سجّل دخولك بدل حساب جديد.');
          if (onChange) onChange();
        });
      }, 350);
    });
    return function () { return ok; };
  }
  function bindAddKid() {
    $('add-kid').addEventListener('click', function () {
      var box = document.createElement('div'); box.innerHTML = kidFields(kidCount++);
      $('kids').appendChild(box.firstChild);
    });
  }
  function readKids() {
    var kids = [];
    for (var i = 0; i < kidCount; i++) {
      var name = val('k-name-' + i), birth = val('k-birth-' + i), health = val('k-health-' + i);
      if (!name && !birth && !health && i > 0) continue;
      if (name.length < 2 || !birth) return { error: 'اكتب اسم وتاريخ ميلاد كل ابن.', focus: name.length < 2 ? 'k-name-' + i : 'k-birth-' + i };
      kids.push({ full_name: name, birth_date: birth, health_notes: health || null });
    }
    return { kids: kids };
  }

  /* ---------- إرسال طلب التسجيل (عملية واحدة على الخادم) ---------- */
  function submitRequest(method, order, kids) {
    return sb.rpc('submit_registration', { p_method: method, p_order: order || null, p_kids: kids }).then(function (r) {
      if (r.error) throw r.error;
      return r.data;
    });
  }
  var ORDER_MSG = {
    not_found: 'رقم الطلب غير مسجّل عندنا. تأكد من الرقم في رسالة سلة، ولو متأكد منه تواصل معنا ونضيفه.',
    used: 'رقم الطلب هذا اتسجّل به حساب قبل. لو عندك حساب سجّل دخولك، أو تواصل معنا.',
    invalid: 'رقم الطلب أرقام فقط، زي ما يظهر في رسالة سلة.',
    too_many: 'محاولات كثيرة. انتظر ربع ساعة وحاول مرة ثانية.',
    request_exists: 'عندك طلب قيد المراجعة.'
  };
  var PAY_NAMES = { salla: 'سلة', cash: 'كاش', card: 'بطاقة' };
  var PLAN_NAMES = { offer: 'عرض التأسيس', monthly: 'شهري' };
  var VENUE = 'حي الزهراء';
  var MAP_URL = 'https://www.google.com/maps?q=21.60126495361328,39.13291549682617';

  /* ---------- مواعيد الحصص (0 = الأحد) ---------- */
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function t12(t) { var p = String(t).split(':'), h = +p[0]; return (h % 12 || 12) + ':' + p[1] + (h < 12 ? ' ص' : ' م'); }
  // «السبت والثلاثاء 7:00 م إلى 8:30 م، والخميس 6:00 م إلى 7:30 م» بترتيب الأسبوع من السبت
  function slotsText(slots) {
    var byTime = {}, order = [];
    (slots || []).slice().sort(function (a, b) { return (a.weekday + 1) % 7 - (b.weekday + 1) % 7 || (a.start_time < b.start_time ? -1 : 1); }).forEach(function (x) {
      var key = t12(x.start_time) + ' إلى ' + t12(x.end_time);
      if (!byTime[key]) { byTime[key] = []; order.push(key); }
      byTime[key].push(DAYS[x.weekday]);
    });
    return order.map(function (k) { return byTime[k].join(' و') + ' ' + k; }).join('، و');
  }
  function nextSlot(slots) {
    var now = new Date(), best = null;
    (slots || []).forEach(function (x) {
      var p = String(x.start_time).split(':'), d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +p[0], +p[1]);
      d.setDate(d.getDate() + ((x.weekday - now.getDay() + 7) % 7));
      if (d <= now) d.setDate(d.getDate() + 7);
      if (!best || d < best.at) best = { at: d, slot: x };
    });
    if (!best) return '';
    var days = Math.round((new Date(best.at.getFullYear(), best.at.getMonth(), best.at.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    return (days === 0 ? 'اليوم' : days === 1 ? 'بكرة' : DAYS[best.slot.weekday]) + ' ' + t12(best.slot.start_time);
  }

  /* ---------- الشاشات ---------- */
  function viewLogin() {
    var staff = MODE === 'staff';
    return card(head(null, '', staff ? 'بوابة طاقم عزم' : 'بوابة أولياء الأمور', staff ? 'للمدرب والمشرفين والدعم الفني' : 'تابع اشتراك ابنك وحضوره وتقاريره') +
      '<form id="login-form" class="form-grid" novalidate><div class="field">' + (staff
        ? '<label for="u">اسم المستخدم</label><input id="u" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false">'
        : '<label for="u">رقم الجوال</label><input id="u" dir="ltr" inputmode="tel" autocomplete="username" placeholder="05XXXXXXXX">') + '</div>' +
      '<div class="field"><label for="p">كلمة المرور</label><input id="p" type="password" dir="ltr" autocomplete="current-password"></div>' +
      '<p class="form-error" id="l-error" role="alert"></p><button class="btn btn-gold btn-block">دخول</button></form>' +
      '<div class="auth-links">' + (staff
        ? '<a class="btn btn-ghost btn-block" href="#activate">أول مرة؟ فعّل حسابك برمز التفعيل</a>'
        : '<a class="btn btn-ghost btn-block" href="#signup">ولي أمر جديد؟ أنشئ حسابك</a>') + '</div>' +
      '<p class="auth-help">نسيت كلمة المرور؟ ' + (staff ? 'تواصل مع الدعم الفني ويعيد تعيينها لك.' : '<a href="' + WA + '" target="_blank" rel="noopener">تواصل معنا</a> ونعيد تعيينها لك.') + '</p>' +
      (staff ? '' : '<a class="back-home" href="../">← الموقع الرئيسي</a>'));
  }
  /* ---------- خطوات تسجيل ولي الأمر ----------
     1. طريقة الدفع  2. رقم طلب سلة (لو سلة)  3. البيانات والأبناء
     نفس الخطوات لولي الأمر الجديد، ولصاحب حساب ما كمّل طلبه أو انرفض طلبه. */
  var reg = { method: null, order: null, reason: null };
  function regTitle() { return session ? (reg.reason ? 'أعد إرسال طلبك' : 'كمّل طلب التسجيل') : 'إنشاء حساب ولي أمر'; }
  function regFoot() { return session ? logoutLink() : '<p class="auth-help">عندك حساب؟ <a href="#login">سجّل دخولك</a></p>'; }
  function waAsk(text) { return WA + '?text=' + encodeURIComponent(text); }
  function viewMethod() {
    return card(head(null, '', regTitle(), 'كيف دفعت اشتراك ابنك؟') +
      (reg.reason ? '<div class="reject-box"><span>سبب رفض الطلب السابق</span><p>' + esc(reg.reason) + '</p></div>' : '') +
      '<div class="method-grid">' +
      '<button type="button" class="method-card" data-method="salla"><b>اشتركت من متجر سرج (سلة)</b><span>عندك رقم طلب من رسالة تأكيد سلة</span></button>' +
      '<button type="button" class="method-card" data-method="cash"><b>دفعت كاش أو بطاقة في الأكاديمية</b><span>بدون رقم طلب</span></button></div>' +
      '<a class="btn btn-ghost btn-block" href="' + C.sallaUrl + '" target="_blank" rel="noopener">ما دفعت بعد؟ اشترك من سلة</a>' + regFoot());
  }
  function viewOrderStep() {
    return card(head(null, '', regTitle(), 'اكتب رقم طلب سلة، ونتأكد إنه مسجّل عندنا.') +
      '<form id="order-form" class="form-grid" novalidate><div class="field"><label for="o-order">رقم طلب سلة</label><span class="paste-row"><input id="o-order" type="text" dir="ltr" autocomplete="off" spellcheck="false" placeholder="مثال: 48777" value="' + esc(reg.order || '') + '"><button type="button" class="btn btn-ghost btn-sm" data-paste-order>لصق</button></span><span class="hint">تلقاه في رسالة تأكيد الطلب من سلة، وتقدر تنسخه وتلصقه هنا.</span></div>' +
      '<div id="o-result" role="alert"></div><button class="btn btn-gold btn-block" id="o-submit">تحقق من الرقم</button></form>' +
      '<p class="auth-help"><a href="#" data-reg-step="method">← رجوع</a></p>' + regFoot());
  }
  function viewDetails() {
    var salla = reg.method === 'salla';
    return card(head(null, '', regTitle(), session ? 'باقي بيانات الأبناء.' : 'بعد الإرسال تراجع الأكاديمية طلبك وتفعّل حسابك.') +
      '<form id="details-form" class="form-grid" novalidate>' +
      (salla ? '<div class="cred"><div><span>رقم طلب سلة</span><b class="num">' + esc(reg.order) + ' ✓</b></div></div>'
        : '<p class="form-section">طريقة الدفع</p><div class="chips pay-chips"><label><input type="radio" name="pay" value="cash"> كاش</label><label><input type="radio" name="pay" value="card"> بطاقة</label></div>' +
          '<p class="hint">تأكد إنك دفعت في الأكاديمية. الطلب يتفعّل بعد ما يتأكدون من استلام المبلغ.</p>') +
      (session ? '' : '<p class="form-section">بياناتك</p>' +
        '<div class="field"><label for="s-name">الاسم كاملًا</label><input id="s-name" autocomplete="name"></div>' +
        phoneField('s-phone') + passFields('sp')) +
      '<p class="form-section">بيانات الأبناء</p>' + kidsFields() +
      '<p class="form-error" id="s-error" role="alert"></p>' +
      '<button class="btn btn-gold btn-block" id="s-submit">إرسال طلب التسجيل</button></form>' +
      '<p class="auth-help"><a href="#" data-reg-step="' + (salla ? 'order' : 'method') + '">← رجوع</a></p>' + regFoot());
  }
  function showReg(step) {
    if (step === 'order') { show(viewOrderStep()); bindOrderStep(); }
    else if (step === 'details') { kidCount = 1; show(viewDetails()); bindDetails(); }
    else { show(viewMethod()); }
  }
  function viewPending(req) {
    var kids = (req.request_players || []).map(function (rp) { return rp.players && rp.players.full_name.split(' ')[0]; }).filter(Boolean).join('، ');
    var pay = req.salla_order_no ? '<div><span>رقم طلب سلة</span><b class="num">' + esc(req.salla_order_no) + '</b></div>'
      : '<div><span>طريقة الدفع</span><b class="plain">' + esc(PAY_NAMES[req.payment_method] || '—') + '</b></div>';
    return card(head('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', 'var(--yellow)', 'طلبك قيد المراجعة', 'وصل طلبك للأكاديمية، ويتفعّل حسابك أول ما تراجع البيانات.') +
      '<ol class="steps"><li class="done">أرسلت الطلب</li><li class="now">مراجعة الأكاديمية</li><li>تفعيل الحساب</li></ol>' +
      '<div class="cred"><div><span>' + (validPhone(profile.username) ? 'رقم الجوال (اسم المستخدم)' : 'اسم المستخدم') + '</span><b class="num">' + esc(profile.username) + '</b></div>' + (kids ? '<div><span>الأبناء</span><b class="plain">' + esc(kids) + '</b></div>' : '') + pay + '</div>' +
      '<a class="btn btn-wa btn-block" style="margin-top:16px" href="' + WA + '" target="_blank" rel="noopener">تأخر الرد؟ تواصل معنا</a>' + logoutLink());
  }
  function viewActivate() {
    return card(head('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>', 'var(--gold)', 'تفعيل حساب الطاقم', 'اكتب رمز التفعيل اللي وصلك. الرمز يُستخدم مرة وحدة.') +
      '<form id="activate-form" class="form-grid" novalidate><div class="field"><label for="a-code">رمز التفعيل</label><input id="a-code" dir="ltr" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="AZM-…" class="code-input"></div>' +
      '<p class="form-error" id="a-error" role="alert"></p><button class="btn btn-gold btn-block" id="a-submit">تحقق من الرمز</button></form>' +
      '<p class="auth-help"><a href="#login">رجوع للدخول</a></p>');
  }
  function viewFirstUse() {
    return card(head('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/></svg>', 'var(--green)', 'أهلًا بك في عزم', 'أول استخدام: أكمل بياناتك لتفعيل حساب <b>' + esc(activation.label) + '</b>.') +
      '<form id="first-form" class="form-grid" novalidate><div class="field"><label for="f-full">الاسم كاملًا</label><input id="f-full" autocomplete="name"></div>' + userField('f-user') + passFields('fp') +
      '<p class="form-error" id="f-error" role="alert"></p><button class="btn btn-gold btn-block" id="f-submit" disabled>حفظ وتفعيل الحساب</button></form>');
  }
  var ROLE_NAMES = { coach: 'المدرب', super_admin: 'المشرف العام', support: 'الدعم الفني' };
  function viewStaffHome() {
    return card(head(null, '', 'أهلًا ' + esc(profile.full_name.split(' ')[0] || ''), 'حسابك مفعّل كـ<b>' + ROLE_NAMES[profile.role] + '</b>.') +
      '<div class="notice-box reject-box" style="border-color:rgba(76,195,255,.45);background:rgba(76,195,255,.08)"><span style="color:var(--blue)">قريبًا</span><p>لوحة ' + ROLE_NAMES[profile.role] + ' قيد التجهيز، وتظهر هنا أول ما تكتمل.</p></div>' + logoutLink());
  }
  function viewParentHome(players) {
    var list = players.map(function (p) {
      var subs = (p.subscriptions || []).slice().sort(function (a, b) { return a.end_date < b.end_date ? 1 : -1; }), s = subs[0], g = p.groups;
      var top = '<div class="prow-top"><span class="avatar">' + esc(p.full_name.charAt(0)) + '</span><div><h4>' + esc(p.full_name) + '</h4><p class="muted">' + esc(g ? 'مجموعة ' + g.name : '') + '</p></div>';
      if (p.status === 'pending' || !s) {
        return '<article class="prow">' + top + '<span class="st st-warn">بانتظار المدرب</span></div>' +
          '<p class="muted sub-wait">المدرب يحدد مجموعة ' + esc(p.full_name.split(' ')[0]) + ' ومدة اشتراكه ومواعيد الحصص، وتظهر هنا أول ما يخلص.</p></article>';
      }
      var left = daysLeft(s.end_date), started = daysLeft(s.start_date) <= 0;
      var st = left < 0 ? '<span class="st st-bad">منتهي</span>' : !started ? '<span class="st st-info">يبدأ ' + fmt(s.start_date) + '</span>' : left <= 7 ? '<span class="st st-warn">باقي ' + left + ' يوم</span>' : '<span class="st st-ok">باقي ' + left + ' يوم</span>';
      var slots = g && g.group_slots, next = left >= 0 ? nextSlot(slots) : '';
      return '<article class="prow">' + top + st + '</div><dl class="sub-details">' +
        '<div><dt>الاشتراك</dt><dd>' + esc(PLAN_NAMES[s.plan] || '') + '</dd></div>' +
        '<div><dt>من</dt><dd>' + fmt(s.start_date) + '</dd></div><div><dt>إلى</dt><dd>' + fmt(s.end_date) + '</dd></div>' +
        (slots && slots.length ? '<div class="wide"><dt>مواعيد الحصص</dt><dd>' + esc(slotsText(slots)) + '</dd></div>' : '') +
        (next ? '<div class="wide"><dt>الحصة الجاية</dt><dd class="next">' + esc(next) + '</dd></div>' : '') +
        '</dl>' + (left >= 0 && left <= 7 ? '<p class="sub-renew">اشتراكه يخلص قريب. جدّد من سلة أو تواصل معنا.</p>' : left < 0 ? '<p class="sub-renew">انتهى الاشتراك. جدّد من سلة أو تواصل معنا.</p>' : '') + '</article>';
    }).join('');
    var hasSub = players.some(function (p) { return p.status === 'active'; });
    return card(head(null, '', 'أهلًا ' + esc(profile.full_name.split(' ')[0] || ''), 'تفاصيل اشتراك أبنائك ومواعيد الحصص.') +
      '<div class="kids-list">' + (list || '<p class="empty">لا يوجد لاعبون بعد.</p>') + '</div>' +
      (hasSub ? '<a class="venue-box" href="' + MAP_URL + '" target="_blank" rel="noopener"><span>مكان التدريب</span><b>' + VENUE + '</b><em>افتح الموقع في الخرائط ←</em></a>' : '') +
      '<a class="btn btn-wa btn-block" style="margin-top:16px" href="' + WA + '" target="_blank" rel="noopener">تواصل مع الأكاديمية</a>' + logoutLink());
  }

  /* ---------- التنقل ---------- */
  function show(html) { $('app').innerHTML = html; window.scrollTo(0, 0); }
  function loadingView() { show('<div class="loading"><div><div class="spinner"></div>جاري التحميل…</div></div>'); }

  // يقرر الشاشة المناسبة للمستخدم المسجّل دخوله. لو فيه تحميل جاري نرجّع نفسه بدل ما نكرره
  var routing = null;
  function routeSignedIn() {
    if (routing) return routing;
    routing = doRoute().then(function () { routing = null; }, function () { routing = null; });
    return routing;
  }
  function doRoute() {
    loadingView();
    return sb.from('profiles').select('*').eq('id', session.user.id).single().then(function (r) {
      if (r.error) throw r.error;
      profile = r.data;
      // كل واحد يستخدم صفحته: الطاقم من /staff وأولياء الأمور من /portal
      if (MODE === 'parent' && profile.role !== 'parent') {
        show(card(head(null, '', 'هذي صفحة أولياء الأمور', 'حسابك من الطاقم، فادخل من صفحة الطاقم.') + '<a class="btn btn-gold btn-block" href="' + OTHER_PAGE + '">افتح صفحة الطاقم</a>' + logoutLink())); return;
      }
      if (MODE === 'staff' && profile.role === 'parent') {
        show(card(head(null, '', 'هذي صفحة الطاقم', 'حسابك ليس مربوطًا بدور في الطاقم. لو أنت ولي أمر، ادخل من صفحة أولياء الأمور، ولو معك رمز تفعيل تواصل مع الدعم الفني.') + '<a class="btn btn-gold btn-block" href="' + OTHER_PAGE + '">صفحة أولياء الأمور</a>' + logoutLink())); return;
      }
      if (profile.role !== 'parent') {
        if (profile.status === 'disabled') { show(card(head(null, '', 'الحساب معطّل', 'تواصل مع الدعم الفني.') + logoutLink())); return; }
        if (profile.status === 'active' && profile.role === 'super_admin' && window.AZM_SUPERVISOR) {
          return window.AZM_SUPERVISOR.open({ sb: sb, profile: profile, root: $('app') });
        }
        if (profile.status === 'active' && profile.role === 'support' && window.AZM_SUPPORT) return openSupport();
        if (profile.status === 'active' && profile.role === 'coach') return loadNewPlayers();
        show(viewStaffHome()); return;
      }
      if (profile.status === 'disabled') { show(card(head(null, '', 'الحساب معطّل', 'تواصل مع الأكاديمية لإعادة تفعيله.') + '<a class="btn btn-wa btn-block" href="' + WA + '" target="_blank" rel="noopener">تواصل معنا</a>' + logoutLink())); return; }
      if (profile.status === 'active') {
        return sb.from('players').select('id, full_name, status, groups(name, group_slots(weekday, start_time, end_time)), subscriptions(plan, start_date, end_date)').eq('parent_id', profile.id).neq('status', 'archived').order('created_at').then(function (p) {
          if (p.error) throw p.error;
          show(viewParentHome(p.data));
        });
      }
      // قيد المراجعة أو مرفوض: نشوف آخر طلب
      return sb.from('registration_requests').select('id, status, salla_order_no, payment_method, reject_reason, created_at, request_players(players(full_name))').eq('parent_id', profile.id).order('created_at', { ascending: false }).limit(1).then(function (q) {
        if (q.error) throw q.error;
        var req = q.data[0];
        if (req && req.status === 'pending') { show(viewPending(req)); return; }
        reg = { method: null, order: null, reason: req && req.status === 'rejected' ? req.reject_reason : null };
        showReg('method');
      });
    }).catch(function (e) { console.error(e); show(card(head(null, '', 'تعذّر تحميل حسابك', friendly(e)) + '<button class="btn btn-gold btn-block" data-retry>حاول مرة ثانية</button>' + logoutLink())); });
  }

  function render() {
    var h = location.hash.replace('#', '');
    if (session) {
      if (h === 'firstuse' && activation) { show(viewFirstUse()); bindFirstUse(); return; }
      routeSignedIn(); return;
    }
    if (h === 'signup' && MODE === 'parent') { reg = { method: null, order: null, reason: null }; showReg('method'); }
    else if (h === 'activate' && MODE === 'staff') { show(viewActivate()); bindActivate(); }
    else if (h === 'firstuse' && activation && MODE === 'staff') { show(viewFirstUse()); bindFirstUse(); }
    else { show(viewLogin()); bindLogin(); }
  }

  /* ---------- ربط النماذج ---------- */
  function bindLogin() {
    $('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = val('u'), p = $('p').value, btn = e.target.querySelector('button');
      // أولياء الأمور يدخلون برقم الجوال، بأي صيغة كتبوه
      var u = MODE === 'parent' && validPhone(normPhone(raw)) ? normPhone(raw) : raw.toLowerCase();
      setError('l-error');
      if (!u || !p) return setError('l-error', 'اكتب اسم المستخدم وكلمة المرور.');
      busy(btn, true, 'جاري الدخول…');
      sb.auth.signInWithPassword({ email: emailOf(u), password: p }).then(function (r) {
        busy(btn, false);
        if (r.error) return setError('l-error', friendly(r.error));
        session = r.data.session; location.hash = ''; routeSignedIn();
      });
    });
  }

  function bindOrderStep() {
    var input = $('o-order');
    // اللصق من رسالة سلة: نترك الأرقام بس
    input.addEventListener('input', function () { var c = normOrder(input.value); if (c !== input.value) input.value = c; });
    document.querySelector('[data-paste-order]').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { input.focus(); toast('اضغط مطوّلًا على الخانة واختر لصق'); return; }
      navigator.clipboard.readText().then(function (t) { input.value = normOrder(t); input.focus(); }, function () { input.focus(); toast('اضغط مطوّلًا على الخانة واختر لصق'); });
    });
    $('order-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var order = normOrder(val('o-order')), btn = $('o-submit'), box = $('o-result');
      box.innerHTML = '';
      if (!/^\d{3,20}$/.test(order)) { $('o-order').focus(); box.innerHTML = '<p class="form-error">' + ORDER_MSG.invalid + '</p>'; return; }
      busy(btn, true, 'نتحقق…');
      sb.rpc('check_salla_order', { p_order: order }).then(function (r) {
        busy(btn, false);
        if (r.error) { box.innerHTML = '<p class="form-error">' + esc(friendly(r.error)) + '</p>'; return; }
        if (r.data === 'ok') { reg.order = order; showReg('details'); return; }
        reg.order = order;
        box.innerHTML = '<div class="reject-box"><span>ما قدرنا نكمل بالرقم ' + esc(order) + '</span><p>' + esc(ORDER_MSG[r.data] || friendly(r.data)) + '</p></div>' +
          (r.data === 'too_many' ? '' : '<a class="btn btn-wa btn-block" style="margin-top:10px" target="_blank" rel="noopener" href="' + esc(waAsk('أهلًا، أبغى أسجّل في أكاديمية عزم برقم طلب سلة ' + order + ' والمنصة تقول ' + (r.data === 'used' ? 'إنه مستخدم.' : 'إنه غير مسجّل.'))) + '">تواصل معنا بالواتساب</a>');
      });
    });
  }

  function bindDetails() {
    var passOk = session ? null : watchPassword('sp'), phoneOk = session ? null : watchPhone($('s-phone'));
    bindAddKid();
    $('details-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setError('s-error');
      var method = reg.method === 'salla' ? 'salla' : ((document.querySelector('input[name="pay"]:checked') || {}).value || '');
      if (!method) return setError('s-error', 'اختر طريقة الدفع: كاش أو بطاقة.');
      var name, phone, pass;
      if (!session) {
        name = val('s-name'); phone = normPhone(val('s-phone')); pass = $('sp1').value;
        if (name.length < 3) { $('s-name').focus(); return setError('s-error', 'اكتب اسمك كاملًا.'); }
        if (!validPhone(phone)) { $('s-phone').focus(); return setError('s-error', 'رقم الجوال يبدأ بـ 05 ويتكون من 10 أرقام.'); }
        if (!phoneOk()) { $('s-phone').focus(); return setError('s-error', 'الرقم هذا عنده حساب، أو لسه ما خلصنا التحقق منه.'); }
        if (!passOk()) { $('sp1').focus(); return setError('s-error', 'كلمة المرور لا تحقق الشروط أو غير متطابقة.'); }
      }
      var k = readKids(); if (k.error) { $(k.focus).focus(); return setError('s-error', k.error); }

      var btn = $('s-submit'), created = false; busy(btn, true, 'جاري الإرسال…');
      var start = session ? Promise.resolve() : sb.auth.signUp({ email: emailOf(phone), password: pass, options: { data: { username: phone, full_name: name, phone: phone } } }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data.session) throw new Error('no session');
        session = r.data.session; created = true;
      });
      start.then(function () {
        return submitRequest(method, reg.order, k.kids);
      }).then(function (status) {
        if (status === 'ok' || status === 'request_exists') { location.hash = ''; routeSignedIn().then(function () { toast('وصل طلبك للأكاديمية'); }); return; }
        if (created) { location.hash = ''; routeSignedIn().then(function () { toast('انعمل حسابك، لكن الطلب ما وصل: ' + (ORDER_MSG[status] || '')); }); return; }
        busy(btn, false); setError('s-error', ORDER_MSG[status] || friendly(status));
      }).catch(function (err) {
        console.error(err); busy(btn, false);
        // لو انعمل الحساب وتعثّر الطلب، يكمّله ولي الأمر من نفس الخطوات بعد الدخول
        if (created) { location.hash = ''; routeSignedIn().then(function () { toast('انعمل حسابك، لكن الطلب ما وصل. كمّله من هنا.'); }); return; }
        setError('s-error', /already registered|already exists|duplicate key.*username/i.test(err && err.message || '') ? 'رقم الجوال هذا عنده حساب. سجّل دخولك.' : friendly(err));
      });
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-method], [data-reg-step]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.method) { reg.method = t.dataset.method; reg.order = null; showReg(reg.method === 'salla' ? 'order' : 'details'); }
    else showReg(t.dataset.regStep);
  });

  function normalizeActivationCode(code) {
    return code.toUpperCase()
      .replace(/[\s\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069]/g, '')
      .replace(/[\u2010-\u2015\u2212\uff0d]/g, '-')
      .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, function (digit) {
        var zero = digit <= '\u0669' ? '\u0660' : '\u06f0';
        return String(digit.charCodeAt(0) - zero.charCodeAt(0));
      })
      .replace(/^AZM-?([A-Z0-9]{6})-?([A-Z0-9]{4})$/, 'AZM-$1-$2')
      .replace(/^AZM-?([A-F0-9]{12})-?([A-F0-9]{12})$/, 'AZM-$1-$2');
  }

  function bindActivate() {
    $('activate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var code = normalizeActivationCode(val('a-code')), btn = $('a-submit');
      setError('a-error');
      if (!code) return setError('a-error', 'اكتب رمز التفعيل.');
      busy(btn, true, 'نتحقق…');
      sb.rpc('check_activation_code', { p_code: code }).then(function (r) {
        busy(btn, false);
        if (r.error) return setError('a-error', friendly(r.error));
        if (!r.data || !r.data.length) return setError('a-error', 'الرمز غير صحيح أو مستخدم أو منتهي. اطلب رمز جديد من الدعم الفني.');
        activation = { code: code, label: r.data[0].label, role: r.data[0].role };
        location.hash = 'firstuse';
      });
    });
  }

  function bindFirstUse() {
    var btn = $('f-submit'), full = $('f-full'), pOk = null, uOk = null;
    function upd() { btn.disabled = !(full.value.trim().length >= 3 && uOk && uOk() && pOk && pOk()); }
    pOk = watchPassword('fp', upd); uOk = watchUsername($('f-user'), upd); full.addEventListener('input', upd);
    $('first-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setError('f-error');
      var name = full.value.trim(), user = val('f-user'), pass = $('fp1').value;
      busy(btn, true, 'جاري التفعيل…');
      var start = session ? Promise.resolve() : sb.auth.signUp({ email: emailOf(user), password: pass, options: { data: { username: user, full_name: name } } }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data.session) throw new Error('no session');
        session = r.data.session;
      });
      start.then(function () {
        return sb.rpc('redeem_activation_code', { p_code: activation.code, p_full_name: name });
      }).then(function (r) {
        if (r.error) throw r.error;
        activation = null; location.hash = '';
        return routeSignedIn().then(function () { toast('تم تفعيل حسابك'); });
      }).catch(function (err) { console.error(err); busy(btn, false); setError('f-error', friendly(err)); });
    });
  }

  /* ---------- النوافذ المنبثقة ---------- */
  function modal(html) {
    var root = $('modal-root');
    root.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><div class="modal-box">' + html + '</div></div>';
    var m = root.firstChild;
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    var f = m.querySelector('select, input, textarea, button'); if (f) f.focus();
    return m;
  }
  function closeModal() { $('modal-root').innerHTML = ''; }
  function waLink(phone, text) { return 'https://wa.me/966' + String(phone || '').replace(/^0/, '') + '?text=' + encodeURIComponent(text); }
  function waModal(title, intro, phone, msg) {
    modal('<h3>' + esc(title) + '</h3><p class="muted">' + esc(intro) + '</p><div class="wa-preview">' + esc(msg) + '</div>' +
      '<div class="actions">' + (phone ? '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + esc(waLink(phone, msg)) + '">أرسل عبر واتساب</a>' : '<p class="muted">لا يوجد جوال مسجّل لولي الأمر.</p>') +
      '<button class="btn btn-ghost btn-block" type="button" data-close>تم</button></div>');
  }

  /* ---------- لوحة المدرب: طلبات التسجيل ---------- */
  var PORTAL_URL = 'azm.sorog.net/portal';
  var KIND = { new_account: ['حساب جديد', 'st-info'], new_child: ['ابن جديد لحساب قائم', 'st-ok'], renewal: ['تجديد اشتراك', 'st-warn'] };
  var REASONS = ['لم نستلم المبلغ بعد', 'الطلب غير مدفوع في سلة', 'بيانات اللاعب ناقصة', 'الفئة العمرية غير متاحة حاليًا'];
  var coach = { requests: [], groups: [], history: [], newPlayers: [] };

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addMonth(s) { var p = s.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); d.setMonth(d.getMonth() + 1); return iso(d); }
  function ageOf(birth) { if (!birth) return null; var p = birth.split('-'), b = new Date(+p[0], +p[1] - 1, +p[2]), t = new Date(), a = t.getFullYear() - b.getFullYear(); if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
  // يقترح المجموعة من العمر: «تحت 10» تعني أصغر من 10 سنوات
  function suggestGroup(birth) {
    var a = ageOf(birth), best = null;
    coach.groups.forEach(function (g) { var n = parseInt((g.name.match(/\d+/) || [])[0], 10); if (a != null && n && a < n && (!best || n < best.n)) best = { id: g.id, n: n }; });
    return best ? best.id : (coach.groups[0] && coach.groups[0].id);
  }
  function stamp(ts) { var d = new Date(ts); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' · ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function openSupport() {
    return window.AZM_SUPPORT.open({ sb: sb, profile: profile, root: $('app'), toast: toast, requests: loadCoachRequests });
  }

  // الدعم الفني يراجع الطلبات ويفعّل الحساب، والمدرب يحدد مجموعة كل لاعب ومدة اشتراكه
  var staffView = 'requests';
  function staffShell(title, desc, body) {
    var support = profile.role === 'support', nr = coach.requests.length, nn = coach.newPlayers.length;
    var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg>';
    var icon2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M17 8v6M14 11h6"/></svg>';
    function item(v, ic, label, n) { return '<a href="#" data-staff-view="' + v + '"' + (staffView === v ? ' class="on" aria-current="page"' : '') + '>' + ic + '<span>' + label + (n ? ' <em class="count">' + n + '</em>' : '') + '</span></a>'; }
    var nav = (support ? item('requests', icon, 'طلبات التسجيل', nr) : '') + item('new', icon2, 'المشتركين الجدد', nn) +
      (support ? '<button type="button" class="btn btn-ghost btn-sm" data-support-home>لوحة الدعم الفني</button>' : '<span class="nav-soon">باقي الأقسام قريبًا</span>');
    return '<div class="shell"><aside class="side"><div class="side-head"><img src="' + LOGO + '" alt=""><div><b>أكاديمية عزم</b><span>' + (support ? 'الدعم الفني' : 'لوحة المدرب') + '</span></div></div><nav aria-label="أقسام اللوحة">' + nav + '</nav></aside>' +
      '<main class="main"><div class="topbar"><div class="who"><img src="' + LOGO + '" alt="أكاديمية عزم"><div><h1>' + esc(profile.full_name) + '<span class="role-badge">' + ROLE_NAMES[profile.role] + '</span></h1><p class="num">' + esc(profile.username) + '</p></div></div>' +
      '<div class="prow-actions"><button class="btn btn-ghost btn-sm" type="button" data-refresh>تحديث</button><button class="btn btn-ghost btn-sm" type="button" data-logout>خروج</button></div></div>' +
      '<h2 class="page-title">' + title + '</h2><p class="muted" style="margin-bottom:14px">' + desc + '</p>' + body + '</main></div>';
  }
  function loadGroups() {
    return sb.from('groups').select('id, name, coach_id, group_slots(weekday, start_time, end_time)').eq('is_active', true).order('name').then(function (r) {
      if (r.error) throw r.error;
      // المدرب يختار من مجموعاته، والدعم الفني من كل المجموعات
      coach.groups = r.data.filter(function (g) { return profile.role === 'support' || g.coach_id === profile.id; });
    });
  }
  function fetchNewPlayers() {
    return sb.from('players').select('id, full_name, birth_date, health_notes, created_at, parent:profiles!players_parent_id_fkey(full_name, username, phone, status), request_players(registration_requests(status, payment_method, salla_order_no, reviewed_at))')
      .eq('status', 'pending').is('group_id', null).order('created_at').then(function (r) {
        if (r.error) throw r.error;
        coach.newPlayers = r.data.filter(function (p) {
          return p.parent && p.parent.status === 'active' && (p.request_players || []).some(function (rp) { return rp.registration_requests && rp.registration_requests.status === 'approved'; });
        });
      });
  }

  function loadCoachRequests() {
    staffView = 'requests';
    loadingView();
    var sel = 'id, kind, status, salla_order_no, payment_method, reject_reason, created_at, reviewed_at, parent_id, ' +
      'parent:profiles!registration_requests_parent_id_fkey(full_name, username, phone), ' +
      'request_players(player_id, players(id, full_name, birth_date, health_notes, status, group_id))';
    return Promise.all([
      sb.from('registration_requests').select(sel).eq('status', 'pending').order('created_at'),
      sb.from('registration_requests').select(sel).neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(10),
      loadGroups(), fetchNewPlayers()
    ]).then(function (r) {
      for (var i = 0; i < 2; i++) if (r[i].error) throw r[i].error;
      coach.requests = r[0].data; coach.history = r[1].data;
      var cards = coach.requests.map(requestCard).join('') || '<p class="empty">ما فيه طلبات جديدة. 👌</p>';
      var hist = coach.history.map(requestCard).join('');
      show(staffShell('طلبات التسجيل', 'طلبات سلة رقمها موجود في قائمة أرقام سلة. طلبات الكاش أو البطاقة تأكد من استلام المبلغ قبل التفعيل. بعد التفعيل يظهر الأبناء عند المدرب في «المشتركين الجدد».',
        '<div class="plist">' + cards + '</div>' + (hist ? '<h4 class="report-sub" style="margin-top:22px">آخر الطلبات اللي اتخذت فيها قرار</h4><div class="plist">' + hist + '</div>' : '')));
    });
  }
  function loadNewPlayers() {
    staffView = 'new';
    loadingView();
    return Promise.all([loadGroups(), fetchNewPlayers()]).then(function () {
      var cards = coach.newPlayers.map(newPlayerCard).join('') || '<p class="empty">ما فيه مشتركين جدد ينتظرون. 👌</p>';
      show(staffShell('المشتركين الجدد', 'حسابات فعّلها الدعم الفني. حدد لكل لاعب مجموعته ونوع اشتراكه وبدايته ونهايته، وبعدها تظهر التفاصيل والمواعيد في حساب ولي الأمر.',
        (coach.groups.length ? '' : '<div class="reject-box"><span>ما فيه مجموعات مربوطة بحسابك</span><p>تواصل مع الدعم الفني يربطك بمجموعة.</p></div>') + '<div class="plist">' + cards + '</div>'));
    });
  }
  function refreshStaff() { return staffView === 'new' ? loadNewPlayers() : loadCoachRequests(); }

  function ageText(birth) { var a = ageOf(birth); return a == null ? '' : 'العمر <span class="num">' + a + '</span> ' + (a >= 3 && a <= 10 ? 'سنوات' : 'سنة'); }
  function requestCard(r) {
    var g = r.parent || {}, k = KIND[r.kind] || ['طلب', 'st-off'];
    var kids = (r.request_players || []).map(function (rp) {
      var p = rp.players; if (!p) return '';
      return '<li><b>' + esc(p.full_name) + '</b><span>' + ageText(p.birth_date) + (p.health_notes ? ' · ملاحظة صحية: ' + esc(p.health_notes) : '') + '</span></li>';
    }).join('');
    var foot = r.status === 'pending'
      ? '<div class="prow-actions"><button class="btn btn-gold btn-sm" type="button" data-activate="' + r.id + '">تفعيل الحساب</button><button class="btn btn-danger btn-sm" type="button" data-reject="' + r.id + '">رفض</button>' +
        (g.phone ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + esc(waLink(g.phone, 'أهلًا ' + (g.full_name || ''))) + '">واتساب</a>' : '') + '</div>'
      : '<p class="muted">' + (r.status === 'approved' ? '✓ تم التفعيل' : '✗ رُفض: ' + esc(r.reject_reason)) + (r.reviewed_at ? ' · ' + stamp(r.reviewed_at) : '') + '</p>';
    return '<article class="req' + (r.status !== 'pending' ? ' done' : '') + '"><div class="prow-top"><span class="avatar">' + esc((g.full_name || '؟').charAt(0)) + '</span><div><h4>' + esc(g.full_name || '') + '</h4><p class="muted"><span class="num">' + esc(g.phone || g.username || '') + '</span></p></div><span class="st ' + k[1] + '">' + k[0] + '</span></div>' +
      '<ul class="req-kids">' + kids + '</ul>' +
      (r.salla_order_no ? '<div class="req-order"><span>رقم طلب سلة</span><b class="num">' + esc(r.salla_order_no) + '</b><span class="st st-ok">موجود في قائمة سلة</span>'
        : '<div class="req-order"><span>طريقة الدفع</span><b>' + esc(PAY_NAMES[r.payment_method] || '—') + '</b><span class="st st-warn">تأكد من استلام المبلغ</span>') + '<span class="muted req-at">' + stamp(r.created_at) + '</span></div>' + foot + '</article>';
  }
  function findRequest(id) { return coach.requests.filter(function (r) { return r.id === id; })[0]; }
  function playerRequest(p) {
    var rs = (p.request_players || []).map(function (rp) { return rp.registration_requests; }).filter(function (x) { return x && x.status === 'approved'; });
    return rs[0] || {};
  }
  function newPlayerCard(p) {
    var g = p.parent || {}, rq = playerRequest(p), sg = coach.groups.filter(function (x) { return x.id === suggestGroup(p.birth_date); })[0];
    return '<article class="req"><div class="prow-top"><span class="avatar">' + esc(p.full_name.charAt(0)) + '</span><div><h4>' + esc(p.full_name) + '</h4><p class="muted">' + ageText(p.birth_date) + (sg ? ' · المقترح: ' + esc(sg.name) : '') + '</p></div><span class="st st-warn">بدون اشتراك</span></div>' +
      '<ul class="req-kids"><li><b>ولي الأمر</b><span>' + esc(g.full_name || '') + ' · <span class="num">' + esc(g.phone || g.username || '') + '</span></span></li>' +
      '<li><b>الدفع</b><span>' + (rq.salla_order_no ? 'سلة · طلب رقم <span class="num">' + esc(rq.salla_order_no) + '</span>' : esc(PAY_NAMES[rq.payment_method] || '—')) + (rq.reviewed_at ? ' · فُعّل ' + stamp(rq.reviewed_at) : '') + '</span></li>' +
      (p.health_notes ? '<li><b>ملاحظة صحية</b><span>' + esc(p.health_notes) + '</span></li>' : '') + '</ul>' +
      '<div class="prow-actions"><button class="btn btn-gold btn-sm" type="button" data-assign="' + p.id + '"' + (coach.groups.length ? '' : ' disabled') + '>تحديد الاشتراك</button>' +
      (g.phone ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + esc(waLink(g.phone, 'أهلًا ' + (g.full_name || ''))) + '">واتساب</a>' : '') + '</div></article>';
  }

  function activateModal(r) {
    var g = r.parent || {}, names = (r.request_players || []).map(function (rp) { return rp.players && rp.players.full_name; }).filter(Boolean).join(' و');
    var m = modal('<h3>تفعيل حساب ' + esc(g.full_name || '') + '</h3><p class="muted">' + (r.salla_order_no ? 'رقم طلب سلة <b class="num">' + esc(r.salla_order_no) + '</b> موجود في القائمة.' : 'تأكدت من استلام المبلغ (' + esc(PAY_NAMES[r.payment_method] || '') + ')؟') +
      ' بعد التفعيل يدخل ولي الأمر حسابه، ويظهر ' + esc(names) + ' عند المدرب في «المشتركين الجدد» ليحدد المجموعة ومدة الاشتراك.</p>' +
      '<p class="form-error" id="ac-error" role="alert"></p><div class="actions"><button class="btn btn-gold btn-block" type="button" id="ac-save">تفعيل الحساب</button><button class="btn btn-ghost btn-block" type="button" data-close>إلغاء</button></div>');
    m.querySelector('#ac-save').addEventListener('click', function () {
      var btn = this; busy(btn, true, 'جاري التفعيل…');
      sb.rpc('activate_request', { p_request: r.id }).then(function (res) {
        if (res.error) { busy(btn, false); console.error(res.error); m.querySelector('#ac-error').textContent = friendly(res.error); return; }
        closeModal();
        loadCoachRequests().then(function () {
          waModal('تم تفعيل الحساب', 'أرسل لولي الأمر إن حسابه صار جاهز.', g.phone,
            'أهلًا ' + (g.full_name || '') + '،\nتم تفعيل حسابك في أكاديمية عزم.\nادخل البوابة ' + (validPhone(g.username || '') ? 'برقم جوالك ' : 'باسم المستخدم ') + (g.username || '') + ': ' + PORTAL_URL +
            '\nالمدرب يحدد مجموعة ' + names + ' ومواعيد الحصص، وتظهر لك في حسابك.');
        });
      });
    });
  }
  function assignModal(p) {
    var today = iso(new Date()), sel = suggestGroup(p.birth_date);
    var m = modal('<h3>اشتراك ' + esc(p.full_name) + '</h3><p class="muted">' + ageText(p.birth_date) + '</p>' +
      '<div class="form-grid two" style="margin-top:12px"><div class="field"><label for="as-g">المجموعة</label><select id="as-g">' + coach.groups.map(function (g) { return '<option value="' + g.id + '"' + (g.id === sel ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') + '</select><span class="auto" id="as-slots"></span></div>' +
      '<div class="field"><label for="as-p">نوع الاشتراك</label><select id="as-p"><option value="offer">عرض التأسيس</option><option value="monthly">شهري</option></select></div>' +
      '<div class="field"><label for="as-start">بداية الاشتراك</label><input id="as-start" type="date" value="' + today + '"></div>' +
      '<div class="field"><label for="as-end">نهاية الاشتراك</label><input id="as-end" type="date" value="' + addMonth(today) + '"><span class="auto">تتحسب تلقائيًا بعد شهر، وتقدر تعدلها.</span></div></div>' +
      '<p class="form-error" id="as-error" role="alert"></p><div class="actions"><button class="btn btn-gold btn-block" type="button" id="as-save">حفظ الاشتراك</button><button class="btn btn-ghost btn-block" type="button" data-close>إلغاء</button></div>');
    var gs = m.querySelector('#as-g'), s = m.querySelector('#as-start'), e = m.querySelector('#as-end');
    function group() { return coach.groups.filter(function (g) { return g.id === gs.value; })[0] || {}; }
    function showSlots() { m.querySelector('#as-slots').textContent = slotsText(group().group_slots) || 'ما فيه مواعيد مسجلة لهذي المجموعة.'; }
    gs.addEventListener('change', showSlots); showSlots();
    s.addEventListener('change', function () { if (s.value) e.value = addMonth(s.value); });
    m.querySelector('#as-save').addEventListener('click', function () {
      var btn = this, err = m.querySelector('#as-error'), plan = m.querySelector('#as-p').value;
      if (!s.value || !e.value || e.value < s.value) { err.textContent = 'تأكد من تاريخ البداية والنهاية.'; return; }
      busy(btn, true, 'جاري الحفظ…');
      sb.rpc('start_subscription', { p_player: p.id, p_group: gs.value, p_plan: plan, p_start: s.value, p_end: e.value }).then(function (res) {
        if (res.error) { busy(btn, false); console.error(res.error); err.textContent = /not your group/.test(res.error.message) ? 'هذي المجموعة مش مربوطة بحسابك.' : /not waiting/.test(res.error.message) ? 'اللاعب هذا اتحدد اشتراكه قبل. حدّث القائمة.' : friendly(res.error); return; }
        var g = p.parent || {}, gr = group(), sl = slotsText(gr.group_slots);
        closeModal();
        loadNewPlayers().then(function () {
          waModal('تم حفظ الاشتراك', 'أرسل لولي الأمر تفاصيل الاشتراك والمواعيد.', g.phone,
            'أهلًا ' + (g.full_name || '') + '،\nتم تسجيل ' + p.full_name + ' في مجموعة ' + (gr.name || '') + ' بأكاديمية عزم.' +
            '\nالاشتراك (' + PLAN_NAMES[plan] + ') من ' + fmt(s.value) + ' إلى ' + fmt(e.value) + '.' +
            (sl ? '\nمواعيد الحصص: ' + sl + '.' : '') + '\nالمكان: ' + VENUE + ' ' + MAP_URL +
            '\nتفاصيل الاشتراك في حسابك: ' + PORTAL_URL);
        });
      });
    });
  }
  function rejectModal(r) {
    var g = r.parent || {};
    var m = modal('<h3>رفض طلب ' + esc(g.full_name || '') + '</h3><p class="muted">السبب يظهر لولي الأمر أول ما يدخل، ويقدر يعدّل ويرسل من جديد.</p><div class="chips" style="margin:12px 0">' +
      REASONS.map(function (x) { return '<button type="button" data-reason="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      '<div class="field"><label for="rj-reason">سبب الرفض <span class="req">إجباري</span></label><textarea id="rj-reason"></textarea></div>' +
      '<p class="form-error" id="rj-error" role="alert"></p><div class="actions"><button class="btn btn-danger btn-block" type="button" id="rj-save">رفض الطلب</button><button class="btn btn-ghost btn-block" type="button" data-close>إلغاء</button></div>');
    var ta = m.querySelector('#rj-reason');
    m.querySelectorAll('[data-reason]').forEach(function (b) { b.addEventListener('click', function () { ta.value = b.dataset.reason; ta.focus(); }); });
    m.querySelector('#rj-save').addEventListener('click', function () {
      var btn = this, reason = ta.value.trim();
      if (!reason) { m.querySelector('#rj-error').textContent = 'اكتب سبب الرفض.'; ta.focus(); return; }
      busy(btn, true, 'جاري الحفظ…');
      sb.rpc('reject_request', { p_request: r.id, p_reason: reason }).then(function (res) {
        if (res.error) { busy(btn, false); console.error(res.error); m.querySelector('#rj-error').textContent = friendly(res.error); return; }
        closeModal();
        loadCoachRequests().then(function () {
          waModal('تم رفض الطلب', 'أرسل لولي الأمر السبب بالواتساب.', g.phone,
            'أهلًا ' + (g.full_name || '') + '،\nما قدرنا نقبل طلب التسجيل في أكاديمية عزم للسبب التالي:\n' + reason + '\nتقدر تعدّل بياناتك وترسل الطلب من جديد: ' + PORTAL_URL);
        });
      });
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-activate], [data-assign], [data-reject], [data-refresh], [data-support-home], [data-staff-view]');
    if (!t) return;
    if (t.hasAttribute('data-support-home')) {
      if (profile && profile.role === 'support' && window.AZM_SUPPORT) openSupport();
    }
    else if (t.dataset.staffView) { e.preventDefault(); if (t.dataset.staffView === 'new') loadNewPlayers(); else loadCoachRequests(); }
    else if (t.dataset.activate) activateModal(findRequest(t.dataset.activate));
    else if (t.dataset.assign) assignModal(coach.newPlayers.filter(function (p) { return p.id === t.dataset.assign; })[0]);
    else if (t.dataset.reject) rejectModal(findRequest(t.dataset.reject));
    else refreshStaff();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ---------- عام ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-logout], [data-retry]');
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute('data-retry')) { routeSignedIn(); return; }
    sb.auth.signOut().then(function () { session = null; profile = null; location.hash = 'login'; render(); });
  });
  window.addEventListener('hashchange', render);

  sb.auth.getSession().then(function (r) { session = r.data.session; render(); });
  sb.auth.onAuthStateChange(function (event, s) { if (event === 'SIGNED_OUT') { session = null; profile = null; } else if (s) session = s; });
})();
