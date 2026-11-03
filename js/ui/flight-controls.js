/* MissionMind 2.0 — Manual flight operations: fuel, thermal, gravity and descent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;
  const $ = MM.$;

  const DESCENT_LABELS = {
    idle: 'IDLE',
    chute: 'PARACHUTE',
    retro: 'RETRO BURN',
    landed: 'LANDED',
    crashed: 'CRASHED'
  };

  class FlightControlsView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
      this.spacecraftEngine = app.spacecraftEngine;
      this.descentEngine = app.descentEngine;
      this.lastThermalTarget = 22;
    }

    init() {
      this.bindFuelControls();
      this.bindThermalControls();
      this.bindDescentControls();
      this.bindBus();
      this.render();
      this.renderDescent(this.descentEngine ? this.descentEngine.telemetry : this.stateManager.state.descent);
    }

    bindBus() {
      MM.bus.on('state:change', () => this.render());
      MM.bus.on('fuel:updated', () => this.renderFuel());
      MM.bus.on('landing:update', (data) => this.renderDescent(data));
      MM.bus.on('mission:reset', () => this.render());
      MM.bus.on('orbit:changed', () => this.renderGravity());
      MM.bus.on('sim:tick', () => this.renderGravity());
    }

    /* ---------------- Fuel operator ---------------- */
    bindFuelControls() {
      const pump = $('#fuel-pump-input');
      if (pump) {
        pump.addEventListener('input', (event) => {
          const value = Number(event.target.value);
          this.spacecraftEngine.setFuelPump(value);
          this.renderFuel();
        });
        pump.addEventListener('change', (event) => {
          const value = Number(event.target.value);
          this.stateManager.addLog('fuel', 'Manual fuel pump adjustment', `Fuel pump throttle set to ${value}%. Maximum thrust and propellant flow scale with pump output.`, { severity: value < 25 ? 'warning' : 'info' });
        });
      }

      document.querySelectorAll('[data-fuel-pump]').forEach((button) => {
        button.addEventListener('click', () => {
          const value = Number(button.dataset.fuelPump);
          this.spacecraftEngine.setFuelPump(value);
          if (pump) pump.value = value;
          this.renderFuel();
          this.stateManager.addLog('fuel', 'Fuel pump preset', `Fuel pump throttle set to ${value}%.`, { severity: 'info' });
        });
      });

      $('#btn-fuel-valve')?.addEventListener('click', () => {
        this.spacecraftEngine.toggleFeedValve();
        this.renderFuel();
      });

      $('#btn-fuel-conserve')?.addEventListener('click', () => {
        this.spacecraftEngine.setFeedValve(true, { silent: true });
        this.spacecraftEngine.setFuelPump(50);
        if (pump) pump.value = 50;
        this.stateManager.addLog('fuel', 'Fuel conservation profile selected', 'Main feed open at 50% pump output. Propellant mass flow reduced by half.', { severity: 'info' });
        MM.bus.emit('toast', { type: 'info', title: 'Conservation profile', message: 'Fuel pump set to 50%. Thrust and flow are derated.' });
        this.renderFuel();
      });
    }

    renderFuel() {
      const fuel = this.spacecraftEngine ? this.spacecraftEngine.getFuelTelemetry() : (this.stateManager.state.fuelSystem || {});
      const stateFuel = this.stateManager.state.resources.fuel;
      const capacity = fuel.capacityKg || 15000;
      const remaining = fuel.remainingKg != null ? fuel.remainingKg : 12500;

      this.setText('fuel-ops-remaining', `${U.thousands(remaining)} kg`);
      this.setText('fuel-ops-percent', `${U.fixed(stateFuel, 1)}% of ${U.thousands(capacity)} kg`);
      this.setText('fuel-pump-value', `${Math.round(fuel.pumpPercent || 0)}%`);
      this.setText('fuel-pump-readout', `${Math.round(fuel.pumpPercent || 0)}%`);
      this.setText('fuel-pressure', `${U.fixed(fuel.feedPressureBar || 0, 1)} bar`);
      this.setText('fuel-flow', `${U.fixed(fuel.flowRateKgS || 0, 3)} kg/s`);
      this.setText('fuel-feed-state', fuel.valveOpen ? 'OPEN' : 'ISOLATED');

      const pumpInput = $('#fuel-pump-input');
      if (pumpInput && document.activeElement !== pumpInput) pumpInput.value = String(fuel.pumpPercent || 0);

      const pressureBar = $('#fuel-pressure-bar');
      if (pressureBar) {
        const pct = U.clamp(((fuel.feedPressureBar || 0) / ((fuel.feedPressureNominalBar || 25) + 5)) * 100, 0, 100);
        pressureBar.style.width = `${pct}%`;
        pressureBar.className = pct < 25 ? 'bar-red' : pct < 60 ? 'bar-amber' : 'bar-green';
      }

      const status = fuel.status || 'nominal';
      const badge = $('#fuel-ops-status');
      if (badge) {
        const map = {
          nominal: ['green', 'NOMINAL'],
          'low-feed': ['amber', 'LOW FEED'],
          isolated: ['red', 'ISOLATED'],
          empty: ['red', 'EMPTY']
        };
        const [color, label] = map[status] || ['blue', String(status).toUpperCase()];
        badge.className = `pill pill-${color}`;
        badge.textContent = label;
      }

      const valveBtn = $('#btn-fuel-valve');
      if (valveBtn) {
        const open = Boolean(fuel.valveOpen);
        valveBtn.classList.toggle('open', open);
        valveBtn.classList.toggle('closed', !open);
        valveBtn.setAttribute('aria-pressed', String(open));
        this.setText('fuel-valve-label', open ? 'FEED VALVE OPEN' : 'FEED VALVE ISOLATED');
      }
    }

    /* ---------------- Cabin thermal controller ---------------- */
    bindThermalControls() {
      const target = $('#thermal-target-input');
      if (target) {
        target.addEventListener('input', (event) => {
          this.applyThermalSetpoint(Number(event.target.value), false);
        });
        target.addEventListener('change', (event) => {
          this.applyThermalSetpoint(Number(event.target.value), true);
        });
      }

      document.querySelectorAll('[data-thermal-target]').forEach((button) => {
        button.addEventListener('click', () => {
          this.applyThermalSetpoint(Number(button.dataset.thermalTarget), true);
        });
      });

      document.querySelectorAll('[data-thermal-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          this.setThermalMode(button.dataset.thermalMode);
        });
      });

      const heater = $('#thermal-heater-input');
      if (heater) {
        heater.addEventListener('input', (event) => {
          this.setManualThermal('heaterPercent', Number(event.target.value));
        });
      }
      const cooler = $('#thermal-cooler-input');
      if (cooler) {
        cooler.addEventListener('input', (event) => {
          this.setManualThermal('coolerPercent', Number(event.target.value));
        });
      }
    }

    applyThermalSetpoint(value, log) {
      const target = U.clamp(Number(value) || 22, 16, 28);
      this.stateManager.update((s) => {
        s.systems.temperatureTarget = target;
        if (s.systems.thermalMode === 'off') s.systems.thermalMode = 'auto';
      }, 'thermal:setpoint');
      if (log) {
        this.stateManager.addLog('systems', 'Cabin temperature setpoint changed', `Thermal loop target set to ${U.fixed(target, 1)} °C.`, { severity: 'info' });
      }
      this.renderThermal();
    }

    setThermalMode(mode) {
      if (!['auto', 'manual', 'off'].includes(mode)) return;
      this.stateManager.update((s) => {
        s.systems.thermalMode = mode;
      }, 'thermal:mode');
      this.stateManager.addLog('systems', `Cabin thermal mode: ${mode.toUpperCase()}`,
        mode === 'auto' ? 'Automatic thermal loop driving toward the selected setpoint.'
          : mode === 'manual' ? 'Manual heater and cooler outputs enabled.'
            : 'Thermal loop disabled. Cabin temperature will drift.',
        { severity: mode === 'off' ? 'warning' : 'info' });
      this.renderThermal();
    }

    setManualThermal(key, value) {
      const pct = U.clamp(Number(value) || 0, 0, 100);
      this.stateManager.update((s) => {
        s.systems[key] = pct;
        s.systems.thermalMode = 'manual';
      }, 'thermal:manual');
      this.renderThermal();
    }

    renderThermal() {
      const s = this.stateManager.state;
      const temp = Number(s.systems.temperature) || 0;
      const target = Number(s.systems.temperatureTarget) || 22;
      const mode = s.systems.thermalMode || 'auto';
      const heater = Number(s.systems.heaterPercent) || 0;
      const cooler = Number(s.systems.coolerPercent) || 0;

      this.setText('thermal-current', `${U.fixed(temp, 1)} °C`);
      this.setText('thermal-target-value', `${U.fixed(target, 1)} °C`);
      this.setText('thermal-target-readout', `${U.fixed(target, 1)} °C`);
      this.setText('thermal-status', temp < 16 ? 'Below comfort band' : temp > 29 ? 'Above comfort band' : 'Within comfort band');
      this.setText('thermal-heater-readout', `${Math.round(heater)}%`);
      this.setText('thermal-cooler-readout', `${Math.round(cooler)}%`);

      const targetInput = $('#thermal-target-input');
      if (targetInput && document.activeElement !== targetInput) targetInput.value = String(target);
      const heaterInput = $('#thermal-heater-input');
      if (heaterInput && document.activeElement !== heaterInput) heaterInput.value = String(heater);
      const coolerInput = $('#thermal-cooler-input');
      if (coolerInput && document.activeElement !== coolerInput) coolerInput.value = String(cooler);

      const pill = $('#thermal-mode-pill');
      if (pill) {
        pill.className = `pill ${mode === 'auto' ? 'pill-green' : mode === 'manual' ? 'pill-blue' : 'pill-amber'}`;
        pill.textContent = mode.toUpperCase();
      }

      document.querySelectorAll('[data-thermal-mode]').forEach((button) => {
        button.classList.toggle('active', button.dataset.thermalMode === mode);
      });

      const manual = $('#thermal-manual-controls');
      if (manual) manual.hidden = mode !== 'manual';

      const pct = (value) => U.clamp(((value - 10) / 25) * 100, 0, 100);
      const marker = $('#thermal-band-marker');
      const targetMark = $('#thermal-band-target');
      const fill = $('#thermal-band-fill');
      if (marker) marker.style.left = `${pct(temp)}%`;
      if (targetMark) targetMark.style.left = `${pct(target)}%`;
      if (fill) {
        fill.style.left = `${Math.min(pct(temp), pct(target))}%`;
        fill.style.width = `${Math.abs(pct(temp) - pct(target))}%`;
        fill.className = temp > 29 ? 'thermal-band-fill hot' : temp < 16 ? 'thermal-band-fill cold' : 'thermal-band-fill';
      }
    }

    /* ---------------- Gravity at point ---------------- */
    renderGravity() {
      const s = this.stateManager.state;
      const orbit = s.orbit || {};
      const bodyId = orbit.bodyId || s.centralBody || 'earth';
      const body = CFG.BODIES[bodyId] || CFG.BODIES.earth;
      const radius = Number(orbit.radius) || body.defaultOrbitRadius;
      const altitudeM = Math.max(0, radius - body.radius);
      const g = MM.physics ? MM.physics.gravitationalAcceleration(body.mass, radius) : 0;
      const vEsc = radius > 0 ? Math.sqrt((2 * CFG.PHYSICS.G * body.mass) / radius) / 1000 : 0;

      this.setText('gravity-local', `${U.fixed(g, 2)} m/s²`);
      this.setText('gravity-body', body.name.toUpperCase());
      this.setText('gravity-central-body', body.name);
      this.setText('gravity-radius', `${U.thousands(Math.round(radius / 1000))} km`);
      this.setText('gravity-altitude', `${U.thousands(Math.round(altitudeM / 1000))} km`);
      this.setText('gravity-surface', `${U.fixed(body.surfaceGravity, 2)} m/s²`);
      this.setText('gravity-escape', `${U.fixed(vEsc, 2)} km/s`);
      const localG = $('#telemetry-local-g');
      if (localG) localG.textContent = `${U.fixed(g, 2)} m/s²`;

      const shipDot = $('#gravity-ship-dot');
      if (shipDot) {
        const angle = Number(orbit.trueAnomalyDeg) || 0;
        const offset = 34 + 20 * U.clamp((radius / body.defaultOrbitRadius - 1) / 3, 0, 1);
        shipDot.style.transform = `rotate(${angle}deg) translateX(${offset}px)`;
      }
    }

    /* ---------------- Descent speed controller ---------------- */
    bindDescentControls() {
      const target = $('#descent-target-input');
      if (target) {
        target.addEventListener('input', (event) => {
          const value = Number(event.target.value);
          this.descentEngine.setTargetDescent(value);
          this.setText('descent-target-readout', `${U.fixed(value, 1)} m/s`);
          this.setText('descent-target', `${U.fixed(value, 1)} m/s`);
        });
        target.addEventListener('change', (event) => {
          this.stateManager.addLog('navigation', 'Landing descent speed target changed', `Target descent rate set to ${U.fixed(Number(event.target.value), 1)} m/s.`, { severity: 'info' });
        });
      }

      const throttle = $('#descent-throttle-input');
      if (throttle) {
        throttle.addEventListener('input', (event) => {
          const value = Number(event.target.value);
          this.descentEngine.setManualThrottle(value);
          this.setText('descent-throttle-readout', `${Math.round(value)}%`);
        });
      }

      document.querySelectorAll('[data-descent-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          const mode = button.dataset.descentMode;
          this.descentEngine.setMode(mode);
          this.stateManager.addLog('navigation', `Descent guidance mode: ${mode.toUpperCase()}`, mode === 'auto' ? 'Autopilot tracking the target descent rate.' : 'Manual retro-throttle authority enabled.', { severity: 'info' });
          this.renderDescent(this.descentEngine.telemetry);
        });
      });

      $('#btn-descent-start')?.addEventListener('click', () => {
        this.descentEngine.start();
        this.renderDescent(this.descentEngine.telemetry);
      });
      $('#btn-descent-hold')?.addEventListener('click', () => {
        this.descentEngine.hold();
        this.renderDescent(this.descentEngine.telemetry);
      });
      $('#btn-descent-abort')?.addEventListener('click', () => {
        this.descentEngine.abort();
        this.renderDescent(this.descentEngine.telemetry);
      });
      $('#btn-flightops-reset-descent')?.addEventListener('click', () => {
        this.descentEngine.abort();
        this.renderDescent(this.descentEngine.telemetry);
      });

      this.updateDescentManualVisibility('auto');
    }

    renderDescent(data) {
      if (!data) return;
      const status = data.status || 'idle';
      const altitude = Math.max(0, Number(data.altitudeM) || 0);
      const rate = Math.max(0, Number(data.descentRateMs) || 0);
      const target = Number(data.targetDescentMs) || 0;
      const mode = data.mode || 'auto';

      this.setText('descent-altitude', `${U.thousands(Math.round(altitude))} m`);
      this.setText('descent-altitude-label', `${U.thousands(Math.round(altitude))} m`);
      this.setText('descent-rate', `${U.fixed(rate, 1)} m/s`);
      this.setText('descent-target', `${U.fixed(target, 1)} m/s`);
      this.setText('descent-target-readout', `${U.fixed(target, 1)} m/s`);
      this.setText('descent-throttle', `${Math.round(data.throttlePercent || 0)}%`);
      this.setText('descent-throttle-readout', `${Math.round(data.manualThrottlePercent || 0)}%`);
      this.setText('descent-gravity', `${U.fixed(data.localGravity || 3.71, 2)} m/s²`);
      this.setText('descent-fuel', `${U.fixed(data.fuelUsedKg || 0, 1)} kg`);
      this.setText('descent-phase-label', DESCENT_LABELS[status] || status.toUpperCase());

      const bar = $('#descent-altitude-bar');
      if (bar) bar.style.height = `${U.clamp((altitude / (data.startAltitudeM || 2500)) * 100, 0, 100)}%`;
      const chute = $('#descent-chute-line');
      if (chute) chute.style.bottom = `${((data.chuteAltitudeM || 420) / (data.startAltitudeM || 2500)) * 100}%`;

      const badge = $('#descent-status');
      if (badge) {
        const color = status === 'landed' ? 'green' : status === 'crashed' ? 'red' : status === 'idle' ? 'blue' : 'amber';
        badge.className = `pill pill-${color}`;
        badge.textContent = DESCENT_LABELS[status] || status.toUpperCase();
      }

      const targetInput = $('#descent-target-input');
      if (targetInput && document.activeElement !== targetInput) targetInput.value = String(target);
      const throttleInput = $('#descent-throttle-input');
      if (throttleInput && document.activeElement !== throttleInput) throttleInput.value = String(data.manualThrottlePercent || 0);

      document.querySelectorAll('[data-descent-mode]').forEach((button) => {
        button.classList.toggle('active', button.dataset.descentMode === mode);
      });
      this.updateDescentManualVisibility(mode);

      const startBtn = $('#btn-descent-start');
      if (startBtn) {
        startBtn.textContent = status === 'idle' ? 'Start Descent' : status === 'landed' || status === 'crashed' ? 'Run Again' : 'Restart Descent';
      }
      const holdBtn = $('#btn-descent-hold');
      if (holdBtn) holdBtn.disabled = !data.active;

      const banner = $('#descent-banner');
      if (banner) {
        const messages = {
          idle: 'Parachute descent begins at 2,500 m. Retro-thrust terminal guidance starts below 420 m. Safe touchdown limit: 3.0 m/s.',
          chute: 'Parachute phase active. The module is descending at terminal velocity; retro-thrust ignition occurs at 420 m. No propellant is being consumed.',
          retro: mode === 'auto'
            ? `Autopilot tracking ${U.fixed(target, 1)} m/s. Retro-throttle ${Math.round(data.throttlePercent || 0)}%, hover throttle is about ${data.hoverThrottlePercent || 0}%.`
            : `Manual retro-throttle ${Math.round(data.throttlePercent || 0)}%. Increase throttle early to avoid a high-speed impact.`,
          landed: `Touchdown confirmed at ${U.fixed(data.touchdownSpeedMs || 0, 2)} m/s. ${U.fixed(data.fuelUsedKg || 0, 1)} kg of propellant used.`,
          crashed: `Impact at ${U.fixed(data.touchdownSpeedMs || 0, 2)} m/s exceeded the 3.0 m/s limit. Reset and try a higher retro-throttle or lower target speed.`
        };
        banner.textContent = messages[status] || messages.idle;
        banner.className = `descent-banner ${status === 'landed' ? 'success' : status === 'crashed' ? 'danger' : status === 'idle' ? '' : 'active'}`;
      }
    }

    updateDescentManualVisibility(mode) {
      const manual = $('#descent-manual-controls');
      if (manual) manual.hidden = mode !== 'manual';
    }

    /* ---------------- Shared helpers ---------------- */
    render() {
      this.renderFuel();
      this.renderThermal();
      this.renderGravity();
    }

    setText(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    }
  }

  MM.FlightControlsView = FlightControlsView;
})();
