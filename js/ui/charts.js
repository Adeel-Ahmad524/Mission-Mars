/* MissionMind — telemetry charts (Chart.js with dependency-free fallback) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  const COLORS = {
    fuel: '#f59e0b',
    power: '#8b5cf6',
    oxygen: '#22c55e',
    progress: '#38bdf8',
    risk: '#ef4444',
    health: '#22c55e',
    temp: '#fb923c',
    reports: '#38bdf8',
    decisions: '#8b5cf6'
  };

  class ChartManager {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.charts = {};
      this.useChartJs = typeof window.Chart !== 'undefined';
      this.lastRender = 0;
      this.bound = false;
      this.init();
    }

    init() {
      if (!this.useChartJs) return;
      const Chart = window.Chart;
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.font.family = '"Inter", sans-serif';
      Chart.defaults.font.size = 10;
      Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.08)';
      Chart.defaults.animation = false;
      Chart.defaults.plugins.legend.display = false;

      const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            borderColor: 'rgba(148, 163, 184, 0.25)',
            borderWidth: 1,
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            padding: 9,
            displayColors: true,
            callbacks: {
              title: (items) => (items.length ? `Mission ${items[0].label}` : '')
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.055)', drawTicks: false },
            ticks: { maxTicksLimit: 7, padding: 6 },
            border: { display: false }
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.055)' },
            ticks: { maxTicksLimit: 5, padding: 6 },
            border: { display: false }
          }
        }
      };

      const make = (id, datasets, yOptions, extraScales) => {
        const canvas = document.getElementById(id);
        if (!canvas) return null;
        return new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: { labels: [], datasets },
          options: {
            ...baseOptions,
            scales: {
              ...baseOptions.scales,
              y: { ...baseOptions.scales.y, ...(yOptions || {}) },
              ...(extraScales || {})
            }
          }
        });
      };

      const line = (label, color, key, options) => ({
        label,
        data: [],
        borderColor: color,
        backgroundColor: color,
        borderWidth: 1.8,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.32,
        fill: false,
        ...(options || {})
      });

      this.charts.resources = make('chart-resources', [
        line('Fuel', COLORS.fuel, 'fuel'),
        line('Power', COLORS.power, 'power'),
        line('Oxygen', COLORS.oxygen, 'oxygen')
      ], { min: 0, max: 100, ticks: { callback: (v) => `${v}%`, maxTicksLimit: 5 } });

      this.charts.progress = make('chart-progress', [
        line('Progress', COLORS.progress, 'progress', { fill: true, backgroundColor: 'rgba(56, 189, 248, 0.08)' }),
        line('Risk', COLORS.risk, 'risk', { borderDash: [4, 3] })
      ], { min: 0, max: 100, ticks: { callback: (v) => `${v}%`, maxTicksLimit: 5 } });

      this.charts.health = make('chart-health', [
        line('Equipment health', COLORS.health, 'health'),
        line('Temperature', COLORS.temp, 'temp', { yAxisID: 'y1', borderDash: [3, 3] })
      ], { min: 0, max: 100, ticks: { callback: (v) => `${v}%`, maxTicksLimit: 5 } }, {
        y1: {
          position: 'right',
          min: -10,
          max: 50,
          grid: { drawOnChartArea: false },
          ticks: { callback: (v) => `${v}°`, maxTicksLimit: 4 },
          border: { display: false }
        }
      });

      this.charts.agents = make('chart-agents', [
        line('Agent cycles', COLORS.reports, 'reports', { stepped: true }),
        line('Decisions', COLORS.decisions, 'decisions', { stepped: true, borderDash: [4, 3] })
      ], {
        min: 0,
        ticks: { precision: 0, maxTicksLimit: 5 }
      });

      this.bound = false;
    }

    attach() {
      if (this.bound) return;
      this.bound = true;
      MM.bus.on('telemetry:sample', () => this.maybeRender());
      MM.bus.on('decision:new', () => this.render());
      MM.bus.on('mission:reset', () => this.reset());
      MM.bus.on('agents:cycle', () => this.maybeRender(true));
    }

    reset() {
      Object.values(this.charts).forEach((chart) => {
        if (!chart) return;
        chart.data.labels = [];
        chart.data.datasets.forEach((dataset) => { dataset.data = []; });
        chart.update('none');
      });
      this.renderFallback();
    }

    maybeRender(force) {
      const now = performance.now();
      if (!force && now - this.lastRender < 1800) return;
      this.lastRender = now;
      this.render();
    }

    render() {
      const samples = this.stateManager.telemetry.slice(-140);
      if (!this.useChartJs) {
        this.renderFallback();
        return;
      }
      const labels = samples.map((s) => `D+${Math.floor(s.day)}`);
      const map = {
        resources: ['fuel', 'power', 'oxygen'],
        progress: ['progress', 'risk'],
        health: ['health', 'temp'],
        agents: ['reports', 'decisions']
      };
      Object.entries(this.charts).forEach(([key, chart]) => {
        if (!chart) return;
        chart.data.labels = labels;
        chart.data.datasets.forEach((dataset, index) => {
          const field = map[key][index];
          dataset.data = samples.map((s) => s[field] ?? 0);
        });
        chart.update('none');
      });
      this.updateNotes(samples);
    }

    updateNotes(samples) {
      const last = samples[samples.length - 1];
      const progressNote = document.getElementById('chart-progress-note');
      const healthNote = document.getElementById('chart-health-note');
      if (progressNote) progressNote.textContent = last ? `${U.fixed(last.progress, 1)}%` : '0.0%';
      if (healthNote) healthNote.textContent = last ? `${U.fixed(last.health, 1)}%` : '100.0%';
    }

    renderFallback() {
      const samples = this.stateManager.telemetry.slice(-100);
      this.updateNotes(samples);
      this.drawFallback('chart-resources', [
        { field: 'fuel', color: COLORS.fuel, min: 0, max: 100, suffix: '%' },
        { field: 'power', color: COLORS.power, min: 0, max: 100, suffix: '%' },
        { field: 'oxygen', color: COLORS.oxygen, min: 0, max: 100, suffix: '%' }
      ], samples, { yMin: 0, yMax: 100 });
      this.drawFallback('chart-progress', [
        { field: 'progress', color: COLORS.progress, min: 0, max: 100, suffix: '%', fill: true },
        { field: 'risk', color: COLORS.risk, min: 0, max: 100, suffix: '%', dash: [4, 3] }
      ], samples, { yMin: 0, yMax: 100 });
      this.drawFallback('chart-health', [
        { field: 'health', color: COLORS.health, min: 0, max: 100, suffix: '%' },
        { field: 'temp', color: COLORS.temp, min: -10, max: 50, suffix: '°', secondary: true }
      ], samples, { yMin: 0, yMax: 100, secondaryMin: -10, secondaryMax: 50 });
      this.drawFallback('chart-agents', [
        { field: 'reports', color: COLORS.reports, min: 0, max: null, suffix: '' },
        { field: 'decisions', color: COLORS.decisions, min: 0, max: null, suffix: '', dash: [4, 3] }
      ], samples, {});
    }

    drawFallback(canvasId, series, samples, opts) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(200, Math.round(rect.width));
      const h = Math.max(120, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pad = { left: 34, right: 36, top: 10, bottom: 20 };
      const plotW = w - pad.left - pad.right;
      const plotH = h - pad.top - pad.bottom;
      const yMin = opts.yMin ?? 0;
      const yMax = opts.yMax ?? Math.max(1, ...samples.flatMap((s) => series.map((se) => Number(s[se.field]) || 0))) * 1.1;
      const yScale = (v) => pad.top + plotH - ((U.clamp(v, yMin, yMax) - yMin) / (yMax - yMin)) * plotH;
      const rightMin = opts.secondaryMin ?? 0;
      const rightMax = opts.secondaryMax ?? 50;
      const yRight = (v) => pad.top + plotH - ((U.clamp(v, rightMin, rightMax) - rightMin) / (rightMax - rightMin)) * plotH;
      const xScale = (i) => pad.left + (samples.length <= 1 ? plotW / 2 : (i / (samples.length - 1)) * plotW);

      /* Grid + axes */
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i += 1) {
        const y = pad.top + (plotH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        const value = yMax - ((yMax - yMin) / 4) * i;
        ctx.textAlign = 'right';
        ctx.fillText(samples.length ? `${U.round(value, 0)}` : '—', pad.left - 6, y + 3);
      }

      if (!samples.length) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.font = '10px "Inter", sans-serif';
        ctx.fillText('Awaiting telemetry · start the mission', w / 2, h / 2);
        return;
      }

      /* X labels */
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(100, 116, 139, 0.8)';
      const labelCount = Math.min(5, samples.length);
      for (let i = 0; i < labelCount; i += 1) {
        const index = Math.floor((i / Math.max(1, labelCount - 1)) * (samples.length - 1));
        ctx.fillText(`D+${Math.floor(samples[index].day)}`, xScale(index), h - 6);
      }

      /* Series */
      series.forEach((se) => {
        if (se.secondary) return;
        this.plotSeries(ctx, se, samples, xScale, yScale, plotW, pad, pad.top + plotH);
      });
      const secondary = series.find((se) => se.secondary);
      if (secondary) {
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.32)';
        for (let i = 0; i <= 2; i += 1) {
          const y = pad.top + (plotH / 2) * i;
          ctx.beginPath();
          ctx.moveTo(w - pad.right, y);
          ctx.lineTo(w - pad.right + 3, y);
          ctx.stroke();
          const value = rightMax - ((rightMax - rightMin) / 2) * i;
          ctx.fillStyle = 'rgba(251, 146, 60, 0.7)';
          ctx.textAlign = 'left';
          ctx.fillText(`${U.round(value, 0)}°`, w - pad.right + 5, y + 3);
        }
        this.plotSeries(ctx, secondary, samples, xScale, yRight, plotW, pad, pad.top + plotH);
      }

      /* Current value dots */
      series.forEach((se) => {
        const last = samples[samples.length - 1];
        const y = se.secondary ? yRight(last[se.field]) : yScale(last[se.field]);
        ctx.fillStyle = se.color;
        ctx.beginPath();
        ctx.arc(xScale(samples.length - 1), y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    plotSeries(ctx, se, samples, xScale, yScale, plotW, pad, plotBottom) {
      ctx.strokeStyle = se.color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.setLineDash(se.dash || []);
      ctx.beginPath();
      samples.forEach((sample, index) => {
        const x = xScale(index);
        const y = yScale(Number(sample[se.field]) || 0);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      if (se.fill && samples.length > 1) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.07)';
        ctx.beginPath();
        ctx.moveTo(xScale(0), plotBottom);
        samples.forEach((sample, index) => {
          ctx.lineTo(xScale(index), yScale(Number(sample[se.field]) || 0));
        });
        ctx.lineTo(xScale(samples.length - 1), plotBottom);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  MM.ChartManager = ChartManager;
})();
