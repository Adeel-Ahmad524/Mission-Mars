/* MissionMind — shared helpers */
(function () {
  'use strict';
  const MM = (window.MM = window.MM || {});

  const U = {
    clamp(value, min, max) {
      const n = Number(value);
      if (!Number.isFinite(n)) return min;
      return Math.min(max, Math.max(min, n));
    },
    round(value, digits = 2) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      const f = Math.pow(10, digits);
      return Math.round(n * f) / f;
    },
    fixed(value, digits = 1) {
      return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
    },
    pct(value, digits = 1) {
      return `${U.fixed(value, digits)}%`;
    },
    millions(km, digits = 1) {
      return `${U.fixed(km / 1e6, digits)} M km`;
    },
    thousands(n) {
      return new Intl.NumberFormat('en-US').format(Math.round(n));
    },
    missionTime(day, withSeconds) {
      const safe = Math.max(0, Number(day) || 0);
      const whole = Math.floor(safe);
      const minutesTotal = Math.floor((safe - whole) * 1440);
      const hh = String(Math.floor(minutesTotal / 60)).padStart(2, '0');
      const mm = String(minutesTotal % 60).padStart(2, '0');
      const base = `D+${String(whole).padStart(3, '0')} ${hh}:${mm}`;
      if (!withSeconds) return base;
      const ss = String(Math.floor((Date.now() / 1000) % 60)).padStart(2, '0');
      return `${base}:${ss}`;
    },
    nowISO() {
      return new Date().toISOString();
    },
    uid(prefix) {
      U._seq = (U._seq || 0) + 1;
      return `${prefix || 'id'}-${Date.now().toString(36)}-${U._seq}`;
    },
    deepCopy(value) {
      try {
        if (typeof structuredClone === 'function') return structuredClone(value);
      } catch (err) { /* fall through */ }
      return JSON.parse(JSON.stringify(value));
    },
    escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    severityRank(sev) {
      return { low: 0, info: 0, medium: 1, warning: 1, high: 2, critical: 3 }[sev] ?? 0;
    },
    worstSeverity(list) {
      return (list || []).reduce((worst, s) => (U.severityRank(s) > U.severityRank(worst) ? s : worst), 'low');
    },
    download(filename, text, mime) {
      const blob = new Blob([text], { type: mime || 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },
    statusLabel(status) {
      return String(status || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  MM.U = U;
  MM.util = U;

  /* Tiny DOM helpers used by all UI modules */
  MM.$ = (sel, root) => (root || document).querySelector(sel);
  MM.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  MM.esc = U.escapeHtml;
})();
