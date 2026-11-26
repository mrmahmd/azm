(function () {
  'use strict';

  const dayMs = 86400000;
  const dayFormat = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Riyadh'
  });
  const monthFormat = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const selectSubscription = 'id,player_id,plan,start_date,end_date,created_at';

  function today(date = new Date()) {
    const parts = Object.fromEntries(dayFormat.formatToParts(date).map(part => [part.type, part.value]));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function offsetDay(date, offset) {
    return new Date(Date.parse(date + 'T00:00Z') + offset * dayMs).toISOString().slice(0, 10);
  }
  function monthAt(month, offset) {
    const [year, number] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
  }
  function periodFor(month, mode, now) {
    const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= '2000-01' && month <= now.slice(0, 7);
    const selected = valid ? month : now.slice(0, 7);
    const size = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1;
    const shift = (Number(selected.slice(5)) - 1) % size;
    const first = monthAt(selected, -shift);
    const start = first + '-01';
    const end = offsetDay(monthAt(first, size) + '-01', -1);
    const label = size === 12 ? first.slice(0, 4) : size === 3
      ? 'الربع ' + Math.ceil(Number(first.slice(5)) / 3) + ' · ' + first.slice(0, 4)
      : monthFormat.format(new Date(start + 'T00:00Z'));
    return { start, end, through: end < now ? end : now, label };
  }
  function monthSeries(month, count = 6) {
    return Array.from({ length: count }, (_, index) => monthAt(month, index - count + 1));
  }
  function monthName(month) {
    return monthFormat.format(new Date(month + '-01T00:00Z'));
  }
  function riyadhTimestamp(date) {
    return new Date(date + 'T00:00:00+03:00').toISOString();
  }
  function number(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function readers(sb) {
    const batch = 250;
    async function all(table, fields, keys, filter = query => query) {
      const rows = [];
      for (let offset = 0; ; offset += batch) {
        let query = filter(sb.from(table).select(fields));
        for (const key of keys) query = query.order(key, { ascending: true });
        const { data, error } = await query.range(offset, offset + batch - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < batch) return rows;
      }
    }
    async function one(table, fields, id) {
      const { data, error } = await sb.from(table).select(fields).eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    }
    const roster = () => all('players', 'id,member_no,full_name,group_id,status,created_at,parent_id', ['id']);
    const groups = () => all('groups', 'id,name,is_active', ['id']);
    const parents = () => all('profiles', 'id,full_name,username', ['id'], query => query.eq('role', 'parent'));
    const parent = id => one('profiles', 'id,full_name,phone,status,last_login_at', id);
    const subscriptions = playerId => all('subscriptions', selectSubscription, ['id'],
      query => playerId ? query.eq('player_id', playerId) : query);
    const attendance = (period, playerId) => all('attendance',
      'player_id,session_id,status,session:sessions!inner(date,group_id,is_cancelled)', ['session_id', 'player_id'], query => {
        query = query.eq('session.is_cancelled', false);
        if (period) query = query.gte('session.date', period.start).lte('session.date', period.through);
        return playerId ? query.eq('player_id', playerId) : query;
      });
    const reports = (period, playerId) => all('monthly_reports',
      'id,player_id,month,status,published_at', ['month', 'id'], query => {
        if (period) query = query.gte('month', period.start).lte('month', period.through);
        return playerId ? query.eq('player_id', playerId) : query;
      });
    async function settings(keys) {
      const pairs = await all('settings', 'key,value', ['key'], query => query.in('key', keys));
      return Object.fromEntries(pairs.map(pair => [pair.key, number(pair.value)]));
    }
    async function financeInputs(through) {
      const [payments, prices] = await Promise.all([
        all('payments', 'id,subscription_id,amount,salla_order_no,paid_at,recorded_by', ['id'],
          query => query.lt('paid_at', riyadhTimestamp(offsetDay(through, 1)))),
        settings(['price', 'offer_price'])
      ]);
      return { payments, prices };
    }
    async function activity() {
      const { data, error } = await sb.rpc('supervisor_activity');
      if (error) throw error;
      return data;
    }
    function player(id) {
      return one('players', 'id,member_no,full_name,birth_date,group_id,parent_id,status,health_notes', id);
    }
    function report(id) {
      return one('monthly_reports',
        'id,player_id,month,status,published_at,ball,pass,shot,fitness,discipline,strength,to_improve,next_goal', id);
    }
    function playerPayments(id, through) {
      return all('payments', 'id,subscription_id,amount,salla_order_no,subscription:subscriptions!inner(player_id)', ['id'],
        query => query.eq('subscription.player_id', id).lt('paid_at', riyadhTimestamp(offsetDay(through, 1))));
    }
    async function paymentActors(ids) {
      if (!ids.length) return [];
      const pages = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const page = ids.slice(offset, offset + 100);
        pages.push(all('profiles', 'id,full_name,username', ['id'], query => query.in('id', page)));
      }
      return (await Promise.all(pages)).flat();
    }
    return { roster, groups, parents, parent, subscriptions, attendance, reports, settings, financeInputs, activity, player, report, playerPayments, paymentActors };
  }

  function index(rows) {
    return new Map(rows.map(row => [row.id, row]));
  }
  function groupBy(rows, key) {
    const groups = new Map();
    for (const row of rows) {
      const value = key(row);
      if (!groups.has(value)) groups.set(value, []);
      groups.get(value).push(row);
    }
    return groups;
  }

  function subscriptionStats(rows, players, now) {
    const history = groupBy(rows, row => row.player_id);
    for (const contracts of history.values()) {
      contracts.sort((a, b) => a.start_date.localeCompare(b.start_date)
        || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id));
    }
    const students = players.filter(player => player.status !== 'archived');
    const items = students.map(player => {
      const list = history.get(player.id) || [];
      const current = list.filter(row => row.start_date <= now && row.end_date >= now)
        .sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
      const upcoming = list.find(row => row.start_date > now);
      const previous = list.filter(row => row.end_date < now).sort((a, b) => b.end_date.localeCompare(a.end_date))[0];
      const row = current || upcoming || previous;
      let state = current ? 'active' : upcoming ? 'upcoming' : previous ? 'expired' : 'none';
      if (current && current.end_date <= offsetDay(now, 7)) state = 'soon';
      return { player, row, state, upcoming };
    });
    const statuses = Object.fromEntries(['active', 'soon', 'upcoming', 'expired', 'none']
      .map(state => [state, items.filter(item => item.state === state).length]));
    const offerUsed = new Set(rows.filter(row => row.plan === 'offer').map(row => row.player_id)).size;
    return { history, items, statuses, offerUsed };
  }

  function renewalStats(history, period, todayDate) {
    const items = [];
    const lastMatureDate = offsetDay(todayDate, -30);
    for (const contracts of history.values()) {
      for (const [index, current] of contracts.entries()) {
        if (current.end_date < period.start || current.end_date > period.through) continue;
        const deadline = offsetDay(current.end_date, 30);
        const next = contracts.slice(index + 1).find(row => row.end_date > current.end_date && row.start_date <= deadline);
        if (next || current.end_date <= lastMatureDate) items.push({ current, next });
      }
    }
    const renewed = items.filter(item => item.next).length;
    return { items, renewed, total: items.length };
  }
  function newPlayers(history, period) {
    return [...history.values()].map(list => list[0]).filter(row => row.start_date >= period.start && row.start_date <= period.through);
  }
  function attendanceStats(rows) {
    const stats = { present: 0, absent: 0, excused: 0, total: 0 };
    for (const row of rows) {
      if (!row.session || row.session.is_cancelled || !['present', 'absent', 'excused'].includes(row.status)) continue;
      stats[row.status]++;
      stats.total++;
    }
    return stats;
  }
  function ratio(numerator, denominator) {
    return denominator ? Math.round(numerator / denominator * 100) : null;
  }
  function financeStats(inputs, history, period) {
    const { payments, prices } = inputs;
    const cohort = history.filter(row => row.start_date >= period.start && row.start_date <= period.through);
    const ending = riyadhTimestamp(offsetDay(period.through, 1));
    const starting = riyadhTimestamp(period.start);
    const within = payments.filter(row => {
      const at = new Date(row.paid_at).toISOString();
      return at >= starting && at < ending;
    });
    const matched = groupBy(payments.filter(row => new Date(row.paid_at).toISOString() < ending), row => row.subscription_id);
    const collected = within.reduce((sum, row) => sum + (number(row.amount) ?? 0), 0);
    const due = cohort.map(row => {
      const expected = row.plan === 'offer' ? prices.offer_price : prices.price;
      const paid = (matched.get(row.id) || []).reduce((sum, payment) => sum + (number(payment.amount) ?? 0), 0);
      const outstanding = expected == null ? null : Math.max(0, expected - paid);
      return { row, expected: expected ?? null, paid, outstanding };
    });
    const hasPrices = due.every(item => item.expected != null);
    const expected = hasPrices ? due.reduce((sum, item) => sum + item.expected, 0) : null;
    const arrears = hasPrices ? due.reduce((sum, item) => sum + item.outstanding, 0) : null;
    const collectedForDue = hasPrices ? due.reduce((sum, item) => sum + Math.min(item.expected, item.paid), 0) : null;
    const discount = prices.offer_price == null || prices.price == null ? null
      : cohort.filter(row => row.plan === 'offer').length * Math.max(0, prices.price - prices.offer_price);
    return { within, due, collected, expected, arrears, collectedForDue, discount };
  }

  window.AZM_SUPERVISOR_DATA = {
    today, offsetDay, periodFor, monthSeries, monthName, number, readers, index, groupBy,
    subscriptionStats, renewalStats, newPlayers, attendanceStats, ratio, financeStats
  };
})();
