(function () {
  'use strict';

  const D = window.AZM_SUPERVISOR_DATA;
  const tabs = {
    overview: 'نظرة عامة', players: 'المشتركون', subscriptions: 'الاشتراكات',
    finance: 'المالية', reports: 'التقارير'
  };
  const statuses = {
    active: ['نشط', 'ok'], soon: ['ينتهي خلال 7 أيام', 'warn'], upcoming: ['لم يبدأ', 'info'],
    expired: ['منتهي', 'bad'], none: ['بدون اشتراك', 'off'], archived: ['مؤرشف', 'off'],
    pending: ['قيد المراجعة', 'warn'], rejected: ['مرفوض', 'bad'], disabled: ['موقوف', 'off'],
    published: ['منشور', 'ok'], draft: ['مسودة', 'warn'], missing: ['لم يُكتب', 'off']
  };
  const reportTypes = {
    summary: 'ملخص الفترة', members: 'تقرير المشتركين', attendance: 'تقرير الحضور',
    renewal: 'تقرير التجديد والانقطاع', finance: 'التقرير المالي'
  };
  const entities = {
    players: 'المشتركون', groups: 'المجموعات', subscriptions: 'الاشتراكات',
    sessions: 'الحصص', attendance: 'الحضور', monthly_reports: 'التقارير الشهرية'
  };
  const actions = { insert: 'إضافة', update: 'تحديث', delete: 'حذف' };
  const scoreLabels = { ball: 'التحكم بالكرة', pass: 'التمرير', shot: 'التسديد', fitness: 'اللياقة', discipline: 'الانضباط' };
  const colors = ['var(--gold)', 'var(--green)', 'var(--blue)', 'var(--yellow)', 'var(--red)'];
  const pageSize = 20;
  const numberFormat = new Intl.NumberFormat('ar-SA-u-nu-latn');
  const currency = new Intl.NumberFormat('ar-SA-u-nu-latn', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 });
  const dateDisplay = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeZone: 'Asia/Riyadh' });
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const num = value => value == null ? '—' : numberFormat.format(value);
  const money = value => value == null ? '—' : currency.format(value);
  const pct = value => value == null ? '—' : num(value) + '%';
  const fmt = value => value ? dateDisplay.format(new Date(value.length === 10 ? value + 'T00:00Z' : value)) : '—';
  const plan = value => ({ offer: 'عرض التأسيس', monthly: 'شهري' })[value] || '—';
  const person = value => value?.full_name || '—';

  function badge(key) {
    const [title, color] = statuses[key] || ['—', 'off'];
    return '<span class="st st-' + color + '">' + title + '</span>';
  }
  function empty(text = 'لا توجد سجلات في هذا القسم.') { return '<p class="super-empty">' + text + '</p>'; }
  function card(title, body) { return '<section class="card"><h3>' + title + '</h3>' + body + '</section>'; }
  function kpis(stats) {
    return '<div class="kpis super-kpis">' + stats.map(([label, value, color]) =>
      '<div class="kpi" style="--c:' + color + '"><strong>' + escape(value) + '</strong><span>' + label + '</span></div>'
    ).join('') + '</div>';
  }
  function chart(items, isPercent = false, currencyMode = false) {
    if (!items.length || items.every(item => item[1] == null)) return empty('لا توجد بيانات كافية.');
    const ceiling = isPercent ? 100 : Math.max(1, ...items.map(item => item[1] || 0));
    return '<ul class="super-chart">' + items.map(([label, value, color], index) => {
      const size = Math.max(0, Math.min(100, (value || 0) / ceiling * 100));
      const formatted = isPercent ? pct(value) : currencyMode ? money(value) : num(value);
      return '<li style="--c:' + (color || colors[index % colors.length]) + '"><span>' + escape(label) +
        '</span><span class="bar" aria-hidden="true"><i style="width:' + size + '%"></i></span><span>' + escape(formatted) + '</span></li>';
    }).join('') + '</ul>';
  }
  function table(head, rows) {
    if (!rows.length) return empty();
    return '<div class="table-wrap super-table"><table class="t"><thead><tr>' +
      head.map(text => '<th scope="col">' + escape(text) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  function normalize(value) {
    return String(value || '').toLocaleLowerCase('ar').replace(/[\u064b-\u065f\u0670\u0640]/g, '').replace(/[إأآٱ]/g, 'ا');
  }
  function labelSelect(title, name, options, value) {
    return '<label>' + title + '<select name="' + name + '">' + options.map(([key, label]) =>
      '<option value="' + escape(key) + '"' + (key === value ? ' selected' : '') + '>' + escape(label) + '</option>'
    ).join('') + '</select></label>';
  }
  function rowButton(kind, id, label) {
    return '<button class="btn btn-ghost btn-sm" type="button" data-super-' + kind + '="' + escape(id) + '">' + label + '</button>';
  }

  async function open({ sb, profile, root }) {
    if (profile.role !== 'super_admin' || profile.status !== 'active') return;
    const read = D.readers(sb);
    const { data, error } = await sb.from('staff_permissions').select('section').eq('user_id', profile.id);
    if (error) throw error;
    const granted = Object.keys(tabs).filter(key => data.some(entry => entry.section === key));
    const can = section => granted.includes(section);
    const now = D.today();
    const currentMonth = now.slice(0, 7);
    const periodSelection = { month: currentMonth, mode: 'month' };
    const state = {
      tab: granted[0], sequence: 0, detail: 0, dataset: null, output: null,
      page: {}, group: '', search: '', filter: '', reportKind: 'summary'
    };

    root.innerHTML = '<div class="shell supervisor-shell"><aside class="side"><div class="side-head">' +
      '<img src="../assets/azm-logo.webp" alt=""><div><b>أكاديمية عزم</b><span>لوحة المشرف العام</span></div></div>' +
      '<nav aria-label="أقسام المشرف العام">' + granted.map(key => '<a href="#super-' + key + '" data-super-tab="' +
        key + '">' + tabs[key] + '</a>').join('') + '</nav></aside><main class="main"><div class="topbar">' +
      '<div class="who"><img src="../assets/azm-logo.webp" alt=""><div><h1>' + escape(profile.full_name) + '</h1>' +
      '<p class="muted">المشرف العام</p></div></div><div class="super-tools"><span class="super-mode">اطلاع فقط</span>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-super-refresh>تحديث</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-logout>خروج</button></div></div>' +
      '<div class="super-content"></div></main><dialog class="super-dialog" aria-labelledby="super-detail-title"></dialog></div>';

    const shell = root.querySelector('.supervisor-shell');
    const content = shell.querySelector('.super-content');
    const dialog = shell.querySelector('.super-dialog');
    if (!granted.length) {
      content.innerHTML = card('صلاحيات المشرف', empty('لا توجد أقسام مخصّصة لهذا الحساب. تواصل مع الدعم الفني.'));
      return;
    }

    function groupName(data, groupId) { return data.groupIndex.get(groupId)?.name || 'بدون مجموعة'; }
    function title(extra = '') {
      return '<div class="super-title"><h2 class="page-title">' + tabs[state.tab] + '</h2>' +
        (extra ? '<span class="muted">' + escape(extra) + '</span>' : '') + '</div>';
    }
    function pagination(key, rows, render) {
      const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
      const page = Math.min(state.page[key] || 0, lastPage);
      state.page[key] = page;
      const results = render(rows.slice(page * pageSize, (page + 1) * pageSize));
      if (rows.length <= pageSize) return results;
      return results + '<div class="super-pager"><button type="button" class="btn btn-ghost btn-sm" data-super-page="' +
        key + '" data-step="-1" ' + (page ? '' : 'disabled') + '>السابق</button><span>صفحة ' + (page + 1) +
        ' من ' + (lastPage + 1) + ' · ' + num(rows.length) + ' سجل</span><button type="button" class="btn btn-ghost btn-sm" data-super-page="' +
        key + '" data-step="1" ' + (page < lastPage ? '' : 'disabled') + '>التالي</button></div>';
    }
    async function base() {
      const [players, groups, subscriptionRows] = await Promise.all([read.roster(), read.groups(), read.subscriptions()]);
      return {
        players, groups, subscriptionRows, playerIndex: D.index(players), groupIndex: D.index(groups),
        subscriptionIndex: D.index(subscriptionRows), stats: D.subscriptionStats(subscriptionRows, players, now)
      };
    }
    async function fetchData(tab) {
      const period = tab === 'overview' ? D.periodFor(currentMonth, 'month', now) : D.periodFor(periodSelection.month, periodSelection.mode, now);
      const jobs = { first: base() };
      if (tab === 'players') jobs.parents = read.parents();
      if (tab === 'subscriptions' || tab === 'overview') jobs.settings = read.settings(['offer_seats']);
      if (tab === 'reports' || tab === 'overview') jobs.attendance = read.attendance(period);
      if (tab === 'reports') jobs.reports = read.reports(period);
      if (tab === 'overview') jobs.activity = read.activity().catch(() => null);
      if (can('finance') && (tab === 'overview' || tab === 'finance' || (tab === 'reports' && state.reportKind === 'finance'))) {
        jobs.finance = read.financeInputs(period.through);
      }
      const { first: shared, parents, ...result } = Object.fromEntries(await Promise.all(
        Object.entries(jobs).map(async ([key, job]) => [key, await job])));
      const actors = result.finance && tab !== 'overview'
        ? await read.paymentActors([...new Set(result.finance.payments.map(row => row.recorded_by).filter(Boolean))]) : [];
      return { ...shared, ...result, period, actors: D.index(actors), parents: D.index(parents || []) };
    }
    async function load(tab = state.tab) {
      if (!can(tab)) return;
      const version = ++state.sequence;
      state.tab = tab;
      state.output = null;
      state.dataset = null;
      for (const link of shell.querySelectorAll('[data-super-tab]')) {
        const selected = link.dataset.superTab === tab;
        link.classList.toggle('on', selected);
        if (selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      content.innerHTML = title() + '<p class="super-note" role="status">جاري تحديث البيانات…</p>';
      try {
        const dataset = await fetchData(tab);
        if (version !== state.sequence || !shell.isConnected) return;
        state.dataset = dataset;
        render();
      } catch {
        if (version === state.sequence) {
          content.innerHTML = title() + empty('تعذّر تحميل القسم. اضغط تحديث للمحاولة مرة أخرى.');
        }
      }
    }

    function overview(data) {
      const { stats, period, attendance, settings, activity } = data;
      const totalAttendance = D.attendanceStats(attendance);
      const renewals = D.renewalStats(stats.history, period, now);
      const seatLimit = settings.offer_seats;
      const seatCount = seatLimit == null ? null : Math.max(0, seatLimit - stats.offerUsed);
      const fin = data.finance && D.financeStats(data.finance, data.subscriptionRows, period);
      const tiles = [
        ['مشترك نشط', num(stats.statuses.active + stats.statuses.soon), colors[1]],
        ['الحضور خلال الشهر', pct(D.ratio(totalAttendance.present, totalAttendance.total)), colors[2]],
        ['نسبة التجديد', pct(D.ratio(renewals.renewed, renewals.total)), colors[0]],
        ['ينتهي خلال 7 أيام', num(stats.statuses.soon), colors[3]],
        ['مقاعد العرض المتبقية', num(seatCount), colors[0]]
      ];
      if (fin) tiles.splice(1, 0, ['إيراد الشهر المحصّل', money(fin.collected), colors[0]], ['متأخرات الفترة تقديريًا', money(fin.arrears), colors[4]]);
      const trend = D.monthSeries(currentMonth).map(month => [
        D.monthName(month), D.newPlayers(stats.history, D.periodFor(month, 'month', now)).length
      ]);
      const assigned = D.groupBy(stats.items.filter(item => item.player.status === 'active'), item => item.player.group_id);
      const distribution = [...assigned.entries()].map(([id, items]) => [groupName(data, id), items.length]);
      const dayData = D.groupBy(attendance, row => new Date(row.session.date + 'T00:00Z').getUTCDay());
      const days = dayNames.map((name, index) => {
        const value = D.attendanceStats(dayData.get(index) || []);
        return [name, D.ratio(value.present, value.total)];
      });
      const recent = activity ? activity.map(item => '<li><span>' + escape(actions[item.action] || item.action) + ' · ' +
        escape(entities[item.entity] || item.entity) + '</span><time datetime="' + escape(item.at) + '">' + fmt(item.at) + '</time></li>').join('') : '';
      const status = ['active', 'soon', 'upcoming', 'expired', 'none'].map((key, index) => [statuses[key][0], stats.statuses[key], colors[index]]);
      const revenue = fin ? card('المبالغ المحصّلة خلال الأشهر الستة', chart(D.monthSeries(currentMonth).map(month =>
        [D.monthName(month), D.financeStats(data.finance, data.subscriptionRows, D.periodFor(month, 'month', now)).collected]), false, true)) : '';
      return title(period.label) + kpis(tiles) + '<div class="grid grid-2">' +
        card('المشتركون الجدد حسب الشهر', chart(trend)) + card('توزيع اللاعبين النشطين على المجموعات', chart(distribution)) +
        card('حالة الاشتراكات', chart(status)) + card('الحضور حسب يوم الحصة', chart(days, true)) + revenue +
        card('آخر العمليات', recent ? '<ul class="super-activity">' + recent + '</ul>' :
          empty(activity ? 'لا توجد عمليات حديثة.' : 'تعذّر تحميل سجل العمليات.')) + '</div>';
    }

    function players(data) {
      const needle = normalize(state.search);
      const roster = state.filter === 'archived'
        ? data.players.filter(player => player.status === 'archived').map(player => ({ player, state: 'archived' }))
        : data.stats.items;
      const available = roster.filter(item => (!state.group || (item.player.group_id || 'unassigned') === state.group)
        && (!state.filter || item.state === state.filter) && (!needle || [item.player.full_name, item.player.member_no,
          data.parents.get(item.player.parent_id)?.full_name, data.parents.get(item.player.parent_id)?.username]
          .some(value => normalize(value).includes(needle))));
      available.sort((a, b) => a.player.full_name.localeCompare(b.player.full_name, 'ar'));
      const groups = [['', 'كل المجموعات'], ...data.groups.map(row => [row.id, row.name]), ['unassigned', 'بدون مجموعة']];
      const filters = [['', 'الحالات الحالية'], ...['active', 'soon', 'upcoming', 'expired', 'none', 'archived'].map(key => [key, statuses[key][0]])];
      const form = '<form class="super-tools" data-super-player-filter><label>بحث<input type="search" name="search" maxlength="80" value="' +
        escape(state.search) + '" placeholder="اسم اللاعب أو ولي الأمر"></label>' + labelSelect('المجموعة', 'group', groups, state.group) +
        labelSelect('الاشتراك', 'filter', filters, state.filter) + '<button class="btn btn-gold btn-sm">بحث</button></form>';
      return title(num(available.length) + ' مشترك') + form + pagination('players', available, rows => table(
        ['اللاعب', 'ولي الأمر', 'المجموعة', 'الاشتراك', 'الملف'],
        rows.map(({ player, state: subscriptionState }) => [
          escape(player.full_name), escape(person(data.parents.get(player.parent_id))), escape(groupName(data, player.group_id)),
          badge(subscriptionState), rowButton('player', player.id, 'عرض الملف')
        ])));
    }

    function subscriptions(data) {
      const { items, statuses: count, history, offerUsed } = data.stats;
      const renewal = D.renewalStats(history, D.periodFor(currentMonth, 'month', now), now);
      const seatLimit = data.settings.offer_seats;
      const seats = seatLimit == null ? null : Math.max(0, seatLimit - offerUsed);
      const rollup = kpis([
        ['نشط', num(count.active + count.soon), colors[1]], ['ينتهي خلال 7 أيام', num(count.soon), colors[3]],
        ['منتهي بدون اشتراك قادم', num(count.expired), colors[4]], ['نسبة التجديد للشهر', pct(D.ratio(renewal.renewed, renewal.total)), colors[2]],
        ['مقاعد العرض المتبقية', num(seats), colors[0]]
      ]);
      const list = items.filter(item => item.row).sort((a, b) => a.row.end_date.localeCompare(b.row.end_date));
      const timeline = pagination('subscriptions', list, rows => table(['تاريخ الانتهاء', 'اللاعب', 'الباقة', 'الحالة', 'اشتراك قادم'],
        rows.map(item => [fmt(item.row.end_date), escape(item.player.full_name), plan(item.row.plan),
          badge(item.state), item.upcoming && item.upcoming.id !== item.row.id ? fmt(item.upcoming.start_date) : '—'])));
      const usage = seatLimit == null ? empty('حد مقاعد العرض غير متوفر.') :
        chart([['المقاعد المستخدمة', D.ratio(offerUsed, seatLimit), colors[0]]], true) +
        '<p class="super-note">' + num(offerUsed) + ' لاعبًا استفادوا من العرض · الحد ' + num(seatLimit) + '</p>';
      return title() + rollup + '<div class="grid grid-2">' + card('تقويم الانتهاءات', timeline) + card('عرض التأسيس', usage) + '</div>';
    }

    function periodForm(withReportKind) {
      const kinds = Object.entries(reportTypes).filter(([key]) => key !== 'finance' || can('finance'));
      return '<form class="super-tools" data-super-period>' +
        (withReportKind ? labelSelect('التقرير', 'kind', kinds, state.reportKind) : '') +
        labelSelect('الفترة', 'mode', [['month', 'شهر'], ['quarter', 'ربع سنة'], ['year', 'سنة']], periodSelection.mode) +
        '<label>الشهر<input type="month" name="month" value="' + escape(periodSelection.month) + '" max="' + currentMonth + '" required></label>' +
        '<button class="btn btn-gold btn-sm">عرض</button></form>';
    }
    function ledger(data, finance) {
      const rows = finance.within.slice().sort((a, b) => b.paid_at.localeCompare(a.paid_at)).map(payment => {
        const sub = data.subscriptionIndex.get(payment.subscription_id);
        const actor = data.actors.get(payment.recorded_by);
        return [fmt(payment.paid_at), person(data.playerIndex.get(sub?.player_id)), plan(sub?.plan),
          D.number(payment.amount), payment.salla_order_no || '—', actor?.full_name || actor?.username || '—'];
      });
      return { columns: ['تاريخ الدفع', 'اللاعب', 'الباقة', 'المبلغ (ريال)', 'طلب سلة', 'سجّله'], rows, title: 'سجل المدفوعات', moneyColumn: 3 };
    }
    function exportButtons(pdf = true) {
      return '<div class="super-tools"><button class="btn btn-ghost btn-sm" type="button" data-super-export="xlsx">تنزيل Excel</button>' +
        (pdf ? '<button class="btn btn-ghost btn-sm" type="button" data-super-export="pdf">طباعة أو حفظ PDF</button>' : '') + '</div>';
    }
    function outputTable(output, key) {
      return pagination(key, output.rows, rows => table(output.columns, rows.map(row =>
        row.map((cell, index) => escape(index === output.moneyColumn ? money(cell) : cell ?? '—')))));
    }

    function finance(data) {
      const current = D.financeStats(data.finance, data.subscriptionRows, data.period);
      const items = [
        ['المحصّل خلال الفترة', money(current.collected), colors[1]], ['المتوقع تقديريًا', money(current.expected), colors[0]],
        ['المتأخرات تقديريًا', money(current.arrears), colors[4]],
        ['نسبة تحصيل المستحق', pct(D.ratio(current.collectedForDue, current.expected)), colors[2]],
        ['قيمة خصم العرض تقديريًا', money(current.discount), colors[3]]
      ];
      const outstanding = current.due.filter(item => item.outstanding > 0)
        .sort((a, b) => b.outstanding - a.outstanding);
      const contracts = D.groupBy(current.due, item => item.row.plan);
      state.output = ledger(data, current);
      return title(data.period.label) + periodForm(false) + kpis(items) +
        '<p class="super-note">المتوقع والمتأخرات والخصم تُقدّر بأسعار الباقات الحالية. المحصّل من سجلات الدفع الفعلية.</p>' +
        '<div class="grid grid-2">' + card('المتوقع والمحصّل للاشتراكات المستحقة',
          chart([['المتوقع', current.expected, colors[0]], ['المحصّل من المستحق', current.collectedForDue, colors[1]]], false, true)) +
        card('الاشتراكات المستحقة حسب الباقة', chart([...contracts].map(([key, value]) => [plan(key), value.length]))) + '</div>' +
        '<div class="super-section">' + card('المتأخرات',
          pagination('arrears', outstanding, rows => table(['اللاعب', 'تاريخ بدء الاشتراك', 'المتبقي تقديريًا'],
            rows.map(item => [escape(person(data.playerIndex.get(item.row.player_id))), fmt(item.row.start_date), money(item.outstanding)])))) + '</div>' +
        '<div class="super-section">' + card('سجل المدفوعات', (state.output.rows.length ? exportButtons(false) : '') +
          outputTable(state.output, 'finance')) + '</div>';
    }

    function reportOutput(data) {
      const period = data.period;
      const stats = D.attendanceStats(data.attendance);
      const history = data.stats.history;
      const renewal = D.renewalStats(history, period, now);
      const newRows = D.newPlayers(history, period);
      const activeAtEnd = [...history.values()].filter(list => list.some(row => row.start_date <= period.through && row.end_date >= period.through)).length;
      const selected = reportTypes[state.reportKind];
      if (state.reportKind === 'summary') return { title: selected, columns: ['المؤشر', 'القيمة'], rows: [
        ['المشتركون الجدد', newRows.length], ['اشتراك نشط بنهاية الفترة', activeAtEnd], ['حاضر', stats.present], ['غائب', stats.absent],
        ['بعذر', stats.excused], ['نسبة الحضور', pct(D.ratio(stats.present, stats.total))], ['التجديدات المسجّلة', renewal.renewed],
        ['نسبة التجديد', pct(D.ratio(renewal.renewed, renewal.total))], ['التقارير المنشورة', data.reports.filter(row => row.status === 'published').length]
      ] };
      if (state.reportKind === 'members') {
        const rows = [...history.entries()].flatMap(([playerId, list]) => {
          const relevant = list.filter(row => row.start_date <= period.through && row.end_date >= period.start);
          if (!relevant.length) return [];
          const item = data.playerIndex.get(playerId);
          const isNew = list[0].start_date >= period.start;
          const remains = relevant.some(row => row.end_date >= period.through);
          return [[person(item), groupName(data, item?.group_id), fmt(list[0].start_date),
            isNew ? 'جديد' : remains ? 'مستمر' : 'انتهى خلال الفترة']];
        });
        return { title: selected, columns: ['اللاعب', 'المجموعة الحالية', 'أول اشتراك', 'الحالة خلال الفترة'], rows };
      }
      if (state.reportKind === 'attendance') {
        const groups = D.groupBy(data.attendance, row => row.player_id + ':' + (row.session.group_id || ''));
        const rows = [...groups.values()].map(items => {
          const score = D.attendanceStats(items);
          return [person(data.playerIndex.get(items[0].player_id)), groupName(data, items[0].session.group_id),
            score.present, score.absent, score.excused, pct(D.ratio(score.present, score.total))];
        });
        return { title: selected, columns: ['اللاعب', 'مجموعة الحصة', 'حاضر', 'غائب', 'بعذر', 'الحضور'], rows };
      }
      if (state.reportKind === 'renewal') return { title: selected, columns: ['اللاعب', 'انتهاء الاشتراك', 'النتيجة', 'بداية الاشتراك التالي'],
        rows: renewal.items.map(({ current, next }) => [person(data.playerIndex.get(current.player_id)), fmt(current.end_date),
          next ? 'جدّد' : 'لم يجدّد خلال 30 يومًا', fmt(next?.start_date)]) };
      if (state.reportKind === 'finance' && can('finance')) return { ...ledger(data, D.financeStats(data.finance, data.subscriptionRows, period)), title: selected };
      return { title: selected, columns: [], rows: [] };
    }
    function coachReports(data) {
      const source = new Map(data.reports.map(row => [row.player_id + '|' + row.month.slice(0, 7), row]));
      const periodStart = data.period.start.slice(0, 7);
      const periodEnd = data.period.through.slice(0, 7);
      const months = D.monthSeries(periodEnd, 12).filter(month => month >= periodStart);
      for (const [playerId, list] of data.stats.history) {
        for (const month of months) {
          const period = D.periodFor(month, 'month', now);
          const key = playerId + '|' + month;
          if (!source.has(key) && list.some(row => row.start_date <= period.through && row.end_date >= period.start)) {
            source.set(key, { player_id: playerId, month: period.start, status: 'missing' });
          }
        }
      }
      return [...source.values()].sort((a, b) => b.month.localeCompare(a.month));
    }
    function reports(data) {
      state.output = reportOutput(data);
      const monthly = coachReports(data);
      return title(data.period.label) + periodForm(true) + '<div class="super-reports">' +
        card(state.output.title, (state.output.rows.length ? exportButtons() : '') + outputTable(state.output, 'report')) +
        card('التقارير الشهرية من المدرب',
          pagination('monthly', monthly, rows => table(['اللاعب', 'المجموعة الحالية', 'الشهر', 'الحالة', 'عرض'],
            rows.map(row => {
              const player = data.playerIndex.get(row.player_id);
              return [escape(person(player)), escape(groupName(data, player?.group_id)), escape(D.monthName(row.month.slice(0, 7))),
                badge(row.status), row.id ? rowButton('report', row.id, 'عرض التقرير') : '—'];
            })))) + '</div>';
    }

    const pages = { overview, players, subscriptions, finance, reports };
    function render() {
      if (state.dataset) content.innerHTML = pages[state.tab](state.dataset);
    }
    function shellDialog(title, body) {
      dialog.innerHTML = '<form method="dialog"><button type="submit" class="btn btn-ghost btn-sm super-close">إغلاق</button></form>' +
        '<h2 id="super-detail-title">' + escape(title) + '</h2><div class="super-profile">' + body + '</div>';
      if (!dialog.open) dialog.showModal();
    }
    function detailsGrid(fields) {
      return '<div class="profile-grid">' + fields.map(([label, value]) =>
        '<div><span>' + label + '</span><b>' + escape(value ?? '—') + '</b></div>').join('') + '</div>';
    }
    async function showPlayer(id) {
      if (!can('players') || state.tab !== 'players') return;
      const ticket = ++state.detail;
      const data = state.dataset;
      shellDialog('ملف المشترك', '<p class="super-note" role="status">جاري التحميل…</p>');
      try {
        const loadedPlayer = read.player(id);
        const [player, subs, recorded, records, payments, parent] = await Promise.all([
          loadedPlayer, read.subscriptions(id), read.attendance(null, id), can('reports') ? read.reports(null, id) : [],
          can('finance') ? read.playerPayments(id, now) : [],
          loadedPlayer.then(row => row?.parent_id ? read.parent(row.parent_id) : null)
        ]);
        if (ticket !== state.detail || !dialog.open) return;
        if (!player) { shellDialog('ملف المشترك', empty('الملف غير متاح.')); return; }
        const sub = D.subscriptionStats(subs, [{ ...player, status: 'active' }], now).items[0];
        const counts = D.attendanceStats(recorded.filter(row => row.session.date <= now));
        const fields = [
          ['رقم العضوية', player.member_no], ['المجموعة', groupName(data, player.group_id)], ['تاريخ الميلاد', fmt(player.birth_date)],
          ['ولي الأمر', person(parent)], ['رقم التواصل', parent?.phone], ['حالة حساب ولي الأمر', statuses[parent?.status]?.[0]],
          ['آخر دخول لولي الأمر', fmt(parent?.last_login_at)],
          ['حالة الاشتراك', statuses[player.status === 'archived' ? 'archived' : sub?.state]?.[0]], ['الباقة', plan(sub?.row?.plan)],
          ['بداية الاشتراك', fmt(sub?.row?.start_date)], ['نهاية الاشتراك', fmt(sub?.row?.end_date)],
          ['الحضور المسجّل', pct(D.ratio(counts.present, counts.total)) + ' · ' + num(counts.present) + ' من ' + num(counts.total)],
          ['ملاحظات صحية', player.health_notes || '—']
        ];
        if (can('finance') && sub?.row) {
          const currentPayments = payments.filter(payment => payment.subscription_id === sub.row.id);
          const paid = currentPayments.reduce((sum, payment) => sum + (D.number(payment.amount) || 0), 0);
          fields.push(['مدفوعات الاشتراك المعروض', currentPayments.length ? money(paid) : 'لا يوجد دفع مسجّل'],
            ['طلبات سلة المرتبطة', [...new Set(currentPayments.map(payment => payment.salla_order_no).filter(Boolean))].join('، ') || '—']);
        }
        const monthly = can('reports') ? '<h3>التقارير الشهرية</h3>' + (records.length
          ? '<div class="chips">' + records.slice().reverse().map(row =>
              rowButton('report', row.id, escape(D.monthName(row.month.slice(0, 7))) + ' · ' + statuses[row.status]?.[0])).join('') + '</div>'
          : empty('لا توجد تقارير شهرية.')) : '';
        shellDialog(player.full_name, detailsGrid(fields) + monthly);
      } catch {
        if (ticket === state.detail && dialog.open) shellDialog('ملف المشترك', empty('تعذّر تحميل ملف المشترك.'));
      }
    }
    async function showReport(id) {
      if (!can('reports')) return;
      const ticket = ++state.detail;
      shellDialog('تقرير المدرب', '<p class="super-note" role="status">جاري التحميل…</p>');
      try {
        const row = await read.report(id);
        if (ticket !== state.detail || !dialog.open) return;
        if (!row) { shellDialog('تقرير المدرب', empty('التقرير غير متاح.')); return; }
        const values = Object.entries(scoreLabels).map(([key, label]) => [label, row[key] == null ? '—' : num(row[key]) + ' / 5']);
        values.push(['نقاط القوة', row.strength], ['جوانب التحسين', row.to_improve], ['الهدف القادم', row.next_goal]);
        shellDialog('تقرير المدرب · ' + D.monthName(row.month.slice(0, 7)), badge(row.status) + detailsGrid(values));
      } catch {
        if (ticket === state.detail && dialog.open) shellDialog('تقرير المدرب', empty('تعذّر تحميل التقرير.'));
      }
    }
    dialog.addEventListener('close', () => { state.detail++; dialog.replaceChildren(); });
    shell.addEventListener('click', event => {
      const control = event.target.closest('button, a');
      if (!control) return;
      if (control.dataset.superTab) { event.preventDefault(); load(control.dataset.superTab); }
      if (control.hasAttribute('data-super-refresh')) load();
      if (control.dataset.superPlayer) showPlayer(control.dataset.superPlayer);
      if (control.dataset.superReport) showReport(control.dataset.superReport);
      if (control.dataset.superPage) {
        const key = control.dataset.superPage;
        state.page[key] = Math.max(0, (state.page[key] || 0) + Number(control.dataset.step));
        render();
      }
      if (control.dataset.superExport && state.output?.rows.length) {
        if (state.output.moneyColumn !== undefined && !can('finance')) return;
        const out = state.output;
        if (control.dataset.superExport === 'xlsx') {
          window.AZM_SUPERVISOR_EXPORT.excel(out, 'azm-' + state.dataset.period.start);
        } else {
          const body = table(out.columns, out.rows.map(row => row.map((cell, index) =>
            escape(index === out.moneyColumn ? money(cell) : cell ?? '—'))));
          window.AZM_SUPERVISOR_EXPORT.print(out.title, state.dataset.period.label, body);
        }
      }
    });
    shell.addEventListener('submit', event => {
      const form = event.target;
      if (form.matches('[data-super-player-filter]')) {
        event.preventDefault();
        const values = new FormData(form);
        state.search = String(values.get('search') || '').trim();
        state.group = String(values.get('group') || '');
        state.filter = String(values.get('filter') || '');
        state.page.players = 0;
        render();
      }
      if (form.matches('[data-super-period]')) {
        event.preventDefault();
        const values = new FormData(form);
        periodSelection.month = String(values.get('month') || currentMonth);
        periodSelection.mode = String(values.get('mode') || 'month');
        const kind = values.get('kind');
        if (Object.hasOwn(reportTypes, kind) && (kind !== 'finance' || can('finance'))) state.reportKind = kind;
        state.page = {};
        load();
      }
    });
    await load();
  }

  window.AZM_SUPERVISOR = { open };
})();
