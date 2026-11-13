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
  var TITLES = ['مصور', 'مصور فوتوغرافي', 'مصمم', 'مونتير', 'كونتنت كريتر', 'كاتب محتوى', 'درون بايلوت', 'مدير إعلانات', 'فيلم ميكر', 'وجه إعلامي', 'موشن جرافيك', 'معلّق صوتي', 'مدير حسابات', 'مساعد تصوير'];
  var SERVICES = ['إدارة صفحة', 'إدارة إعلانات', 'تصوير', 'مونتاج', 'تصميم', 'وجه إعلامي', 'كتابة محتوى', 'درون', 'تغطية فعالية'];

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
  function resync() { return SRV.pull().then(function (d) { db = d; if (me() && me().role === 'client') pstate.data = null; render(); }).catch(function () { if (!SRV.hasSession()) render(); }); }
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
    var f = u && u.gender === 'f', msg = 'السلام عليكم ورحمة الله، كيف حالك ' + (f ? 'أستاذة ' : 'أستاذ ') + (u ? u.name : '') + '؟ حبيت أطمّن شو صار ' + (f ? 'معكِ' : 'معك') + ' بشغل ' + (what || 'المهام') + '. ' + (f ? 'يعطيكِ العافية.' : 'يعطيك العافية.');
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
    if (!isMgr()) { return out + MNAV.map(function (i) { return '<a href="' + i[1] + '" class="' + (base === i[1] ? 'on' : '') + '">' + i[0] + '</a>'; }).join('') + timeBox(); }
    NAV.forEach(function (g) {
      var has = g[1].some(function (i) { return i[1] && i[1] === base; }) || (r.indexOf('#/soon/') === 0 && g[1].some(function (i) { return '#/soon/' + encodeURIComponent(i[0]) === r; }));
      out += '<details' + (has || g[0] === 'الرئيسية' ? ' open' : '') + '><summary><span>' + g[0] + '</span>' + CHEV + '</summary><div class="items">';
      g[1].forEach(function (i) {
        var href = i[1] || '#/soon/' + encodeURIComponent(i[0]);
        out += '<a href="' + href + '" class="' + (href === base || href === r ? 'on' : '') + (i[1] ? '' : ' soon') + '">' + i[0] + '</a>';
      });
      out += '</div></details>';
    });
    return out + timeBox();
  }
  function timeBox() { return '<div class="timebox"><span class="clock" id="clock"></span><span>' + h(longDates()).replace(' · ', '</span><span>') + '</span></div>'; }
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
    var c = '<div class="head" style="border-bottom:1px solid var(--ln);padding-bottom:20px"><div><h1>' + greet() + '، ' + h(me().name) + '</h1></div></div>';
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
    var roles = normRoles(cl), rl = roleList();
    var rolesHtml = '<div class="rows">' + roles.map(function (r, i) {
      var u = byId('users', r.user);
      var sel = '<select aria-label="الشخص" data-chg="roleuser" data-id="' + h(id) + '" data-i="' + i + '" style="min-height:44px;background:var(--p2);border:1px solid var(--ln);border-radius:12px;padding:0 10px"><option value="">اختر الشخص</option>' + team.filter(function (x) { return x.role !== 'client'; }).map(function (x) { return '<option value="' + h(x.id) + '"' + (r.user === x.id ? ' selected' : '') + '>' + h(x.name) + '</option>'; }).join('') + '</select>';
      var nm = '<input aria-label="اسم الدور" list="dl_roles" autocomplete="off" placeholder="اسم الدور" data-chg="rolename" data-id="' + h(id) + '" data-i="' + i + '" value="' + h(r.role) + '" style="min-height:44px;width:150px;background:var(--p2);border:1px solid var(--ln);border-radius:12px;padding:0 10px">';
      return '<div><span class="acts">' + nm + sel + '</span><span class="acts">' + (u ? '<a class="btn sm" target="_blank" rel="noopener" href="' + h(waLink(u, cl.name)) + '">شو صار معك؟ · واتساب</a>' : '') + btn('حذف', 'delRole', { id: id, i: i }, 'sm') + '</span></div>';
    }).join('') + '</div><datalist id="dl_roles">' + rl.map(function (x) { return '<option value="' + h(x) + '">'; }).join('') + '</datalist>' + btn('+ إضافة دور', 'addRole', { id: id }, 'sm');
    var c = head(cl.name, (cl.kind === 'project' ? 'مشروع' : 'إدارة صفحات') + (e ? ' · ينتهي ' + dateAr(e) : ''), btn('تعديل', 'editClient', { id: id }) + clientLoginBtn(cl) + (ONLINE && clientUser(cl) ? btn('إرسال إشعار', 'sendNote', { client: id }) : '') + btn('+ حركة مالية', 'addMove', { client: id }, 'pri'));
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
        '<div class="acts"><a class="btn sm" target="_blank" rel="noopener" href="' + h(waLink(u)) + '">شو صار معك؟ · واتساب</a>' + btn('دفع له', 'addMove', { user: u.id }, 'sm') + (ONLINE ? btn('إرسال إشعار', 'sendNote', { uid: u.id }, 'sm') : '') + btn('تعديل', 'editMember', { id: u.id }, 'sm') + btn(u.active === false ? 'تفعيل' : 'إيقاف', 'toggleMember', { id: u.id }, 'sm') + '</div>');
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
      return '<tr class="' + (m.is_void ? 'done' : '') + '"><td>' + h(dateAr(m.date)) + '</td><td>' + h(m.cat) + (m.service ? ' · ' + h(m.service) : '') + (m.receipt ? ' · ' + h(m.receipt) : '') + (m.note ? ' · ' + h(m.note) : '') + who + (m.is_void ? ' · ملغاة' : '') + '</td><td>' + (m.cur === 'USD' ? '<span class="ltr">' + h(usd(m.amount)) + '</span>' : h(syp(m.amount)) + ' <span class="mu">@' + h(m.rate) + '</span>') + '</td><td><b class="ltr">' + (m.dir === 'in' ? '+' : '-') + h(usd(m.usd)) + '</b></td><td>' + (m.is_void ? btn('حذف نهائي', 'delMove', { id: m.id }, 'sm') : btn('إلغاء', 'voidMove', { id: m.id }, 'sm')) + '</td></tr>';
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
    c += '<section class="tile" style="padding:24px;grid-column:span 2;min-width:0"><form class="form" data-form="profile">' + f('name', 'الاسم') + f('title', 'الصفة أو العنوان') + '<div class="fld"><label for="p_gender">الجنس</label><select id="p_gender" name="gender"><option value="m"' + (u.gender !== 'f' ? ' selected' : '') + '>ذكر</option><option value="f"' + (u.gender === 'f' ? ' selected' : '') + '>أنثى</option></select></div>' + f('phone', 'رقم التواصل' + (ONLINE && u.login_phone ? ' (رقم الدخول: ' + u.login_phone + ')' : ''), 'tel') + f('email', 'الإيميل', 'email') + f('city', 'المدينة') + f('insta', 'حساب إنستغرام') + f('bio', 'نبذة', 'area', true) + '<div class="fld wide"><p class="err" id="perr"></p><div class="acts"><button class="btn pri" type="submit">حفظ التعديلات</button>' + btn('تغيير كلمة السر', 'chPass') + '</div></div></form></section></div>';
    c += pushTile();
    if (isMgr()) c += tile('بوابة العملاء', 'رقم الواتساب: ' + h(db.settings.shafq_phone || me().phone || 'غير محدد'), '<p class="mu">زر «شو صار معكم؟» عند المنشور المتأخر، وزر «تواصل مع شفق» في بوابة العميل، يفتحان واتساب على هذا الرقم.</p><div class="acts"><label for="shafqph" class="mu">رقم شفق</label><input id="shafqph" type="tel" data-chg="shafqph" value="' + h(db.settings.shafq_phone || me().phone || '') + '" style="min-height:44px;padding:0 16px;background:var(--p2);border:1px solid var(--ln);border-radius:999px"></div>');
    if (isMgr() && !ONLINE) c += tile('النسخ الاحتياطي', 'البيانات محفوظة على هذا الجهاز', '<p class="mu">في هذه النسخة البيانات محفوظة في متصفح هذا الجهاز فقط. نزّل نسخة احتياطية بانتظام.</p><div class="acts">' + btn('تنزيل نسخة احتياطية', 'backup') + '<label class="btn" for="restore">استرجاع نسخة</label><input id="restore" type="file" accept="application/json" data-chg="restore" hidden></div>');
    return shell(c);
  }

  function vSoon(name) { return shell(head(name, 'هذا القسم لم يُبنَ بعد', '') + '<p class="empty">القسم مصمم على لوحة التصميم، وسيُبنى في خطوة قادمة.</p>'); }

  function authCard(inner) { return '<div class="auth"><div class="card"><img class="lg-w" src="' + LOGO_W + '" alt="شعار شفق"><img class="lg-b" src="' + LOGO_B + '" alt="شعار شفق">' + inner + '</div></div>'; }
  function vSetup() { return authCard('<h1>إعداد نظام شفق</h1><p>أول دخول: أنشئ حساب المدير.</p><form class="fld" data-form="setup" style="gap:14px"><div class="fld"><label for="s_name">الاسم</label><input id="s_name" name="name" required></div><div class="fld"><label for="s_phone">رقم الموبايل</label><input id="s_phone" name="phone" type="tel" required></div><div class="fld"><label for="s_pass">كلمة السر</label><input id="s_pass" name="pass" type="password" minlength="6" required></div><p class="err" id="aerr"></p><button class="btn pri" type="submit">إنشاء الحساب والدخول</button></form>'); }
  function vLogin() { return authCard('<h1>تسجيل الدخول</h1><p>شفق ميديا · نظام إدارة الأعمال</p><form class="fld" data-form="login" style="gap:14px"><div class="fld"><label for="l_phone">رقم الموبايل</label><input id="l_phone" name="phone" type="tel" required></div><div class="fld"><label for="l_pass">كلمة السر</label><input id="l_pass" name="pass" type="password" required></div><p class="err" id="aerr"></p><button class="btn pri" type="submit">دخول</button></form><p>نسيت كلمة السر؟ اطلب من المدير إعادة تعيينها.</p>'); }

  /* ---------- النوافذ ---------- */
  var formCb = null;
  function openForm(title, fields, cb, note, okLabel) {
    formCb = cb;
    var out = '<div class="dlg" role="dialog" aria-modal="true" aria-label="' + h(title) + '"><h2>' + h(title) + '</h2>' + (note ? (note.html ? '<div class="mu">' + note.html + '</div>' : '<p class="mu">' + h(note) + '</p>') : '') + '<form class="form" data-form="modal">';
    fields.forEach(function (f) {
      var id = 'm_' + f.k, el;
      if (f.type === 'select') el = '<select id="' + id + '" name="' + f.k + '">' + f.options.map(function (o) { return '<option value="' + h(o[0]) + '"' + (String(f.value) === String(o[0]) ? ' selected' : '') + '>' + h(o[1]) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'area') el = '<textarea id="' + id + '" name="' + f.k + '">' + h(f.value) + '</textarea>';
      else el = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + h(f.value == null ? '' : f.value) + '"' + (f.req ? ' required' : '') + (f.ph ? ' placeholder="' + h(f.ph) + '"' : '') + (f.type === 'number' ? ' step="any" min="0" inputmode="decimal"' : '') + (f.list ? ' list="dl_' + f.k + '" autocomplete="off"' : '') + '>' + (f.list ? '<datalist id="dl_' + f.k + '">' + f.list.map(function (o) { return '<option value="' + h(o) + '">'; }).join('') + '</datalist>' : '');
      out += '<div class="fld' + (f.wide ? ' wide' : '') + '"><label for="' + id + '">' + h(f.label) + '</label>' + el + '</div>';
    });
    out += '<div class="fld wide"><p class="err" id="merr"></p><div class="acts"><button class="btn pri" type="submit">' + h(okLabel || 'حفظ') + '</button>' + btn('إلغاء', 'close') + '</div></div></form></div>';
    var m = document.getElementById('modal'); m.innerHTML = out; m.hidden = false;
    var first = m.querySelector('input,select,textarea'); if (first) first.focus();
  }
  function closeForm() { var m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; formCb = null; }
  function memberOpts(none) { return (none ? [['', none]] : []).concat(db.users.filter(function (u) { return u.active !== false && u.role !== 'client'; }).map(function (u) { return [u.id, u.name]; })); }
  function titleList() { var o = {}; TITLES.concat(db.users.map(function (u) { return u.title; })).concat(roleList(true)).forEach(function (t) { if (t) o[t] = 1; }); return Object.keys(o); }
  function roleList(raw) { var o = {}; db.clients.forEach(function (c) { normRoles(c).forEach(function (r) { if (r.role) o[r.role] = 1; }); }); return raw ? Object.keys(o) : TITLES.concat(Object.keys(o)).filter(function (x, i, a) { return a.indexOf(x) === i; }); }
  function serviceList() { var o = {}; SERVICES.concat(db.settings.services || []).concat(db.moves.map(function (m) { return m.service; })).forEach(function (t) { if (t) o[t] = 1; }); return Object.keys(o); }
  function normRoles(c) { if (Array.isArray(c.roles)) return c.roles; var out = []; var r = c.roles || {}; ROLES.forEach(function (x) { if (r[x[0]]) out.push({ role: x[1], user: r[x[0]] }); }); return out; }
  function clientOpts() { return [['', 'عام (بدون عميل)']].concat(db.clients.map(function (c) { return [c.id, c.name]; })); }

  var acts = {
    close: closeForm,
    theme: function () { var l = document.body.classList.toggle('t-light'); document.body.classList.toggle('t-dark', !l); localStorage.setItem(TKEY, l ? 'light' : 'dark'); render(); },
    logout: function () { pstate.data = null; pstate.month = ''; if (ONLINE) { SRV.idle().then(pushOff).then(function () { return SRV.signOut(); }).then(function () { db = blank(); location.hash = '#/'; checkSetup(); }); return; } localStorage.removeItem(SKEY); location.hash = '#/'; render(); },
    retry: function () { boot(); },
    addClient: function () { clientForm(null); },
    editClient: function (d) { clientForm(byId('clients', d.id)); },
    addMember: function () { memberForm(null); },
    editMember: function (d) { memberForm(byId('users', d.id)); },
    toggleMember: function (d) { var u = byId('users', d.id); u.active = u.active === false; save(); render(); toast(u.active ? 'تم التفعيل' : 'تم الإيقاف'); },
    addTask: function (d) {
      openForm('مهمة جديدة', [{ k: 'title', label: 'المهمة', req: true, wide: true }, { k: 'user_id', label: 'لمن', type: 'select', options: memberOpts(), value: me().id }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts(), value: d.client || '' }, { k: 'due', label: 'موعد التسليم', type: 'date', value: today(), req: true }], function (v) {
        db.tasks.push({ id: uid(), title: v.title.trim(), user_id: v.user_id, client_id: v.client_id, client_name: v.client_id ? clientName(v.client_id) : '', due: v.due, done: false, done_at: '' });
        if (v.user_id && v.user_id !== me().id) notify([{ to: [v.user_id], title: 'مهمة جديدة 📋', body: v.title.trim() + ' · التسليم ' + dateAr(v.due), tag: 'task' }]);
        return 'أُضيفت المهمة';
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
        { k: 'user_id', label: 'عضو الفريق', type: 'select', options: memberOpts('لا أحد'), value: d.user || '' }, { k: 'item_id', label: 'مربوط بمشروع أو طلب درون', type: 'select', options: itemOpts(), value: d.item || '' }, { k: 'service', label: 'عن شو', ph: 'اختر أو اكتب خدمة جديدة', list: serviceList() }, { k: 'note', label: 'ملاحظة داخلية (لا تظهر للعميل)', wide: true }
      ], function (v) {
        var amt = num(v.amount); if (amt <= 0) return { err: 'أدخل مبلغاً أكبر من صفر.' };
        if (CATS_IN.indexOf(v.cat) >= 0 && v.dir !== 'in') return { err: 'هذا التصنيف للقبض. غيّر النوع أو التصنيف.' };
        if (CATS_OUT.indexOf(v.cat) >= 0 && v.dir !== 'out') return { err: 'هذا التصنيف للدفع. غيّر النوع أو التصنيف.' };
        var rate = 1;
        if (v.cur === 'SYP') { rate = db.rates[v.date] || (lastRate() || {}).rate; if (!rate) return { err: 'أدخل سعر الصرف من أعلى الشاشة أولاً.' }; }
        var svc = (v.service || '').trim(), mid = uid(), rcv = '';
        if (svc && serviceList().indexOf(svc) < 0) { db.settings.services = (db.settings.services || []).concat([svc]); }
        if (v.dir === 'in' && v.client_id) { rcv = nextNo('RCV', v.date); db.items.push({ id: uid(), kind: 'paper', status: 'سارية', created: today(), code: 'RCV', no: rcv, name: clientName(v.client_id), amount: amt, cur: v.cur, date: v.date, move_id: mid, notes: svc }); }
        db.moves.push({ id: mid, date: v.date, dir: v.dir, cat: v.cat, amount: amt, cur: v.cur, rate: rate, usd: v.cur === 'USD' ? amt : amt / rate, note: v.note.trim(), service: svc, receipt: rcv, client_id: v.client_id, user_id: v.user_id, item_id: v.item_id || '', created_by: me().id, is_void: false });
        if (v.dir === 'in' && v.client_id) notify([{ to: { client: v.client_id }, title: 'وصلتنا دفعتكم 🙏', body: amountTxt(amt, v.cur) + (svc ? ' عن ' + svc : '') + (rcv ? ' · وصل ' + rcv : '') + '. شكراً لثقتكم', tag: 'pay' }]);
        if (v.dir === 'out' && v.user_id && v.user_id !== me().id) { var pu = byId('users', v.user_id) || {}; notify([{ to: [v.user_id], title: 'سجّلنا دفعة ' + (pu.gender === 'f' ? 'إلكِ' : 'إلك') + ' 💸', body: amountTxt(amt, v.cur) + (v.note.trim() ? ' · ' + v.note.trim() : ''), tag: 'pay' }]); }
        return rcv ? 'سُجّلت الدفعة · وصل ' + rcv : 'سُجّلت الحركة';
      }, 'الحركة بالليرة تُحوَّل إلى الدولار بسعر يومها، ويُحفظ السعر معها.');
    },
    voidMove: function (d) { if (!confirm('إلغاء الحركة؟ تبقى في السجل ولا تُحسب.')) return; var mv0 = byId('moves', d.id); mv0.is_void = true; db.items.forEach(function (p) { if (p.kind === 'paper' && p.move_id === mv0.id) p.status = 'ملغاة'; }); save(); render(); toast('أُلغيت الحركة'); },
    addRole: function (d) { var c = byId('clients', d.id); c.roles = normRoles(c).concat([{ role: '', user: '' }]); save(); render(); },
    delRole: function (d) { var c = byId('clients', d.id), rs = normRoles(c).slice(); rs.splice(+d.i, 1); c.roles = rs; save(); render(); },
    clientLogin: function (d) { clientLoginForm(byId('clients', d.id)); },
    toggleClientLogin: function (d) { var u = byId('users', d.uid); u.active = u.active === false; save(); render(); toast(u.active ? 'فُعّل دخول العميل' : 'أُوقف دخول العميل'); },
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
      if (c.id) { Object.assign(c, o); db.tasks.forEach(function (t) { if (t.client_id === c.id) t.client_name = o.name; }); } else { o.id = uid(); o.roles = [{ role: '', user: '' }]; db.clients.push(o); }
      return 'حُفظ العميل';
    });
  }
  function memberForm(u) {
    var edit = !!u; u = u || {};
    var fields = [{ k: 'name', label: 'الاسم', req: true, value: u.name }, { k: 'title', label: 'الصفة', ph: 'اختر أو اكتب صفة جديدة', value: u.title, list: titleList() }, { k: 'gender', label: 'الجنس', type: 'select', options: [['m', 'ذكر'], ['f', 'أنثى']], value: u.gender || 'm' }, { k: 'phone', label: 'رقم الموبايل', type: 'tel', req: true, value: u.phone }, { k: 'kind', label: 'نوع العقد', type: 'select', options: [['freelancer', 'فريلانسر'], ['employee', 'موظف']], value: u.kind || 'freelancer' }, { k: 'contract', label: 'قيمة العقد بالدولار', type: 'number', value: u.contract }, { k: 'pass', label: edit ? 'كلمة سر جديدة (اتركها فارغة للإبقاء)' : 'كلمة سر مؤقتة', type: 'password', req: !edit }];
    if (ONLINE && edit) fields.pop();
    openForm(edit ? 'تعديل العضو' : 'عضو جديد', fields, function (v) {
      var ph = normPhone(v.phone); if (!ph) return { err: 'أدخل رقم موبايل صحيحاً.' };
      if (db.users.some(function (x) { return x.id !== u.id && (normPhone(x.phone) === ph || (!edit && normPhone(x.login_phone) === ph)); })) return { err: 'هذا الرقم مسجل لعضو آخر.' };
      if (v.pass && v.pass.length < 6) return { err: 'كلمة السر 6 أحرف على الأقل.' };
      var o = { name: v.name.trim(), title: v.title.trim(), gender: v.gender, phone: v.phone.trim(), kind: v.kind, contract: num(v.contract) };
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
      fields: function () { return [{ k: 'name', label: 'عنوان المنشور', req: true }, { k: 'client_id', label: 'العميل', type: 'select', options: clientOpts() }, { k: 'type', label: 'النوع', type: 'select', options: sel(['بوست', 'ريل', 'كاروسيل', 'ستوري', 'منشور الجمعة']) }, { k: 'owner', label: 'المسؤول', type: 'select', options: memberOpts('غير محدد') }, { k: 'date', label: 'موعد النشر', type: 'date' }, { k: 'time', label: 'ساعة النشر', type: 'time' }, { k: 'notes', label: 'ملاحظات', type: 'area', wide: true }]; },
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
    var c = head(m.title, m.sub, (key === 'content' ? btn('تحميل قالب إكسل', 'xlTemplate') + '<label class="btn" for="xlfile">رفع ملف إكسل</label><input id="xlfile" type="file" accept=".xlsx" data-chg="xlfile" hidden>' : '') + btn(m.add, 'addItem', { mod: key }, 'pri'));
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
    lead2client: function (d) { var l = byId('items', d.id); if (!confirm('تحويل «' + l.name + '» إلى عميل؟')) return; db.clients.push({ id: uid(), name: l.name, kind: 'page', value: num(l.value), months: 0, start_date: today(), notes: l.notes || '', roles: [{ role: '', user: '' }] }); l.status = 'صار عميلاً'; save(); render(); toast('صار عميلاً'); },
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


  /* ---------- بوابة العميل ---------- */
  function clientUser(cl) { return db.users.filter(function (u) { return u.role === 'client' && u.client_id === cl.id; })[0]; }
  function clientLoginBtn(cl) { var u = clientUser(cl); return u ? btn(u.active === false ? 'تفعيل دخول العميل' : 'إيقاف دخول العميل', 'toggleClientLogin', { uid: u.id }) : btn('إنشاء دخول للعميل', 'clientLogin', { id: cl.id }); }
  function clientLoginForm(cl) {
    openForm('دخول العميل: ' + cl.name, [{ k: 'phone', label: 'رقم موبايل العميل (اسم المستخدم)', type: 'tel', req: true }, { k: 'pass', label: 'كلمة السر', type: 'password', req: true }], function (v) {
      var ph = normPhone(v.phone); if (!ph) return { err: 'أدخل رقم موبايل صحيحاً.' };
      if (v.pass.length < 6) return { err: 'كلمة السر 6 أحرف على الأقل.' };
      if (db.users.some(function (x) { return normPhone(x.phone) === ph || normPhone(x.login_phone) === ph; })) return { err: 'هذا الرقم مسجل لحساب آخر.' };
      var o = { role: 'client', client_id: cl.id, name: cl.name, title: 'عميل', phone: v.phone.trim(), login_phone: ph, active: true, kind: '', contract: 0 };
      if (ONLINE) return SRV.signUp(v.phone, v.pass, false).then(function (id) { db.users.push(Object.assign({ id: id }, o)); return 'أُنشئ دخول العميل'; });
      var salt = uid(); return hash(v.pass, salt).then(function (hh) { db.users.push(Object.assign({ id: uid(), pass: hh, salt: salt }, o)); return 'أُنشئ دخول العميل'; });
    }, 'العميل يدخل من رابط النظام نفسه برقمه وكلمة السر، ويرى بوابته فقط: خطة النشر وحسابه ودفعاته.');
  }
  function portalLocal(cid) {
    var c = byId('clients', cid) || {};
    return { client: { name: c.name, kind: c.kind, value: c.value, months: c.months, start_date: c.start_date },
      payments: db.moves.filter(function (m) { return live(m) && m.client_id === cid && m.dir === 'in'; }).map(function (m) { return { date: m.date, service: m.service, usd: m.usd, amount: m.amount, cur: m.cur, receipt: m.receipt }; }),
      posts: db.items.filter(function (x) { return x.kind === 'post' && x.client_id === cid; }).map(function (x) { return { name: x.name, type: x.type, date: x.date, time: x.time, status: x.status }; }),
      phone: db.settings.shafq_phone || (db.users.filter(function (u) { return u.role === 'manager'; })[0] || {}).phone || '' };
  }
  var pstate = { data: null, loading: false, err: '', month: '' };
  function portalData() {
    if (!ONLINE) return portalLocal(me().client_id);
    if (!pstate.data && !pstate.loading) {
      pstate.loading = true; pstate.err = '';
      SRV.rpc('client_portal').then(function (d) { pstate.data = d; }, function (e) { pstate.err = e.message; }).then(function () { pstate.loading = false; render(); });
    }
    return pstate.data;
  }
  function postState(p, now) {
    if (p.status === 'منشور') return ['done', 'نزل'];
    var due = p.date ? new Date(p.date + 'T' + (p.time || '23:59') + ':00') : null;
    if (due && due < now) { var dd = Math.floor((now - due) / 86400000); return ['late', dd >= 1 ? 'متأخر ' + (dd === 1 ? 'يوم' : dd === 2 ? 'يومين' : dd + ' أيام') : 'متأخر']; }
    if (p.status === 'مجدول') return ['ready', 'جاهز للنشر'];
    return ['plan', 'قيد التحضير'];
  }
  function schedule(cl, paid) {
    var v = num(cl.value), n = cl.kind === 'project' ? 1 : num(cl.months), start = cl.start_date || today(), rows = [], left = paid;
    for (var i = 0; i < n; i++) { var due = addMonths(start, i), cov = Math.min(v, left); left -= cov; if (cov < v - 0.005) rows.push({ date: due, usd: v - cov }); }
    return rows;
  }
  function vPortal() {
    var d = portalData(), now = new Date(), t = today();
    var top = '<div class="ptop"><div class="brand"><img class="lg-w" src="' + LOGO_W + '" alt="شعار شفق"><img class="lg-b" src="' + LOGO_B + '" alt="شعار شفق"><div><b>شفق ميديا</b><span>بوابة العميل</span></div></div><div class="acts">' + btn(document.body.classList.contains('t-light') ? 'الثيم الغامق' : 'الثيم الفاتح', 'theme') + btn('تسجيل الخروج', 'logout') + '</div></div>';
    if (!d) return '<div class="portal">' + top + (pstate.err ? '<p class="warn">تعذر تحميل البوابة: ' + h(pstate.err) + '</p>' + btn('إعادة المحاولة', 'portalRefresh', {}, 'pri') : '<p class="empty">جارٍ التحميل…</p>') + '</div>';
    var cl = d.client || {}, ym = pstate.month || t.slice(0, 7), mname;
    try { mname = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { month: 'long', year: 'numeric' }).format(new Date(ym + '-15T12:00:00')); } catch (x) { mname = ym; }
    var c = top + pushBanner() + '<div class="hello"><h1>' + greet() + '، ' + h(cl.name || '') + '</h1><p class="mu">' + h(longDates()) + '</p></div>';
    // plan
    var posts = (d.posts || []).filter(function (p) { return (p.date || '').slice(0, 7) === ym; }).sort(function (a, b) { return ((a.date || '') + (a.time || '')) < ((b.date || '') + (b.time || '')) ? -1 : 1; });
    var done = posts.filter(function (p) { return p.status === 'منشور'; }).length, types = {};
    posts.forEach(function (p) { var k = p.type || 'منشور'; types[k] = types[k] || [0, 0]; types[k][1]++; if (p.status === 'منشور') types[k][0]++; });
    c += '<div class="head"><div><h1 style="font-size:26px">خطة النشر الشهرية</h1><p>' + h(mname) + ' · نزل ' + done + ' من ' + posts.length + '</p></div><div class="acts">' + btn('الشهر السابق', 'portalMonth', { d: -1 }) + btn('الشهر التالي', 'portalMonth', { d: 1 }) + '</div></div>';
    if (posts.length) c += '<div class="tile" style="padding:16px 20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:16px">' + Object.keys(types).map(function (k) { var x = types[k]; return '<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span>' + h(k) + '</span><span class="mu">' + x[0] + ' من ' + x[1] + '</span></div><div class="bar"><i style="width:' + Math.round(x[0] / x[1] * 100) + '%"></i></div></div>'; }).join('') + '</div>';
    var last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), weeks = [[1, 7], [8, 14], [15, 21], [22, last]], names = ['الأول', 'الثاني', 'الثالث', 'الرابع'], phone = d.phone;
    weeks.forEach(function (w, i) {
      var wp = posts.filter(function (p) { var dd = +p.date.slice(8, 10); return dd >= w[0] && dd <= w[1]; }), isNow = t.slice(0, 7) === ym && +t.slice(8, 10) >= w[0] && +t.slice(8, 10) <= w[1];
      var late = wp.filter(function (p) { return postState(p, now)[0] === 'late'; }).length, wd = wp.filter(function (p) { return p.status === 'منشور'; }).length;
      var summ = wp.length ? wp.length + ' منشورات · نزل ' + wd + (late ? ' · متأخر ' + late : '') : 'لا منشورات';
      var body = wp.length ? wp.map(function (p) {
        var st = postState(p, now), dt = new Date(p.date + 'T12:00:00'), dn;
        try { dn = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { weekday: 'long', day: 'numeric' }).format(dt); } catch (x) { dn = p.date; }
        var rel = p.date === t ? ' · اليوم' : p.date === addDays(t, 1) ? ' · بكرة' : p.date === addDays(t, 2) ? ' · بعد بكرة' : '';
        var wa = st[0] === 'late' && phone ? '<a class="btn sm wa" target="_blank" rel="noopener" href="' + h(waTo(phone, 'السلام عليكم، معكم ' + (cl.name || '') + '. شو صار بمنشور «' + (p.name || '') + '» اللي كان موعده ' + dateAr(p.date) + (p.time ? ' الساعة ' + p.time : '') + '؟')) + '">شو صار معكم؟ · واتساب</a>' : '';
        return '<div class="post ' + st[0] + '"><div><b>' + h(dn) + '</b><span class="mu">' + h(p.time || '') + rel + '</span></div><span class="type">' + h(p.type || 'منشور') + '</span><span>' + h(p.name || '') + '</span><span class="st ' + st[0] + '">' + h(st[1]) + '</span><span class="pact">' + wa + '</span></div>';
      }).join('') : '<p class="empty">لا منشورات مخططة هذا الأسبوع.</p>';
      c += '<details class="tile week' + (isNow ? ' now' : '') + '"' + (isNow ? ' open' : '') + '><summary><div><h2>الأسبوع ' + names[i] + ' · ' + w[0] + ' إلى ' + w[1] + '</h2><span>' + summ + (isNow ? ' · هذا الأسبوع' : '') + '</span></div>' + CHEV + '</summary><div class="body">' + body + '</div></details>';
    });
    // account
    var pays = (d.payments || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }), paid = sum(pays, function (p) { return num(p.usd); });
    var n = cl.kind === 'project' ? 1 : num(cl.months), total = num(cl.value) * (n || 1), sch = schedule(cl, paid), next = sch[0];
    c += '<div class="head"><div><h1 style="font-size:26px">حسابك</h1></div></div><div class="kpis">' + kpi('قيمة العقد', usd(total), false, cl.kind === 'project' ? 'للمشروع' : (n ? usd(num(cl.value)) + ' شهرياً × ' + n + ' أشهر' : 'شهرياً')) + kpi('المدفوع', usd(paid), false, pays.length + ' دفعات') + kpi('الباقي', usd(Math.max(0, total - paid)), false, sch.length ? sch.length + ' دفعات' : 'لا شيء') + kpi('الدفعة الجاية', next ? dateAr(next.date) : 'لا يوجد', true, next ? usd(next.usd) + (daysTo(next.date) > 0 ? ' · بعد ' + daysTo(next.date) + ' يوم' : daysTo(next.date) === 0 ? ' · اليوم' : ' · متأخرة') : 'الحساب مسدد') + '</div>';
    // payments table
    var tr = pays.map(function (p) { return '<tr><td>' + h(dateAr(p.date)) + '</td><td>' + (p.service ? '<span class="type">' + h(p.service) + '</span>' : '<span class="mu">—</span>') + '</td><td>' + (p.cur === 'SYP' ? h(syp(num(p.amount))) + ' <span class="mu">(<span class="ltr">' + h(usd(num(p.usd))) + '</span>)</span>' : '<span class="ltr">' + h(usd(num(p.usd))) + '</span>') + '</td><td><span class="ltr">' + h(p.receipt || '—') + '</span></td><td><b class="paid">مدفوعة</b></td></tr>'; }).join('') +
      sch.map(function (s0) { return '<tr><td>' + h(dateAr(s0.date)) + '</td><td><span class="mu">—</span></td><td><span class="ltr">' + h(usd(s0.usd)) + '</span></td><td><span class="mu">—</span></td><td><b class="due">' + (daysTo(s0.date) < 0 ? 'متأخرة' : 'مستحقة') + '</b></td></tr>'; }).join('');
    c += tile('الدفعات', pays.length + ' مدفوعة · ' + sch.length + ' مستحقة', tr ? '<div class="tbl"><table><thead><tr><th>التاريخ</th><th>عن شو</th><th>المبلغ</th><th>رقم الوصل</th><th>الحالة</th></tr></thead><tbody>' + tr + '</tbody></table></div>' : '<p class="empty">لا دفعات بعد.</p>', true);
    c += '<div class="foot">' + (phone ? '<a class="btn pri" target="_blank" rel="noopener" href="' + h(waTo(phone, 'السلام عليكم، معكم ' + (cl.name || '') + '.')) + '">تواصل مع شفق · واتساب</a>' : '') + '<span class="mu">شفق ميديا</span></div>';
    return '<div class="portal">' + c + '</div>';
  }
  Object.assign(acts, {
    portalMonth: function (d) { pstate.month = addMonths((pstate.month || today().slice(0, 7)) + '-15', +d.d).slice(0, 7); render(); },
    portalRefresh: function () { pstate.data = null; render(); }
  });


  /* ---------- إشعارات الجوال ---------- */
  var PUSH_KEY = CFG.pushKey || '', pushSynced = false;
  function isIOS() { return /iPhone|iPad|iPod/.test(navigator.userAgent); }
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function pushOK() { return ONLINE && !!PUSH_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
  function pushStatus() {
    if (!ONLINE || !PUSH_KEY) return 'off';
    if (isIOS() && !standalone()) return 'ios';
    if (!pushOK()) return 'unsupported';
    return Notification.permission; // default | granted | denied
  }
  function keyBytes(b) { b = b.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; var r = atob(b), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function pushSub(create) {
    return swReg().then(function (reg) {
      return reg.pushManager.getSubscription().then(function (s) { return s || (create ? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) }) : null); });
    }).then(function (s) { if (!s) return null; var j = s.toJSON(); return SRV.rpc('save_push_sub', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }).then(function () { return s; }); });
  }
  function swReg() { return navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) return reg; return navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }); }); }
  function pushSync() { if (pushSynced || pushStatus() !== 'granted') return; pushSynced = true; pushSub(true).catch(function () { pushSynced = false; }); }
  function pushOff() {
    pushSynced = false;
    if (!pushOK() || !SRV.hasSession()) return Promise.resolve();
    return navigator.serviceWorker.getRegistration().then(function (reg) { return reg ? reg.pushManager.getSubscription() : null; }).then(function (s) {
      if (!s) return; return SRV.rpc('delete_push_sub', { p_endpoint: s.endpoint }).catch(function () {}).then(function () { return s.unsubscribe(); });
    }).catch(function () {});
  }
  function pushBanner() {
    var st = pushStatus();
    try { if (localStorage.getItem('shafq_push_later') === today()) return ''; } catch (e) {}
    if (st === 'default') return '<div class="pushbar"><span>🔔 فعّل الإشعارات لتوصلك المهام والدفعات وتحية الصبح والمسا على جهازك.</span><span class="acts">' + btn('تفعيل الإشعارات', 'pushOn', {}, 'pri') + btn('لاحقاً', 'pushLater') + '</span></div>';
    if (st === 'ios') return '<div class="pushbar"><span>🔔 على الآيفون: من زر المشاركة اختر «إضافة إلى الشاشة الرئيسية»، وافتح النظام من الأيقونة لتقدر تفعّل الإشعارات.</span><span class="acts">' + btn('تمام', 'pushLater') + '</span></div>';
    return '';
  }
  function pushTile() {
    var st = pushStatus(), txt = { granted: 'مفعّلة على هذا الجهاز ✓', 'default': 'غير مفعّلة على هذا الجهاز', denied: 'محظورة من المتصفح. افتح إعدادات الموقع (القفل جنب الرابط) واسمح بالإشعارات.', ios: 'على الآيفون لازم تضيف النظام للشاشة الرئيسية أولاً، وتفتحه من الأيقونة.', unsupported: 'هذا المتصفح لا يدعم الإشعارات. جرّب كروم.', off: 'الإشعارات تشتغل بعد ربط النظام بالسيرفر.' }[st];
    return tile('الإشعارات', txt, '<p class="mu">بتوصلك إشعارات المهام والدفعات والمنشورات، وتحية الصبح والمسا باسمك.</p><div class="acts">' + (st === 'default' ? btn('تفعيل الإشعارات', 'pushOn', {}, 'pri') : '') + (st === 'granted' ? btn('إرسال إشعار تجريبي', 'pushTest', {}, 'pri') : '') + '</div>');
  }
  function notify(items) { if (ONLINE && SRV.notify) SRV.notify(items); }
  function amountTxt(amt, cur) { return cur === 'USD' ? usd(amt) : syp(amt); }
  Object.assign(acts, {
    pushOn: function () {
      if (pushStatus() !== 'default') { render(); return; }
      Notification.requestPermission().then(function (p) {
        if (p !== 'granted') { toast('ما انسمح بالإشعارات'); render(); return; }
        return pushSub(true).then(function () { pushSynced = true; toast('تفعّلت الإشعارات 🔔'); render(); });
      }).catch(function (e) { toast('تعذر تفعيل الإشعارات: ' + (e && e.message || e)); render(); });
    },
    pushLater: function () { try { localStorage.setItem('shafq_push_later', today()); } catch (e) {} render(); },
    pushTest: function () { pushSub(true).then(function () { return SRV.notify([{ to: [me().id], title: 'أهلاً ' + (me().gender === 'f' ? 'أستاذة ' : 'أستاذ ') + me().name + ' 🔔', body: 'الإشعارات شغالة على هذا الجهاز.' }]); }).then(function (r) { toast(r && r.sent ? 'انبعت الإشعار' : 'ما وصل شي. تأكد إنه دالة الإشعارات منشورة بـ Supabase.'); }, function (e) { toast('تعذر الإرسال: ' + e.message); }); }
  });


  /* ---------- إرسال إشعار يدوي برسائل جاهزة ---------- */
  function notePresets(u, cl) {
    var f = u && u.gender === 'f', sr = (f ? 'أستاذة ' : 'أستاذ ') + (u ? u.name : ''), k = f ? 'كِ' : 'ك';
    if (cl) {
      var paid = sum(db.moves.filter(function (m) { return live(m) && m.client_id === cl.id && m.dir === 'in'; }), function (m) { return m.usd; }), nx = schedule(cl, paid)[0];
      return [
        ['what', 'شو صار معكم؟', 'شو صار معكم؟ 👀', 'السلام عليكم ' + sr + '، حبينا نطمّن عليكم ونشوف إذا في شي بدكم ياه منا.'],
        ['due', 'تذكير بالدفعة الجاية', 'تذكير بالدفعة 🗓️', sr + '، تذكير لطيف: الدفعة الجاية' + (nx ? ' بتاريخ ' + dateAr(nx.date) + ' بقيمة ' + usd(nx.usd) : '') + '. شكراً لتعاونكم.'],
        ['got', 'وصلتنا دفعتكم', 'وصلتنا دفعتكم 🙏', sr + '، وصلتنا الدفعة، شكراً لثقتكم.'],
        ['approve', 'محتوى بانتظار موافقتكم', 'بانتظار موافقتكم ✍️', sr + '، في محتوى جاهز وبانتظار موافقتكم. فوتوا على البوابة وشوفوه.'],
        ['plan', 'خطة الشهر جاهزة', 'خطة النشر جاهزة 📅', sr + '، خطة النشر لهالشهر صارت جاهزة على البوابة.']
      ];
    }
    return [
      ['what', 'شو صار مع' + k + '؟', 'شو صار مع' + k + '؟ 👀', 'السلام عليكم ' + sr + '، حبيت أطمّن شو صار مع' + k + ' بالشغل. يعطي' + k + ' العافية.'],
      ['paid', 'وصل' + k + ' الدفع؟', 'وصل' + k + ' الدفع؟ 💸', sr + '، سجّلنا دفعة إل' + k + '. طمّني إذا وصلت' + k + '.'],
      ['task', 'عند' + k + ' مهمة جديدة', 'مهمة جديدة 📋', sr + '، في مهمة جديدة إل' + k + ' على النظام، فوت' + (f ? 'ي' : '') + ' شوفها.'],
      ['due', 'تذكير بموعد التسليم', 'تذكير بالتسليم ⏰', sr + '، تذكير بموعد تسليم مهام' + k + '. إذا في شي معطّل' + k + ' خبّرني.'],
      ['thanks', 'يعطي' + k + ' العافية', 'يعطي' + k + ' العافية 🌟', sr + '، شكراً على شغل' + k + '، يعطي' + k + ' العافية.']
    ];
  }
  function sendNoteForm(u, cl) {
    var ps = notePresets(u, cl), to = cl ? { client: cl.id } : [u.id];
    openForm('إرسال إشعار إلى ' + (cl ? cl.name : u.name), [
      { k: 'kind', label: 'الرسالة', type: 'select', options: ps.map(function (p) { return [p[0], p[1]]; }).concat([['other', 'رسالة أخرى…']]), value: ps[0][0], wide: true },
      { k: 'text', label: 'نص الإشعار (فيك تعدّله)', type: 'area', value: ps[0][3], wide: true, req: true }
    ], function (v) {
      var p = ps.filter(function (x) { return x[0] === v.kind; })[0], body = String(v.text || '').trim();
      if (!body) return { err: 'اكتب نص الرسالة.' };
      return SRV.notify([{ to: to, title: p ? p[2] : 'رسالة من شفق ميديا 💬', body: body, tag: 'note' }]).then(function (r) {
        if (r && r.sent) return 'انبعت الإشعار ✓';
        return { err: r ? 'ما وصل: ' + (cl ? 'العميل' : (u.gender === 'f' ? 'هي' : 'هو')) + ' لسا ما فعّل الإشعارات على جهازه. فيك تبعتله واتساب بدالها.' : 'تعذر الإرسال. تأكد من الإنترنت ومن دالة push.' };
      });
    }, 'الإشعار بيوصل على جهاز الشخص إذا كان مفعّل الإشعارات.');
    var sel = document.getElementById('m_kind'), ta = document.getElementById('m_text');
    if (sel && ta) sel.addEventListener('change', function () { var p = ps.filter(function (x) { return x[0] === sel.value; })[0]; ta.value = p ? p[3] : ''; if (!p) ta.focus(); });
  }
  Object.assign(acts, {
    sendNote: function (d) {
      if (d.client) { var cl = byId('clients', d.client); return sendNoteForm(clientUser(cl), cl); }
      sendNoteForm(byId('users', d.uid), null);
    }
  });


  /* ---------- خطة المحتوى من ملف إكسل ---------- */
  var XL_COLS = ['التاريخ', 'الساعة', 'العميل', 'النوع', 'العنوان', 'المسؤول', 'الحالة', 'ملاحظات'];
  var XL_TYPES = ['بوست', 'ريل', 'كاروسيل', 'ستوري', 'منشور الجمعة'];
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zipStore(files) { // ملف zip بدون ضغط، يكفي لقالب صغير
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f[0]), data = enc.encode(f[1]), crc = crc32(data);
      var head = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += head.length + name.length + data.length;
    });
    var csize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    return new Blob(parts.concat(central, [end]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xesc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function xlCol(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function xlTemplateFiles() {
    var team = db.users.filter(function (u) { return u.active !== false && u.role !== 'client'; }).map(function (u) { return u.name; });
    var lists = [['العملاء', db.clients.map(function (c) { return c.name; })], ['النوع', XL_TYPES], ['المسؤول', team], ['الحالة', MODS.content.statuses]];
    var cell = function (r, c, v, st) { return '<c r="' + xlCol(c) + r + '" t="inlineStr"' + (st ? ' s="' + st + '"' : '') + '><is><t>' + xesc(v) + '</t></is></c>'; };
    var head = '<row r="1">' + XL_COLS.map(function (t, i) { return cell(1, i, t, 1); }).join('') + '</row>';
    var widths = [14, 10, 22, 14, 40, 18, 16, 36];
    var dv = [[2, 0], [3, 1], [5, 2], [6, 3]].map(function (x) { var L = lists[x[1]], n = Math.max(2, L[1].length + 1); return '<dataValidation type="list" allowBlank="1" showErrorMessage="0" sqref="' + xlCol(x[0]) + '2:' + xlCol(x[0]) + '1000"><formula1>\'القوائم\'!$' + xlCol(x[1]) + '$2:$' + xlCol(x[1]) + '$' + n + '</formula1></dataValidation>'; }).join('');
    var sheet1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' + widths.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"' + (i === 0 ? ' style="2"' : i === 1 ? ' style="3"' : '') + '/>'; }).join('') + '</cols><sheetData>' + head + '</sheetData><dataValidations count="4">' + dv + '</dataValidations></worksheet>';
    var maxL = Math.max.apply(null, lists.map(function (l) { return l[1].length; }));
    var rows = '';
    for (var r = 0; r <= maxL; r++) { rows += '<row r="' + (r + 1) + '">' + lists.map(function (l, i) { var v = r === 0 ? l[0] : l[1][r - 1]; return v == null ? '' : cell(r + 1, i, v, r === 0 ? 1 : 0); }).join('') + '</row>'; }
    var sheet2 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><cols><col min="1" max="4" width="24" customWidth="1"/></cols><sheetData>' + rows + '</sheetData></worksheet>';
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts><fonts count="2"><font><sz val="12"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6F432"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="164" applyNumberFormat="1"/><xf numFmtId="165" applyNumberFormat="1"/></cellXfs></styleSheet>';
    return [
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="الخطة" sheetId="1" r:id="rId1"/><sheet name="القوائم" sheetId="2" r:id="rId2"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/styles.xml', styles], ['xl/worksheets/sheet1.xml', sheet1], ['xl/worksheets/sheet2.xml', sheet2]
    ];
  }
  function xlTemplate() {
    var a = document.createElement('a'); a.href = URL.createObjectURL(zipStore(xlTemplateFiles())); a.download = 'خطة-المحتوى-شفق.xlsx';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  /* قراءة ملف xlsx */
  function unzip(buf) {
    var b = new Uint8Array(buf), dv = new DataView(buf), e = b.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) return Promise.reject(new Error('الملف مو ملف إكسل (xlsx).'));
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), out = {}, jobs = [], dec = new TextDecoder();
    for (var i = 0; i < n; i++) {
      var method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = dec.decode(b.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
      if (!/\.(xml|rels)$/.test(name)) continue;
      var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = b.subarray(start, start + csz);
      jobs.push((function (name, data, method) {
        if (method === 0) { out[name] = dec.decode(data); return Promise.resolve(); }
        if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('المتصفح قديم. افتح النظام بكروم أو إيدج.'));
        return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(function (t) { out[name] = t; });
      })(name, data, method));
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  function xmlDoc(t) { return new DOMParser().parseFromString(t, 'application/xml'); }
  function byTag(d, tag) { return Array.prototype.slice.call(d.getElementsByTagNameNS('*', tag)); }
  function readXlsx(file) {
    return file.arrayBuffer().then(unzip).then(function (z) {
      var wb = xmlDoc(z['xl/workbook.xml'] || '<w/>'), sheets = byTag(wb, 'sheet');
      if (!sheets.length) throw new Error('ما لقيت صفحات بالملف.');
      var rid = sheets[0].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheets[0].getAttribute('r:id');
      var target = 'worksheets/sheet1.xml';
      byTag(xmlDoc(z['xl/_rels/workbook.xml.rels'] || '<r/>'), 'Relationship').forEach(function (r) { if (r.getAttribute('Id') === rid) target = r.getAttribute('Target'); });
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      var ss = z['xl/sharedStrings.xml'] ? byTag(xmlDoc(z['xl/sharedStrings.xml']), 'si').map(function (si) { return byTag(si, 't').map(function (t) { return t.textContent; }).join(''); }) : [];
      var sh = xmlDoc(z['xl/' + target] || '<w/>'), rows = [];
      byTag(sh, 'row').forEach(function (row) {
        var r = [];
        byTag(row, 'c').forEach(function (c) {
          var ref = c.getAttribute('r') || '', col = 0, m = ref.match(/^[A-Z]+/);
          if (m) { for (var i = 0; i < m[0].length; i++) col = col * 26 + m[0].charCodeAt(i) - 64; col--; } else col = r.length;
          var t = c.getAttribute('t'), v = byTag(c, 'v')[0], val;
          if (t === 's') val = ss[+(v ? v.textContent : 0)] || '';
          else if (t === 'inlineStr') val = byTag(c, 't').map(function (x) { return x.textContent; }).join('');
          else val = v ? v.textContent : '';
          if (t !== 's' && t !== 'inlineStr' && t !== 'str' && val !== '' && !isNaN(+val)) val = +val;
          r[col] = val;
        });
        rows.push(r);
      });
      return rows;
    });
  }
  function normAr(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' '); }
  function findBy(list, name, get) {
    var n = normAr(name); if (!n) return null;
    return list.filter(function (x) { return normAr(get(x)) === n; })[0] || list.filter(function (x) { var g = normAr(get(x)); return g && (g.indexOf(n) >= 0 || n.indexOf(g) >= 0); })[0] || null;
  }
  function arDigits(s) { return String(s == null ? '' : s).trim().replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 1632; }); }
  function xlDate(v) {
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    var s = arDigits(v), m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))) return (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function xlTime(v) {
    if (typeof v === 'number') { var mins = Math.round((v % 1) * 1440); return ('0' + (Math.floor(mins / 60) % 24)).slice(-2) + ':' + ('0' + (mins % 60)).slice(-2); }
    var s = arDigits(v), m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(ص|م|am|pm)?/i);
    if (!s || !m) return '';
    var hh = +m[1], suf = m[3] || '';
    if (/م|pm/i.test(suf) && hh < 12) hh += 12;
    if (/ص|am/i.test(suf) && hh === 12) hh = 0;
    return ('0' + hh).slice(-2) + ':' + (m[2] || '00');
  }
  function planFromRows(rows) {
    var hi = -1, map = {};
    for (var i = 0; i < Math.min(rows.length, 10) && hi < 0; i++) { if ((rows[i] || []).some(function (x) { return normAr(x) === normAr('العنوان'); })) hi = i; }
    if (hi < 0) throw new Error('ما لقيت عمود «العنوان». استعمل قالب شفق، أو خلّي أول سطر فيه أسماء الأعمدة.');
    (rows[hi] || []).forEach(function (x, i) { XL_COLS.forEach(function (c) { if (normAr(x) === normAr(c)) map[c] = i; }); });
    var team = db.users.filter(function (u) { return u.role !== 'client'; }), ok = [], dup = 0, warn = [], seen = {};
    items('post').forEach(function (p) { seen[(p.client_id || '') + '|' + (p.date || '') + '|' + normAr(p.name)] = 1; });
    rows.slice(hi + 1).forEach(function (r, i) {
      r = r || [];
      var g = function (c) { var v = map[c] == null ? '' : r[map[c]]; return v == null ? '' : v; }, line = hi + i + 2;
      var name = String(g('العنوان')).trim(); if (!name) return;
      var cl = findBy(db.clients, g('العميل'), function (x) { return x.name; }), ow = findBy(team, g('المسؤول'), function (x) { return x.name; });
      var type = findBy(XL_TYPES, g('النوع'), function (x) { return x; }) || (String(g('النوع')).trim() || 'بوست');
      var st = findBy(MODS.content.statuses, g('الحالة'), function (x) { return x; }) || 'فكرة';
      var date = xlDate(g('التاريخ')), time = xlTime(g('الساعة'));
      if (g('العميل') !== '' && !cl) warn.push('سطر ' + line + ': العميل «' + g('العميل') + '» مو موجود، انضاف بدون عميل');
      if (g('المسؤول') !== '' && !ow) warn.push('سطر ' + line + ': «' + g('المسؤول') + '» مو من الفريق');
      if (g('التاريخ') !== '' && !date) warn.push('سطر ' + line + ': التاريخ «' + g('التاريخ') + '» مو مفهوم');
      var key = (cl ? cl.id : '') + '|' + date + '|' + normAr(name);
      if (seen[key]) { dup++; return; }
      seen[key] = 1;
      ok.push({ id: uid(), kind: 'post', status: st, created: today(), name: name, client_id: cl ? cl.id : '', type: type, owner: ow ? ow.id : '', date: date, time: time, notes: String(g('ملاحظات')).trim() });
    });
    return { ok: ok, dup: dup, warn: warn };
  }
  function importPlan(file) {
    readXlsx(file).then(function (rows) {
      var res = planFromRows(rows), ok = res.ok;
      if (!ok.length && !res.dup) throw new Error('الملف ما فيه منشورات. عبّي عمود «العنوان» على الأقل.');
      var byC = {}; ok.forEach(function (p) { var n = p.client_id ? clientName(p.client_id) : 'بدون عميل'; byC[n] = (byC[n] || 0) + 1; });
      var html = '<p><b>' + ok.length + '</b> منشور جاهز للإضافة' + (res.dup ? ' · <b>' + res.dup + '</b> موجود من قبل وما رح يتكرر' : '') + '</p>' +
        (ok.length ? '<p>' + Object.keys(byC).map(function (k) { return h(k) + ': ' + byC[k]; }).join(' · ') + '</p>' : '') +
        (res.warn.length ? '<p class="warn">' + res.warn.slice(0, 8).map(h).join('<br>') + (res.warn.length > 8 ? '<br>و' + (res.warn.length - 8) + ' ملاحظات تانية' : '') + '</p>' : '');
      openForm('استيراد خطة المحتوى', [], function () {
        if (!ok.length) return 'ما في شي جديد';
        db.items = db.items.concat(ok); return 'انضاف ' + ok.length + ' منشور للخطة';
      }, { html: html }, ok.length ? 'إضافة ' + ok.length + ' منشور' : 'تمام');
    }).catch(function (e) { toast('تعذر قراءة الملف: ' + (e && e.message || e)); });
  }
  Object.assign(acts, { xlTemplate: function () { xlTemplate(); toast('تنزّل القالب. عبّيه وارجع ارفعه من «رفع ملف إكسل»'); } });

  /* ---------- الأحداث ---------- */
  function formVals(f) { var v = {}; Array.prototype.forEach.call(f.elements, function (e) { if (e.name) v[e.name] = e.value; }); return v; }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) { var mn = document.querySelector('details.menu[open]'); if (mn && !e.target.closest('details.menu')) mn.removeAttribute('open'); return; }
    var a = el.getAttribute('data-act'); if (!acts[a]) return;
    if (!isMgr() && ['close', 'theme', 'logout', 'retry', 'delPhoto', 'chPass', 'portalRefresh', 'portalMonth', 'pushOn', 'pushLater', 'pushTest'].indexOf(a) < 0) return;
    acts[a](el.dataset);
  });
  document.addEventListener('change', function (e) {
    var el = e.target, k = el.getAttribute && el.getAttribute('data-chg'); if (!k) return;
    if (k === 'rate' && isMgr()) { var r = num(el.value); if (r > 0) { db.rates[today()] = r; toast('حُفظ سعر الصرف'); } else delete db.rates[today()]; save(); render(); }
    if (k === 'task') { var t = byId('tasks', el.dataset.id); if (t && (isMgr() || t.user_id === me().id)) { t.done = el.checked; t.done_at = el.checked ? today() : ''; save(); render(); if (el.checked && !isMgr()) notify([{ to: 'managers', title: (me().gender === 'f' ? 'أنجزت ' : 'أنجز ') + me().name + ' مهمة ✅', body: t.title, tag: 'done' }]); } }
    if (k === 'istatus' && isMgr()) { var it = byId('items', el.dataset.id); if (it) { var was = it.status; it.status = el.value; save(); render(); if (it.kind === 'post' && el.value === 'منشور' && was !== 'منشور' && it.client_id) notify([{ to: { client: it.client_id }, title: 'نزل منشور جديد 🎉', body: '«' + (it.name || '') + '»' + (it.type ? ' · ' + it.type : ''), tag: 'post' }]); } }
    if ((k === 'rolename' || k === 'roleuser') && isMgr()) { var c = byId('clients', el.dataset.id), rs = normRoles(c).slice(), i = +el.dataset.i; rs[i] = Object.assign({}, rs[i]); rs[i][k === 'rolename' ? 'role' : 'user'] = k === 'rolename' ? el.value.trim() : el.value; c.roles = rs; save(); render(); }
    if (k === 'shafqph' && isMgr()) { db.settings.shafq_phone = el.value.trim(); save(); render(); toast('حُفظ رقم شفق'); }
    if (k === 'xlfile' && isMgr() && el.files[0]) { importPlan(el.files[0]); el.value = ''; }
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
      ['name', 'title', 'phone', 'email', 'city', 'insta', 'bio'].forEach(function (k) { m[k] = (v[k] || '').trim(); }); m.gender = v.gender === 'f' ? 'f' : 'm'; save(); render(); toast('حُفظ الملف');
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
    else if (me().role === 'client') html = vPortal();
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
    if (me() && me().role !== 'client' && (r === '#/' || r === '')) html = html.replace(/<div class="head"/, function (m) { return pushBanner() + m; });
    if (ONLINE && SRV.hasSession() && me() && state.ready) pushSync();
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
  window.SHAFQ = { render: render, db: function () { return db; }, save: function () { save(); render(); } };
  start();
})();
