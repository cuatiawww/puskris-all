/**
 * Puskris – API Data NCC 119 (Google Apps Script, Web App, HANYA BACA)
 *
 * Spreadsheet ini: "Puskris – Data NCC 119 (API)"
 *   Harian   : 1 baris per tanggal (baris TOTALS dari laporan interval)
 *   Interval : 1 baris per slot 30 menit per tanggal
 *   Kamus    : arti setiap kolom
 *   Meta     : sumber dan waktu sinkron terakhir
 *
 * Endpoint (GET <URL /exec>?action=...):
 *   action=ringkasan (bawaan) : total, harian, pola per jam, interval tersibuk
 *   action=meta               : info sumber, rentang tanggal, daftar kolom
 *   action=harian             : baris Harian
 *   action=interval           : baris Interval (maks. 31 hari per panggilan)
 *   action=per_jam            : agregat per slot 30 menit pada rentang tanggal
 * Filter opsional: tanggal1=YYYY-MM-DD, tanggal2=YYYY-MM-DD.
 *   prov diterima tetapi diabaikan: data NCC 119 hanya tingkat nasional.
 * Kunci opsional: bila Script Property API_KEY diisi, setiap panggilan wajib
 *   menyertakan &key=<API_KEY>.
 *
 * Tidak ada doPost dan doGet tidak menulis apa pun. Penulisan hanya terjadi
 * di sinkronkan() yang dijalankan pemilik (manual atau pemicu per jam) dan
 * hanya menulis ke spreadsheet ini; spreadsheet sumber hanya dibaca.
 */

var CACHE_DETIK = 600; // 10 menit
var SUMBER_ID_BAWAAN = '1NKzX88f9_tHTF4C7piMsOKqO67sqknq72L1GNCB8YtE';
var SUMBER_TAB_BAWAAN = 'Master Data Interval';

var KOLOM = [
  ['cof', 'COF', 'int'], ['acd', 'ACD Calls', 'int'], ['abd', 'Aban Calls', 'int'],
  ['pct_acd', '%ACD Call', 'pct'], ['pct_abd', '% Abandon', 'pct'], ['acceptable', 'ACCEPTABLE', 'int'],
  ['pct_sl', '% SL', 'pct'], ['aht_detik', 'Avg Handling Time', 'dur'], ['hold_detik', 'Hold Time', 'dur'],
  ['held_calls', 'Held Calls', 'int'], ['asa_detik', 'Avg Speed Ans', 'dur'], ['avg_aban_detik', 'Avg Aban Time', 'dur'],
  ['avg_acd_detik', 'Avg ACD Time', 'dur'], ['avg_acw_detik', 'Avg ACW Time', 'dur'], ['max_delay_detik', 'Max Delay', 'dur'],
  ['flow_in', 'Flow In', 'int'], ['flow_out', 'Flow Out', 'int'], ['extn_out_calls', 'Extn Out Calls', 'int'],
  ['avg_extn_out_detik', 'Avg Extn Out Time', 'dur'], ['dequeued_calls', 'Dequeued Calls', 'int'],
  ['avg_dequeue_detik', 'Avg Time to Dequeue', 'dur'], ['pct_acd_time', '% ACD Time', 'pct'], ['pct_ans_calls', '% Ans Calls', 'pct'],
  ['avg_pos_staff', 'Avg Pos Staff', 'dec'], ['max_staffed', 'MAXSTAFFED', 'int'], ['calls_per_pos', 'Calls Per Pos', 'int'],
  ['aux_detik', 'AUX Time', 'dur'], ['acw_detik', 'ACW Time', 'dur'], ['staff_detik', 'Staff Time', 'dur'],
  ['other_detik', 'Other Time', 'dur'], ['pct_occ_acw', '% Occupancy w/ ACW', 'pct'], ['pct_occ_no_acw', '% Occupancy w/o ACW', 'pct'],
  ['utilisasi_detik', 'Utilisasi', 'dur'], ['avg_hold_acd_detik', 'AVG Hold by ACD', 'dur']
];

