/* MissionMind 2.0 — Radar Scope & Obstacle Tracking Display */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;

  class RadarDisplayView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
      this.canvas = null;
      this.ctx = null;
      this.animId = null;
    }

    init() {
      this.canvas = document.getElementById('radar-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.bindToolbar();
      this.bindCanvasClicks();
      this.start();

      MM.bus.on('radar:range-changed', () => this.renderList());
      MM.bus.on('radar:selection-changed', () => this.renderList());
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(260, Math.round(rect.width));
      this.height = Math.max(260, Math.round(rect.height));
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    bindToolbar() {
      // Range buttons (25, 50, 150, 500 km)
      const rangeBtns = document.querySelectorAll('.radar-range-btn');
      rangeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const range = Number(btn.dataset.range);
          if (this.app.radarEngine) {
            this.app.radarEngine.setRange(range);
            rangeBtns.forEach((b) => b.classList.toggle('active', Number(b.dataset.range) === range));
          }
        });
      });

      // Toggle sweep button
      const btnToggleSweep = $('#btn-radar-toggle-sweep');
      if (btnToggleSweep) {
        btnToggleSweep.addEventListener('click', () => {
          if (this.app.radarEngine) {
            const active = this.app.radarEngine.toggleSweep();
            btnToggleSweep.textContent = active ? 'Sweep: ON' : 'Sweep: PAUSED';
          }
        });
      }
    }

    bindCanvasClicks() {
      if (!this.canvas) return;
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const cx = this.width / 2;
        const cy = this.height / 2;

        const s = this.stateManager.state;
        const radar = s.radar || {};
        const rangeM = (radar.rangeKm || 50) * 1000;
        const radiusPx = Math.min(this.width, this.height) * 0.46;

        // Check if user clicked near any object blip
        if (radar.objects) {
          let clickedObj = null;
          radar.objects.forEach((obj) => {
            const bx = cx + (obj.pos.x / rangeM) * radiusPx;
            const by = cy + (obj.pos.y / rangeM) * radiusPx;
            if (Math.hypot(clickX - bx, clickY - by) < 14) {
              clickedObj = obj;
            }
          });
          if (this.app.radarEngine) {
            this.app.radarEngine.selectObject(clickedObj ? clickedObj.id : null);
          }
        }
      });
    }

    start() {
      const render = () => {
        this.draw();
        this.animId = requestAnimationFrame(render);
      };
      this.animId = requestAnimationFrame(render);
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const s = this.stateManager.state;
      const radar = s.radar || { rangeKm: 50, sweepAngleDeg: 0, objects: [], threatLevel: 'green' };

      ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.width / 2;
      const cy = this.height / 2;
      const maxRadius = Math.min(this.width, this.height) * 0.46;
      const rangeM = (radar.rangeKm || 50) * 1000;

      // 1. Concentric Range Rings
      ctx.save();
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ringSteps.forEach((frac, idx) => {
        const r = maxRadius * frac;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = idx === 3 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(56, 189, 248, 0.16)';
        ctx.lineWidth = idx === 3 ? 1.8 : 1.0;
        ctx.stroke();

        // Distance range ring label
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.fillText(`${Math.round(radar.rangeKm * frac)} km`, cx + 4, cy - r + 11);
      });

      // 2. Crosshair Azimuth Grid
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      // Diagonals (45°, 135°)
      const diag = maxRadius * 0.7071;
      ctx.moveTo(cx - diag, cy - diag);
      ctx.lineTo(cx + diag, cy + diag);
      ctx.moveTo(cx - diag, cy + diag);
      ctx.lineTo(cx + diag, cy - diag);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // 3. Rotating Sweep Beam with Phosphor Gradient Trail
      if (radar.sweepActive) {
        const sweepRad = (radar.sweepAngleDeg * Math.PI) / 180;
        const trailAngle = 0.5; // rad
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, sweepRad - trailAngle, sweepRad);
        ctx.closePath();
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        sweepGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        sweepGrad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
        ctx.fillStyle = sweepGrad;
        ctx.fill();

        // Leading edge line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepRad) * maxRadius, cy + Math.sin(sweepRad) * maxRadius);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // 4. Center Spacecraft Crosshair
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 5. Render Detected Obstacles
      (radar.objects || []).forEach((obj) => {
        const bx = cx + (obj.pos.x / rangeM) * maxRadius;
        const by = cy + (obj.pos.y / rangeM) * maxRadius;

        // Skip if outside current radar range
        if (Math.hypot(bx - cx, by - cy) > maxRadius) return;

        const isSelected = obj.id === radar.selectedId;
        const isRed = obj.threat === 'red';
        const isYellow = obj.threat === 'yellow';

        const color = isRed ? '#ef4444' : isYellow ? '#f59e0b' : '#38bdf8';

        // Blip diamond or circle
        ctx.beginPath();
        if (obj.type === 'debris' || obj.type === 'asteroid') {
          ctx.rect(bx - 3.5, by - 3.5, 7, 7);
        } else {
          ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        }
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isRed ? 14 : 6;
        ctx.fill();

        // Selected Reticle Ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(bx, by, 9, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        // Velocity vector line
        const vScale = 0.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (obj.vel?.x || 0) * vScale, by + (obj.vel?.y || 0) * vScale);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Label
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(obj.name, bx + 7, by - 3);
      });

      ctx.restore();
      this.renderList();
    }

    renderList() {
      const s = this.stateManager.state;
      const radar = s.radar || {};
      const container = $('#radar-target-list');
      if (!container) return;

      // Update Threat Banner
      const banner = $('#radar-threat-banner');
      if (banner) {
        const level = radar.threatLevel || 'green';
        banner.className = `radar-threat-banner radar-threat-${level}`;
        if (level === 'red') {
          banner.innerHTML = `<strong>⚠️ CRITICAL COLLISION ALERT:</strong> Incoming track requires immediate avoidance manoeuvre burn!`;
        } else if (level === 'yellow') {
          banner.innerHTML = `<strong>⚡ PROXIMITY ADVISORY:</strong> Orbital contact detected within warning radius. Continuous tracking active.`;
        } else {
          banner.innerHTML = `<strong>✅ RADAR NOMINAL:</strong> Surrounding space clear. No immediate collision vectors detected.`;
        }
      }

      // Populate Target Items
      const objects = radar.objects || [];
      container.innerHTML = objects.map((obj) => {
        const isSel = obj.id === radar.selectedId;
        const threatPill = obj.threat === 'red' ? '<span class="pill pill-red">COLLISION RISK</span>' : obj.threat === 'yellow' ? '<span class="pill pill-amber">TRACKING</span>' : '<span class="pill pill-green">SAFE</span>';
        return `
          <div class="target-item ${isSel ? 'selected' : ''}" data-target-id="${obj.id}">
            <div class="target-item-header">
              <span class="target-title">${obj.name}</span>
              ${threatPill}
            </div>
            <div class="target-metrics-grid">
              <div>Type: <span style="color:var(--text)">${obj.label}</span></div>
              <div>Range: <span style="color:#38bdf8">${obj.distanceKm} km</span></div>
              <div>Rel Speed: <span style="color:var(--text)">${obj.relativeSpeedKms} km/s</span></div>
              <div>TCA: <span style="color:${obj.tcaSeconds < 180 ? '#f87171' : 'var(--text)'}">${obj.tcaSeconds > 0 ? obj.tcaSeconds + 's' : 'Diverging'}</span></div>
              <div>Miss Dist: <span style="color:${obj.dcaKm < 2.5 ? '#f87171' : '#4ade80'}">${obj.dcaKm != null ? obj.dcaKm + ' km' : '—'}</span></div>
            </div>
          </div>
        `;
      }).join('');

      // Bind selection clicks
      container.querySelectorAll('.target-item').forEach((item) => {
        item.addEventListener('click', () => {
          const id = item.dataset.targetId;
          if (this.app.radarEngine) this.app.radarEngine.selectObject(id);
        });
      });
    }
  }

  MM.RadarDisplayView = RadarDisplayView;
})();
