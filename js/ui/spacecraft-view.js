/* MissionMind 2.0 — Interactive 3D Spacecraft Simulator Visualization */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class SpacecraftView {
    constructor(containerId, stateManager) {
      this.container = document.getElementById(containerId);
      this.stateManager = stateManager;
      this.animId = null;
      this.canvas = null;
      this.ctx = null;

      // 3D camera / orbit state
      this.rotX = 0.35;
      this.rotY = 0.65;
      this.zoom = 1.0;
      this.isDragging = false;
      this.lastMouse = { x: 0, y: 0 };

      // Component highlight
      this.highlightedPart = null;

      if (!this.container) return;
      this.init();
    }

    init() {
      // Create canvas
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'spacecraft-3d-canvas';
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      this.container.innerHTML = '';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.bindMouseControls();
      this.start();
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = Math.max(300, Math.round(rect.width));
      this.height = Math.max(260, Math.round(rect.height));
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    bindMouseControls() {
      const el = this.canvas;
      el.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener('mouseup', () => { this.isDragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.rotY += dx * 0.008;
        this.rotX = U.clamp(this.rotX + dy * 0.008, -1.2, 1.2);
      });
      el.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom = U.clamp(this.zoom - e.deltaY * 0.0012, 0.6, 2.2);
      }, { passive: false });
    }

    start() {
      const render = () => {
        this.draw();
        this.animId = requestAnimationFrame(render);
      };
      this.animId = requestAnimationFrame(render);
    }

    stop() {
      if (this.animId) cancelAnimationFrame(this.animId);
    }

    /**
     * 3D Coordinate Projection Matrix (Rotation X, Y + User Pitch/Yaw/Roll)
     */
    project(x, y, z, orientation) {
      // Apply spacecraft attitude orientation (degrees)
      const rad = Math.PI / 180;
      const p = (orientation.pitch || 0) * rad;
      const yw = (orientation.yaw || 0) * rad;
      const r = (orientation.roll || 0) * rad;

      // Local spacecraft rotation
      let rx = x * Math.cos(r) - y * Math.sin(r);
      let ry = x * Math.sin(r) + y * Math.cos(r);
      let rz = z;

      let rx2 = rx * Math.cos(p) + rz * Math.sin(p);
      let rz2 = -rx * Math.sin(p) + rz * Math.cos(p);
      rx = rx2; rz = rz2;

      let rx3 = rx * Math.cos(yw) - ry * Math.sin(yw);
      let ry3 = rx * Math.sin(yw) + ry * Math.cos(yw);
      rx = rx3; ry = ry3;

      // Apply camera orbit (rotX, rotY)
      const cosY = Math.cos(this.rotY), sinY = Math.sin(this.rotY);
      const cosX = Math.cos(this.rotX), sinX = Math.sin(this.rotX);

      const cx = rx * cosY - rz * sinY;
      const cz = rx * sinY + rz * cosY;
      const cy = ry * cosX - cz * sinX;
      const czFinal = ry * sinX + cz * cosX;

      // Perspective projection
      const cameraDist = 450;
      const factor = (cameraDist / (cameraDist + czFinal)) * this.zoom;
      return {
        px: this.width / 2 + cx * factor,
        py: this.height / 2 + cy * factor,
        scale: factor,
        depth: czFinal
      };
    }

    draw() {
      const ctx = this.ctx;
      if (!ctx) return;
      const s = this.stateManager.state;
      const orient = s.spacecraft?.orientation || { pitch: 0, yaw: 0, roll: 0 };
      const thrusters = s.thrusters || { x: {}, y: {}, z: {} };
      const solar = s.solar || { deploymentProgress: 1.0, deployed: true };
      const mode = s.propulsionMode || 'chemical';

      ctx.clearRect(0, 0, this.width, this.height);

      // Deep space backdrop stars
      this.drawStarfield(ctx);

      // 1. Draw Spacecraft Main Hull (Hexagonal Prism / Cylinder)
      this.drawHull(ctx, orient);

      // 2. Draw Deployable Solar Wings
      this.drawSolarWings(ctx, orient, solar.deploymentProgress);

      // 3. Draw High-Gain Dish Antenna & Radar Pod
      this.drawAntennaAndRadar(ctx, orient);

      // 4. Draw 3-Axis Thrusters & Active Exhaust Plumes
      this.drawThrusters(ctx, orient, thrusters, mode);

      // 5. Draw HUD telemetry overlay
      this.drawOverlayHUD(ctx, s);
    }

    drawStarfield(ctx) {
      ctx.fillStyle = '#050914';
      ctx.fillRect(0, 0, this.width, this.height);

      // Subtle star grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      const t = Date.now() * 0.0001;
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 73 + t * 40) % this.width);
        const sy = ((i * 127 + i * 19) % this.height);
        const r = (i % 3 === 0) ? 1.2 : 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawHull(ctx, orient) {
      // Main central service module & crew command module
      const pFront = this.project(70, 0, 0, orient);
      const pBack = this.project(-60, 0, 0, orient);
      const pTop = this.project(0, -28, 0, orient);
      const pBottom = this.project(0, 28, 0, orient);
      const pLeft = this.project(0, 0, -28, orient);
      const pRight = this.project(0, 0, 28, orient);

      // Body gradient
      const grad = ctx.createLinearGradient(pTop.px, pTop.py, pBottom.px, pBottom.py);
      grad.addColorStop(0, '#334155');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#0f172a');

      ctx.save();
      // Hull outline
      ctx.beginPath();
      ctx.moveTo(pFront.px, pFront.py);
      ctx.lineTo(pTop.px, pTop.py);
      ctx.lineTo(pBack.px, pBack.py);
      ctx.lineTo(pBottom.px, pBottom.py);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Transverse ribs & panels
      ctx.beginPath();
      ctx.moveTo(pLeft.px, pLeft.py);
      ctx.lineTo(pFront.px, pFront.py);
      ctx.lineTo(pRight.px, pRight.py);
      ctx.lineTo(pBack.px, pBack.py);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.0;
      ctx.stroke();

      // Command module nose cone
      const pNose = this.project(92, 0, 0, orient);
      ctx.beginPath();
      ctx.moveTo(pFront.px, pFront.py - 10);
      ctx.lineTo(pNose.px, pNose.py);
      ctx.lineTo(pFront.px, pFront.py + 10);
      ctx.closePath();
      ctx.fillStyle = '#475569';
      ctx.fill();
      ctx.strokeStyle = '#00e5ff';
      ctx.stroke();

      ctx.restore();
    }

    drawSolarWings(ctx, orient, deployFactor) {
      const progress = Math.max(0.05, deployFactor != null ? deployFactor : 1.0);
      const wingLength = 110 * progress;
      const wingWidth = 26;

      // Port wing (+Z)
      const pWingPortBase = this.project(0, 0, 28, orient);
      const pWingPortEnd = this.project(0, 0, 28 + wingLength, orient);
      const pWingPortTop = this.project(wingWidth, 0, 28 + wingLength, orient);
      const pWingPortBtm = this.project(-wingWidth, 0, 28 + wingLength, orient);

      // Starboard wing (-Z)
      const pWingStbdBase = this.project(0, 0, -28, orient);
      const pWingStbdEnd = this.project(0, 0, -28 - wingLength, orient);
      const pWingStbdTop = this.project(wingWidth, 0, -28 - wingLength, orient);
      const pWingStbdBtm = this.project(-wingWidth, 0, -28 - wingLength, orient);

      ctx.save();
      // Render Port Wing
      ctx.beginPath();
      ctx.moveTo(pWingPortBase.px, pWingPortBase.py);
      ctx.lineTo(pWingPortBtm.px, pWingPortBtm.py);
      ctx.lineTo(pWingPortTop.px, pWingPortTop.py);
      ctx.lineTo(pWingPortBase.px, pWingPortBase.py);
      ctx.closePath();
      ctx.fillStyle = 'rgba(14, 116, 144, 0.75)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Render Starboard Wing
      ctx.beginPath();
      ctx.moveTo(pWingStbdBase.px, pWingStbdBase.py);
      ctx.lineTo(pWingStbdBtm.px, pWingStbdBtm.py);
      ctx.lineTo(pWingStbdTop.px, pWingStbdTop.py);
      ctx.lineTo(pWingStbdBase.px, pWingStbdBase.py);
      ctx.closePath();
      ctx.fillStyle = 'rgba(14, 116, 144, 0.75)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Photovoltaic grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.restore();
    }

    drawAntennaAndRadar(ctx, orient) {
      // Dish antenna mounted on dorsal mast
      const pMastBase = this.project(15, -28, 0, orient);
      const pMastTop = this.project(15, -50, 0, orient);
      const pDishRim1 = this.project(25, -60, 14, orient);
      const pDishRim2 = this.project(5, -40, -14, orient);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pMastBase.px, pMastBase.py);
      ctx.lineTo(pMastTop.px, pMastTop.py);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Elliptical dish reflector
      ctx.beginPath();
      ctx.ellipse(pMastTop.px, pMastTop.py, 16 * this.zoom, 8 * this.zoom, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.7)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      // Radar sweep pulsing beacon
      const pRadar = this.project(65, -18, 0, orient);
      const pulseR = 3 + Math.sin(Date.now() / 150) * 2;
      ctx.beginPath();
      ctx.arc(pRadar.px, pRadar.py, pulseR * this.zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.restore();
    }

    drawThrusters(ctx, orient, thrusters, mode) {
      // Thruster 1: X-Axis (Aft Engine Bell)
      const pAft = this.project(-60, 0, 0, orient);
      const cmdX = (thrusters.x?.percent || 0) / 100;
      this.drawEnginePlume(ctx, pAft, cmdX, -1, 0, mode, 'X');

      // Thruster 2: Y-Axis (Lateral Thrusters Port/Starboard)
      const pPort = this.project(0, 0, 28, orient);
      const cmdY = (thrusters.y?.percent || 0) / 100;
      this.drawEnginePlume(ctx, pPort, cmdY, 0, 1, mode, 'Y');

      // Thruster 3: Z-Axis (Dorsal/Ventral Thrusters)
      const pVentral = this.project(0, 28, 0, orient);
      const cmdZ = (thrusters.z?.percent || 0) / 100;
      this.drawEnginePlume(ctx, pVentral, cmdZ, 0, -1, mode, 'Z');
    }

    drawEnginePlume(ctx, origin, cmd, dirX, dirY, mode, label) {
      if (Math.abs(cmd) < 0.02) return;
      ctx.save();

      const plumeLength = Math.abs(cmd) * (mode === 'chemical' ? 70 : 45) * this.zoom;
      const plumeWidth = Math.abs(cmd) * (mode === 'chemical' ? 18 : 10) * this.zoom;

      // Color coding: Chemical = Orange flame / Blue core, Solar-Electric = Cyan / Purple ion glow
      const isChemical = mode === 'chemical';
      const colOuter = isChemical ? 'rgba(251, 146, 60, 0.85)' : 'rgba(168, 85, 247, 0.85)';
      const colInner = isChemical ? '#38bdf8' : '#00e5ff';

      const sign = cmd > 0 ? 1 : -1;
      const endX = origin.px + dirX * plumeLength * sign;
      const endY = origin.py + dirY * plumeLength * sign;

      // Dynamic flame flicker
      const flicker = (Math.random() - 0.5) * 4;

      ctx.beginPath();
      ctx.moveTo(origin.px - plumeWidth / 2, origin.py);
      ctx.lineTo(origin.px + plumeWidth / 2, origin.py);
      ctx.lineTo(endX + flicker, endY + flicker);
      ctx.closePath();

      const flameGrad = ctx.createLinearGradient(origin.px, origin.py, endX, endY);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, colInner);
      flameGrad.addColorStop(1, colOuter);

      ctx.fillStyle = flameGrad;
      ctx.shadowColor = colInner;
      ctx.shadowBlur = 18;
      ctx.fill();

      ctx.restore();
    }

    drawOverlayHUD(ctx, s) {
      ctx.save();
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`SIMULATOR: 3D VIEW (Drag: Orbit · Wheel: Zoom)`, 14, 20);

      const orient = s.spacecraft?.orientation || { pitch: 0, yaw: 0, roll: 0 };
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`PITCH: ${U.fixed(orient.pitch, 1)}° | YAW: ${U.fixed(orient.yaw, 1)}° | ROLL: ${U.fixed(orient.roll, 1)}°`, 14, 38);

      const mode = s.propulsionMode ? s.propulsionMode.toUpperCase() : 'CHEMICAL';
      ctx.fillStyle = mode === 'CHEMICAL' ? '#fb923c' : '#00e5ff';
      ctx.fillText(`PROPULSION: ${mode}`, 14, 56);
      ctx.restore();
    }
  }

  MM.SpacecraftView = SpacecraftView;
})();
