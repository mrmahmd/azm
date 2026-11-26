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
  function requestFields() {
    var kids = ''; for (var i = 0; i < kidCount; i++) kids += kidFields(i);
    return '<div id="kids">' + kids + '</div><button type="button" class="btn btn-ghost btn-block" id="add-kid">+ أضف ابن آخر</button>' +
      '<p class="form-section">طلب الاشتراك في سلة</p>' +
      '<a class="btn btn-ghost btn-block" href="' + C.sallaUrl + '" target="_blank" rel="noopener">ما دفعت بعد؟ ادفع في سلة</a>' +
      '<div class="field"><label for="s-order">رقم طلب سلة <span class="req">إجباري</span></label><input id="s-order" dir="ltr" inputmode="numeric" placeholder="مثال: 48777"><span class="hint">تلقاه في رسالة تأكيد الطلب من سلة.</span></div>' +
      '<div class="field"><label for="s-receipt">صورة الإيصال (اختياري)</label><input id="s-receipt" type="file" accept="image/jpeg,image/png,image/webp,image/heic"></div>';
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

  /* ---------- إرسال طلب التسجيل ---------- */
  function submitRequest(kind, kids, order, file) {
    var uid = session.user.id, receiptPath = null;
    var upload = Promise.resolve();
    if (file) {
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      receiptPath = uid + '/' + Date.now() + '.' + ext;
      upload = sb.storage.from('receipts').upload(receiptPath, file, { upsert: false }).then(function (r) { if (r.error) throw r.error; });
    }
    var playerIds;
    return upload.then(function () {
      return sb.from('players').insert(kids.map(function (k) { return { parent_id: uid, full_name: k.full_name, birth_date: k.birth_date, health_notes: k.health_notes }; })).select('id');
    }).then(function (r) {
      if (r.error) throw r.error;
      playerIds = r.data.map(function (x) { return x.id; });
      return sb.from('registration_requests').insert({ parent_id: uid, kind: kind, salla_order_no: order, receipt_path: receiptPath }).select('id').single();
    }).then(function (r) {
      if (r.error) throw r.error;
      return sb.from('request_players').insert(playerIds.map(function (pid) { return { request_id: r.data.id, player_id: pid }; }));
    }).then(function (r) { if (r.error) throw r.error; });
  }

  /* ---------- الشاشات ---------- */
  function viewLogin() {
    var staff = MODE === 'staff';
    return card(head(null, '', staff ? 'بوابة طاقم عزم' : 'بوابة أولياء الأمور', staff ? 'للمدرب والمشرفين والدعم الفني' : 'تابع اشتراك ابنك وحضوره وتقاريره') +
      '<form id="login-form" class="form-grid" novalidate><div class="field"><label for="u">اسم المستخدم</label><input id="u" dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false"></div>' +
      '<div class="field"><label for="p">كلمة المرور</label><input id="p" type="password" dir="ltr" autocomplete="current-password"></div>' +
      '<p class="form-error" id="l-error" role="alert"></p><button class="btn btn-gold btn-block">دخول</button></form>' +
      '<div class="auth-links">' + (staff
        ? '<a class="btn btn-ghost btn-block" href="#activate">أول مرة؟ فعّل حسابك برمز التفعيل</a>'
        : '<a class="btn btn-ghost btn-block" href="#signup">ولي أمر جديد؟ أنشئ حسابك</a>') + '</div>' +
      '<p class="auth-help">نسيت كلمة المرور؟ ' + (staff ? 'تواصل مع الدعم الفني ويعيد تعيينها لك.' : '<a href="' + WA + '" target="_blank" rel="noopener">تواصل معنا</a> ونعيد تعيينها لك.') + '</p>' +
      (staff ? '' : '<a class="back-home" href="../">← الموقع الرئيسي</a>'));
  }
  function viewSignup() {
    return card(head(null, '', 'إنشاء حساب ولي أمر', 'بعد الإرسال يراجع المدرب طلبك ويفعّل حسابك.') +
      '<form id="signup-form" class="form-grid" novalidate>' +
      '<p class="form-section">1. بياناتك</p>' +
      '<div class="field"><label for="s-name">الاسم كاملًا</label><input id="s-name" autocomplete="name"></div>' +
      '<div class="field"><label for="s-phone">رقم الجوال</label><input id="s-phone" dir="ltr" inputmode="tel" autocomplete="tel" placeholder="05XXXXXXXX"></div>' +
      '<p class="form-section">2. بيانات الدخول</p>' + userField('s-user') + passFields('sp') +
      '<p class="form-section">3. بيانات الأبناء</p>' + requestFields() +
      '<p class="form-error" id="s-error" role="alert"></p>' +
      '<button class="btn btn-gold btn-block" id="s-submit">إرسال طلب التسجيل</button></form>' +
      '<p class="auth-help">عندك حساب؟ <a href="#login">سجّل دخولك</a></p>');
  }
  function viewRequestForm(reason) {
    return card(head(null, '', reason ? 'أعد إرسال طلبك' : 'كمّل طلب التسجيل', reason ? 'عدّل البيانات حسب سبب الرفض وأرسل الطلب من جديد.' : 'حسابك جاهز، باقي بيانات الأبناء وطلب سلة.') +
      (reason ? '<div class="reject-box"><span>سبب الرفض من المدرب</span><p>' + esc(reason) + '</p></div>' : '') +
      '<form id="request-form" class="form-grid" novalidate style="margin-top:14px"><p class="form-section">بيانات الأبناء</p>' + requestFields() +
      '<p class="form-error" id="r-error" role="alert"></p><button class="btn btn-gold btn-block" id="r-submit">إرسال الطلب</button></form>' + logoutLink());
  }
  function viewPending(req) {
    var kids = (req.request_players || []).map(function (rp) { return rp.players && rp.players.full_name.split(' ')[0]; }).filter(Boolean).join('، ');
    return card(head('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', 'var(--yellow)', 'طلبك قيد المراجعة', 'وصل طلبك للمدرب، ويتفعّل حسابك أول ما يتأكد من البيانات وطلب سلة.') +
      '<ol class="steps"><li class="done">أرسلت الطلب</li><li class="now">مراجعة المدرب</li><li>تفعيل الحساب</li></ol>' +
      '<div class="cred"><div><span>اسم المستخدم</span><b class="num">' + esc(profile.username) + '</b></div>' + (kids ? '<div><span>الأبناء</span><b class="plain">' + esc(kids) + '</b></div>' : '') + '<div><span>رقم طلب سلة</span><b class="num">' + esc(req.salla_order_no) + '</b></div></div>' +
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
      var subs = (p.subscriptions || []).slice().sort(function (a, b) { return a.end_date < b.end_date ? 1 : -1; }), s = subs[0];
      var st = !s ? '<span class="st st-off">بدون اشتراك</span>' : daysLeft(s.end_date) < 0 ? '<span class="st st-bad">منتهي</span>' : daysLeft(s.end_date) <= 7 ? '<span class="st st-warn">باقي ' + daysLeft(s.end_date) + ' يوم</span>' : '<span class="st st-ok">باقي ' + daysLeft(s.end_date) + ' يوم</span>';
      return '<article class="prow"><div class="prow-top"><span class="avatar">' + esc(p.full_name.charAt(0)) + '</span><div><h4>' + esc(p.full_name) + '</h4><p class="muted">' + esc((p.groups && p.groups.name) || (p.status === 'pending' ? 'قيد المراجعة' : '')) + (s ? ' · ينتهي ' + fmt(s.end_date) : '') + '</p></div>' + st + '</div></article>';
    }).join('');
    return card(head(null, '', 'أهلًا ' + esc(profile.full_name.split(' ')[0] || ''), 'حسابك مفعّل. لوحتك الكاملة (الحضور والتقارير) تظهر هنا قريبًا.') +
      '<div class="kids-list">' + (list || '<p class="empty">لا يوجد لاعبون بعد.</p>') + '</div>' +
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
        if (profile.status === 'active' && profile.role === 'support' && window.AZM_SUPPORT) return openSupport();
        if (profile.status === 'active' && (profile.role === 'coach' || profile.role === 'support')) return loadCoachRequests();
        show(viewStaffHome()); return;
      }
      if (profile.status === 'disabled') { show(card(head(null, '', 'الحساب معطّل', 'تواصل مع الأكاديمية لإعادة تفعيله.') + '<a class="btn btn-wa btn-block" href="' + WA + '" target="_blank" rel="noopener">تواصل معنا</a>' + logoutLink())); return; }
      if (profile.status === 'active') {
        return sb.from('players').select('id, full_name, status, groups(name), subscriptions(start_date, end_date)').eq('parent_id', profile.id).neq('status', 'archived').order('created_at').then(function (p) {
          if (p.error) throw p.error;
          show(viewParentHome(p.data));
        });
      }
      // قيد المراجعة أو مرفوض: نشوف آخر طلب
      return sb.from('registration_requests').select('id, status, salla_order_no, reject_reason, created_at, request_players(players(full_name))').eq('parent_id', profile.id).order('created_at', { ascending: false }).limit(1).then(function (q) {
        if (q.error) throw q.error;
        var req = q.data[0];
        if (req && req.status === 'pending') { show(viewPending(req)); return; }
        kidCount = 1;
        show(viewRequestForm(req && req.status === 'rejected' ? req.reject_reason : null));
        bindRequestForm();
      });
    }).catch(function (e) { console.error(e); show(card(head(null, '', 'تعذّر تحميل حسابك', friendly(e)) + '<button class="btn btn-gold btn-block" data-retry>حاول مرة ثانية</button>' + logoutLink())); });
  }

  function render() {
    var h = location.hash.replace('#', '');
    if (session) {
      if (h === 'firstuse' && activation) { show(viewFirstUse()); bindFirstUse(); return; }
      routeSignedIn(); return;
    }
    if (h === 'signup' && MODE === 'parent') { kidCount = 1; show(viewSignup()); bindSignup(); }
    else if (h === 'activate' && MODE === 'staff') { show(viewActivate()); bindActivate(); }
    else if (h === 'firstuse' && activation && MODE === 'staff') { show(viewFirstUse()); bindFirstUse(); }
    else { show(viewLogin()); bindLogin(); }
  }

  /* ---------- ربط النماذج ---------- */
  function bindLogin() {
    $('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var u = val('u').toLowerCase(), p = $('p').value, btn = e.target.querySelector('button');
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

  function bindSignup() {
    var passOk = watchPassword('sp'), userOk = watchUsername($('s-user'));
    bindAddKid();
    $('signup-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setError('s-error');
      var name = val('s-name'), phone = val('s-phone').replace(/\s/g, ''), user = val('s-user'), pass = $('sp1').value, order = val('s-order'), file = $('s-receipt').files[0];
      if (name.length < 3) { $('s-name').focus(); return setError('s-error', 'اكتب اسمك كاملًا.'); }
      if (!validPhone(phone)) { $('s-phone').focus(); return setError('s-error', 'رقم الجوال لازم يبدأ بـ 05 ويتكون من 10 أرقام.'); }
      if (!userOk()) { $('s-user').focus(); return setError('s-error', 'اختر اسم مستخدم متاح.'); }
      if (!passOk()) { $('sp1').focus(); return setError('s-error', 'كلمة المرور لا تحقق الشروط أو غير متطابقة.'); }
      var k = readKids(); if (k.error) { $(k.focus).focus(); return setError('s-error', k.error); }
      if (!order) { $('s-order').focus(); return setError('s-error', 'رقم طلب سلة إجباري.'); }
      if (file && file.size > 5 * 1024 * 1024) return setError('s-error', 'صورة الإيصال أكبر من 5 ميجا.');

      var btn = $('s-submit'); busy(btn, true, 'جاري الإرسال…');
      sb.auth.signUp({ email: emailOf(user), password: pass, options: { data: { username: user, full_name: name, phone: phone } } }).then(function (r) {
        if (r.error) throw r.error;
        if (!r.data.session) throw new Error('no session');
        session = r.data.session;
        return submitRequest('new_account', k.kids, order, file);
      }).then(function () {
        location.hash = ''; routeSignedIn().then(function () { toast('وصل طلبك للمدرب'); });
      }).catch(function (err) {
        console.error(err); busy(btn, false);
        // لو انعمل الحساب وتعثّر الطلب، يكمّله ولي الأمر من شاشة «كمّل طلب التسجيل»
        if (session) { routeSignedIn().then(function () { toast('انعمل حسابك، لكن الطلب ما وصل. كمّله من هنا.'); }); return; }
        setError('s-error', friendly(err));
      });
    });
  }

  function bindRequestForm() {
    bindAddKid();
    $('request-form').addEventListener('submit', function (e) {
      e.preventDefault();
      setError('r-error');
      var k = readKids(); if (k.error) { $(k.focus).focus(); return setError('r-error', k.error); }
      var order = val('s-order'), file = $('s-receipt').files[0];
      if (!order) { $('s-order').focus(); return setError('r-error', 'رقم طلب سلة إجباري.'); }
      if (file && file.size > 5 * 1024 * 1024) return setError('r-error', 'صورة الإيصال أكبر من 5 ميجا.');
      var btn = $('r-submit'); busy(btn, true, 'جاري الإرسال…');
      submitRequest('new_account', k.kids, order, file).then(function () {
        routeSignedIn().then(function () { toast('وصل طلبك للمدرب'); });
      }).catch(function (err) { console.error(err); busy(btn, false); setError('r-error', friendly(err)); });
    });
  }

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
  var REASONS = ['رقم طلب سلة غير صحيح', 'الطلب غير مدفوع في سلة', 'بيانات اللاعب ناقصة', 'الفئة العمرية غير متاحة حاليًا'];
  var coach = { requests: [], groups: [], history: [] };

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

  function loadCoachRequests() {
    loadingView();
    var sel = 'id, kind, status, salla_order_no, receipt_path, reject_reason, created_at, reviewed_at, parent_id, ' +
      'parent:profiles!registration_requests_parent_id_fkey(full_name, username, phone), ' +
      'request_players(player_id, players(id, full_name, birth_date, health_notes, status, group_id))';
    return Promise.all([
      sb.from('registration_requests').select(sel).eq('status', 'pending').order('created_at'),
      sb.from('registration_requests').select(sel).neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(10),
      sb.from('groups').select('id, name, age_category, color').eq('is_active', true).order('name')
    ]).then(function (r) {
      for (var i = 0; i < r.length; i++) if (r[i].error) throw r[i].error;
      coach.requests = r[0].data; coach.history = r[1].data; coach.groups = r[2].data;
      show(viewCoach());
    });
  }
  function viewCoach() {
    var n = coach.requests.length;
    var nav = '<a href="#" class="on" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg><span>الطلبات' + (n ? ' <em class="count">' + n + '</em>' : '') + '</span></a>' +
      (profile.role === 'support' ? '<button type="button" class="btn btn-ghost btn-sm" data-support-home>لوحة الدعم الفني</button>' : '<span class="nav-soon">باقي الأقسام قريبًا</span>');
    var cards = coach.requests.map(requestCard).join('') || '<p class="empty">ما فيه طلبات جديدة. 👌</p>';
    var hist = coach.history.map(requestCard).join('');
    return '<div class="shell"><aside class="side"><div class="side-head"><img src="' + LOGO + '" alt=""><div><b>أكاديمية عزم</b><span>' + (profile.role === 'support' ? 'الدعم الفني' : 'لوحة المدرب') + '</span></div></div><nav aria-label="لوحة المدرب">' + nav + '</nav></aside>' +
      '<main class="main"><div class="topbar"><div class="who"><img src="' + LOGO + '" alt="أكاديمية عزم"><div><h1>' + esc(profile.full_name) + '<span class="role-badge">' + ROLE_NAMES[profile.role] + '</span></h1><p class="num">' + esc(profile.username) + '</p></div></div>' +
      '<div class="prow-actions"><button class="btn btn-ghost btn-sm" type="button" data-refresh>تحديث</button><button class="btn btn-ghost btn-sm" type="button" data-logout>خروج</button></div></div>' +
      '<h2 class="page-title">طلبات التسجيل</h2><p class="muted" style="margin-bottom:14px">طابق رقم طلب سلة مع لوحة سلة، وبعدها وافق أو ارفض. الرفض يحتاج سبب يوصل لولي الأمر.</p>' +
      '<div class="plist">' + cards + '</div>' +
      (hist ? '<h4 class="report-sub" style="margin-top:22px">آخر الطلبات اللي اتخذت فيها قرار</h4><div class="plist">' + hist + '</div>' : '') +
      '</main></div>';
  }
  function requestCard(r) {
    var g = r.parent || {}, k = KIND[r.kind] || ['طلب', 'st-off'];
    var kids = (r.request_players || []).map(function (rp) {
      var p = rp.players; if (!p) return '';
      var a = ageOf(p.birth_date), sg = coach.groups.filter(function (x) { return x.id === suggestGroup(p.birth_date); })[0];
      return '<li><b>' + esc(p.full_name) + '</b><span>' + (a != null ? 'العمر <span class="num">' + a + '</span> ' + (a >= 3 && a <= 10 ? 'سنوات' : 'سنة') + ' · ' : '') + (r.status === 'pending' && sg ? 'المقترح: ' + esc(sg.name) : '') + (p.health_notes ? ' · ملاحظة صحية: ' + esc(p.health_notes) : '') + '</span></li>';
    }).join('');
    var foot = r.status === 'pending'
      ? '<div class="prow-actions"><button class="btn btn-gold btn-sm" type="button" data-approve="' + r.id + '">موافقة وتفعيل</button><button class="btn btn-danger btn-sm" type="button" data-reject="' + r.id + '">رفض</button>' +
        (r.receipt_path ? '<button class="btn btn-ghost btn-sm" type="button" data-receipt="' + esc(r.receipt_path) + '">صورة الإيصال</button>' : '') +
        (g.phone ? '<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="' + esc(waLink(g.phone, 'أهلًا ' + (g.full_name || ''))) + '">واتساب</a>' : '') + '</div>'
      : '<p class="muted">' + (r.status === 'approved' ? '✓ تمت الموافقة' : '✗ رُفض: ' + esc(r.reject_reason)) + (r.reviewed_at ? ' · ' + stamp(r.reviewed_at) : '') + '</p>';
    return '<article class="req' + (r.status !== 'pending' ? ' done' : '') + '"><div class="prow-top"><span class="avatar">' + esc((g.full_name || '؟').charAt(0)) + '</span><div><h4>' + esc(g.full_name || '') + '</h4><p class="muted"><span class="num">' + esc(g.username || '') + '</span>' + (g.phone ? ' · <span class="num">' + esc(g.phone) + '</span>' : '') + '</p></div><span class="st ' + k[1] + '">' + k[0] + '</span></div>' +
      '<ul class="req-kids">' + kids + '</ul>' +
      '<div class="req-order"><span>رقم طلب سلة</span><b class="num">' + esc(r.salla_order_no) + '</b>' + (r.receipt_path ? '<span class="st st-ok">مع إيصال</span>' : '<span class="st st-off">بدون إيصال</span>') + '<span class="muted req-at">' + stamp(r.created_at) + '</span></div>' + foot + '</article>';
  }
  function findRequest(id) { return coach.requests.filter(function (r) { return r.id === id; })[0]; }

  function approveModal(r) {
    var today = iso(new Date()), kids = (r.request_players || []).map(function (rp) { return rp.players; }).filter(Boolean);
    var groupOpts = function (sel) { return coach.groups.map(function (g) { return '<option value="' + g.id + '"' + (g.id === sel ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join(''); };
    var body = r.kind === 'renewal'
      ? '<p class="muted">تجديد اشتراك ' + esc(kids.map(function (k) { return k.full_name; }).join('، ')) + ' بعد مطابقة طلب سلة <b class="num">' + esc(r.salla_order_no) + '</b>.</p>'
      : '<p class="muted">طابقت طلب سلة <b class="num">' + esc(r.salla_order_no) + '</b>؟ اختر مجموعة كل لاعب ونوع اشتراكه.</p>' + kids.map(function (k, i) {
          return '<div class="kid-box" style="margin-top:12px"><b>' + esc(k.full_name) + '</b><div class="form-grid two" style="margin-top:8px">' +
            '<div class="field"><label for="ap-g-' + i + '">المجموعة</label><select id="ap-g-' + i + '" data-player="' + k.id + '">' + groupOpts(suggestGroup(k.birth_date)) + '</select></div>' +
            '<div class="field"><label for="ap-p-' + i + '">نوع الاشتراك</label><select id="ap-p-' + i + '"><option value="offer">عرض التأسيس</option><option value="monthly">شهري</option></select></div></div></div>';
        }).join('');
    var m = modal('<h3>موافقة على طلب ' + esc((r.parent || {}).full_name || '') + '</h3>' + body +
      '<div class="form-grid two" style="margin-top:12px"><div class="field"><label for="ap-start">بداية الاشتراك</label><input id="ap-start" type="date" value="' + today + '"></div><div class="field"><label for="ap-end">نهاية الاشتراك</label><input id="ap-end" type="date" value="' + addMonth(today) + '"><span class="auto">تتحسب تلقائيًا بعد شهر، وتقدر تعدلها.</span></div></div>' +
      '<p class="form-error" id="ap-error" role="alert"></p><div class="actions"><button class="btn btn-gold btn-block" type="button" id="ap-save">موافقة وتفعيل</button><button class="btn btn-ghost btn-block" type="button" data-close>إلغاء</button></div>');
    var s = m.querySelector('#ap-start'), e = m.querySelector('#ap-end');
    s.addEventListener('change', function () { if (s.value) e.value = addMonth(s.value); });
    m.querySelector('#ap-save').addEventListener('click', function () {
      var btn = this, err = m.querySelector('#ap-error');
      if (!s.value || !e.value || e.value < s.value) { err.textContent = 'تأكد من تاريخ البداية والنهاية.'; return; }
      var assignments = kids.map(function (k, i) { var gs = m.querySelector('#ap-g-' + i), ps = m.querySelector('#ap-p-' + i); return gs ? { player_id: k.id, group_id: gs.value, plan: ps.value } : null; }).filter(Boolean);
      busy(btn, true, 'جاري التفعيل…');
      sb.rpc('approve_request', { p_request: r.id, p_start: s.value, p_end: e.value, p_assignments: assignments }).then(function (res) {
        if (res.error) { busy(btn, false); console.error(res.error); err.textContent = /not your group/.test(res.error.message) ? 'هذي المجموعة مش مربوطة بحسابك.' : friendly(res.error); return; }
        var g = r.parent || {}, names = kids.map(function (k) { return k.full_name; }).join(' و');
        closeModal();
        loadCoachRequests().then(function () {
          waModal('تم التفعيل', 'أرسل لولي الأمر إن حسابه صار جاهز.', g.phone,
            'أهلًا ' + (g.full_name || '') + '،\n' + (r.kind === 'renewal' ? 'تم تجديد اشتراك ' + names + ' حتى ' + fmt(e.value) + '.' : 'تم قبول تسجيل ' + names + ' في أكاديمية عزم، وحسابك صار مفعّل.') +
            '\nادخل البوابة باسم المستخدم ' + (g.username || '') + ': ' + PORTAL_URL);
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
  function receiptModal(path) {
    var m = modal('<h3>صورة الإيصال</h3><div class="receipt-ph" id="rc-box"><div class="spinner"></div></div><div class="actions"><button class="btn btn-ghost btn-block" type="button" data-close>إغلاق</button></div>');
    sb.storage.from('receipts').createSignedUrl(path, 300).then(function (res) {
      var box = m.querySelector('#rc-box'); if (!box) return;
      if (res.error) { box.textContent = 'تعذّر فتح الصورة.'; return; }
      box.style.height = 'auto'; box.innerHTML = '<img src="' + esc(res.data.signedUrl) + '" alt="صورة إيصال سلة" style="max-width:100%;border-radius:10px">';
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-approve], [data-reject], [data-receipt], [data-refresh], [data-support-home]');
    if (!t) return;
    if (t.hasAttribute('data-support-home')) {
      if (profile && profile.role === 'support' && window.AZM_SUPPORT) openSupport();
    }
    else if (t.dataset.approve) approveModal(findRequest(t.dataset.approve));
    else if (t.dataset.reject) rejectModal(findRequest(t.dataset.reject));
    else if (t.dataset.receipt) receiptModal(t.dataset.receipt);
    else loadCoachRequests();
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
