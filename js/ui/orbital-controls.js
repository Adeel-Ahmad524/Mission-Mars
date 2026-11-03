/* MissionMind 2.0 — Orbital Mechanics & Trajectory Control View */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;
  const $ = MM.$;

  class OrbitalControlsView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
      this.canvas = null;
      this.ctx = null;
      this.animId = null;
    }

    init() {
      this.bindInputs();
      this.initTrajectoryCanvas();
      this.render();

      MM.bus.on('orbit:changed', () => this.render());
      MM.bus.on('sim:tick', () => this.renderTrajectory());
    }

    bindInputs() {
      // Central body selection
      const bodySelect = $('#orbit-body-select');
      if (bodySelect) {
        bodySelect.addEventListener('change', (e) => {
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setCentralBody(e.target.value);
            this.render();
          }
        });
      }

      // Orbital speed slider / input
      const speedInput = $('#orbit-velocity-input');
      if (speedInput) {
        speedInput.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setVelocity(val);
            this.render();
          }
        });
      }

      // Orbital radius slider / input
      const radiusInput = $('#orbit-radius-input');
      if (radiusInput) {
        radiusInput.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setRadius(val);
            this.render();
          }
        });
      }

      // Inclination input
      const incInput = $('#orbit-inclination-input');
      if (incInput) {
        incInput.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setInclination(val);
            this.render();
          }
        });
      }

      // Eccentricity input
      const eccInput = $('#orbit-eccentricity-input');
      if (eccInput) {
        eccInput.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setEccentricity(val);
            this.render();
          }
        });
      }

      // Escape Burn button
      const btnEscape = $('#btn-trigger-escape');
      if (btnEscape) {
        btnEscape.addEventListener('click', () => {
          const s = this.stateManager.state;
          const deltaV = (s.orbit?.deltaVToEscapeMs || 3200) + 120;
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.applyDeltaV(deltaV);
            this.stateManager.addLog('navigation', 'Prograde Escape Burn Completed', `Added +${Math.round(deltaV)} m/s delta-V. Orbital energy positive. Escaping central gravitational well.`, { severity: 'info' });
            MM.bus.emit('toast', { type: 'success', title: 'Escape Trajectory Achieved', message: 'Spacecraft is now on an unbound hyperbolic escape trajectory!' });
            this.render();
          }
        });
      }

      // Circularize button
      const btnCircularize = $('#btn-circularize-orbit');
      if (btnCircularize) {
        btnCircularize.addEventListener('click', () => {
          const s = this.stateManager.state;
          const vCirc = s.orbit?.vCircularMs || 7670;
          if (this.app.orbitalEngine) {
            this.app.orbitalEngine.setVelocity(vCirc);
            this.app.orbitalEngine.setEccentricity(0.001);
            this.stateManager.addLog('navigation', 'Orbit Circularized', `Orbital velocity trimmed to circular velocity ${Math.round(vCirc)} m/s.`, { severity: 'info' });
            MM.bus.emit('toast', { type: 'info', title: 'Orbit Circularized', message: 'Eccentricity zeroed. Orbit is circular.' });
            this.render();
          }
        });
      }
    }

    initTrajectoryCanvas() {
      this.canvas = document.getElementById('trajectory-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.renderTrajectory();
    }

    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(280, Math.round(rect.width));
      this.height = Math.max(220, Math.round(rect.height || 340));
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    render() {
      const s = this.stateManager.state;
      const orb = s.orbit || {};

      // Update telemetry readouts
      const elVelMs = $('#telemetry-orbit-vel-ms');
      if (elVelMs) elVelMs.textContent = U.thousands(orb.velocityMs || 7670);

      const elVelKms = $('#telemetry-orbit-vel-kms');
      if (elVelKms) elVelKms.textContent = U.fixed(orb.velocityKms || 7.67, 2);

      const elCircKms = $('#telemetry-circ-vel-kms');
      if (elCircKms) elCircKms.textContent = U.fixed(orb.vCircularKms || 7.67, 2);

      const elDeltaV = $('#telemetry-delta-v');
      if (elDeltaV) elDeltaV.textContent = (orb.deltaVToCircularMs >= 0 ? '+' : '') + Math.round(orb.deltaVToCircularMs || 0) + ' m/s';

      const elEscKms = $('#telemetry-esc-vel-kms');
      if (elEscKms) elEscKms.textContent = U.fixed(orb.vEscapeKms || 10.85, 2);

      const elEnergy = $('#telemetry-specific-energy');
      if (elEnergy) elEnergy.textContent = (orb.specificEnergy ? (orb.specificEnergy / 1e6).toFixed(2) : '-29.4') + ' MJ/kg';

      const elAlt = $('#telemetry-orbit-alt');
      if (elAlt) elAlt.textContent = U.thousands(orb.altitudeKm || 400) + ' km';

      const elPeriod = $('#telemetry-orbit-period');
      if (elPeriod) elPeriod.textContent = orb.periodMinutes !== Infinity ? U.fixed(orb.periodMinutes || 92.5, 1) + ' min' : 'Unbound (∞)';

      const elState = $('#telemetry-orbit-state');
      if (elState) {
        const typeLabels = {
          circular: 'Circular Orbit (Bound)',
          bound_elliptical: 'Elliptical Orbit (Bound)',
          parabolic_escape: 'Parabolic Boundary (ε = 0)',
          hyperbolic_escape: 'Hyperbolic Escape Trajectory (Unbound)',
          suborbital: 'Suborbital Descent / Re-entry'
        };
        elState.textContent = typeLabels[orb.orbitType] || 'Orbit Nominal';
        elState.className = 'badge ' + (orb.isEscaped ? 'badge-blue' : orb.orbitType === 'suborbital' ? 'badge-red' : 'badge-green');
      }

      const elPeri = $('#telemetry-orbit-peri');
      if (elPeri) elPeri.textContent = orb.periapsisKm != null ? U.thousands(orb.periapsisKm) + ' km' : '—';

      const elApo = $('#telemetry-orbit-apo');
      if (elApo) elApo.textContent = orb.apoapsisKm !== Infinity ? U.thousands(orb.apoapsisKm) + ' km' : '∞ (Hyperbolic)';

      this.renderTrajectory();
    }

    renderTrajectory() {
      const ctx = this.ctx;
      if (!ctx || !this.app.orbitalEngine) return;

      const data = this.app.orbitalEngine.getTrajectoryPoints(90);
      const s = this.stateManager.state;
      const body = CFG.BODIES[s.centralBody || 'earth'] || CFG.BODIES.earth;

      ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.width / 2;
      const cy = this.height / 2;

      // Determine scale so orbit fits comfortably
      const maxR = Math.max(data.bodyRadius * 2, data.currentPos.r * 1.4);
      const scale = (Math.min(this.width, this.height) * 0.42) / maxR;

      // Draw central body (Earth, Moon, Mars, Sun)
      const bodyR = Math.max(12, data.bodyRadius * scale);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR, 0, Math.PI * 2);
      ctx.fillStyle = body.color || '#38bdf8';
      ctx.shadowColor = body.color || '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fill();

      // Atmospheric glow
      ctx.beginPath();
      ctx.arc(cx, cy, bodyR * 1.15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.textAlign = 'center';
      ctx.fillText(body.name.toUpperCase(), cx, cy + bodyR + 14);

      // Draw Trajectory curve
      if (data.orbitPoints && data.orbitPoints.length > 1) {
        ctx.beginPath();
        const first = data.orbitPoints[0];
        ctx.moveTo(cx + first.x * scale, cy + first.y * scale);
        for (let i = 1; i < data.orbitPoints.length; i++) {
          const pt = data.orbitPoints[i];
          ctx.lineTo(cx + pt.x * scale, cy + pt.y * scale);
        }
        if (!data.isEscaped) ctx.closePath();

        ctx.strokeStyle = data.isEscaped ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = data.isEscaped ? 2.2 : 1.6;
        ctx.setLineDash(data.isEscaped ? [6, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Spacecraft Position Marker
      const scX = cx + data.currentPos.x * scale;
      const scY = cy + data.currentPos.y * scale;

      ctx.beginPath();
      ctx.arc(scX, scY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.fill();

      // Spacecraft Velocity Vector Arrow
      const vKms = s.orbit ? s.orbit.velocityKms : 7.67;
      const arrowLen = Math.min(35, vKms * 2.5);
      const angle = data.currentPos.theta + Math.PI / 2;
      const vx = Math.cos(angle) * arrowLen;
      const vy = Math.sin(angle) * arrowLen;

      ctx.beginPath();
      ctx.moveTo(scX, scY);
      ctx.lineTo(scX + vx, scY + vy);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'left';
      ctx.fillText(`SC (${Math.round(vKms)} km/s)`, scX + 8, scY - 4);

      ctx.restore();
    }
  }

  MM.OrbitalControlsView = OrbitalControlsView;
})();