// ============================================================ Web App (baca)
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var kunci = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (kunci && String(p.key || '') !== kunci) return json_({ ok: false, error: 'unauthorized' });
    var action = String(p.action || 'ringkasan').toLowerCase();
    var t1 = tgl_(p.tanggal1), t2 = tgl_(p.tanggal2);
    if ((p.tanggal1 && !t1) || (p.tanggal2 && !t2)) return json_({ ok: false, error: 'format tanggal harus YYYY-MM-DD' });
    var cacheKey = ['ncc', action, t1 || '', t2 || ''].join('|') + (p.prov ? '|p' : '');
    var cache = CacheService.getScriptCache();
    var hit = cache.get(cacheKey);
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
    var out;
    if (action === 'meta') out = meta_();
    else if (action === 'harian') out = { ok: true, data: harian_(t1, t2) };
    else if (action === 'interval') out = intervalAksi_(t1, t2);
    else if (action === 'per_jam') out = { ok: true, data: perJam_(interval_(t1, t2)) };
    else if (action === 'ringkasan') out = ringkasan_(t1, t2);
    else return json_({ ok: false, error: 'action tidak dikenal', actions: ['ringkasan', 'meta', 'harian', 'interval', 'per_jam'] });
    out.cakupan = 'nasional';
    if (p.prov) out.catatan_prov = 'Data NCC 119 hanya tingkat nasional; filter prov diabaikan.';
    out.filter = { tanggal1: t1, tanggal2: t2 };
    out.dibuat = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ssXXX");
    var s = JSON.stringify(out);
    if (s.length < 95000) cache.put(cacheKey, s, CACHE_DETIK);
    return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function tgl_(v) { v = String(v || '').trim(); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }
function inRange_(d, t1, t2) { return (!t1 || d >= t1) && (!t2 || d <= t2); }

function bacaTab_(nama) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nama);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  var h = v[0].map(String);
  var out = [];
  for (var i = 1; i < v.length; i++) {
    if (v[i][0] === '' || v[i][0] == null) continue;
    var o = {};
    for (var j = 0; j < h.length; j++) {
      var x = v[i][j];
      if (x instanceof Date) x = Utilities.formatDate(x, 'Asia/Jakarta', j === 0 ? 'yyyy-MM-dd' : 'HH:mm');
      o[h[j]] = x === '' ? null : x;
    }
    o.tanggal = String(o.tanggal);
    out.push(o);
  }
  return out;
}
function harian_(t1, t2) { return bacaTab_('Harian').filter(function (r) { return inRange_(r.tanggal, t1, t2); }); }
function interval_(t1, t2) { return bacaTab_('Interval').filter(function (r) { return inRange_(r.tanggal, t1, t2); }); }

function intervalAksi_(t1, t2) {
  var rows = interval_(t1, t2);
  var hari = {};
  rows.forEach(function (r) { hari[r.tanggal] = 1; });
  if (Object.keys(hari).length > 31) return { ok: false, error: 'rentang interval maksimal 31 hari; isi tanggal1 dan tanggal2' };
  return { ok: true, data: rows };
}

function perJam_(rows) {
  var m = {};
  rows.forEach(function (r) {
    var k = r.interval_mulai;
    var a = m[k] || (m[k] = { interval_mulai: k, interval_selesai: r.interval_selesai, cof: 0, acd: 0, abd: 0, _aht: 0, _asa: 0, _hari: 0 });
    a.cof += +r.cof || 0; a.acd += +r.acd || 0; a.abd += +r.abd || 0;
    a._aht += (+r.aht_detik || 0) * (+r.acd || 0); a._asa += (+r.asa_detik || 0) * (+r.acd || 0); a._hari += 1;
  });
  return Object.keys(m).sort().map(function (k) {
    var a = m[k];
    return {
      interval_mulai: a.interval_mulai, interval_selesai: a.interval_selesai, hari: a._hari,
      cof: a.cof, acd: a.acd, abd: a.abd,
      rata_cof_per_hari: a._hari ? Math.round(a.cof / a._hari * 10) / 10 : null,
      pct_acd: a.cof ? Math.round(a.acd / a.cof * 10000) / 100 : null,
      aht_detik: a.acd ? Math.round(a._aht / a.acd) : null,
      asa_detik: a.acd ? Math.round(a._asa / a.acd) : null
    };
  });
}

