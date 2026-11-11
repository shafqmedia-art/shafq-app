/* نظام شفق — الخطوة الأولى: الدخول، لوحة اليوم، العملاء، الفريق، المهام، المالية، الملف الشخصي */
(function () {
  'use strict';
  var CFG = window.SHAFQ_CONFIG || { mode: 'local', countryCode: '963' };
  var KEY = 'shafq.db.v1', SKEY = 'shafq.session', TKEY = 'shafq.theme';
  var SRV = window.SHAFQ_SERVER, ONLINE = !!(SRV && SRV.enabled);
  var state = { ready: !ONLINE, needSetup: false, err: '' };
  var LOGO_W = 'icons/logo-white.png', LOGO_B = 'icons/logo-black.png';
  var CATS_IN = ['دفعة عميل', 'دخل آخر'];
  var CATS_OUT = ['أجر فريق', 'تمويل إعلاني', 'إيجار معدات', 'مواصلات', 'مصروف آخر'];
  var ROLES = [['creator', 'كونتنت كريتر'], ['editor', 'إيديتر'], ['designer', 'مصمم'], ['face', 'الوجه الإعلامي']];

  /* ---------- أدوات ---------- */
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(new Date()); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function addMonths(s, n) { var d = new Date(s + 'T12:00:00'); d.setMonth(d.getMonth() + n); return iso(d); }
  function num(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function usd(n) { n = Math.round(n * 100) / 100; var neg = n < 0; n = Math.abs(n); return (neg ? '-' : '') + '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function syp(n) { return Math.round(n).toLocaleString('en-US') + ' ل.س'; }
  function dateAr(s) { try { return new Intl.DateTimeFormat('ar-SY-u-nu-latn', { day: 'numeric', month: 'long' }).format(new Date(s + 'T12:00:00')); } catch (e) { return s; } }
  function longDates() {
    var d = new Date(), g = '', hj = '';
    try { g = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { g = today(); }
    try { hj = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { hj = ''; }
    return g + (hj ? ' · ' + hj : '');
  }
  function greet() { var hr = new Date().getHours(); return hr < 12 ? 'صباح الخير' : 'مساء الخير'; }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('show'); }, 2200); }
  var CHEV = '<svg class="chev" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

  /* ---------- التخزين (الوضع المحلي) ---------- */
  var db;
  function blank() { return { users: [], clients: [], tasks: [], moves: [], debts: [], items: [], rates: {}, settings: { goal: 0 } }; }
  function load() { if (ONLINE) { db = blank(); return; } try { db = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch (e) { db = blank(); } var b = blank(); Object.keys(b).forEach(function (k) { if (db[k] == null) db[k] = b[k]; }); }
  function save() {
    if (!ONLINE) { localStorage.setItem(KEY, JSON.stringify(db)); return; }
    SRV.push(db).catch(function (e) { toast('تعذر الحفظ: ' + e.message); return resync(); });
  }
  function resync() { return SRV.pull().then(function (d) { db = d; render(); }).catch(function () { if (!SRV.hasSession()) render(); }); }
  function checkSetup() {
    state.ready = false; render();
    return SRV.hasManager().then(function (b) { state.needSetup = !b; state.err = ''; }, function (e) { state.err = e.message; }).then(function () { state.ready = true; render(); });
  }
  function boot() {
    state.err = ''; state.ready = false; render();
    if (!SRV.hasSession()) return checkSetup();
    return SRV.pull().then(function (d) { db = d; state.ready = true; render(); }, function (e) {
      if (e.offline) { state.err = e.message; state.ready = true; render(); return; }
      SRV.clear(); return checkSetup();
    });
  }
  function byId(t, id) { return db[t].filter(function (r) { return r.id === id; })[0]; }
  function userName(id) { var u = byId('users', id); return u ? u.name : 'غير محدد'; }
  function clientName(id) { var c = byId('clients', id); return c ? c.name : 'عام'; }

  /* ---------- الدخول ---------- */
  function hash(pass, salt) {
    var s = salt + '|' + pass;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      });
    }
    var x = 5381; for (var i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0;
    return Promise.resolve('f' + x.toString(16));
  }
  function me() { var id = ONLINE ? SRV.uid() : localStorage.getItem(SKEY); var u = id && byId('users', id); return u && u.active !== false ? u : null; }
  function isMgr() { var u = me(); return !!u && u.role === 'manager'; }
  function normPhone(p) { return String(p || '').replace(/[^\d]/g, ''); }
  function waPhone(p) { p = normPhone(p); if (!p) return ''; if (p.indexOf('00') === 0) return p.slice(2); if (p.charAt(0) === '0') return (CFG.countryCode || '963') + p.slice(1); return p; }
  function waLink(u, what) {
    var msg = 'السلام عليكم ورحمة الله، كيف حالك أستاذ ' + (u ? u.name : '') + '؟ حبيت أطمّن شو صار معنا بشغل ' + (what || 'المهام') + '. يعطيك العافية.';
    return 'https://wa.me/' + waPhone(u && u.phone) + '?text=' + encodeURIComponent(msg);
  }

  /* ---------- الحسابات ---------- */
  function live(m) { return !m.is_void; }
  function sum(arr, f) { return arr.reduce(function (a, r) { return a + f(r); }, 0); }
  function lastRate() { var ks = Object.keys(db.rates).sort(); return ks.length ? { date: ks[ks.length - 1], rate: db.rates[ks[ks.length - 1]] } : null; }
  function monthOf(s) { return s.slice(0, 7); }
  function box() {
    var r = { USD: 0, SYP: 0 };
    db.moves.filter(live).forEach(function (m) { r[m.cur] += (m.dir === 'in' ? 1 : -1) * m.amount; });
    var lr = lastRate(); r.total = r.USD + (lr ? r.SYP / lr.rate : 0); return r;
  }
  function memberDue(u) {
    var paid = sum(db.moves.filter(function (m) { return live(m) && m.dir === 'out' && m.user_id === u.id; }), function (m) { return m.usd; });
    return { contract: u.contract || 0, paid: paid, left: Math.max(0, (u.contract || 0) - paid) };
  }
  function clientEnd(c) { return c.start_date && c.months ? addMonths(c.start_date, num(c.months)) : ''; }
  function daysTo(s) { return Math.round((new Date(s + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 86400000); }

  /* ---------- قطع الواجهة ---------- */
  function kpi(label, val, hi, sub) { return '<div class="kpi' + (hi ? ' hi' : '') + '"><span>' + h(label) + '</span><b>' + h(val) + '</b>' + (sub ? '<small>' + h(sub) + '</small>' : '') + '</div>'; }
  function tile(title, summ, body, open) { return '<details class="tile"' + (open ? ' open' : '') + '><summary><div><h2>' + h(title) + '</h2><span>' + summ + '</span></div>' + CHEV + '</summary><div class="body">' + body + '</div></details>'; }
  function rows(list) { return list.length ? '<div class="rows">' + list.map(function (r) { return '<div><span>' + r[0] + '</span><span class="mu">' + r[1] + '</span></div>'; }).join('') + '</div>' : '<p class="empty">لا شيء بعد.</p>'; }
  function btn(label, act, data, cls) { var d = ''; Object.keys(data || {}).forEach(function (k) { d += ' data-' + k + '="' + h(data[k]) + '"'; }); return '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + d + '>' + h(label) + '</button>'; }
  function avatar(u) { return '<span class="av" aria-hidden="true">' + (u.photo ? '<img src="' + h(u.photo) + '" alt="">' : h((u.name || '؟').charAt(0))) + '</span>'; }

  var NAV = [
    ['الرئيسية', [['لوحة اليوم', '#/'], ['التقويم', '#/calendar'], ['المهام', '#/tasks']]],
    ['العمل', [['العملاء', '#/clients'], ['المشاريع', '#/m/projects'], ['الدرون', '#/m/drone'], ['خط المحتوى', '#/m/content']]],
    ['الناس', [['الفريق', '#/team'], ['فريلانس', '#/m/talent'], ['بنك المؤثرين', '#/m/influencers'], ['العملاء المحتملون', '#/m/leads'], ['صندوق الطلبات', '#/m/inbox']]],
    ['المال', [['المالية', '#/finance'], ['الأوراق', '#/m/papers'], ['التقارير', '#/reports']]],
    ['الأدوات', [['المعدات', '#/m/gear'], ['التسويق', ''], ['ميتا', ''], ['المراسل', '#/reporter']]]
  ];
  var MNAV = [['مهامي', '#/'], ['ملفي', '#/profile']];
  function route() { return location.hash || '#/'; }
  function navHtml() {
    var r = route(), base = r.indexOf('#/client/') === 0 ? '#/clients' : r, out = '';
    out += '<div class="brand"><img class="lg-w" src="' + LOGO_W + '" alt="شعار شفق"><img class="lg-b" src="' + LOGO_B + '" alt="شعار شفق"><div><b>شفق ميديا</b><span>' + (isMgr() ? 'نظام إدارة الأعمال' : 'واجهة الفريق') + '</span></div></div>';
    if (!isMgr()) { return out + MNAV.map(function (i) { return '<a href="' + i[1] + '" class="' + (base === i[1] ? 'on' : '') + '">' + i[0] + '</a>'; }).join(''); }
    NAV.forEach(function (g) {
      var has = g[1].some(function (i) { return i[1] && i[1] === base; }) || (r.indexOf('#/soon/') === 0 && g[1].some(function (i) { return '#/soon/' + encodeURIComponent(i[0]) === r; }));
      out += '<details' + (has || g[0] === 'الرئيسية' ? ' open' : '') + '><summary><span>' + g[0] + '</span>' + CHEV + '</summary><div class="items">';
      g[1].forEach(function (i) {
        var href = i[1] || '#/soon/' + encodeURIComponent(i[0]);
        out += '<a href="' + href + '" class="' + (href === base || href === r ? 'on' : '') + (i[1] ? '' : ' soon') + '">' + i[0] + '</a>';
      });
      out += '</div></details>';
    });
    return out;
  }
  function topHtml() {
    var u = me(), out = '<div class="top">';
    if (isMgr()) {
      out += '<details class="menu"><summary><span>العملاء</span>' + CHEV + '</summary><div class="pop">' +
        db.clients.map(function (c) { return '<a href="#/client/' + h(c.id) + '">' + h(c.name) + '</a>'; }).join('') +
        '<a href="#/clients" class="mu">+ إضافة عميل</a></div></details>';
      var r = db.rates[today()];
      out += '<div class="pill"><label for="rate">سعر الصرف اليوم</label><input id="rate" inputmode="numeric" data-chg="rate" placeholder="أدخل السعر" value="' + (r ? h(r) : '') + '"><span>ل.س</span></div>';
    }
    out += '<div class="grow"></div>' + btn(document.body.classList.contains('t-light') ? 'الثيم الغامق' : 'الثيم الفاتح', 'theme');
    out += '<a class="who" href="#/profile" aria-label="الملف الشخصي">' + avatar(u) + '<span><b>' + h(u.name) + '</b><small>' + h(u.title || (isMgr() ? 'المدير' : 'عضو الفريق')) + ' · ملفي</small></span></a></div>';
    return out;
  }
  function shell(content) { return '<div class="shell"><nav class="nav" aria-label="أقسام النظام">' + navHtml() + '</nav><main>' + topHtml() + content + '</main></div>'; }
  function head(h1, sub, acts) { return '<div class="head"><div><h1>' + h(h1) + '</h1><p>' + h(sub) + '</p></div><div class="acts">' + (acts || '') + '</div></div>'; }

  /* ---------- الشاشات ---------- */
  function taskRow(t, showWho) {
    var meta = (showWho ? h(userName(t.user_id)) + ' · ' : '') + h(t.client_name || clientName(t.client_id)) + ' · ' + h(dateAr(t.due));
    return '<div><label class="chk"><input type="checkbox" data-chg="task" data-id="' + h(t.id) + '"' + (t.done ? ' checked' : '') + '><span class="' + (t.done ? 'done' : '') + '">' + h(t.title) + '</span></label><span class="mu">' + meta + (isMgr() ? ' ' + btn('حذف', 'delTask', { id: t.id }, 'sm') : '') + '</span></div>';
  }
  function taskList(list, showWho) { return list.length ? '<div class="rows">' + list.map(function (t) { return taskRow(t, showWho); }).join('') + '</div>' : '<p class="empty">لا مهام.</p>'; }

  function vDash() {
    var t = today(), tm = addDays(t, 1), mv = db.moves.filter(live);
    var inT = sum(mv.filter(function (m) { return m.date === t && m.dir === 'in'; }), function (m) { return m.usd; });
    var outT = sum(mv.filter(function (m) { return m.date === t && m.dir === 'out'; }), function (m) { return m.usd; });
    var owe = db.debts.filter(function (d) { return !d.settled && d.dir === 'owe'; }), owed = db.debts.filter(function (d) { return !d.settled && d.dir === 'owed'; });
    var open = db.tasks.filter(function (x) { return !x.done; });
    var tToday = open.filter(function (x) { return x.due === t; }), tTom = open.filter(function (x) { return x.due === tm; }), late = open.filter(function (x) { return x.due < t; });
    var alerts = [];
    if (!db.rates[t]) alerts.push(['سعر الصرف لم يُدخل اليوم', 'أدخله من الأعلى']);
    if (late.length) alerts.push(['مهام تجاوزت موعدها', String(late.length)]);
    db.debts.filter(function (d) { return !d.settled && d.due && daysTo(d.due) <= 7; }).forEach(function (d) { alerts.push([(d.dir === 'owe' ? 'دين عليّ: ' : 'دين لي: ') + h(d.party), daysTo(d.due) < 0 ? 'فات موعده' : 'خلال ' + daysTo(d.due) + ' يوم']); });
    db.clients.forEach(function (c) { var e = clientEnd(c); if (e && daysTo(e) >= 0 && daysTo(e) <= 30) alerts.push(['عقد ' + h(c.name) + ' ينتهي', 'خلال ' + daysTo(e) + ' يوم']); });
    alerts = alerts.concat(modAlerts());
    var mInc = sum(mv.filter(function (m) { return m.dir === 'in' && monthOf(m.date) === monthOf(t); }), function (m) { return m.usd; });
    var goal = num(db.settings.goal), pct = goal ? Math.min(100, Math.round(mInc / goal * 100)) : 0, bx = box();
    var team = db.users.filter(function (u) { return u.role === 'member' && u.active !== false; });
    var dues = team.map(function (u) { return [u, memberDue(u)]; }).filter(function (x) { return x[1].left > 0; });
    var c = '<div class="head" style="border-bottom:1px solid var(--ln);padding-bottom:20px"><div><h1>' + greet() + '، ' + h(me().name) + '</h1><p>' + h(longDates()) + '</p></div><span class="clock" id="clock"></span></div>';
    c += '<div class="kpis">' + kpi('دخل اليوم', usd(inT), true) + kpi('مصاريف اليوم', usd(outT)) + kpi('ديون عليّ', usd(sum(owe, function (d) { return d.usd; })), false, owe.length + ' دين') + kpi('ديون لي', usd(sum(owed, function (d) { return d.usd; })), false, owed.length + ' دين') + kpi('الصندوق', usd(bx.total), false, 'دولار ' + usd(bx.USD) + ' · ليرة ' + syp(bx.SYP)) + '</div>';
    c += '<div class="tiles">' +
      tile('اليوم', tToday.length + ' مهام', taskList(tToday, true)) +
      tile('غداً', tTom.length + ' مهام', taskList(tTom, true)) +
      tile('المراسل', alerts.length + ' تنبيهات', rows(alerts)) +
      tile('هدف الشهر', goal ? pct + '% من ' + h(usd(goal)) : 'لم يُحدد هدف', (goal ? '<div><b class="ltr">' + h(usd(mInc)) + '</b> <span class="mu">من <span class="ltr">' + h(usd(goal)) + '</span></span></div><div class="bar" role="img" aria-label="تحقق ' + pct + ' بالمئة"><i style="width:' + pct + '%"></i></div>' : '') + btn('تحديد الهدف', 'goal')) +
      tile('الصندوق', 'المجموع <span class="ltr">' + h(usd(bx.total)) + '</span>', rows([['رصيد الدولار', '<span class="ltr">' + h(usd(bx.USD)) + '</span>'], ['رصيد الليرة', h(syp(bx.SYP))], ['المجموع بالدولار', '<span class="ltr">' + h(usd(bx.total)) + '</span>']])) +
      tile('مستحقات الفريق', '<span class="ltr">' + h(usd(sum(dues, function (x) { return x[1].left; }))) + '</span> · ' + dues.length + ' أعضاء', rows(dues.map(function (x) { return [h(x[0].name) + ' · ' + h(x[0].title || ''), '<span class="ltr">' + h(usd(x[1].left)) + '</span>']; }))) +
      dashExtra() + '</div>';
    return shell(c);
  }

  function vMember() {
    var u = me(), t = today(), mine = db.tasks.filter(function (x) { return x.user_id === u.id; }), open = mine.filter(function (x) { return !x.done; });
    var d = memberDue(u), wk = addDays(t, 7);
    var c = head('أهلاً، ' + u.name, (u.title || 'عضو الفريق') + ' · ' + longDates());
    c += '<div class="kpis">' + kpi('مهام اليوم', String(open.filter(function (x) { return x.due === t; }).length), true) + kpi('هذا الأسبوع', String(open.filter(function (x) { return x.due > t && x.due <= wk; }).length)) + kpi('متأخرة', String(open.filter(function (x) { return x.due < t; }).length)) + kpi('المتبقي لي', usd(d.left)) + '</div>';
    c += tile('مهامي', open.length + ' مهام مفتوحة', taskList(open.sort(function (a, b) { return a.due < b.due ? -1 : 1; }), false), true);
    c += '<div class="tiles">' + tile('مستحقاتي', 'المتبقي <span class="ltr">' + h(usd(d.left)) + '</span>', rows([['قيمة العقد', '<span class="ltr">' + h(usd(d.contract)) + '</span>'], ['المدفوع', '<span class="ltr">' + h(usd(d.paid)) + '</span>'], ['المتبقي', '<span class="ltr">' + h(usd(d.left)) + '</span>']])) +
      tile('المنجز', mine.filter(function (x) { return x.done; }).length + ' مهام', taskList(mine.filter(function (x) { return x.done; }).slice(-10).reverse(), false)) + '</div>';
    return shell(c);
  }

  function vClients() {
    var c = head('العملاء', db.clients.length + ' عملاء', btn('+ عميل جديد', 'addClient', {}, 'pri'));
    c += db.clients.length ? '<div class="tiles">' + db.clients.map(function (cl) {
      var e = clientEnd(cl);
      return tile(cl.name, (cl.kind === 'project' ? 'مشروع' : 'إدارة صفحات') + ' · <span class="ltr">' + h(usd(num(cl.value))) + '</span>', rows([['النوع', cl.kind === 'project' ? 'مشروع' : 'إدارة صفحات'], ['القيمة', '<span class="ltr">' + h(usd(num(cl.value))) + '</span>'], ['ينتهي', e ? h(dateAr(e)) : 'غير محدد']]) + '<div class="acts"><a class="btn pri" href="#/client/' + h(cl.id) + '">فتح المساحة</a></div>');
    }).join('') + '</div>' : '<p class="empty">لا عملاء بعد. أضف أول عميل من الزر في الأعلى.</p>';
    return shell(c);
  }

  function vClient(id) {
    var cl = byId('clients', id); if (!cl) return shell(head('العميل غير موجود', '', '<a class="btn" href="#/clients">رجوع</a>'));
    var mon = monthOf(today()), mv = db.moves.filter(function (m) { return live(m) && m.client_id === id; }), mm = mv.filter(function (m) { return monthOf(m.date) === mon; });
    var inc = sum(mm.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; }), out = sum(mm.filter(function (m) { return m.dir === 'out'; }), function (m) { return m.usd; });
    var team = db.users.filter(function (u) { return u.active !== false; }), e = clientEnd(cl), tasks = db.tasks.filter(function (t) { return t.client_id === id && !t.done; });
    var roles = cl.roles || {};
    var rolesHtml = '<div class="rows">' + ROLES.map(function (r) {
      var u = byId('users', roles[r[0]]);
      var sel = '<select aria-label="' + r[1] + '" data-chg="role" data-id="' + h(id) + '" data-role="' + r[0] + '" style="min-height:44px;background:var(--p2);border:1px solid var(--ln);border-radius:12px;padding:0 10px"><option value="">لا يوجد</option>' + team.map(function (x) { return '<option value="' + h(x.id) + '"' + (roles[r[0]] === x.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select>';
      return '<div><span>' + r[1] + '</span><span class="acts">' + sel + (u ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waLink(u, cl.name)) + '">شو صار معك؟ · واتساب</a>' : '') + '</span></div>';
    }).join('') + '</div>';
    var c = head(cl.name, (cl.kind === 'project' ? 'مشروع' : 'إدارة صفحات') + (e ? ' · ينتهي ' + dateAr(e) : ''), btn('تعديل', 'editClient', { id: id }) + btn('+ حركة مالية', 'addMove', { client: id }, 'pri'));
    var allIn = sum(mv.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; }), mths = num(cl.months);
    var total = cl.kind === 'project' ? num(cl.value) : (mths ? num(cl.value) * mths : 0);
    c += '<div class="kpis">' + kpi('قيمة العقد', usd(total || num(cl.value)), false, cl.kind === 'project' ? 'للمشروع' : (mths ? usd(num(cl.value)) + ' شهرياً × ' + mths + ' أشهر' : 'شهرياً · المدة غير محددة')) +
      kpi('المقبوض من العميل', usd(allIn), false, 'منه هذا الشهر ' + usd(inc)) +
      kpi('الباقي على العميل', total ? usd(Math.max(0, total - allIn)) : 'غير محدد', true, total ? 'من كامل العقد' : 'حدّد مدة العقد من زر التعديل') +
      kpi('كلفة هذا الشهر', usd(out), false, 'أجور وتمويل ومصاريف') + kpi('الصافي هذا الشهر', usd(inc - out)) + '</div>';
    c += '<div class="tiles">' + tile('الأدوار', 'من يعمل على العميل', rolesHtml, true) +
      tile('المهام المفتوحة', tasks.length + ' مهام', taskList(tasks, true) + btn('+ مهمة', 'addTask', { client: id })) +
      tile('آخر الحركات', mv.length + ' حركة', rows(mv.slice(-8).reverse().map(function (m) { return [h(dateAr(m.date)) + ' · ' + h(m.cat) + (m.note ? ' · ' + h(m.note) : ''), '<span class="ltr">' + (m.dir === 'in' ? '+' : '-') + h(usd(m.usd)) + '</span>']; }))) +
      tile('ملاحظات', cl.notes ? 'مكتوبة' : 'لا ملاحظات', '<p>' + (cl.notes ? h(cl.notes) : '<span class="mu">أضف ملاحظات من زر التعديل.</span>') + '</p>') + '</div>';
    return shell(c);
  }

  function vTeam() {
    var all = db.users.filter(function (u) { return u.role === 'member'; }), act = all.filter(function (u) { return u.active !== false; });
    var c = head('الفريق', act.length + ' أعضاء فعّالون', btn('+ عضو جديد', 'addMember', {}, 'pri'));
    c += '<div class="kpis">' + kpi('أعضاء فعّالون', String(act.length)) + kpi('موظفون', String(act.filter(function (u) { return u.kind === 'employee'; }).length)) + kpi('فريلانسرز', String(act.filter(function (u) { return u.kind !== 'employee'; }).length)) + kpi('مستحقات الفريق', usd(sum(act, function (u) { return memberDue(u).left; })), true) + '</div>';
    c += all.length ? '<div class="tiles">' + all.map(function (u) {
      var d = memberDue(u), open = db.tasks.filter(function (t) { return t.user_id === u.id && !t.done; }).length;
      return tile(u.name + ' · ' + (u.title || 'عضو'), (u.active === false ? 'موقوف' : (u.kind === 'employee' ? 'موظف' : 'فريلانسر')) + ' · المتبقي له <span class="ltr">' + h(usd(d.left)) + '</span>',
        rows([['الهاتف', '<span class="ltr">' + h(u.phone) + '</span>'], ['قيمة العقد', '<span class="ltr">' + h(usd(d.contract)) + '</span>'], ['المدفوع', '<span class="ltr">' + h(usd(d.paid)) + '</span>'], ['المتبقي', '<span class="ltr">' + h(usd(d.left)) + '</span>'], ['مهام مفتوحة', String(open)]]) +
        '<div class="acts"><a class="btn sm" target="_blank" rel="noopener" href="' + h(waLink(u)) + '">شو صار معك؟ · واتساب</a>' + btn('دفع له', 'addMove', { user: u.id }, 'sm') + btn('تعديل', 'editMember', { id: u.id }, 'sm') + btn(u.active === false ? 'تفعيل' : 'إيقاف', 'toggleMember', { id: u.id }, 'sm') + '</div>');
    }).join('') + '</div>' : '<p class="empty">لا أعضاء بعد. أضف أول عضو من الزر في الأعلى.</p>';
    return shell(c);
  }

  function vTasks() {
    var t = today(), all = db.tasks.slice().sort(function (a, b) { return a.due < b.due ? -1 : 1; }), open = all.filter(function (x) { return !x.done; });
    var late = open.filter(function (x) { return x.due < t; }), td = open.filter(function (x) { return x.due === t; }), nx = open.filter(function (x) { return x.due > t; }), dn = all.filter(function (x) { return x.done; });
    var c = head('المهام', open.length + ' مهمة مفتوحة · ' + late.length + ' متأخرة', btn('+ مهمة جديدة', 'addTask', {}, 'pri'));
    c += '<div class="kpis">' + kpi('مفتوحة', String(open.length)) + kpi('اليوم', String(td.length), true) + kpi('متأخرة', String(late.length)) + kpi('منجزة', String(dn.length)) + '</div>';
    c += tile('متأخرة', late.length + ' مهام', taskList(late, true), late.length > 0) + tile('اليوم', td.length + ' مهام', taskList(td, true), true) + tile('قادمة', nx.length + ' مهام', taskList(nx, true)) + tile('منجزة', dn.length + ' مهام', taskList(dn.slice(-15).reverse(), true));
    return shell(c);
  }

  function vFinance() {
    var t = today(), mon = monthOf(t), mv = db.moves.filter(live), mm = mv.filter(function (m) { return monthOf(m.date) === mon; });
    var inc = sum(mm.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; }), out = sum(mm.filter(function (m) { return m.dir === 'out'; }), function (m) { return m.usd; }), bx = box(), lr = lastRate();
    var c = head('المالية', 'العرض بالدولار · الإدخال بالليرة أو الدولار', btn('+ دين', 'addDebt') + btn('+ حركة جديدة', 'addMove', {}, 'pri'));
    if (!db.rates[t]) c += '<p class="warn">سعر الصرف لم يُدخل اليوم.' + (lr ? ' الحركات بالليرة ستُحسب على آخر سعر: ' + h(lr.rate) + ' (' + h(dateAr(lr.date)) + ').' : ' أدخله من الأعلى قبل تسجيل أي حركة بالليرة.') + '</p>';
    c += '<div class="kpis">' + kpi('دخل الشهر', usd(inc), true) + kpi('مصاريف الشهر', usd(out)) + kpi('الصافي', usd(inc - out)) + kpi('الصندوق', usd(bx.total), false, 'دولار وليرة') + '</div>';
    var list = db.moves.slice().sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); }).slice(0, 60);
    var tb = list.length ? '<div class="tbl"><table><thead><tr><th>التاريخ</th><th>البيان</th><th>المبلغ</th><th>بالدولار</th><th></th></tr></thead><tbody>' + list.map(function (m) {
      var who = (m.client_id ? ' · ' + h(clientName(m.client_id)) : '') + (m.user_id ? ' · ' + h(userName(m.user_id)) : '');
      return '<tr class="' + (m.is_void ? 'done' : '') + '"><td>' + h(dateAr(m.date)) + '</td><td>' + h(m.cat) + (m.note ? ' · ' + h(m.note) : '') + who + (m.is_void ? ' · ملغاة' : '') + '</td><td>' + (m.cur === 'USD' ? '<span class="ltr">' + h(usd(m.amount)) + '</span>' : h(syp(m.amount)) + ' <span class="mu">@' + h(m.rate) + '</span>') + '</td><td><b class="ltr">' + (m.dir === 'in' ? '+' : '-') + h(usd(m.usd)) + '</b></td><td>' + (m.is_void ? btn('حذف نهائي', 'delMove', { id: m.id }, 'sm') : btn('إلغاء', 'voidMove', { id: m.id }, 'sm')) + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="empty">لا حركات بعد.</p>';
    c += tile('الحركات', db.moves.length + ' حركة', tb, true);
    function debts(dir) { var l = db.debts.filter(function (d) { return d.dir === dir && !d.settled; }); return [l, l.length ? '<div class="rows">' + l.map(function (d) { return '<div><span>' + h(d.party) + (d.due ? ' · ' + h(dateAr(d.due)) : '') + '</span><span class="acts"><b class="ltr">' + h(usd(d.usd)) + '</b>' + btn('تسديد', 'settle', { id: d.id }, 'sm') + '</span></div>'; }).join('') + '</div>' : '<p class="empty">لا ديون.</p>']; }
    var a = debts('owe'), b = debts('owed');
    c += '<div class="tiles">' + tile('ديون عليّ', '<span class="ltr">' + h(usd(sum(a[0], function (d) { return d.usd; }))) + '</span>', a[1]) + tile('ديون لي', '<span class="ltr">' + h(usd(sum(b[0], function (d) { return d.usd; }))) + '</span>', b[1]) +
      tile('الصندوق', 'دولار وليرة', rows([['رصيد الدولار', '<span class="ltr">' + h(usd(bx.USD)) + '</span>'], ['رصيد الليرة', h(syp(bx.SYP))], ['آخر سعر صرف', lr ? h(lr.rate) + ' · ' + h(dateAr(lr.date)) : 'لم يُدخل']])) + '</div>';
    return shell(c);
  }

  function vProfile() {
    var u = me();
    function f(k, label, type, wide) { return '<div class="fld' + (wide ? ' wide' : '') + '"><label for="p_' + k + '">' + label + '</label>' + (type === 'area' ? '<textarea id="p_' + k + '" name="' + k + '">' + h(u[k]) + '</textarea>' : '<input id="p_' + k + '" name="' + k + '" type="' + (type || 'text') + '" value="' + h(u[k]) + '">') + '</div>'; }
    var c = head('الملف الشخصي', isMgr() ? 'المدير · يرى كل شيء' : 'عضو الفريق', btn('تسجيل الخروج', 'logout'));
    c += '<div class="tiles"><section class="tile" style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px"><span class="av" style="width:140px;height:140px;font-size:56px;border-width:3px">' + (u.photo ? '<img src="' + h(u.photo) + '" alt="صورة الملف الشخصي">' : h((u.name || '؟').charAt(0))) + '</span><b style="font-size:20px">' + h(u.name) + '</b><span class="mu">' + h(u.title || '') + '</span><div class="acts"><label class="btn pri" for="photo">رفع صورة</label><input id="photo" type="file" accept="image/*" data-chg="photo" hidden>' + (u.photo ? btn('حذف الصورة', 'delPhoto') : '') + '</div></section>';
    c += '<section class="tile" style="padding:24px;grid-column:span 2;min-width:0"><form class="form" data-form="profile">' + f('name', 'الاسم') + f('title', 'الصفة أو العنوان') + f('phone', 'رقم التواصل' + (ONLINE && u.login_phone ? ' (رقم الدخول: ' + u.login_phone + ')' : ''), 'tel') + f('email', 'الإيميل', 'email') + f('city', 'المدينة') + f('insta', 'حساب إنستغرام') + f('bio', 'نبذة', 'area', true) + '<div class="fld wide"><p class="err" id="perr"></p><div class="acts"><button class="btn pri" type="submit">حفظ التعديلات</button>' + btn('تغيير كلمة السر', 'chPass') + '</div></div></form></section></div>';
    if (isMgr() && !ONLINE) c += tile('النسخ الاحتياطي', 'البيانات محفوظة على هذا الجهاز', '<p class="mu">في هذه النسخة البيانات محفوظة في متصفح هذا الجهاز فقط. نزّل نسخة احتياطية بانتظام.</p><div class="acts">' + btn('تنزيل نسخة احتياطية', 'backup') + '<label class="btn" for="restore">استرجاع نسخة</label><input id="restore" type="file" accept="application/json" data-chg="restore" hidden></div>');
    return shell(c);
  }

  function vSoon(name) { return shell(head(name, 'هذا القسم لم يُبنَ بعد', '') + '<p class="empty">القسم مصمم على لوحة التصميم، وسيُبنى في خطوة قادمة.</p>'); }

  function authCard(inner) { return '<div class="auth"><div class="card"><img class="lg-w" src="' + LOGO_W + '" alt="شعار شفق"><img class="lg-b" src="' + LOGO_B + '" alt="شعار شفق">' + inner + '</div></div>'; }
  function vSetup() { return authCard('<h1>إعداد نظام شفق</h1><p>أول دخول: أنشئ حساب المدير.</p><form class="fld" data-form="setup" style="gap:14px"><div class="fld"><label for="s_name">الاسم</label><input id="s_name" name="name" required></div><div class="fld"><label for="s_phone">رقم الموبايل</label><input id="s_phone" name="phone" type="tel" required></div><div class="fld"><label for="s_pass">كلمة السر</label><input id="s_pass" name="pass" type="password" minlength="6" required></div><p class="err" id="aerr"></p><button class="btn pri" type="submit">إنشاء الحساب والدخول</button></form>'); }
  function vLogin() { return authCard('<h1>تسجيل الدخول</h1><p>شفق ميديا · نظام إدارة الأعمال</p><form class="fld" data-form="login" style="gap:14px"><div class="fld"><label for="l_phone">رقم الموبايل</label><input id="l_phone" name="phone" type="tel" required></div><div class="fld"><label for="l_pass">كلمة السر</label><input id="l_pass" name="pass" type="password" required></div><p class="err" id="aerr"></p><button class="btn pri" type="submit">دخول</button></form><p>نسيت كلمة السر؟ اطلب من المدير إعادة تعيينها.</p>'); }

  /* ---------- النوافذ ---------- */
  var formCb = null;
  function openForm(title, fields, cb, note) {
    formCb = cb;
    var out = '<div class="dlg" role="dialog" aria-modal="true" aria-label="' + h(title) + '"><h2>' + h(title) + '</h2>' + (note ? '<p class="mu">' + h(note) + '</p>' : '') + '<form class="form" data-form="modal">';
    fields.forEach(function (f) {
      var id = 'm_' + f.k, el;
      if (f.type === 'select') el = '<select id="' + id + '" name="' + f.k + '">' + f.options.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(f.value) === String(o[0]) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'area') el = '<textarea id="' + id + '" name="' + f.k + '">' + h(f.value) + '</textarea>';
      else el = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + h(f.value == null ? '' : f.value) + '"' + (f.req ? ' required' : '') + (f.ph ? ' placeholder="' + h(f.ph) + '"' : '') + (f.type === 'number' ? ' step="any" min="0" inputmode="decimal"' : '') + '>';
      out += '<div class="fld' + (f.wide ? ' wide' : '') + '"><label for="' + id + '">' + h(f.label) + '</label>' + el + '</div>';
    });
    out += '<div class="fld wide"><p class="err" id="merr"></p><div class="acts"><button class="btn pri" type="submit">حفظ</button>' + btn('إلغاء', 'close') + '</div></div></form></div>';
    var m = document.getElementById('modal'); m.innerHTML = out; m.hidden = false;
    var first = m.querySelector('input,select,textarea'); if (first) first.focus();
  }
  function closeForm() { var m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; formCb = null; }
  function memberOpts(none) { return (none ? [['', none]] : []).concat(db.users.filter(function (u) { return u.active !== false; }).map(function (u) { return [u.id, u.name]; })); }
  function clientOpts() { return [['', 'عام (بدون عميل)']].concat(db.clients.map(function (c) { return [c.id, c.name]; })); }

  var acts = {
    close: closeForm,
    theme: function () { var l = document.body.classList.toggle('t-light'); document.body.classList.toggle('t-dark', !l); localStorage.setItem(TKEY, l ? 'light' : 'dark'); render(); },
    logout: function () { if (ONLINE) { SRV.idle().then(function () { return SRV.signOut(); }).then(function () { db = blank(); location.hash = '#/'; checkSetup(); }); return; } localStorage.removeItem(SKEY); location.hash = '#/'; render(); },
    retry: function () { boot(); },
    addClient: function () { clientForm(null); },
    editClient: function (d) { clientForm(byId('clients', d.id)); },
    addMember: function () { memberForm(null); },
    editMember: function (d) { memberForm(byId('users', d.id)); },
    toggleMember: function (d) { var u = byId('users', d.id); u.active = u.active === false; save(); render(); toast(u.active ? 'تم التفعيل' : 'تم الإيقاف'); },
    addTask: function (d) {
      openForm('مهمة جديدة', [{ k: 'title', label: 'المهمة', req: true, wide: true }, { k: 'user_id', label: 'لمن', type: 'select', options: memberOpts(), value: me().id }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts(), value: d.client || '' }, { k: 'due', label: 'موعد التسليم', type: 'date', value: today(), req: true }], function (v) {
        db.tasks.push({ id: uid(), title: v.title.trim(), user_id: v.user_id, client_id: v.client_id, client_name: v.client_id ? clientName(v.client_id) : '', due: v.due, done: false, done_at: '' }); return 'أُضيفت المهمة';
      });
    },
    delTask: function (d) { if (!confirm('حذف المهمة؟')) return; db.tasks = db.tasks.filter(function (t) { return t.id !== d.id; }); save(); render(); },
    addMove: function (d) {
      var isPay = !!d.user;
      openForm(isPay ? 'دفع لعضو الفريق' : 'حركة مالية جديدة', [
        { k: 'dir', label: 'النوع', type: 'select', options: [['in', 'قبض (دخل)'], ['out', 'دفع (مصروف)']], value: isPay ? 'out' : 'in' },
        { k: 'cat', label: 'التصنيف', type: 'select', options: CATS_IN.concat(CATS_OUT).map(function (c) { return [c, c]; }), value: isPay ? 'أجر فريق' : 'دفعة عميل' },
        { k: 'amount', label: 'المبلغ', type: 'number', req: true }, { k: 'cur', label: 'العملة', type: 'select', options: [['USD', 'دولار'], ['SYP', 'ليرة سورية']], value: 'USD' },
        { k: 'date', label: 'التاريخ', type: 'date', value: today(), req: true }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts(), value: d.client || '' },
        { k: 'user_id', label: 'عضو الفريق', type: 'select', options: memberOpts('لا أحد'), value: d.user || '' }, { k: 'item_id', label: 'مربوط بمشروع أو طلب درون', type: 'select', options: itemOpts(), value: d.item || '' }, { k: 'note', label: 'ملاحظة', wide: true }
      ], function (v) {
        var amt = num(v.amount); if (amt <= 0) return { err: 'أدخل مبلغاً أكبر من صفر.' };
        if (CATS_IN.indexOf(v.cat) >= 0 && v.dir !== 'in') return { err: 'هذا التصنيف للقبض. غيّر النوع أو التصنيف.' };
        if (CATS_OUT.indexOf(v.cat) >= 0 && v.dir !== 'out') return { err: 'هذا التصنيف للدفع. غيّر النوع أو التصنيف.' };
        var rate = 1;
        if (v.cur === 'SYP') { rate = db.rates[v.date] || (lastRate() || {}).rate; if (!rate) return { err: 'أدخل سعر الصرف من أعلى الشاشة أولاً.' }; }
        db.moves.push({ id: uid(), date: v.date, dir: v.dir, cat: v.cat, amount: amt, cur: v.cur, rate: rate, usd: v.cur === 'USD' ? amt : amt / rate, note: v.note.trim(), client_id: v.client_id, user_id: v.user_id, item_id: v.item_id || '', created_by: me().id, is_void: false });
        return 'سُجّلت الحركة';
      }, 'الحركة بالليرة تُحوَّل إلى الدولار بسعر يومها، ويُحفظ السعر معها.');
    },
    voidMove: function (d) { if (!confirm('إلغاء الحركة؟ تبقى في السجل ولا تُحسب.')) return; byId('moves', d.id).is_void = true; save(); render(); toast('أُلغيت الحركة'); },
    delMove: function (d) { if (!confirm('حذف الحركة نهائياً من السجل؟ لا يمكن التراجع.')) return; db.moves = db.moves.filter(function (m) { return m.id !== d.id; }); save(); render(); toast('حُذفت الحركة'); },
    addDebt: function () {
      openForm('دين جديد', [{ k: 'dir', label: 'النوع', type: 'select', options: [['owe', 'دين عليّ'], ['owed', 'دين لي']] }, { k: 'party', label: 'الطرف', req: true }, { k: 'usd', label: 'المبلغ بالدولار', type: 'number', req: true }, { k: 'due', label: 'موعد الاستحقاق', type: 'date' }], function (v) {
        if (num(v.usd) <= 0) return { err: 'أدخل مبلغاً أكبر من صفر.' };
        db.debts.push({ id: uid(), dir: v.dir, party: v.party.trim(), usd: num(v.usd), due: v.due, settled: false }); return 'أُضيف الدين';
      });
    },
    settle: function (d) { if (!confirm('تسديد الدين؟')) return; byId('debts', d.id).settled = true; save(); render(); toast('تم التسديد'); },
    goal: function () { openForm('هدف الشهر', [{ k: 'goal', label: 'هدف الدخل بالدولار', type: 'number', value: db.settings.goal || '', wide: true }], function (v) { db.settings.goal = num(v.goal); return 'حُفظ الهدف'; }); },
    delPhoto: function () { me().photo = ''; save(); render(); },
    chPass: function () {
      openForm('تغيير كلمة السر', [{ k: 'p1', label: 'كلمة السر الجديدة', type: 'password', req: true }, { k: 'p2', label: 'تأكيدها', type: 'password', req: true }], function (v) {
        if (v.p1.length < 6) return { err: 'كلمة السر 6 أحرف على الأقل.' }; if (v.p1 !== v.p2) return { err: 'الكلمتان غير متطابقتين.' };
        if (ONLINE) return SRV.setPassword(v.p1).then(function () { return 'تغيّرت كلمة السر'; });
        var u = me(); return hash(v.p1, u.salt).then(function (hh) { u.pass = hh; return 'تغيّرت كلمة السر'; });
      });
    },
    backup: function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' })); a.download = 'shafq-backup-' + today() + '.json'; a.click(); }
  };
  function clientForm(c) {
    c = c || {};
    openForm(c.id ? 'تعديل العميل' : 'عميل جديد', [{ k: 'name', label: 'اسم العميل', req: true, value: c.name }, { k: 'kind', label: 'النوع', type: 'select', options: [['page', 'إدارة صفحات (عقد مستمر)'], ['project', 'مشروع']], value: c.kind || 'page' }, { k: 'value', label: 'قيمة العقد بالدولار', type: 'number', value: c.value }, { k: 'months', label: 'المدة بالأشهر', type: 'number', value: c.months }, { k: 'start_date', label: 'تاريخ البدء', type: 'date', value: c.start_date || today() }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true, value: c.notes }], function (v) {
      var o = { name: v.name.trim(), kind: v.kind, value: num(v.value), months: num(v.months), start_date: v.start_date, notes: v.notes.trim() };
      if (c.id) { Object.assign(c, o); db.tasks.forEach(function (t) { if (t.client_id === c.id) t.client_name = o.name; }); } else { o.id = uid(); o.roles = {}; db.clients.push(o); }
      return 'حُفظ العميل';
    });
  }
  function memberForm(u) {
    var edit = !!u; u = u || {};
    var fields = [{ k: 'name', label: 'الاسم', req: true, value: u.name }, { k: 'title', label: 'الصفة', ph: 'مصور، مصمم، مونتير...', value: u.title }, { k: 'phone', label: 'رقم الموبايل', type: 'tel', req: true, value: u.phone }, { k: 'kind', label: 'نوع العقد', type: 'select', options: [['freelancer', 'فريلانسر'], ['employee', 'موظف']], value: u.kind || 'freelancer' }, { k: 'contract', label: 'قيمة العقد بالدولار', type: 'number', value: u.contract }, { k: 'pass', label: edit ? 'كلمة سر جديدة (اتركها فارغة للإبقاء)' : 'كلمة سر مؤقتة', type: 'password', req: !edit }];
    if (ONLINE && edit) fields.pop();
    openForm(edit ? 'تعديل العضو' : 'عضو جديد', fields, function (v) {
      var ph = normPhone(v.phone); if (!ph) return { err: 'أدخل رقم موبايل صحيحاً.' };
      if (db.users.some(function (x) { return x.id !== u.id && (normPhone(x.phone) === ph || (!edit && normPhone(x.login_phone) === ph)); })) return { err: 'هذا الرقم مسجل لعضو آخر.' };
      if (v.pass && v.pass.length < 6) return { err: 'كلمة السر 6 أحرف على الأقل.' };
      var o = { name: v.name.trim(), title: v.title.trim(), phone: v.phone.trim(), kind: v.kind, contract: num(v.contract) };
      if (ONLINE) {
        if (edit) { Object.assign(u, o); return 'حُفظ العضو'; }
        return SRV.signUp(v.phone, v.pass, false).then(function (id) {
          db.users.push(Object.assign({ id: id, role: 'member', active: true, login_phone: ph, email: '', city: '', insta: '', bio: '', photo: '' }, o)); return 'حُفظ العضو';
        });
      }
      var salt = u.salt || uid();
      return (v.pass ? hash(v.pass, salt) : Promise.resolve(u.pass)).then(function (hh) {
        if (edit) Object.assign(u, o, { pass: hh, salt: salt }); else db.users.push(Object.assign({ id: uid(), role: 'member', active: true, pass: hh, salt: salt }, o));
        return 'حُفظ العضو';
      });
    }, edit ? '' : 'العضو يدخل برقم موبايله وكلمة السر المؤقتة، ثم يغيّرها من ملفه.');
  }


  /* ---------- الأقسام العامة (مشاريع، درون، محتوى، فريلانس، مؤثرون، محتملون، طلبات، أوراق، معدات) ---------- */
  var mstate = { filter: {}, tag: {}, cal: '' };
  function items(kind) { return db.items.filter(function (x) { return x.kind === kind; }); }
  function itemMoney(id) { var mv = db.moves.filter(function (m) { return live(m) && m.item_id === id; }); return { inc: sum(mv.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; }), out: sum(mv.filter(function (m) { return m.dir === 'out'; }), function (m) { return m.usd; }) }; }
  function itemOpts() { return [['', 'غير مربوط']].concat(db.items.filter(function (x) { return (x.kind === 'project' || x.kind === 'drone') && x.status !== 'منتهٍ'; }).map(function (x) { return [x.id, (x.kind === 'drone' ? 'درون: ' : 'مشروع: ') + x.name]; })); }
  function tags(v) { return String(v || '').split(/[,،·]/).map(function (x) { return x.trim(); }).filter(Boolean); }
  function L(v) { return '<span class="ltr">' + h(v) + '</span>'; }
  function sel(list) { return list.map(function (x) { return [x, x]; }); }
  function waTo(phone, msg) { return 'https://wa.me/' + waPhone(phone) + '?text=' + encodeURIComponent(msg); }
  var CODES = [['INV', 'فاتورة'], ['QUO', 'عرض سعر'], ['RCV', 'وصل قبض'], ['PAY', 'وصل دفع'], ['DLV', 'وصل استلام مواد'], ['LOG', 'سجل فرز الداتا'], ['FRL', 'عقد فريلانس'], ['EMP', 'عقد موظف'], ['CLT', 'عقد عميل']];
  function nextNo(code, date) {
    var y = (date || today()).slice(0, 4), pre = code + '-' + y + '-', mx = 0;
    items('paper').forEach(function (p) { if (String(p.no || '').indexOf(pre) === 0) mx = Math.max(mx, parseInt(p.no.slice(pre.length), 10) || 0); });
    return pre + ('00' + (mx + 1)).slice(-3);
  }
  function moneyRows(it) { var m = itemMoney(it.id), price = num(it.price); return [['السعر', L(usd(price))], ['المقبوض', L(usd(m.inc))], ['المتبقي على العميل', L(usd(Math.max(0, price - m.inc)))], ['المصاريف والأجور', L(usd(m.out))], ['الربح حتى الآن', L(usd(m.inc - m.out))]]; }
  var MODS = {
    projects: { title: 'المشاريع', sub: 'معارض، مؤتمرات، وثائقيات، وأعمال صغيرة', kind: 'project', add: '+ مشروع جديد',
      statuses: ['قادم', 'تصوير', 'فرز داتا', 'مونتاج', 'تسليم', 'منتهٍ'],
      fields: function () { return [{ k: 'name', label: 'اسم المشروع', req: true }, { k: 'type', label: 'النوع', type: 'select', options: sel(['مؤتمر', 'معرض', 'فيلم وثائقي', 'عرس أو فعالية', 'عمل صغير', 'آخر']) }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts() }, { k: 'party', label: 'اسم الجهة (إن لم يكن عميلاً مسجلاً)' }, { k: 'date', label: 'التاريخ', type: 'date' }, { k: 'place', label: 'المكان' }, { k: 'team', label: 'الفريق المشارك' }, { k: 'price', label: 'السعر بالدولار', type: 'number' }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.status) + (it.date ? ' · ' + h(dateAr(it.date)) : ''); },
      rows: function (it) { return [['النوع', h(it.type)], ['العميل', h(it.client_id ? clientName(it.client_id) : (it.party || 'غير محدد'))], ['المكان', h(it.place || 'غير محدد')], ['الفريق', h(it.team || 'لم يُحدد')]].concat(moneyRows(it)); },
      acts: function (it) { return btn('+ حركة مالية', 'addMove', { item: it.id, client: it.client_id || '' }, 'sm'); },
      kpis: function (l) { var act = l.filter(function (x) { return x.status !== 'منتهٍ' && x.status !== 'قادم'; }), due = sum(l, function (x) { return Math.max(0, num(x.price) - itemMoney(x.id).inc); }), mon = monthOf(today()); var prof = sum(db.moves.filter(function (m) { return live(m) && m.item_id && monthOf(m.date) === mon && (byId('items', m.item_id) || {}).kind === 'project'; }), function (m) { return m.dir === 'in' ? m.usd : -m.usd; }); return kpi('جارية', String(act.length)) + kpi('قادمة', String(l.filter(function (x) { return x.status === 'قادم'; }).length)) + kpi('بانتظار الدفع', usd(due)) + kpi('ربح هذا الشهر', usd(prof), true); } },
    drone: { title: 'الدرون', sub: 'طلبات الدرون وجدول الطيران', kind: 'drone', add: '+ طلب درون',
      statuses: ['طلب جديد', 'تسعير وتأكيد', 'التصريح', 'موعد الطيران', 'تصوير', 'مونتاج', 'تسليم ودفع', 'منتهٍ'],
      fields: function () { return [{ k: 'name', label: 'اسم العميل', req: true }, { k: 'phone', label: 'رقم العميل', type: 'tel' }, { k: 'pack', label: 'الباقة', type: 'select', options: sel(['صور جوية', 'فيديو قصير', 'تصوير لوكيشن كامل']) }, { k: 'area', label: 'المنطقة' }, { k: 'date', label: 'تاريخ الطيران', type: 'date' }, { k: 'time', label: 'الساعة', type: 'time' }, { k: 'pilot', label: 'الطيار', type: 'select', options: memberOpts('غير محدد') }, { k: 'model', label: 'الدرون' }, { k: 'permit', label: 'التصريح', type: 'select', options: sel(['لا يلزم', 'بانتظار الموافقة', 'جاهز']) }, { k: 'price', label: 'السعر بالدولار', type: 'number' }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.status) + ' · ' + h(it.pack || '') + (it.date ? ' · ' + h(dateAr(it.date)) + (it.time ? ' ' + h(it.time) : '') : ''); },
      rows: function (it) { return [['المنطقة', h(it.area || 'غير محددة')], ['الطيار', h(it.pilot ? userName(it.pilot) : 'غير محدد')], ['الدرون', h(it.model || 'غير محددة')], ['التصريح', h(it.permit || 'لا يلزم')]].concat(moneyRows(it)); },
      acts: function (it) { return (it.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waTo(it.phone, 'السلام عليكم ورحمة الله، معكم شفق ميديا بخصوص طلب تصوير الدرون.')) + '">واتساب العميل</a>' : '') + btn('+ حركة مالية', 'addMove', { item: it.id }, 'sm'); },
      kpis: function (l) { var mon = monthOf(today()), t = today(), ml = l.filter(function (x) { return monthOf(x.created || x.date || '') === mon; }); var inc = sum(db.moves.filter(function (m) { return live(m) && m.dir === 'in' && monthOf(m.date) === mon && m.item_id && (byId('items', m.item_id) || {}).kind === 'drone'; }), function (m) { return m.usd; }); return kpi('طلبات الشهر', String(ml.length), true, 'الهدف 100') + kpi('طلعات اليوم', String(l.filter(function (x) { return x.date === t && x.status !== 'منتهٍ'; }).length)) + kpi('بانتظار التصريح', String(l.filter(function (x) { return x.permit === 'بانتظار الموافقة' && x.status !== 'منتهٍ'; }).length)) + kpi('دخل الدرون', usd(inc), false, 'هذا الشهر'); } },
    content: { title: 'خط إنتاج المحتوى', sub: 'كل منشور من الفكرة إلى النشر', kind: 'post', add: '+ منشور جديد', board: true,
      statuses: ['فكرة', 'كتابة', 'تصميم أو مونتاج', 'موافقة العميل', 'مجدول', 'منشور'],
      fields: function () { return [{ k: 'name', label: 'عنوان المنشور', req: true }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts() }, { k: 'type', label: 'النوع', type: 'select', options: sel(['بوست', 'ريل', 'كاروسيل', 'ستوري', 'منشور الجمعة']) }, { k: 'owner', label: 'المسؤول', type: 'select', options: memberOpts('غير محدد') }, { k: 'date', label: 'موعد النشر', type: 'date' }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.type || '') + ' · ' + h(it.client_id ? clientName(it.client_id) : 'عام') + (it.date ? ' · ' + h(dateAr(it.date)) : ''); },
      kpis: function (l) { return kpi('قيد العمل', String(l.filter(function (x) { return x.status !== 'منشور'; }).length)) + kpi('بانتظار موافقة العميل', String(l.filter(function (x) { return x.status === 'موافقة العميل'; }).length), true) + kpi('مجدول', String(l.filter(function (x) { return x.status === 'مجدول'; }).length)) + kpi('نُشر هذا الشهر', String(l.filter(function (x) { return x.status === 'منشور' && monthOf(x.date || '') === monthOf(today()); }).length)); } },
    talent: { title: 'فريلانس', sub: 'قاعدة بيانات الفريلانسرز للمشاريع القادمة', kind: 'talent', add: '+ فريلانسر', tagField: 'skills', tagLabel: 'الاختصاص',
      statuses: ['محفوظ', 'تواصلت معه', 'اشتغل معنا'],
      fields: function () { return [{ k: 'name', label: 'الاسم', req: true }, { k: 'account', label: 'حساب إنستغرام', ph: '@username' }, { k: 'skills', label: 'الاختصاصات (افصل بفاصلة)', ph: 'فيلم ميكر، مونتير، درون' }, { k: 'city', label: 'المدينة' }, { k: 'phone', label: 'رقم التواصل', type: 'tel' }, { k: 'rate', label: 'السعر التقريبي' }, { k: 'rating', label: 'تقييمي', type: 'select', options: [['', 'بدون']].concat(sel(['5', '4', '3', '2', '1'])) }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(tags(it.skills).join(' · ') || 'بدون اختصاص') + ' · ' + h(it.status); },
      rows: function (it) { return [['الحساب', L(it.account || 'غير محدد')], ['المدينة', h(it.city || 'غير مذكورة')], ['السعر', h(it.rate || 'غير محدد')], ['تقييمي', it.rating ? h(it.rating) + ' من 5' : 'بدون']]; },
      acts: function (it) { return personActs(it); },
      kpis: function (l) { return kpi('محفوظون', String(l.length)) + kpi('تواصلت معهم', String(l.filter(function (x) { return x.status === 'تواصلت معه'; }).length)) + kpi('اشتغلوا معنا', String(l.filter(function (x) { return x.status === 'اشتغل معنا'; }).length), true) + kpi('اختصاصات', String(allTags(l, 'skills').length)); } },
    influencers: { title: 'بنك المؤثرين', sub: 'بلوجرز مفروزون حسب مجال المحتوى', kind: 'influencer', add: '+ مؤثر', tagField: 'niches', tagLabel: 'المجال',
      statuses: ['محفوظ', 'تواصلت معه', 'اشتغل معنا'],
      fields: function () { return [{ k: 'name', label: 'الاسم', req: true }, { k: 'account', label: 'الحساب', ph: '@username' }, { k: 'platform', label: 'المنصة', type: 'select', options: sel(['إنستغرام', 'تيك توك', 'يوتيوب', 'فيسبوك']) }, { k: 'niches', label: 'المجالات (افصل بفاصلة)', ph: 'طبخ ومطاعم، لايف ستايل' }, { k: 'city', label: 'المدينة' }, { k: 'followers', label: 'عدد المتابعين', type: 'number' }, { k: 'reel', label: 'سعر الريل' }, { k: 'story', label: 'سعر الستوري' }, { k: 'phone', label: 'رقم التواصل أو مدير الأعمال', type: 'tel' }, { k: 'fits', label: 'مناسب لمعايير شفق', type: 'select', options: sel(['نعم', 'لا']) }, { k: 'rating', label: 'تقييمي', type: 'select', options: [['', 'بدون']].concat(sel(['5', '4', '3', '2', '1'])) }, { k: 'notes', label: 'ملاحظات ونتائج الحملات', type: 'area', wide: true }]; },
      summary: function (it) { return h(tags(it.niches).join(' · ') || 'بدون مجال') + (it.fits === 'لا' ? ' · غير مناسب' : ''); },
      rows: function (it) { return [['الحساب', L(it.account || 'غير محدد')], ['المنصة', h(it.platform || '')], ['المدينة', h(it.city || 'غير مذكورة')], ['المتابعون', it.followers ? L(num(it.followers).toLocaleString('en-US')) : 'غير محدد'], ['سعر الريل', h(it.reel || 'غير محدد')], ['سعر الستوري', h(it.story || 'غير محدد')], ['مناسب لمعايير شفق', h(it.fits || 'نعم')]]; },
      acts: function (it) { return personActs(it); },
      kpis: function (l) { return kpi('مؤثرون محفوظون', String(l.length)) + kpi('مجالات', String(allTags(l, 'niches').length)) + kpi('اشتغلوا معنا', String(l.filter(function (x) { return x.status === 'اشتغل معنا'; }).length), true) + kpi('غير مناسبين', String(l.filter(function (x) { return x.fits === 'لا'; }).length)); } },
    leads: { title: 'العملاء المحتملون', sub: 'من أُرسل له عرض، من ردّ، ومن يحتاج متابعة', kind: 'lead', add: '+ عميل محتمل', board: true,
      statuses: ['جديد', 'تم التواصل', 'أُرسل عرض', 'تفاوض', 'صار عميلاً', 'ضاع'],
      fields: function () { return [{ k: 'name', label: 'الاسم أو الجهة', req: true }, { k: 'activity', label: 'النشاط', ph: 'مطعم، عيادة، محل...' }, { k: 'phone', label: 'رقم التواصل', type: 'tel' }, { k: 'source', label: 'المصدر', type: 'select', options: sel(['إحالة من عميل', 'نموذج الموقع', 'إنستغرام', 'واتساب', 'معرفة شخصية', 'آخر']) }, { k: 'ref', label: 'من دلّه علينا' }, { k: 'value', label: 'قيمة العرض بالدولار', type: 'number' }, { k: 'next', label: 'موعد المتابعة القادمة', type: 'date' }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.activity || '') + (it.value ? ' · ' + usd(num(it.value)) : '') + (it.next ? ' · متابعة ' + h(dateAr(it.next)) : ''); },
      acts: function (it) { return (it.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waTo(it.phone, 'السلام عليكم ورحمة الله، معكم شفق ميديا. حبيت أتابع معكم بخصوص العرض.')) + '">واتساب</a>' : '') + (it.status !== 'صار عميلاً' ? btn('حوّله إلى عميل', 'lead2client', { id: it.id }, 'sm') : ''); },
      kpis: function (l) { var op = l.filter(function (x) { return x.status !== 'صار عميلاً' && x.status !== 'ضاع'; }), t = today(); return kpi('في المتابعة', String(op.length)) + kpi('عروض مُرسلة', String(l.filter(function (x) { return x.status === 'أُرسل عرض'; }).length)) + kpi('يحتاجون متابعة', String(op.filter(function (x) { return x.next && x.next <= t; }).length), true) + kpi('قيمة العروض', usd(sum(op, function (x) { return num(x.value); }))); } },
    inbox: { title: 'صندوق الطلبات', sub: 'كل الطلبات الواردة في قائمة واحدة', kind: 'request', add: '+ طلب سريع',
      statuses: ['جديد', 'تم الرد', 'بانتظار العميل', 'حُجز', 'ضاع'],
      fields: function () { return [{ k: 'name', label: 'الاسم', req: true }, { k: 'phone', label: 'الرقم', type: 'tel' }, { k: 'service', label: 'الخدمة المطلوبة', type: 'select', options: sel(['درون', 'إدارة صفحة', 'تغطية فعالية', 'فيلم وثائقي', 'أخرى']) }, { k: 'source', label: 'المصدر', type: 'select', options: sel(['واتساب', 'إنستغرام', 'نموذج الموقع', 'اتصال', 'إحالة']) }, { k: 'date', label: 'تاريخ الطلب', type: 'date', def: function () { return today(); } }, { k: 'owner', label: 'من يتابعه', type: 'select', options: memberOpts('غير محدد') }, { k: 'lost', label: 'سبب الضياع (إن ضاع)', type: 'select', options: [['', 'لا ينطبق']].concat(sel(['السعر', 'التأخر في الرد', 'الموعد', 'آخر'])) }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.service || '') + ' · ' + h(it.source || '') + ' · ' + h(it.status); },
      rows: function (it) { return [['الرقم', L(it.phone || 'غير محدد')], ['تاريخ الطلب', it.date ? h(dateAr(it.date)) : 'غير محدد'], ['يتابعه', h(it.owner ? userName(it.owner) : 'غير محدد')], ['سبب الضياع', h(it.lost || 'لا ينطبق')]]; },
      acts: function (it) { return it.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waTo(it.phone, 'السلام عليكم ورحمة الله، أهلاً بكم في شفق ميديا. وصلنا طلبكم بخصوص ' + (it.service || 'خدماتنا') + '، ويسعدنا خدمتكم.')) + '">رد جاهز · واتساب</a>' : ''; },
      kpis: function (l) { var mon = monthOf(today()), ml = l.filter(function (x) { return monthOf(x.date || '') === mon; }), bk = ml.filter(function (x) { return x.status === 'حُجز'; }).length; return kpi('لم يُرد عليها', String(l.filter(function (x) { return x.status === 'جديد'; }).length), true) + kpi('بانتظار العميل', String(l.filter(function (x) { return x.status === 'بانتظار العميل'; }).length)) + kpi('حُجز هذا الشهر', String(bk)) + kpi('نسبة التحويل', (ml.length ? Math.round(bk / ml.length * 100) : 0) + '%', false, 'من ' + ml.length + ' طلب'); } },
    papers: { title: 'الأوراق', sub: 'كل ورقة لها رمز ورقم · لا حذف: الورقة الخطأ تُلغى', kind: 'paper', add: '+ ورقة جديدة', noEdit: true, noDelete: true,
      statuses: ['سارية', 'ملغاة'],
      fields: function () { return [{ k: 'code', label: 'نوع الورقة', type: 'select', options: CODES.map(function (c) { return [c[0], c[1] + ' (' + c[0] + ')']; }) }, { k: 'name', label: 'الطرف الثاني', req: true }, { k: 'amount', label: 'المبلغ', type: 'number' }, { k: 'cur', label: 'العملة', type: 'select', options: [['USD', 'دولار'], ['SYP', 'ليرة سورية']] }, { k: 'date', label: 'التاريخ', type: 'date', def: function () { return today(); } }, { k: 'notes', label: 'البيان', type: 'area', wide: true }]; },
      title_: function (it) { return (it.no || '') + ' · ' + it.name; },
      summary: function (it) { var c = CODES.filter(function (x) { return x[0] === it.code; })[0]; return h(c ? c[1] : it.code) + ' · ' + h(it.status) + (it.date ? ' · ' + h(dateAr(it.date)) : ''); },
      rows: function (it) { return [['الرقم', L(it.no)], ['المبلغ', it.amount ? (it.cur === 'SYP' ? h(syp(num(it.amount))) : L(usd(num(it.amount)))) : 'بدون مبلغ'], ['البيان', h(it.notes || '')]]; },
      acts: function (it) { return it.status === 'سارية' ? btn('إلغاء الورقة', 'voidPaper', { id: it.id }, 'sm') : ''; },
      kpis: function (l) { var mon = monthOf(today()); return kpi('أوراق هذا الشهر', String(l.filter(function (x) { return monthOf(x.date || '') === mon; }).length), true) + kpi('سارية', String(l.filter(function (x) { return x.status === 'سارية'; }).length)) + kpi('ملغاة', String(l.filter(function (x) { return x.status === 'ملغاة'; }).length)) + kpi('فواتير', String(l.filter(function (x) { return x.code === 'INV'; }).length)); } },
    gear: { title: 'المعدات', sub: 'معدات مستأجرة: من أين، بكم، لأي مشروع، ومتى تُعاد', kind: 'gear', add: '+ استئجار قطعة', tagField: 'cat', tagLabel: 'التصنيف',
      statuses: ['مستأجرة', 'أُعيدت'],
      fields: function () { return [{ k: 'name', label: 'اسم القطعة', req: true }, { k: 'cat', label: 'التصنيف', type: 'select', options: sel(['كاميرات', 'عدسات', 'درونات', 'جيمبال', 'ترايبود', 'إضاءة', 'صوت', 'بطاريات', 'تخزين', 'شاشات', 'إكسسوارات', 'شنط']) }, { k: 'model', label: 'الموديل' }, { k: 'shop', label: 'محل التأجير' }, { k: 'phone', label: 'هاتف المحل', type: 'tel' }, { k: 'cost', label: 'كلفة الإيجار الكلية بالدولار', type: 'number' }, { k: 'from', label: 'من تاريخ', type: 'date', def: function () { return today(); } }, { k: 'to', label: 'موعد الإعادة', type: 'date' }, { k: 'holder', label: 'مع من', type: 'select', options: memberOpts('غير محدد') }, { k: 'item', label: 'تُحسب على', type: 'select', options: itemOpts() }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
      summary: function (it) { return h(it.cat || '') + ' · ' + h(it.status) + (it.to ? ' · تُعاد ' + h(dateAr(it.to)) : ''); },
      rows: function (it) { var ref = byId('items', it.item); return [['الموديل', h(it.model || 'غير محدد')], ['محل التأجير', h(it.shop || 'غير محدد') + (it.phone ? ' · ' + L(it.phone) : '')], ['الكلفة', L(usd(num(it.cost)))], ['المدة', (it.from ? h(dateAr(it.from)) : '؟') + ' إلى ' + (it.to ? h(dateAr(it.to)) : '؟')], ['مع من', h(it.holder ? userName(it.holder) : 'غير محدد')], ['تُحسب على', h(ref ? ref.name : 'غير مربوطة')]]; },
      kpis: function (l) { var t = today(), out = l.filter(function (x) { return x.status === 'مستأجرة'; }), mon = monthOf(t); return kpi('مستأجرة الآن', String(out.length), true) + kpi('تُعاد اليوم', String(out.filter(function (x) { return x.to === t; }).length)) + kpi('متأخرة عن الإعادة', String(out.filter(function (x) { return x.to && x.to < t; }).length)) + kpi('كلفة الإيجار', usd(sum(l.filter(function (x) { return monthOf(x.from || '') === mon; }), function (x) { return num(x.cost); })), false, 'هذا الشهر'); } }
  };
  function allTags(l, f) { var o = {}; l.forEach(function (x) { tags(x[f]).forEach(function (t) { o[t] = 1; }); }); return Object.keys(o); }
  function personActs(it) { var acc = String(it.account || '').replace(/^@/, '').trim(); return (acc ? '<a class="btn sm" target="_blank" rel="noopener" href="https://instagram.com/' + encodeURIComponent(acc) + '">فتح الحساب</a>' : '') + (it.phone ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waTo(it.phone, 'السلام عليكم ورحمة الله، معك عبد الرحمن من شفق ميديا. شفت شغلك وحبيت نتعاون.')) + '">واتساب</a>' : ''); }
  function chipRow(label, list, cur, act, mod) { return '<div class="chips" role="group" aria-label="' + h(label) + '">' + list.map(function (x) { var on = (cur || '') === x[0]; return '<button type="button" class="btn sm' + (on ? ' pri' : '') + '" aria-pressed="' + on + '" data-act="' + act + '" data-mod="' + mod + '" data-v="' + h(x[0]) + '">' + h(x[1]) + '</button>'; }).join('') + '</div>'; }
  function statusSel(m, it) { return '<select aria-label="الحالة" data-chg="istatus" data-id="' + h(it.id) + '" style="min-height:36px;background:var(--p2);border:1px solid var(--ln);border-radius:12px;padding:0 8px;font-size:13px">' + m.statuses.map(function (s) { return '<option' + (s === it.status ? ' selected' : '') + '>' + h(s) + '</option>'; }).join('') + '</select>'; }
  function itemActs(key, m, it) { return '<div class="acts">' + (m.noEdit && it.status ? '' : statusSel(m, it)) + (m.acts ? m.acts(it) : '') + (m.noEdit ? '' : btn('تعديل', 'editItem', { mod: key, id: it.id }, 'sm')) + (m.noDelete ? '' : btn('حذف', 'delItem', { id: it.id }, 'sm')) + '</div>'; }
  function vMod(key) {
    var m = MODS[key], all = items(m.kind), f = mstate.filter[key] || '', tg = mstate.tag[key] || '';
    var c = head(m.title, m.sub, btn(m.add, 'addItem', { mod: key }, 'pri'));
    if (ONLINE && SRV.itemsMissing && SRV.itemsMissing()) c += '<p class="warn">هذا القسم يحتاج تحديث قاعدة البيانات: شغّل ملف schema2.sql في Supabase (SQL Editor) مرة واحدة ثم أعد فتح التطبيق.</p>';
    c += '<div class="kpis">' + m.kpis(all) + '</div>';
    var list = all.filter(function (x) { return (!f || x.status === f) && (!tg || tags(x[m.tagField]).indexOf(tg) >= 0); });
    if (m.tagField) c += chipRow(m.tagLabel, [['', 'الكل']].concat(allTags(all, m.tagField).map(function (t) { return [t, t]; })), tg, 'mtag', key);
    if (m.board) {
      c += '<div class="tbl"><div class="board" style="grid-template-columns:repeat(' + m.statuses.length + ',minmax(170px,1fr));min-width:' + (m.statuses.length * 180) + 'px">' + m.statuses.map(function (s) {
        var col = list.filter(function (x) { return x.status === s; });
        return '<div class="col"><span class="colh">' + h(s) + ' · ' + col.length + '</span>' + col.map(function (it) { return '<div class="card"><b>' + h(it.name) + '</b><span class="mu">' + m.summary(it) + '</span>' + itemActs(key, m, it) + '</div>'; }).join('') + '</div>';
      }).join('') + '</div></div>';
    } else {
      c += chipRow('الحالة', [['', 'الكل']].concat(m.statuses.map(function (s) { return [s, s]; })), f, 'mfilter', key);
      c += list.length ? '<div class="tiles">' + list.map(function (it) { return tile(m.title_ ? m.title_(it) : it.name, m.summary(it), rows(m.rows(it)) + (it.notes && !m.noEdit ? '<p class="mu">' + h(it.notes) + '</p>' : '') + itemActs(key, m, it)); }).join('') + '</div>' : '<p class="empty">لا شيء هنا بعد. أضف من الزر في الأعلى.</p>';
    }
    if (key === 'talent' || key === 'influencers') c += '<p class="mu">الإضافة يدوية الآن. التعبئة التلقائية من سكرين شوت تحتاج ربط خدمة ذكاء اصطناعي، وهي خطوة قادمة.</p>';
    if (key === 'papers') c += '<p class="mu">هذا سجل الأوراق وترقيمها. إخراج الورقة بتصميم شفق للطباعة خطوة قادمة.</p>';
    return shell(c);
  }
  function itemForm(key, it) {
    var m = MODS[key], edit = !!it; it = it || {};
    var fields = m.fields().map(function (f) { return Object.assign({}, f, { value: it[f.k] != null && it[f.k] !== '' ? it[f.k] : (f.def ? f.def() : (f.type === 'select' && f.options.length ? f.options[0][0] : '')) }); });
    openForm(edit ? 'تعديل' : m.add.replace('+ ', ''), fields, function (v) {
      var o = {}; m.fields().forEach(function (f) { o[f.k] = f.type === 'number' ? num(v[f.k]) : String(v[f.k] || '').trim(); });
      if (!o.name) return { err: 'الاسم مطلوب.' };
      if (edit) Object.assign(it, o);
      else { o.id = uid(); o.kind = m.kind; o.status = m.statuses[0]; o.created = today(); if (m.kind === 'paper') o.no = nextNo(o.code, o.date); db.items.push(o); }
      return 'تم الحفظ';
    });
  }
  Object.assign(acts, {
    addItem: function (d) { itemForm(d.mod, null); },
    editItem: function (d) { itemForm(d.mod, byId('items', d.id)); },
    delItem: function (d) { if (!confirm('حذف نهائي؟')) return; db.items = db.items.filter(function (x) { return x.id !== d.id; }); db.moves.forEach(function (m) { if (m.item_id === d.id) m.item_id = ''; }); save(); render(); },
    voidPaper: function (d) { if (!confirm('إلغاء الورقة؟ تبقى في السجل برقمها.')) return; byId('items', d.id).status = 'ملغاة'; save(); render(); toast('أُلغيت الورقة'); },
    mfilter: function (d) { mstate.filter[d.mod] = d.v; render(); },
    mtag: function (d) { mstate.tag[d.mod] = d.v; render(); },
    lead2client: function (d) { var l = byId('items', d.id); if (!confirm('تحويل «' + l.name + '» إلى عميل؟')) return; db.clients.push({ id: uid(), name: l.name, kind: 'page', value: num(l.value), months: 0, start_date: today(), notes: l.notes || '', roles: {} }); l.status = 'صار عميلاً'; save(); render(); toast('صار عميلاً'); },
    calPrev: function () { mstate.cal = addMonths(calMonth() + '-15', -1).slice(0, 7); render(); },
    calNext: function () { mstate.cal = addMonths(calMonth() + '-15', 1).slice(0, 7); render(); },
    addEvent: function () { openForm('موعد جديد', [{ k: 'name', label: 'الموعد', req: true, wide: true }, { k: 'date', label: 'التاريخ', type: 'date', value: today(), req: true }, { k: 'time', label: 'الساعة', type: 'time' }], function (v) { db.items.push({ id: uid(), kind: 'event', status: '', name: v.name.trim(), date: v.date, time: v.time }); return 'أُضيف الموعد'; }); }
  });

  /* ---------- التقويم ---------- */
  function calMonth() { return mstate.cal || today().slice(0, 7); }
  function calEntries() {
    var e = {}; function put(d, t) { if (!d) return; (e[d] = e[d] || []).push(t); }
    db.tasks.forEach(function (t) { if (!t.done) put(t.due, 'مهمة: ' + t.title); });
    db.items.forEach(function (x) {
      if (x.kind === 'project' && x.status !== 'منتهٍ') put(x.date, 'مشروع: ' + x.name);
      if (x.kind === 'drone' && x.status !== 'منتهٍ') put(x.date, 'درون' + (x.time ? ' ' + x.time : '') + ': ' + x.name);
      if (x.kind === 'post' && x.status !== 'منشور') put(x.date, 'نشر: ' + x.name);
      if (x.kind === 'event') put(x.date, (x.time ? x.time + ' ' : '') + x.name);
      if (x.kind === 'lead' && x.status !== 'صار عميلاً' && x.status !== 'ضاع') put(x.next, 'متابعة: ' + x.name);
      if (x.kind === 'gear' && x.status === 'مستأجرة') put(x.to, 'إعادة: ' + x.name);
    });
    db.debts.forEach(function (d) { if (!d.settled) put(d.due, (d.dir === 'owe' ? 'دين عليّ: ' : 'دين لي: ') + d.party); });
    db.clients.forEach(function (c) { put(clientEnd(c), 'نهاية عقد: ' + c.name); });
    return e;
  }
  function vCalendar() {
    var ym = calMonth(), first = new Date(ym + '-01T12:00:00'), days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), lead = (first.getDay() + 1) % 7, e = calEntries(), t = today(), title;
    try { title = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { month: 'long', year: 'numeric' }).format(first); } catch (x) { title = ym; }
    var c = head(title, 'المهام، المشاريع، الطلعات، النشر، الدفعات، ونهايات العقود', btn('الشهر السابق', 'calPrev') + btn('الشهر التالي', 'calNext') + btn('+ موعد جديد', 'addEvent', {}, 'pri'));
    var g = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(function (d) { return '<div class="calh">' + d + '</div>'; }).join('');
    for (var i = 0; i < lead; i++) g += '<div aria-hidden="true"></div>';
    var monthList = [];
    for (var d = 1; d <= days; d++) {
      var ds = ym + '-' + pad(d), l = e[ds] || [];
      l.forEach(function (x) { monthList.push([h(x), h(dateAr(ds))]); });
      g += '<div class="cald' + (ds === t ? ' now' : '') + '"><b>' + d + '</b>' + l.slice(0, 3).map(function (x) { return '<span>' + h(x) + '</span>'; }).join('') + (l.length > 3 ? '<span class="mu">+' + (l.length - 3) + '</span>' : '') + '</div>';
    }
    c += '<div class="tbl"><div class="cal">' + g + '</div></div>' + tile('كل مواعيد الشهر', monthList.length + ' موعد', rows(monthList), monthList.length > 0 && monthList.length <= 12);
    return shell(c);
  }

  /* ---------- التقارير ---------- */
  function hbar(label, val, pct) { return '<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span>' + h(label) + '</span><span class="mu ltr">' + h(val) + '</span></div><div class="bar" role="img" aria-label="' + h(label) + ': ' + h(val) + '"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></div></div>'; }
  function bars(pairs, fmt) { var mx = Math.max.apply(null, pairs.map(function (p) { return Math.abs(p[1]); }).concat([1])); return pairs.length ? pairs.map(function (p) { return hbar(p[0], fmt(p[1]), Math.abs(p[1]) / mx * 100); }).join('') : '<p class="empty">لا بيانات بعد.</p>'; }
  function vReports() {
    var t = today(), mon = monthOf(t), mv = db.moves.filter(live), mm = mv.filter(function (m) { return monthOf(m.date) === mon; });
    var inc = sum(mm.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; }), out = sum(mm.filter(function (m) { return m.dir === 'out'; }), function (m) { return m.usd; });
    var byClient = db.clients.map(function (c) { return [c.name, sum(mm.filter(function (m) { return m.client_id === c.id; }), function (m) { return m.dir === 'in' ? m.usd : -m.usd; })]; }).filter(function (p) { return p[1] !== 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var svc = { 'الدرون': 0, 'المشاريع': 0, 'إدارة الصفحات': 0, 'أخرى': 0 };
    mm.filter(function (m) { return m.dir === 'in'; }).forEach(function (m) { var it = byId('items', m.item_id); svc[it && it.kind === 'drone' ? 'الدرون' : it && it.kind === 'project' ? 'المشاريع' : m.client_id ? 'إدارة الصفحات' : 'أخرى'] += m.usd; });
    var months = []; for (var i = 5; i >= 0; i--) { var k = addMonths(mon + '-15', -i).slice(0, 7), lab; try { lab = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { month: 'long' }).format(new Date(k + '-15T12:00:00')); } catch (x) { lab = k; } months.push([lab, sum(mv.filter(function (m) { return monthOf(m.date) === k; }), function (m) { return m.dir === 'in' ? m.usd : -m.usd; })]); }
    var team = db.users.filter(function (u) { return u.role === 'member'; }).map(function (u) { var dn = db.tasks.filter(function (x) { return x.user_id === u.id && x.done; }), on = dn.filter(function (x) { return x.done_at && x.done_at <= x.due; }).length; return [u.name, on, dn.length]; }).filter(function (p) { return p[2] > 0; });
    var c = head('التقارير', 'الشهر الحالي');
    c += '<div class="kpis">' + kpi('الدخل', usd(inc)) + kpi('المصاريف', usd(out)) + kpi('الصافي', usd(inc - out), true) + kpi('هامش الربح', (inc ? Math.round((inc - out) / inc * 100) : 0) + '%') + '</div>';
    c += '<div class="tiles">' + tile('صافي كل عميل', byClient.length + ' عملاء', bars(byClient, usd), true) + tile('الدخل حسب الخدمة', 'هذا الشهر', bars(Object.keys(svc).map(function (k) { return [k, svc[k]]; }).filter(function (p) { return p[1] > 0; }), usd), true) + tile('الصافي آخر 6 أشهر', 'مقارنة الأشهر', bars(months, usd), true) +
      tile('أداء الفريق', 'المهام المسلّمة في وقتها', team.length ? team.map(function (p) { return hbar(p[0], p[1] + ' من ' + p[2], p[1] / p[2] * 100); }).join('') : '<p class="empty">لا مهام منجزة بعد.</p>') + '</div>';
    return shell(c);
  }

  /* ---------- المراسل والتنبيهات ---------- */
  function modAlerts() {
    var a = [], t = today(), n;
    n = items('request').filter(function (x) { return x.status === 'جديد'; }).length; if (n) a.push(['طلبات لم يُرد عليها', String(n)]);
    items('lead').forEach(function (x) { if (x.next && x.next <= t && x.status !== 'صار عميلاً' && x.status !== 'ضاع') a.push(['متابعة عميل محتمل: ' + h(x.name), x.next < t ? 'فات موعدها' : 'اليوم']); });
    items('gear').forEach(function (x) { if (x.status === 'مستأجرة' && x.to && x.to <= t) a.push(['إعادة معدات: ' + h(x.name), x.to < t ? 'متأخرة' : 'اليوم']); });
    items('drone').forEach(function (x) { if (x.status !== 'منتهٍ' && x.permit === 'بانتظار الموافقة' && x.date && daysTo(x.date) <= 3 && daysTo(x.date) >= 0) a.push(['طلعة درون بلا تصريح: ' + h(x.name), 'خلال ' + daysTo(x.date) + ' يوم']); });
    n = items('post').filter(function (x) { return x.status === 'موافقة العميل'; }).length; if (n) a.push(['منشورات بانتظار موافقة العميل', String(n)]);
    return a;
  }
  function dashExtra() {
    var mon = monthOf(today()), dr = items('drone'), rq = items('request');
    return tile('الدرون هذا الشهر', dr.filter(function (x) { return monthOf(x.created || x.date || '') === mon; }).length + ' طلباً من 100', rows([['طلعات اليوم', String(dr.filter(function (x) { return x.date === today() && x.status !== 'منتهٍ'; }).length)], ['بانتظار التصريح', String(dr.filter(function (x) { return x.permit === 'بانتظار الموافقة' && x.status !== 'منتهٍ'; }).length)]]) + '<div class="acts"><a class="btn sm" href="#/m/drone">فتح الدرون</a></div>') +
      tile('صندوق الطلبات', rq.filter(function (x) { return x.status === 'جديد'; }).length + ' طلبات لم يُرد عليها', rows([['بانتظار العميل', String(rq.filter(function (x) { return x.status === 'بانتظار العميل'; }).length)], ['حُجز هذا الشهر', String(rq.filter(function (x) { return x.status === 'حُجز' && monthOf(x.date || '') === mon; }).length)]]) + '<div class="acts"><a class="btn sm" href="#/m/inbox">فتح الصندوق</a></div>');
  }
  function vReporter() {
    var t = today(), e = calEntries(), mv = db.moves.filter(live), td = mv.filter(function (m) { return m.date === t; });
    var morning = (e[t] || []).map(function (x) { return [h(x), 'اليوم']; });
    if (!db.rates[t]) morning.push(['سعر الصرف', 'لم يُدخل بعد']);
    var evening = [['المقبوض اليوم', L(usd(sum(td.filter(function (m) { return m.dir === 'in'; }), function (m) { return m.usd; })))], ['المصروف اليوم', L(usd(sum(td.filter(function (m) { return m.dir === 'out'; }), function (m) { return m.usd; })))], ['مهام أُنجزت اليوم', String(db.tasks.filter(function (x) { return x.done && x.done_at === t; }).length)], ['مهام متأخرة', String(db.tasks.filter(function (x) { return !x.done && x.due < t; }).length)]];
    var al = modAlerts(); db.debts.filter(function (d) { return !d.settled && d.due && daysTo(d.due) <= 7; }).forEach(function (d) { al.push([(d.dir === 'owe' ? 'دين عليّ: ' : 'دين لي: ') + h(d.party), daysTo(d.due) < 0 ? 'فات موعده' : 'خلال ' + daysTo(d.due) + ' يوم']); });
    db.clients.forEach(function (c) { var en = clientEnd(c); if (en && daysTo(en) >= 0 && daysTo(en) <= 30) al.push(['عقد ' + h(c.name) + ' ينتهي', 'خلال ' + daysTo(en) + ' يوم']); });
    var c = head('المراسل', 'ملخص اليوم من بيانات النظام');
    c += '<div class="tiles">' + tile('نشرة الصباح', morning.length + ' بنود اليوم', rows(morning), true) + tile('نشرة المساء', 'ما حدث اليوم', rows(evening), true) + tile('التنبيهات', al.length + ' تنبيهات', rows(al), true) + '</div>';
    c += '<p class="mu">المراسل يلخص ما سُجّل في النظام فقط. الإشعارات على الموبايل وسؤال المساعد بالعربية يحتاجان ربط خدمات خارجية، وهما خطوة قادمة.</p>';
    return shell(c);
  }

  /* ---------- الأحداث ---------- */
  function formVals(f) { var v = {}; Array.prototype.forEach.call(f.elements, function (e) { if (e.name) v[e.name] = e.value; }); return v; }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) { var mn = document.querySelector('details.menu[open]'); if (mn && !e.target.closest('details.menu')) mn.removeAttribute('open'); return; }
    var a = el.getAttribute('data-act'); if (!acts[a]) return;
    if (!isMgr() && ['close', 'theme', 'logout', 'retry', 'delPhoto', 'chPass'].indexOf(a) < 0) return;
    acts[a](el.dataset);
  });
  document.addEventListener('change', function (e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-chg'); if (!k) return;
    if (k === 'rate' && isMgr()) { var r = num(el.value); if (r > 0) { db.rates[today()] = r; toast('حُفظ سعر الصرف'); } else delete db.rates[today()]; save(); render(); }
    if (k === 'task') { var t = byId('tasks', el.dataset.id); if (t && (isMgr() || t.user_id === me().id)) { t.done = el.checked; t.done_at = el.checked ? today() : ''; save(); render(); } }
    if (k === 'istatus' && isMgr()) { var it = byId('items', el.dataset.id); if (it) { it.status = el.value; save(); render(); } }
    if (k === 'role' && isMgr()) { var c = byId('clients', el.dataset.id); c.roles = c.roles || {}; c.roles[el.dataset.role] = el.value; save(); render(); }
    if (k === 'photo' && el.files[0]) { var rd = new FileReader(); rd.onload = function () { var img = new Image(); img.onload = function () { var s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s; var m = Math.min(img.width, img.height); cv.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); me().photo = cv.toDataURL('image/jpeg', 0.85); save(); render(); toast('حُفظت الصورة'); }; img.src = rd.result; }; rd.readAsDataURL(el.files[0]); }
    if (k === 'restore' && isMgr() && el.files[0]) { var fr = new FileReader(); fr.onload = function () { try { var d = JSON.parse(fr.result); if (!d.users || !d.moves) throw 0; if (!confirm('استرجاع النسخة يستبدل كل البيانات الحالية. متابعة؟')) return; localStorage.setItem(KEY, JSON.stringify(d)); load(); render(); toast('تم الاسترجاع'); } catch (x) { toast('الملف غير صالح'); } }; fr.readAsText(el.files[0]); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target, kind = f.getAttribute('data-form'); if (!kind) return; e.preventDefault(); var v = formVals(f);
    if (kind === 'modal' && formCb) {
      Promise.resolve().then(function () { return formCb(v); }).then(function (res) { if (res && res.err) { document.getElementById('merr').textContent = res.err; return; } save(); closeForm(); render(); if (typeof res === 'string') toast(res); }, function (e) { var m = document.getElementById('merr'); if (m) m.textContent = e.message || 'حدث خطأ.'; });
    }
    if (kind === 'setup') {
      if (!ONLINE && db.users.length) return; var ph = normPhone(v.phone), er = document.getElementById('aerr');
      if (!ph) { er.textContent = 'أدخل رقم موبايل صحيحاً.'; return; } if (v.pass.length < 6) { er.textContent = 'كلمة السر 6 أحرف على الأقل.'; return; }
      if (ONLINE) {
        er.textContent = 'جارٍ إنشاء الحساب…';
        SRV.signUp(v.phone, v.pass, true).then(function () { return SRV.bootstrap(v.name.trim(), v.phone.trim()); }).then(function () { return SRV.pull(); }).then(function (d) { db = d; state.needSetup = false; location.hash = '#/'; render(); }, function (e) { var x = document.getElementById('aerr'); SRV.clear(); if (x) x.textContent = e.message; });
        return;
      }
      var salt = uid(); hash(v.pass, salt).then(function (hh) { var u = { id: uid(), name: v.name.trim(), phone: v.phone.trim(), role: 'manager', title: 'المدير', active: true, pass: hh, salt: salt }; db.users.push(u); save(); localStorage.setItem(SKEY, u.id); render(); });
    }
    if (kind === 'login') {
      if (ONLINE) {
        var ee = document.getElementById('aerr'); ee.textContent = 'جارٍ الدخول…';
        SRV.signIn(v.phone, v.pass).then(function () { return SRV.pull(); }).then(function (d) {
          db = d; if (!me()) { return SRV.signOut().then(function () { throw new Error('هذا الحساب غير مفعّل. راجع المدير.'); }); }
          location.hash = '#/'; render();
        }).catch(function (e) { var x = document.getElementById('aerr'); if (x) x.textContent = e.message; });
        return;
      }
      var u = db.users.filter(function (x) { return normPhone(x.phone) === normPhone(v.phone); })[0], er2 = document.getElementById('aerr');
      if (!u) { er2.textContent = 'الرقم أو كلمة السر غير صحيحة.'; return; }
      hash(v.pass, u.salt).then(function (hh) { if (hh !== u.pass) { er2.textContent = 'الرقم أو كلمة السر غير صحيحة.'; return; } if (u.active === false) { er2.textContent = 'هذا الحساب موقوف. راجع المدير.'; return; } localStorage.setItem(SKEY, u.id); location.hash = '#/'; render(); });
    }
    if (kind === 'profile') {
      var m = me(), ph2 = normPhone(v.phone);
      if (!v.name.trim() || !ph2) { document.getElementById('perr').textContent = 'الاسم ورقم التواصل مطلوبان.'; return; }
      if (db.users.some(function (x) { return x.id !== m.id && normPhone(x.phone) === ph2; })) { document.getElementById('perr').textContent = 'هذا الرقم مسجل لحساب آخر.'; return; }
      ['name', 'title', 'phone', 'email', 'city', 'insta', 'bio'].forEach(function (k) { m[k] = v[k].trim(); }); save(); render(); toast('حُفظ الملف');
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !document.getElementById('modal').hidden) closeForm(); });

  /* ---------- التشغيل ---------- */
  function render() {
    var app = document.getElementById('app'), r = route(), html;
    if (ONLINE && !state.ready) html = authCard('<h1>جارٍ التحميل…</h1>');
    else if (ONLINE && state.err) html = authCard('<h1>تعذر الاتصال</h1><p>' + h(state.err) + '</p>' + btn('إعادة المحاولة', 'retry', {}, 'pri'));
    else if (ONLINE && !SRV.hasSession()) html = state.needSetup ? vSetup() : vLogin();
    else if (ONLINE && !me()) html = authCard('<h1>الحساب غير مفعّل</h1><p>هذا الحساب لا يملك ملفاً في النظام أو تم إيقافه. راجع المدير.</p>' + btn('تسجيل الخروج', 'logout'));
    else if (!ONLINE && !db.users.length) html = vSetup();
    else if (!ONLINE && !me()) html = vLogin();
    else if (!isMgr()) { if (r !== '#/profile' && r !== '#/') { location.hash = '#/'; return; } html = r === '#/profile' ? vProfile() : vMember(); }
    else if (r === '#/clients') html = vClients();
    else if (r.indexOf('#/client/') === 0) html = vClient(r.slice(9));
    else if (r === '#/team') html = vTeam();
    else if (r === '#/tasks') html = vTasks();
    else if (r === '#/finance') html = vFinance();
    else if (r === '#/profile') html = vProfile();
    else if (r.indexOf('#/m/') === 0 && MODS[r.slice(4)]) html = vMod(r.slice(4));
    else if (r === '#/calendar') html = vCalendar();
    else if (r === '#/reports') html = vReports();
    else if (r === '#/reporter') html = vReporter();
    else if (r.indexOf('#/soon/') === 0) html = vSoon(decodeURIComponent(r.slice(7)));
    else html = vDash();
    var openTiles = Array.prototype.map.call(app.querySelectorAll('details.tile'), function (d) { return d.open; }), same = app.getAttribute('data-r') === r;
    app.innerHTML = html; app.setAttribute('data-r', r);
    if (same) Array.prototype.forEach.call(app.querySelectorAll('details.tile'), function (d, i) { if (openTiles[i] != null) d.open = openTiles[i]; });
    tick();
  }
  function tick() { var c = document.getElementById('clock'); if (c) { var d = new Date(); c.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()); } }
  function start() {
    if (localStorage.getItem(TKEY) === 'light') { document.body.classList.remove('t-dark'); document.body.classList.add('t-light'); }
    load(); if (ONLINE) boot(); else render(); setInterval(tick, 15000);
    if (ONLINE) {
      var soft = function () { var a = document.activeElement, typing = a && /INPUT|TEXTAREA|SELECT/.test(a.tagName); if (SRV.hasSession() && state.ready && document.getElementById('modal').hidden && !typing) SRV.idle().then(resync); };
      window.addEventListener('focus', soft); setInterval(soft, 120000);
    }
    window.addEventListener('hashchange', render);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(function () {});
  }
  window.SHAFQ = { render: render, db: function () { return db; } };
  start();
})();
