/* نظام شفق — الاتصال بقاعدة البيانات (Supabase) بدون مكتبات خارجية */
(function () {
  'use strict';
  var CFG = window.SHAFQ_CONFIG || {};
  var URL_ = (CFG.serverUrl || '').replace(/\/+$/, ''), KEY = CFG.serverKey || '';
  var SKEY = 'shafq.srv.session', DOMAIN = CFG.loginDomain || 'shafq.art';
  var TABLES = { users: 'profiles', clients: 'clients', tasks: 'tasks', moves: 'moves', debts: 'debts', items: 'items' };
  var noItems = false;
  var LOCAL_ONLY = ['pass', 'salt', 'created_at'];
  var sess = null, shadow = null, chain = Promise.resolve();
  try { sess = JSON.parse(localStorage.getItem(SKEY)); } catch (e) { sess = null; }

  function setSess(r) {
    if (r && r.access_token) { sess = { access_token: r.access_token, refresh_token: r.refresh_token, user_id: r.user && r.user.id, exp: Date.now() + (r.expires_in || 3600) * 1000 }; localStorage.setItem(SKEY, JSON.stringify(sess)); }
    else { sess = null; localStorage.removeItem(SKEY); }
  }
  function digits(p) { return String(p || '').replace(/[^\d]/g, ''); }
  function email(phone) { return digits(phone) + '@' + DOMAIN; }
  function msgOf(j, status) {
    var m = j && (j.msg || j.message || j.error_description || j.error) || ('HTTP ' + status);
    if (/already registered|already been registered/i.test(m)) return 'هذا الرقم مسجل من قبل.';
    if (/invalid login credentials/i.test(m)) return 'الرقم أو كلمة السر غير صحيحة.';
    if (/row-level security|permission denied/i.test(m)) return 'لا تملك صلاحية هذا الإجراء.';
    if (/manager already exists/i.test(m)) return 'يوجد مدير للنظام من قبل.';
    if (/password/i.test(m) && /6|short|weak/i.test(m)) return 'كلمة السر ضعيفة أو قصيرة.';
    return m;
  }
  function raw(method, path, body, opts) {
    opts = opts || {};
    var hd = { apikey: KEY, 'Content-Type': 'application/json' };
    if (sess && !opts.anon) hd.Authorization = 'Bearer ' + sess.access_token;
    if (opts.prefer) hd.Prefer = opts.prefer;
    return fetch(URL_ + path, { method: method, headers: hd, body: body == null ? undefined : JSON.stringify(body) }).then(function (res) {
      return res.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        if (!res.ok) { var er = new Error(msgOf(j, res.status)); er.status = res.status; throw er; }
        return j;
      });
    }, function () { var er = new Error('تعذر الاتصال بالسيرفر. تحقق من الإنترنت.'); er.offline = true; throw er; });
  }
  var refreshing = null; // طلب تجديد واحد مشترك حتى لو انتهت الجلسة أثناء عدة طلبات معاً
  function refresh() {
    if (refreshing) return refreshing;
    if (!sess || !sess.refresh_token) return Promise.reject(new Error('انتهت الجلسة. سجّل الدخول من جديد.'));
    refreshing = raw('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: sess.refresh_token }, { anon: true }).then(function (r) { refreshing = null; setSess(r); }, function (e) { refreshing = null; if (!e.offline) setSess(null); throw e; });
    return refreshing;
  }
  function call(method, path, body, opts) {
    var pre = (sess && sess.exp - Date.now() < 60000) ? refresh() : Promise.resolve();
    return pre.then(function () { return raw(method, path, body, opts); }).catch(function (e) {
      if (e.status === 401 && sess && !(opts && opts.retried)) return refresh().then(function () { return raw(method, path, body, Object.assign({}, opts, { retried: true })); });
      throw e;
    });
  }

  /* تحويل الصفوف بين التطبيق والسيرفر */
  function toSrv(row, t) {
    var o = {};
    if (t === 'items') { o = { id: row.id, kind: row.kind, status: row.status || null, data: {} }; Object.keys(row).forEach(function (k) { if (k !== 'id' && k !== 'kind' && k !== 'status') o.data[k] = row[k]; }); return o; }
    Object.keys(row).forEach(function (k) { if (LOCAL_ONLY.indexOf(k) < 0 && !(noItems && k === 'item_id')) o[k] = row[k] === '' ? null : row[k]; }); return o;
  }
  function fromSrv(row, t) {
    var o = {};
    if (t === 'items') { o = Object.assign({}, row.data || {}); o.id = row.id; o.kind = row.kind; o.status = row.status || ''; return o; }
    Object.keys(row).forEach(function (k) { o[k] = row[k] === null ? '' : row[k]; }); delete o.created_at; return o;
  }
  function snap(db) {
    var s = { rates: Object.assign({}, db.rates), settings: JSON.parse(JSON.stringify(db.settings)) };
    Object.keys(TABLES).forEach(function (t) { s[t] = {}; (db[t] || []).forEach(function (r) { s[t][r.id] = JSON.stringify(toSrv(r, t)); }); });
    return s;
  }
  function pull() {
    var names = Object.keys(TABLES);
    return Promise.all(names.map(function (t) { var q = call('GET', '/rest/v1/' + TABLES[t] + '?select=*&order=created_at.asc'); return t === 'items' ? q.then(function (r) { noItems = false; return r; }, function (e) { if (e.offline || e.status === 401) throw e; noItems = true; return []; }) : q; }).concat([call('GET', '/rest/v1/rates?select=*'), call('GET', '/rest/v1/settings?select=*')])).then(function (res) {
      var db = { rates: {}, settings: { goal: 0 } };
      names.forEach(function (t, i) { db[t] = (res[i] || []).map(function (r) { return fromSrv(r, t); }); });
      (res[names.length] || []).forEach(function (r) { db.rates[r.day] = Number(r.rate); });
      (res[names.length + 1] || []).forEach(function (r) { db.settings[r.key] = r.value; });
      db.clients.forEach(function (c) { if (!c.roles || typeof c.roles !== 'object') c.roles = {}; });
      shadow = snap(db); return db;
    });
  }
  function ops(db) {
    var now = snap(db), list = [];
    Object.keys(TABLES).forEach(function (t) {
      if (t === 'items' && noItems) return;
      var path = '/rest/v1/' + TABLES[t];
      Object.keys(now[t]).forEach(function (id) {
        if (!(id in shadow[t])) list.push(['POST', path, JSON.parse(now[t][id]), 'return=minimal']);
        else if (shadow[t][id] !== now[t][id]) list.push(['PATCH', path + '?id=eq.' + encodeURIComponent(id), JSON.parse(now[t][id]), 'return=minimal']);
      });
      Object.keys(shadow[t]).forEach(function (id) { if (!(id in now[t])) list.push(['DELETE', path + '?id=eq.' + encodeURIComponent(id), null, 'return=minimal']); });
    });
    Object.keys(now.rates).forEach(function (d) { if (shadow.rates[d] !== now.rates[d]) list.push(['POST', '/rest/v1/rates?on_conflict=day', { day: d, rate: now.rates[d] }, 'resolution=merge-duplicates,return=minimal']); });
    Object.keys(shadow.rates).forEach(function (d) { if (!(d in now.rates)) list.push(['DELETE', '/rest/v1/rates?day=eq.' + d, null, 'return=minimal']); });
    Object.keys(now.settings).forEach(function (k) { if (JSON.stringify(shadow.settings[k]) !== JSON.stringify(now.settings[k])) list.push(['POST', '/rest/v1/settings?on_conflict=key', { key: k, value: now.settings[k] }, 'resolution=merge-duplicates,return=minimal']); });
    return { list: list, now: now };
  }
  function push(db) {
    chain = chain.catch(function () {}).then(function () {
      if (!shadow) return;
      var o = ops(db), i = 0;
      function next() { if (i >= o.list.length) { shadow = o.now; return; } var x = o.list[i++]; return call(x[0], x[1], x[2], { prefer: x[3] }).then(next); }
      return next();
    });
    return chain;
  }

  window.SHAFQ_SERVER = {
    enabled: CFG.mode === 'server',
    hasSession: function () { return !!sess; },
    uid: function () { return sess && sess.user_id; },
    digits: digits,
    hasManager: function () { return raw('POST', '/rest/v1/rpc/has_manager', {}, { anon: true }); },
    signIn: function (phone, pass) { return raw('POST', '/auth/v1/token?grant_type=password', { email: email(phone), password: pass }, { anon: true }).then(setSess); },
    // keep=false: إنشاء حساب لعضو الفريق دون تبديل جلسة المدير
    signUp: function (phone, pass, keep) {
      return raw('POST', '/auth/v1/signup', { email: email(phone), password: pass }, { anon: true }).then(function (r) {
        var id = r && (r.user ? r.user.id : r.id);
        if (!id) throw new Error('تعذر إنشاء الحساب.');
        if (keep) { if (!r.access_token) throw new Error('عطّل خيار Confirm email في إعدادات Supabase ثم أعد المحاولة.'); setSess(r); }
        return id;
      });
    },
    bootstrap: function (name, phone) { return call('POST', '/rest/v1/rpc/bootstrap_manager', { p_name: name, p_phone: phone }); },
    setPassword: function (p) { return call('PUT', '/auth/v1/user', { password: p }); },
    signOut: function () { var p = sess ? raw('POST', '/auth/v1/logout', {}, {}).catch(function () {}) : Promise.resolve(); return p.then(function () { setSess(null); shadow = null; }); },
    clear: function () { setSess(null); shadow = null; },
    pull: pull, push: push,
    itemsMissing: function () { return noItems; },
    idle: function () { return chain.catch(function () {}); }
  };
})();