function ringkasan_(t1, t2) {
  var days = harian_(t1, t2);
  var iv = interval_(t1, t2);
  var tot = { cof: 0, acd: 0, abd: 0, acceptable: 0, _aht: 0, _asa: 0 };
  days.forEach(function (d) {
    tot.cof += +d.cof || 0; tot.acd += +d.acd || 0; tot.abd += +d.abd || 0; tot.acceptable += +d.acceptable || 0;
    tot._aht += (+d.aht_detik || 0) * (+d.acd || 0); tot._asa += (+d.asa_detik || 0) * (+d.acd || 0);
  });
  var busiest = null;
  iv.forEach(function (r) { if (!busiest || (+r.cof || 0) > (+busiest.cof || 0)) busiest = r; });
  return {
    ok: true,
    meta: metaRingkas_(),
    totals: {
      cof: tot.cof, acd: tot.acd, abd: tot.abd, hari: days.length,
      pct_acd: tot.cof ? Math.round(tot.acd / tot.cof * 10000) / 100 : null,
      pct_abd: tot.cof ? Math.round(tot.abd / tot.cof * 10000) / 100 : null,
      pct_sl: tot.cof ? Math.round(tot.acceptable / tot.cof * 10000) / 100 : null,
      aht_detik: tot.acd ? Math.round(tot._aht / tot.acd) : null,
      asa_detik: tot.acd ? Math.round(tot._asa / tot.acd) : null
    },
    days: days.map(function (d) {
      return { tanggal: d.tanggal, cof: d.cof, acd: d.acd, abd: d.abd, pct_acd: d.pct_acd, pct_abd: d.pct_abd, pct_sl: d.pct_sl,
        aht_detik: d.aht_detik, asa_detik: d.asa_detik, avg_aban_detik: d.avg_aban_detik, max_delay_detik: d.max_delay_detik,
        avg_pos_staff: d.avg_pos_staff, max_staffed: d.max_staffed, pct_occ_acw: d.pct_occ_acw };
    }),
    per_jam: perJam_(iv),
    busiest_interval: busiest ? { tanggal: busiest.tanggal, interval_mulai: busiest.interval_mulai, interval_selesai: busiest.interval_selesai,
      cof: busiest.cof, acd: busiest.acd, abd: busiest.abd, pct_acd: busiest.pct_acd } : null
  };
}

function metaTab_() {
  var o = {};
  bacaTabMentah_('Meta').forEach(function (r) { if (r[0]) o[String(r[0])] = r[1]; });
  return o;
}
function bacaTabMentah_(nama) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nama);
  return sh && sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), Math.max(2, sh.getLastColumn())).getValues() : [];
}
function metaRingkas_() {
  var m = metaTab_();
  var d = bacaTab_('Harian').map(function (r) { return r.tanggal; }).sort();
  return { sumber: 'NCC 119 Kemenkes (laporan interval pusat panggilan, skill ' + (m.skill || 'Kemenkes NCC') + ')', terakhir_sinkron: m.terakhir_sinkron || null,
    tanggal_awal: d[0] || null, tanggal_akhir: d[d.length - 1] || null, hari: d.length };
}
function meta_() {
  var m = metaRingkas_();
  m.ok = true;
  m.kolom = bacaTabMentah_('Kamus').slice(1).map(function (r) { return { kolom: r[0], label_sumber: r[1], tipe: r[2], keterangan: r[3] }; });
  m.actions = ['ringkasan', 'meta', 'harian', 'interval', 'per_jam'];
  return m;
}

// ============================================================ Sinkron (pemilik saja)
/** Baca tab laporan interval di spreadsheet sumber (hanya baca), tulis ulang tab Harian dan Interval. */
function sinkronkan() {
  var props = PropertiesService.getScriptProperties();
  var sumberId = props.getProperty('SUMBER_ID') || SUMBER_ID_BAWAAN;
  var sumberTab = props.getProperty('SUMBER_TAB') || SUMBER_TAB_BAWAAN;
  var rows = bacaSumber_(sumberId, sumberTab);
  var hasil = uraikanLaporan_(rows);
  if (!hasil.harian.length) throw new Error('Tidak ada blok LAPORAN INTERVAL TANGGAL yang terbaca di sumber.');
  var ss = SpreadsheetApp.getActive();
  var kol = KOLOM.map(function (k) { return k[0]; });
  tulisTab_(ss, 'Harian', ['tanggal'].concat(kol), hasil.harian, 1);
  tulisTab_(ss, 'Interval', ['tanggal', 'interval_mulai', 'interval_selesai'].concat(kol), hasil.interval, 3);
  setMeta_(ss, 'terakhir_sinkron', Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm') + ' WIB');
  setMeta_(ss, 'sumber_spreadsheet_id', sumberId);
  setMeta_(ss, 'sumber_tab', sumberTab);
  CacheService.getScriptCache().removeAll(['ncc|ringkasan||', 'ncc|meta||', 'ncc|harian||', 'ncc|per_jam||']);
  return { harian: hasil.harian.length, interval: hasil.interval.length };
}

/** Pasang pemicu sinkron tiap jam (jalankan sekali). */
function pasangPemicuPerJam() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sinkronkan') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sinkronkan').timeBased().everyHours(1).create();
}

