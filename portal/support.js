(function () {
  'use strict';

  const pageSize = 20;
  const labels = {
    parent: 'ولي أمر', coach: 'مدرب', super_admin: 'مشرف عام', support: 'دعم فني',
    active: 'نشط', pending: 'قيد المراجعة', rejected: 'مرفوض', disabled: 'موقوف',
    approved: 'مقبول', archived: 'مؤرشف', offer: 'عرض', monthly: 'شهري',
    present: 'حاضر', absent: 'غائب', excused: 'بعذر', draft: 'مسودة', published: 'منشور',
    new_account: 'حساب جديد', new_child: 'إضافة لاعب', renewal: 'تجديد',
    overview: 'نظرة عامة', players: 'اللاعبون', subscriptions: 'الاشتراكات',
    finance: 'المالية', reports: 'التقارير',
    insert: 'إضافة', update: 'تحديث', delete: 'حذف',
    invite_create: 'إصدار دعوة', invite_replace: 'استبدال دعوة', invite_revoke: 'إلغاء دعوة',
    account_suspend: 'إيقاف حساب', account_restore: 'إعادة فتح حساب',
    account_sessions: 'إنهاء الجلسات', account_unlock: 'رفع القفل',
    account_recovery_requested: 'طلب استعادة كلمة المرور',
    salla: 'سلة', cash: 'كاش', card: 'بطاقة', available: 'متاح', claimed: 'مُستخدم'
  };
  const dateFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh'
  });
  const sections = ['overview', 'players', 'subscriptions', 'finance', 'reports'];
  const areas = {
    profiles: ['الحسابات', 'created_at', 'username', { full_name: 'الاسم', username: 'اسم المستخدم', role: 'الدور', status: 'الحالة', phone: 'الجوال', locked_until: 'مقفل إلى', failed_logins: 'محاولات فاشلة', last_login_at: 'آخر دخول', created_at: 'تاريخ الإنشاء', must_complete_profile: 'الملف غير مكتمل' }],
    activation_codes: ['رموز التفعيل', 'created_at', 'label', { label: 'صاحب الدعوة', role: 'الدور', state: 'الحالة', expires_at: 'تنتهي في', sections: 'الأقسام', used_at: 'تاريخ الاستخدام', used_by: 'الحساب المستخدم', revoked_at: 'تاريخ الإلغاء', created_at: 'تاريخ الإنشاء' }],
    salla_orders: ['أرقام طلبات سلة', 'created_at', 'order_no', { order_no: 'رقم الطلب', status: 'الحالة', claimed_by: 'سجّل به', created_at: 'تاريخ الإضافة', claimed_at: 'تاريخ التسجيل', created_by: 'أضافه' }],
    registration_requests: ['طلبات التسجيل', 'created_at', 'salla_order_no', { salla_order_no: 'طلب سلة', parent_id: 'ولي الأمر', payment_method: 'طريقة الدفع', status: 'الحالة', kind: 'النوع', created_at: 'تاريخ الطلب', reject_reason: 'سبب الرفض', reviewed_at: 'راجعه في', reviewed_by: 'راجعه', receipt_path: 'مسار الإيصال' }],
    request_players: ['لاعبو الطلبات', 'request_id,player_id', null, { request_id: 'معرّف الطلب', player_id: 'اللاعب' }],
    players: ['اللاعبون', 'created_at', 'full_name', { full_name: 'اسم اللاعب', member_no: 'رقم العضوية', group_id: 'المجموعة', status: 'الحالة', birth_date: 'الميلاد', parent_id: 'ولي الأمر', health_notes: 'ملاحظات صحية', archived_reason: 'سبب الأرشفة', archived_at: 'تاريخ الأرشفة', created_at: 'تاريخ الإنشاء', photo_path: 'مسار صورة اللاعب' }],
    groups: ['المجموعات', 'name', 'name', { name: 'المجموعة', age_category: 'الفئة العمرية', coach_id: 'المدرب', is_active: 'نشطة', color: 'اللون', created_at: 'تاريخ الإنشاء' }],
    group_slots: ['مواعيد المجموعات', 'group_id,weekday,start_time', null, { group_id: 'المجموعة', weekday: 'اليوم', start_time: 'من', end_time: 'إلى' }],
    subscriptions: ['الاشتراكات', 'start_date', null, { player_id: 'اللاعب', plan: 'الخطة', start_date: 'بداية', end_date: 'نهاية', created_at: 'تاريخ الإنشاء', created_by: 'أنشأه' }],
    payments: ['المالية', 'paid_at', 'salla_order_no', { salla_order_no: 'طلب سلة', amount: 'المبلغ', subscription_id: 'معرّف الاشتراك', paid_at: 'تاريخ الدفع', recorded_by: 'سجّله', receipt_path: 'مسار الإيصال' }],
    sessions: ['الحصص', 'date', null, { group_id: 'المجموعة', date: 'اليوم', start_time: 'من', end_time: 'إلى', is_cancelled: 'أُلغيت' }],
    attendance: ['الحضور', 'recorded_at', null, { player_id: 'اللاعب', status: 'الحالة', session_id: 'معرّف الحصة', recorded_at: 'وقت التسجيل', recorded_by: 'سجّله' }],
    monthly_reports: ['التقارير الشهرية', 'month', null, { player_id: 'اللاعب', month: 'الشهر', status: 'الحالة', published_at: 'وقت النشر', ball: 'التحكم بالكرة', pass: 'التمرير', shot: 'التسديد', fitness: 'اللياقة', discipline: 'الانضباط', strength: 'نقاط القوة', to_improve: 'جوانب التحسين', next_goal: 'الهدف القادم', notified_at: 'تاريخ الإشعار', coach_id: 'المدرب', updated_at: 'آخر تعديل', created_at: 'تاريخ الإنشاء' }],
    announcements: ['الإعلانات', 'created_at', 'title', { title: 'العنوان', group_id: 'المجموعة', created_at: 'النشر', body: 'المحتوى', created_by: 'أنشأه' }],
    audit_log: ['سجل العمليات', 'id', 'action', { at: 'الوقت', action: 'العملية', entity: 'القسم', actor_id: 'المنفّذ', entity_id: 'معرّف السجل', details: 'التفاصيل' }],
    login_events: ['محاولات الدخول', 'at,id', 'username_tried', { at: 'الوقت', username_tried: 'اسم المستخدم', success: 'نجحت', user_id: 'الحساب' }],
    staff_permissions: ['صلاحيات المشرفين', 'user_id,section', null, { user_id: 'حساب المشرف', section: 'القسم' }],
    settings: ['إعدادات المنصة', 'key', 'key', { key: 'الإعداد', value: 'القيمة', updated_at: 'آخر تعديل', updated_by: 'عدّله' }]
  };
  const navigation = [
    ['الدعم والتشغيل', ['salla_orders', 'registration_requests', 'profiles', 'activation_codes', 'request_players', 'audit_log', 'login_events']],
    ['الأكاديمية', ['players', 'groups', 'group_slots', 'subscriptions', 'payments', 'sessions', 'attendance', 'monthly_reports', 'announcements']],
    ['الإدارة', ['staff_permissions', 'settings']]
  ];
  const compositeKeys = new Set(['request_players', 'attendance', 'staff_permissions', 'settings']);
  const names = {
    parent_id: 'profiles', coach_id: 'profiles', user_id: 'profiles', actor_id: 'profiles',
    used_by: 'profiles', recorded_by: 'profiles', reviewed_by: 'profiles', created_by: 'profiles',
    updated_by: 'profiles', claimed_by: 'profiles', group_id: 'groups', player_id: 'players'
  };
  function digits(value) {
    return String(value || '')
      .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660)
      .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6f0)
      .replace(/\D/g, '');
  }
  const accountActions = {
    suspend: ['إيقاف الحساب', 'يتوقّف دخول صاحب الحساب إلى البوابة، وتُنهى جلساته الحالية.'],
    restore: ['إعادة فتح الحساب', 'يرجع الحساب لحالته قبل الإيقاف.'],
    sessions: ['إنهاء كل الجلسات', 'سيحتاج صاحب الحساب إلى تسجيل الدخول مرة أخرى.'],
    unlock: ['رفع قفل الحساب', 'تُصفّر محاولات الدخول المسجّلة في الملف ويُرفع القفل.'],
    recovery: ['إصدار رابط استعادة', 'تحقّق من هوية صاحب الحساب قبل تسليمه الرابط. الرابط يتيح له تعيين كلمة مرور جديدة.']
  };
  const errors = {
    support_required: 'الإجراء متاح لحساب الدعم الفني النشط فقط.',
    protected_account: 'إدارة هذا الحساب تحتاج مسؤول النظام.',
    invite_unavailable: 'الدعوة لم تعد متاحة لهذا الإجراء. حدّث القائمة.',
    invalid_invite: 'راجع اسم صاحب الدعوة ودوره والأقسام المحددة.',
    account_state_changed: 'حالة الحساب تغيّرت. حدّث القائمة.',
    prior_status_unknown: 'الحساب موقوف من قبل إضافة هذه اللوحة. يلزم مراجعة حالته قبل إعادة فتحه.',
    invalid_action: 'راجع الإجراء والسبب المدخل.',
    missing_identity: 'تعذّر العثور على حساب الدخول المرتبط بالملف.',
    recovery_failed: 'تعذّر إصدار رابط الاستعادة. حاول مرة أخرى.'
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
  function format(value, key) {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'amount') return new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR' }).format(value);
    if (key === 'weekday') return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][value] ?? value;
    if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
    if (Array.isArray(value)) return value.map(item => labels[item] || item).join('، ') || '—';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return dateFormat.format(new Date(value));
    if (key === 'entity') return areas[value]?.[0] || value;
    return labels[value] || value;
  }
  function inviteState(row) {
    if (row.used_at) return ['مستخدمة', 'st-ok'];
    if (row.revoked_at) return ['ملغاة', 'st-bad'];
    return new Date(row.expires_at).getTime() <= Date.now() ? ['منتهية', 'st-off'] : ['صالحة', 'st-ok'];
  }
  function selectedFields(area) {
    const fields = Object.keys(areas[area][3]).filter(field => field !== 'state');
    return (compositeKeys.has(area) ? fields : ['id', ...fields]).join(',');
  }

  function open({ sb, profile, root, toast, requests }) {
    if (profile.role !== 'support' || profile.status !== 'active') return Promise.resolve();
    const current = { area: 'overview', search: '', profileField: 'full_name', page: 0, version: 0, rows: [], names: {}, total: 0, pending: false };
    root.innerHTML = '<div class="support-shell"><header class="support-head"><div class="support-brand">' +
      '<img src="../assets/azm-logo.webp" alt=""><div><p>أكاديمية عزم</p><h1>لوحة الدعم الفني</h1></div></div>' +
      '<div class="support-identity"><span><b>' + escapeHtml(profile.full_name) + '</b><small dir="ltr">' + escapeHtml(profile.username) +
      '</small></span><button type="button" class="btn btn-ghost btn-sm" data-logout>خروج</button></div></header>' +
      '<div class="support-layout"><aside class="support-sidebar"><nav aria-label="أقسام الدعم الفني">' +
      '<button type="button" data-area="overview">نظرة عامة</button>' +
      navigation.map(([label, items]) => '<p>' + label + '</p>' + items.map(area =>
        '<button type="button" data-area="' + area + '">' + areas[area][0] + '</button>').join('')).join('') +
      '</nav></aside><main class="support-main" id="support-content"></main></div>' +
      '<dialog class="support-dialog" aria-labelledby="support-dialog-title"></dialog></div>';

    const shell = root.querySelector('.support-shell');
    const content = shell.querySelector('#support-content');
    const dialog = shell.querySelector('dialog');

    function heading(title, actions) {
      content.innerHTML = '<header class="support-title"><h2>' + title + '</h2><div class="support-actions">' +
        (actions || '') + '<button type="button" class="btn btn-ghost btn-sm" data-support-refresh>تحديث</button>' +
        '</div></header><div class="support-body" aria-live="polite"></div>';
      return content.querySelector('.support-body');
    }

    async function overview(body) {
      const summary = [
        ['registration_requests', 'طلبات قيد المراجعة', 'status', 'pending'],
        ['salla_orders', 'أرقام سلة لم يُسجَّل بها', 'status', 'available'],
        ['profiles', 'الحسابات النشطة', 'status', 'active'],
        ['players', 'اللاعبون النشطون', 'status', 'active'],
        ['subscriptions', 'الاشتراكات الجارية']
      ];
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
      const result = await Promise.all(summary.map(async ([area, title, key, value]) => {
        let query = sb.from(area).select('id', { count: 'exact', head: true });
        query = key ? query.eq(key, value) : query.lte('start_date', today).gte('end_date', today);
        const { count, error } = await query;
        return '<button class="support-stat" type="button" data-area="' + area + '"><span>' + title +
          '</span><b>' + (error ? '—' : count ?? 0) + '</b></button>';
      }));
      body.innerHTML = '<div class="support-stats">' + result.join('') +
        '</div><div class="support-quick"><h3>الإجراءات السريعة</h3><div class="support-actions">' +
        '<button type="button" class="btn btn-gold btn-sm" data-area="salla_orders">إضافة رقم طلب سلة</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-create-invite>إصدار رمز تفعيل</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-area="profiles">البحث عن حساب</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-support-requests>مراجعة طلبات التسجيل</button>' +
        '</div></div>';
    }

    async function linkedNames(rows) {
      const lookup = {};
      for (const row of rows) {
        for (const [key, relation] of Object.entries(names)) {
          if (row[key]) (lookup[relation] ||= new Set()).add(row[key]);
        }
      }
      const result = await Promise.all(Object.entries(lookup).map(async ([table, ids]) => {
        const name = table === 'groups' ? 'name' : 'full_name';
        const { data } = await sb.from(table).select('id,' + name).in('id', [...ids]);
        return (data || []).map(row => [row.id, row[name]]);
      }));
      return Object.fromEntries(result.flat());
    }

    function cell(row, key) {
      if (key === 'state') {
        const [label, color] = inviteState(row);
        return '<span class="st ' + color + '">' + label + '</span>';
      }
      if (current.area === 'salla_orders' && key === 'status') {
        return row.status === 'available' ? '<span class="st st-ok">متاح للتسجيل</span>' : '<span class="st st-off">مُستخدم</span>';
      }
      const value = current.names[row[key]] || row[key];
      return '<bdi>' + escapeHtml(format(value, key)) + '</bdi>';
    }

    function renderRows(body) {
      const [, , , columns] = areas[current.area];
      const keys = Object.keys(columns).slice(0, 4);
      if (!current.rows.length) {
        body.innerHTML = '<p class="support-empty">ما فيه سجلات مطابقة.</p>';
        return;
      }
      body.innerHTML = '<div class="support-table"><table><thead><tr>' +
        keys.map(key => '<th scope="col">' + columns[key] + '</th>').join('') +
        '<th scope="col">عرض</th></tr></thead><tbody>' + current.rows.map((row, index) =>
          '<tr>' + keys.map(key => '<td>' + cell(row, key) + '</td>').join('') +
          '<td><button type="button" class="btn btn-ghost btn-sm" data-detail="' + index + '">التفاصيل</button></td></tr>'
        ).join('') + '</tbody></table></div>' +
        '<div class="support-pages"><button type="button" class="btn btn-ghost btn-sm" data-step="-1" ' + (current.page ? '' : 'disabled') +
        '>السابق</button><span>صفحة ' + (current.page + 1) + ' من ' + Math.max(1, Math.ceil(current.total / pageSize)) +
        ' · ' + current.total + ' سجل</span><button type="button" class="btn btn-ghost btn-sm" data-step="1" ' +
        ((current.page + 1) * pageSize < current.total ? '' : 'disabled') + '>التالي</button></div>';
    }

    async function load(area = current.area) {
      const version = ++current.version;
      current.rows = [];
      current.names = {};
      if (area !== current.area) {
        current.search = '';
        current.profileField = 'full_name';
        current.page = 0;
      }
      current.area = area;
      for (const button of shell.querySelectorAll('.support-sidebar [data-area]')) {
        if (button.dataset.area === area) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
      let body;
      if (area === 'overview') {
        body = heading('نظرة عامة');
        try { await overview(body); }
        catch { body.textContent = 'تعذّر تحميل نظرة عامة.'; }
        return;
      }
      const [title, order, searchKey] = areas[area];
      let action = '';
      if (area === 'activation_codes') action = '<button type="button" class="btn btn-gold btn-sm" data-create-invite>إصدار رمز تفعيل</button>';
      if (area === 'registration_requests') action = '<button type="button" class="btn btn-gold btn-sm" data-support-requests>مراجعة الطلبات</button>';
      body = heading(title, action);
      if (area === 'salla_orders') {
        body.insertAdjacentHTML('beforebegin', '<form class="support-form salla-add" id="salla-add" data-command="salla_add">' +
          '<label for="salla-number">أضف رقم طلب من لوحة سلة</label><p class="support-note">اكتب رقم الطلب بعد ما تتأكد إنه مدفوع. ولي الأمر يكتب نفس الرقم وقت التسجيل، والرقم يُستخدم مرة وحدة.</p>' +
          '<div><input id="salla-number" name="order" inputmode="numeric" dir="ltr" maxlength="24" autocomplete="off" required>' +
          '<button class="btn btn-gold btn-sm">حفظ الرقم</button></div><p role="alert" class="form-error"></p></form>');
      }
      if (searchKey) {
        const fields = area === 'profiles'
          ? '<select name="field" aria-label="البحث حسب"><option value="full_name">الاسم</option><option value="username" ' +
            (current.profileField === 'username' ? 'selected' : '') + '>اسم المستخدم</option></select>'
          : '';
        body.insertAdjacentHTML('beforebegin', '<form class="support-search" id="support-search"><label for="support-query">' +
          (fields ? 'البحث عن حساب' : 'البحث بـ' + areas[area][3][searchKey]) + '</label><div>' + fields + '<input id="support-query" name="query" maxlength="80" value="' +
          escapeHtml(current.search) + '"><button class="btn btn-ghost btn-sm">بحث</button></div></form>');
      }
      body.textContent = 'جاري التحميل…';
      try {
        let query = sb.from(area).select(selectedFields(area), { count: 'exact' });
        const sort = order.split(',');
        if (!compositeKeys.has(area) && !sort.includes('id')) sort.push('id');
        for (const field of sort) query = query.order(field, { ascending: ['name', 'key'].includes(field) });
        if (current.search && searchKey) {
          const field = area === 'profiles' ? current.profileField : searchKey;
          query = query.ilike(field, '%' + current.search.replace(/[\\%_]/g, '\\$&') + '%');
        }
        const start = current.page * pageSize;
        const { data, error, count } = await query.range(start, start + pageSize - 1);
        if (version !== current.version) return;
        if (error?.code === 'PGRST103' && current.page) { current.page = 0; return load(); }
        if (error) throw error;
        const total = count ?? data.length;
        if (current.page && start >= total) {
          current.page = Math.max(0, Math.ceil(total / pageSize) - 1);
          return load();
        }
        const resolved = await linkedNames(data);
        if (version !== current.version) return;
        current.rows = data;
        current.names = resolved;
        current.total = total;
        renderRows(body);
      } catch {
        if (version === current.version) body.textContent = 'تعذّر تحميل هذا القسم. جرّب التحديث.';
      }
    }

    function showDialog(title, inner) {
      dialog.innerHTML = '<header><h2 id="support-dialog-title">' + title + '</h2><button class="btn btn-ghost btn-sm" type="button" data-dialog-close>إغلاق</button></header>' + inner;
      if (!dialog.open) dialog.showModal();
    }
    function details(row) {
      const fields = areas[current.area][3];
      let actions = '';
      if (current.area === 'activation_codes' && !row.used_at && !row.revoked_at && row.role !== 'support') {
        actions = '<button type="button" class="btn btn-ghost btn-sm" data-invite-action="replace">استبدال الدعوة</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-invite-action="revoke">إلغاء الدعوة</button>';
      }
      if (current.area === 'profiles' && row.role !== 'support' && row.id !== profile.id) {
        const items = row.status === 'disabled' ? ['restore'] : ['suspend', 'sessions', 'recovery'];
        if (row.failed_logins || row.locked_until) items.push('unlock');
        actions = items.map(action => '<button class="btn btn-ghost btn-sm" type="button" data-account-action="' +
          action + '">' + accountActions[action][0] + '</button>').join('');
      }
      if (current.area === 'salla_orders' && row.status === 'available') {
        actions = '<button class="btn btn-danger btn-sm" type="button" data-salla-delete>حذف الرقم</button>';
      }
      showDialog('تفاصيل السجل', '<dl class="support-details">' + Object.entries(fields).map(([key, name]) =>
        '<div><dt>' + name + '</dt><dd>' + cell(row, key) + '</dd></div>').join('') + '</dl>' +
        (actions ? '<div class="support-actions">' + actions + '</div>' : ''));
    }
    function inviteForm() {
      showDialog('إصدار رمز تفعيل', '<form class="support-form" data-command="create"><label for="invite-label">اسم صاحب الدعوة</label>' +
        '<input id="invite-label" name="label" minlength="3" maxlength="100" required>' +
        '<label for="invite-role">الدور</label><select id="invite-role" name="role"><option value="coach">مدرب</option>' +
        '<option value="super_admin">مشرف عام</option></select><fieldset hidden id="invite-sections"><legend>الأقسام المتاحة للمشرف</legend>' +
        sections.map(section => '<label><input type="checkbox" name="sections" value="' + section + '"> ' + labels[section] + '</label>').join('') +
        '</fieldset><p role="alert" class="form-error"></p><button class="btn btn-gold">إصدار الرمز</button></form>');
    }
    function inviteConfirmation(row, action) {
      const title = action === 'replace' ? 'استبدال الدعوة' : 'إلغاء الدعوة';
      showDialog(title, '<form class="support-form" data-command="' + action + '" data-target="' + row.id + '">' +
        '<p>صاحب الدعوة <b>' + escapeHtml(row.label) + '</b></p><p>' +
        (action === 'replace' ? 'يُلغى الرمز القديم ويصدر رمز جديد بنفس الصلاحيات.' : 'يفقد الرمز الحالي صلاحيته للاستخدام.') +
        '</p><p role="alert" class="form-error"></p><button class="btn btn-gold">' + title + '</button></form>');
    }
    function accountConfirmation(row, action) {
      const [title, description] = accountActions[action];
      showDialog(title, '<form class="support-form" data-command="' + action + '" data-target="' + row.id + '">' +
        '<p><b>' + escapeHtml(row.full_name) + '</b> · <bdi>' + escapeHtml(row.username) + '</bdi></p><p>' + description +
        '</p><label for="support-reason">السبب</label><textarea id="support-reason" name="reason" required minlength="3" maxlength="240"></textarea>' +
        '<p role="alert" class="form-error"></p><button class="btn btn-gold">' + title + '</button></form>');
    }
    function share(title, value, description) {
      showDialog(title, '<div class="support-form"><p>' + description + '</p>' +
        '<label for="support-secret">' + title + '</label><textarea rows="2" id="support-secret" dir="ltr" readonly autocomplete="off">' +
        escapeHtml(value) + '</textarea><button type="button" class="btn btn-gold" data-support-copy>نسخ</button></div>');
    }

    let detailRow;
    let reloadOnClose = false;
    dialog.addEventListener('close', () => {
      const reload = reloadOnClose;
      reloadOnClose = false;
      detailRow = null;
      dialog.replaceChildren();
      if (reload && shell.isConnected) load();
    });
    dialog.addEventListener('cancel', event => { if (current.pending) event.preventDefault(); });
    shell.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-dialog-close')) { if (!current.pending) dialog.close(); return; }
      if (button.dataset.area) load(button.dataset.area);
      if (button.hasAttribute('data-support-refresh')) load();
      if (button.hasAttribute('data-support-requests')) {
        requests().catch(() => { open({ sb, profile, root, toast, requests }); toast('تعذر تحميل الطلبات'); });
      }
      if (button.dataset.step) { current.page += Number(button.dataset.step); load(); }
      if (button.dataset.detail !== undefined) {
        detailRow = current.rows[Number(button.dataset.detail)];
        if (detailRow) details(detailRow);
      }
      if (button.hasAttribute('data-create-invite')) inviteForm();
      if (button.dataset.inviteAction && detailRow) inviteConfirmation(detailRow, button.dataset.inviteAction);
      if (button.dataset.accountAction && detailRow) accountConfirmation(detailRow, button.dataset.accountAction);
      if (button.hasAttribute('data-salla-delete') && detailRow) {
        showDialog('حذف رقم الطلب', '<form class="support-form" data-command="salla_delete" data-target="' + detailRow.id + '">' +
          '<p>يُحذف الرقم <b dir="ltr">' + escapeHtml(detailRow.order_no) + '</b> من القائمة، وما يقدر أحد يسجّل به بعد كذا.</p>' +
          '<p role="alert" class="form-error"></p><button class="btn btn-danger">حذف الرقم</button></form>');
      }
      if (button.hasAttribute('data-support-copy')) {
        const field = dialog.querySelector('#support-secret');
        navigator.clipboard.writeText(field.value).then(() => toast('تم النسخ'), () => { field.focus(); field.select(); });
      }
    });
    shell.addEventListener('change', event => {
      if (event.target.id === 'invite-role') dialog.querySelector('#invite-sections').hidden = event.target.value !== 'super_admin';
    });
    shell.addEventListener('submit', async event => {
      const form = event.target;
      event.preventDefault();
      const input = new FormData(form);
      if (form.id === 'support-search') {
        current.search = String(input.get('query')).trim();
        if (current.area === 'salla_orders') current.search = digits(current.search);
        current.profileField = input.get('field') === 'username' ? 'username' : 'full_name';
        current.page = 0;
        load();
        return;
      }
      if (current.pending) return;
      const action = form.dataset.command;
      const id = form.dataset.target;
      const alert = form.querySelector('[role="alert"]');
      const submit = form.querySelector('button');
      current.pending = submit.disabled = true;
      alert.textContent = '';
      try {
        let response;
        if (action === 'salla_add') {
          const order = digits(input.get('order'));
          if (!/^\d{3,20}$/.test(order)) { alert.textContent = 'رقم الطلب لازم يكون أرقام فقط (من 3 إلى 20 رقم).'; return; }
          response = await sb.from('salla_orders').insert({ order_no: order });
          if (response.error) {
            alert.textContent = response.error.code === '23505' ? 'الرقم ' + order + ' مسجّل قبل كذا.' : 'تعذّر حفظ الرقم. حاول مرة أخرى.';
            return;
          }
          toast('تم حفظ رقم الطلب ' + order);
          current.search = '';
          current.page = 0;
          load();
          return;
        }
        if (action === 'salla_delete') {
          response = await sb.from('salla_orders').delete().eq('id', id).eq('status', 'available').select('id');
          if (response.error) throw response.error;
          if (!response.data.length) { alert.textContent = 'الرقم اتسجّل به ولي أمر، فما ينفع يتحذف. حدّث القائمة.'; return; }
          reloadOnClose = true;
          dialog.close();
          toast('تم حذف الرقم');
          return;
        }
        if (['create', 'replace', 'revoke'].includes(action)) {
          const role = input.get('role');
          response = await sb.rpc('support_invite', {
            p_action: action, p_id: id ?? null, p_label: input.get('label'), p_role: role,
            p_sections: role === 'super_admin' ? input.getAll('sections') : []
          });
        } else if (action === 'recovery') {
          response = await sb.functions.invoke('azm-support-recovery', { body: { userId: id, reason: String(input.get('reason')).trim() } });
          if (response.error?.context instanceof Response) {
            const result = await response.error.context.json().catch(() => ({}));
            if (result.error) throw new Error(result.error);
          }
        } else {
          response = await sb.rpc('support_account', { p_action: action, p_id: id, p_reason: String(input.get('reason')).trim() });
        }
        if (response.error) throw response.error;
        reloadOnClose = true;
        if (response.data?.code) share('رمز التفعيل', response.data.code, 'انسخ الرمز وسلّمه لصاحبه. ينتهي في ' + format(response.data.expires_at) + '.');
        else if (response.data?.url) share('رابط الاستعادة', response.data.url, 'سلّم الرابط لصاحب الحساب عبر وسيلة تواصل موثوقة.');
        else { dialog.close(); toast('تم تنفيذ الإجراء'); }
      } catch (error) {
        alert.textContent = errors[error.message] || 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.';
      } finally {
        current.pending = submit.disabled = false;
      }
    });
    return load();
  }

  window.AZM_SUPPORT = { open };
})();
