/* MissionMind — canvas mission map */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  function seeded(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function random() {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function pointOnQuad(p0, c, p1, t) {
    const mt = 1 - t;
    return {
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y
    };
  }

  function tangentAngle(p0, c, p1, t) {
    const mt = 1 - t;
    const dx = 2 * mt * (c.x - p0.x) + 2 * t * (p1.x - c.x);
    const dy = 2 * mt * (c.y - p0.y) + 2 * t * (p1.y - c.y);
    return Math.atan2(dy, dx);
  }

  class MissionMap {
    constructor(canvasId, stateManager, options) {
      this.canvas = document.getElementById(canvasId);
      this.stateManager = stateManager;
      this.options = options || {};
      this.compact = Boolean(this.options.compact);
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.playing = true;
      this.showMarkers = true;
      this.zoom = 1;
      this.time = 0;
      this.lastFrame = 0;
      this.stars = [];
      this.running = false;
      this.width = 0;
      this.height = 0;

      if (!this.canvas || !this.ctx) return;
      this.makeStars();
      this.resize();
      this.bindResize();
      this.start();
    }

    bindResize() {
      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize);
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(this.onResize);
        this.resizeObserver.observe(this.canvas.parentElement || this.canvas);
      }
    }

    makeStars() {
      const rand = seeded(this.compact ? 1337 : 8675309);
      this.stars = Array.from({ length: this.compact ? 70 : 130 }, () => ({
        x: rand(),
        y: rand(),
        r: 0.4 + rand() * 1.25,
        a: 0.15 + rand() * 0.6,
        phase: rand() * Math.PI * 2,
        speed: 0.25 + rand() * 0.7
      }));
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(220, Math.round(rect.width));
      this.height = Math.max(150, Math.round(rect.height));
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    setPlaying(playing) {
      this.playing = Boolean(playing);
    }

    setMarkers(visible) {
      this.showMarkers = Boolean(visible);
    }

    setZoom(zoom) {
      this.zoom = U.clamp(Number(zoom) || 1, 0.8, 1.6);
    }

    start() {
      if (this.running) return;
      this.running = true;
      const loop = (timestamp) => {
        if (!this.running) return;
        const delta = this.lastFrame ? Math.min(80, timestamp - this.lastFrame) : 16;
        this.lastFrame = timestamp;
        if (this.playing) this.time += delta / 1000;
        this.render();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
    }

    geometry() {
      const w = this.width;
      const h = this.height;
      const curveLift = this.compact ? 0.24 : 0.18;
      const p0 = { x: w * 0.115, y: h * 0.63 };
      const p1 = { x: w * 0.865, y: h * 0.37 };
      const c = { x: w * 0.48, y: h * curveLift };
      return { p0, c, p1, earthR: this.compact ? 17 : U.clamp(Math.min(w, h) * 0.055, 22, 40), marsR: this.compact ? 12 : U.clamp(Math.min(w, h) * 0.042, 16, 30) };
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;
      const state = this.stateManager.state;
      const progress = U.clamp(state.progress, 0, 100);
      const t = U.clamp(progress / 100, 0.004, 1);
      const geo = this.geometry();

      ctx.clearRect(0, 0, w, h);

      /* Space background */
      const bg = ctx.createRadialGradient(w * 0.3, h * 0.15, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
      bg.addColorStop(0, '#0a1628');
      bg.addColorStop(0.55, '#070e1b');
      bg.addColorStop(1, '#04080f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      /* Stars */
      this.stars.forEach((star) => {
        const twinkle = 0.65 + Math.sin(this.time * star.speed + star.phase) * 0.35;
        ctx.globalAlpha = star.a * twinkle;
        ctx.fillStyle = star.phase > 4.2 ? '#bae6fd' : '#e2e8f0';
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.save();
      if (this.zoom !== 1 && !this.compact) {
        const cx = w / 2;
        const cy = h / 2;
        ctx.translate(cx, cy);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-cx, -cy);
      }

      /* Technical grid arcs */
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      /* Orbit rings around planets */
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.ellipse(geo.p0.x, geo.p0.y, geo.earthR + 16, (geo.earthR + 16) * 0.38, -0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(249, 115, 98, 0.16)';
      ctx.beginPath();
      ctx.ellipse(geo.p1.x, geo.p1.y, geo.marsR + 15, (geo.marsR + 15) * 0.42, 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Full trajectory */
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(geo.p0.x, geo.p0.y);
      ctx.quadraticCurveTo(geo.c.x, geo.c.y, geo.p1.x, geo.p1.y);
      ctx.stroke();
      ctx.setLineDash([]);

      /* Travelled trajectory */
      const gradient = ctx.createLinearGradient(geo.p0.x, geo.p0.y, geo.p1.x, geo.p1.y);
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
      gradient.addColorStop(0.6, 'rgba(99, 179, 245, 0.95)');
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0.95)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.compact ? 1.8 : 2.4;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i <= 90; i += 1) {
        const p = pointOnQuad(geo.p0, geo.c, geo.p1, (i / 90) * t);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* Planets */
      this.drawEarth(geo.p0, geo.earthR);
      this.drawMars(geo.p1, geo.marsR);

      /* Destination marker */
      if (this.showMarkers) {
        const ringPulse = (this.time * 0.35) % 1;
        ctx.strokeStyle = `rgba(249, 115, 98, ${0.45 * (1 - ringPulse)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(geo.p1.x, geo.p1.y, geo.marsR + 8 + ringPulse * 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      /* Spacecraft */
      const ship = pointOnQuad(geo.p0, geo.c, geo.p1, t);
      const angle = tangentAngle(geo.p0, geo.c, geo.p1, t);
      this.drawShip(ship, angle, state);

      /* Active event indicators around the ship */
      if (this.showMarkers) this.drawEventMarkers(ship, state);

      /* Labels */
      this.drawLabel(geo.p0.x, geo.p0.y + geo.earthR + (this.compact ? 18 : 26), 'EARTH', '#7dd3fc', 'center');
      this.drawLabel(geo.p1.x, geo.p1.y + geo.marsR + (this.compact ? 18 : 26), 'MARS', '#fca5a5', 'center');

      if (!this.compact) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText('EARTH DEPARTURE', geo.p0.x - 44, geo.p0.y - geo.earthR - 18);
        ctx.fillText('MARS ARRIVAL', geo.p1.x - 36, geo.p1.y - geo.marsR - 20);
        ctx.fillStyle = 'rgba(100, 116, 139, 0.55)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText('SIMULATED TRANSFER SCHEMATIC · NOT TO SCALE', 16, h - 14);
        ctx.textAlign = 'right';
        ctx.fillText(`RISK ${state.metrics.riskIndex ?? 0}/100`, w - 16, h - 14);
        ctx.textAlign = 'left';
      }

      /* Progress tag near ship */
      const label = `${U.fixed(progress, 1)}%`;
      const tagX = U.clamp(ship.x + 16, 8, w - 70);
      const tagY = U.clamp(ship.y - 28, 16, h - 24);
      ctx.fillStyle = 'rgba(9, 16, 28, 0.75)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1;
      const tagW = 46;
      const tagH = 17;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(tagX, tagY, tagW, tagH, 4);
      else ctx.rect(tagX, tagY, tagW, tagH);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bae6fd';
      ctx.font = `${this.compact ? 8 : 9}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(label, tagX + tagW / 2, tagY + 12);
      ctx.textAlign = 'left';

      ctx.restore();
    }

    drawEarth(pos, radius) {
      const ctx = this.ctx;
      const glow = ctx.createRadialGradient(pos.x, pos.y, radius * 0.2, pos.x, pos.y, radius * 2.6);
      glow.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      glow.addColorStop(0.6, 'rgba(56, 189, 248, 0.06)');
      glow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 2.6, 0, Math.PI * 2);
      ctx.fill();

      const sphere = ctx.createRadialGradient(pos.x - radius * 0.35, pos.y - radius * 0.35, radius * 0.1, pos.x, pos.y, radius);
      sphere.addColorStop(0, '#7dd3fc');
      sphere.addColorStop(0.45, '#0ea5e9');
      sphere.addColorStop(0.8, '#1d4ed8');
      sphere.addColorStop(1, '#0c2451');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 2, -0.9, 1.7);
      ctx.stroke();
    }

    drawMars(pos, radius) {
      const ctx = this.ctx;
      const glow = ctx.createRadialGradient(pos.x, pos.y, radius * 0.2, pos.x, pos.y, radius * 2.5);
      glow.addColorStop(0, 'rgba(249, 115, 98, 0.22)');
      glow.addColorStop(0.6, 'rgba(249, 115, 98, 0.05)');
      glow.addColorStop(1, 'rgba(249, 115, 98, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      const sphere = ctx.createRadialGradient(pos.x - radius * 0.3, pos.y - radius * 0.3, radius * 0.1, pos.x, pos.y, radius);
      sphere.addColorStop(0, '#fdba74');
      sphere.addColorStop(0.4, '#f97362');
      sphere.addColorStop(0.8, '#b93b2f');
      sphere.addColorStop(1, '#5a1c17');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(254, 215, 170, 0.15)';
      ctx.beginPath();
      ctx.ellipse(pos.x - radius * 0.15, pos.y + radius * 0.2, radius * 0.4, radius * 0.16, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    drawShip(ship, angle, state) {
      const ctx = this.ctx;
      const scale = this.compact ? 0.72 : 1;
      const pulse = 0.75 + Math.sin(this.time * 2.2) * 0.25;

      ctx.save();
      ctx.translate(ship.x, ship.y);

      const halo = ctx.createRadialGradient(0, 0, 2, 0, 0, 26 * scale);
      halo.addColorStop(0, `rgba(56, 189, 248, ${0.28 * pulse})`);
      halo.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, 26 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = state.missionStatus === 'failed' ? '#fca5a5' : '#f8fafc';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -9 * scale);
      ctx.lineTo(5.5 * scale, 6 * scale);
      ctx.lineTo(0, 3.2 * scale);
      ctx.lineTo(-5.5 * scale, 6 * scale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -1 * scale, 1.4 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (this.showMarkers && this.playing) {
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 * (1 - ((this.time * 0.8) % 1))})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, 10 + ((this.time * 16) % 24), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    drawEventMarkers(ship, state) {
      const ctx = this.ctx;
      const events = [
        { active: state.events.solarStorm, label: 'STORM', color: '#f59e0b' },
        { active: state.events.fuelShortage, label: 'FUEL', color: '#38bdf8' },
        { active: state.events.communicationFailure, label: 'COMMS', color: '#a78bfa' },
        { active: state.events.powerFailure, label: 'POWER', color: '#ef4444' }
      ].filter((e) => e.active);

      events.forEach((event, index) => {
        const orbit = 24 + index * 9;
        const pulse = 0.55 + Math.sin(this.time * 3 + index) * 0.35;
        ctx.strokeStyle = event.color;
        ctx.globalAlpha = pulse * 0.75;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(ship.x, ship.y, orbit, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.fillStyle = event.color;
        const angle = -Math.PI / 2 + index * 0.9 + this.time * 0.12;
        ctx.beginPath();
        ctx.arc(ship.x + Math.cos(angle) * orbit, ship.y + Math.sin(angle) * orbit, 2, 0, Math.PI * 2);
        ctx.fill();

        if (!this.compact) {
          ctx.fillStyle = event.color;
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(event.label, ship.x + orbit + 5, ship.y - orbit + 3);
        }
      });
      ctx.textAlign = 'left';
    }

    drawLabel(x, y, text, color, align) {
      const ctx = this.ctx;
      ctx.fillStyle = color;
      ctx.font = `${this.compact ? 8 : 10}px "Inter", sans-serif`;
      ctx.textAlign = align || 'left';
      ctx.fillText(text, x, y);
      ctx.textAlign = 'left';
    }
  }

  MM.MissionMap = MissionMap;
})();