function bacaSumber_(id, tab) {
  // Sheets API v4 dengan UNFORMATTED_VALUE: durasi >= 24 jam tetap utuh (pecahan hari),
  // tidak berubah jadi "12/30/1899" seperti nilai tampilan.
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(id) + '/values/' +
    encodeURIComponent("'" + tab.replace(/'/g, "''") + "'!A1:AK") + '?valueRenderOption=UNFORMATTED_VALUE';
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    // cadangan: salinan mentah di spreadsheet ini (tab Sumber_Mentah)
    var sh = SpreadsheetApp.getActive().getSheetByName('Sumber_Mentah');
    if (!sh) throw new Error('Gagal membaca sumber (HTTP ' + res.getResponseCode() + ') dan tab Sumber_Mentah tidak ada.');
    return sh.getDataRange().getValues();
  }
  return JSON.parse(res.getContentText()).values || [];
}

function angka_(v, tipe) {
  if (v === '' || v == null) return null;
  if (v instanceof Date) { // nilai durasi yang terbaca sebagai tanggal (cadangan Sumber_Mentah)
    return Math.round((v.getTime() - new Date(1899, 11, 30).getTime()) / 1000);
  }
  var s = String(v).trim();
  if (s === '') return null;
  if (tipe === 'pct' || tipe === 'dec') {
    var f = s.indexOf(',') >= 0 ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
    return isNaN(f) ? null : Math.round(f * 100) / 100;
  }
  if (tipe === 'int') { var n = parseFloat(s.replace(/,/g, '')); return isNaN(n) ? null : Math.round(n); }
  // durasi -> detik
  if (/^\d+(\.\d+)?$/.test(s) && s.split('.').length <= 2) return Math.round(parseFloat(s) * 86400); // pecahan hari
  var p = s.split(/[:.]/).map(function (x) { return x === '' ? 0 : parseInt(x, 10) || 0; });
  while (p.length < 3) p.unshift(0);
  return p[p.length - 3] * 3600 + p[p.length - 2] * 60 + p[p.length - 1];
}

function uraikanLaporan_(rows) {
  var harian = [], interval = [], tanggal = null, header = null, seen = {};
  rows.forEach(function (r) {
    if (!r || !r.length) return;
    var a = String(r[0] == null ? '' : r[0]).trim();
    if (!a) return;
    var m = a.match(/LAPORAN INTERVAL TANGGAL:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) { tanggal = m[3] + '-' + m[2] + '-' + m[1]; return; }
    if (a === 'Interval') { header = r.slice(1, 1 + KOLOM.length).map(String); return; }
    if (!tanggal || !header) return;
    var vals = KOLOM.map(function (k) { var j = header.indexOf(k[1]); return angka_(j >= 0 ? r[j + 1] : null, k[2]); });
    if (a === 'TOTALS') {
      if (seen[tanggal]) return; // blok ganda: pakai yang pertama (paling atas = terbaru)
      seen[tanggal] = 1;
      harian.push([tanggal].concat(vals));
    } else {
      var mm = a.match(/^(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})$/);
      if (!mm) return;
      interval.push([tanggal, pad_(mm[1]) + ':' + mm[2], pad_(mm[3]) + ':' + mm[4]].concat(vals));
    }
  });
  // buang interval ganda (tanggal+jam) bila satu tanggal muncul dua kali
  var u = {}; interval = interval.filter(function (x) { var k = x[0] + x[1]; if (u[k]) return false; u[k] = 1; return true; });
  harian.sort(function (x, y) { return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0; });
  interval.sort(function (x, y) { return (x[0] + x[1]) < (y[0] + y[1]) ? -1 : 1; });
  return { harian: harian, interval: interval };
}
function pad_(h) { return ('0' + h).slice(-2); }

function tulisTab_(ss, nama, header, rows, kolomTeks) {
  var sh = ss.getSheetByName(nama) || ss.insertSheet(nama);
  sh.clearContents();
  var data = [header].concat(rows);
  if (sh.getMaxRows() < data.length) sh.insertRowsAfter(sh.getMaxRows(), data.length - sh.getMaxRows());
  if (sh.getMaxColumns() < header.length) sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
  sh.getRange(1, 1, data.length, kolomTeks).setNumberFormat('@'); // tanggal & jam tetap teks
  sh.getRange(1, 1, data.length, header.length).setValues(data);
  sh.setFrozenRows(1);
}
function setMeta_(ss, kunci, nilai) {
  var sh = ss.getSheetByName('Meta') || ss.insertSheet('Meta');
  var v = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 1).getValues() : [];
  for (var i = 0; i < v.length; i++) if (String(v[i][0]) === kunci) { sh.getRange(i + 1, 2).setValue(nilai); return; }
  sh.appendRow([kunci, nilai]);
}
