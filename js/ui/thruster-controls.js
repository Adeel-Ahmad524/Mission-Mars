/* MissionMind 2.0 — 3-Axis Thruster & Manual Attitude Flight Controls */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;

  class ThrusterControlsView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
    }

    init() {
      this.bindKnobs();
      this.bindOrientationControls();
      this.bindEmergencyCutoff();
      this.bindFlightModeSelector();
      this.render();

      MM.bus.on('thrusters:update', () => this.render());
      MM.bus.on('control:mode-changed', () => this.render());
      MM.bus.on('spacecraft:oriented', () => this.render());
    }

    bindKnobs() {
      // Setup rotary drag / click behavior for Thruster X, Y, Z
      ['x', 'y', 'z'].forEach((axis) => {
        const knob = $(`#knob-thruster-${axis}`);
        const input = $(`#input-thruster-${axis}`);
        const btnZero = $(`#btn-thruster-${axis}-zero`);
        const btnFullPos = $(`#btn-thruster-${axis}-full`);
        const btnFullNeg = $(`#btn-thruster-${axis}-rev`);

        if (input) {
          input.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            if (this.app.spacecraftEngine) {
              this.app.spacecraftEngine.setThrusterCommand(axis, val);
            }
          });
        }

        if (btnZero) {
          btnZero.addEventListener('click', () => {
            if (this.app.spacecraftEngine) this.app.spacecraftEngine.setThrusterCommand(axis, 0);
          });
        }
        if (btnFullPos) {
          btnFullPos.addEventListener('click', () => {
            if (this.app.spacecraftEngine) this.app.spacecraftEngine.setThrusterCommand(axis, 100);
          });
        }
        if (btnFullNeg) {
          btnFullNeg.addEventListener('click', () => {
            if (this.app.spacecraftEngine) this.app.spacecraftEngine.setThrusterCommand(axis, -100);
          });
        }

        // Mouse drag on rotary dial
        if (knob) {
          let dragging = false;
          let startY = 0;
          let startVal = 0;

          knob.addEventListener('mousedown', (e) => {
            dragging = true;
            startY = e.clientY;
            startVal = Number(input ? input.value : 0);
            e.preventDefault();
          });

          window.addEventListener('mouseup', () => { dragging = false; });
          window.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const dy = startY - e.clientY; // drag up = positive
            const newVal = U.clamp(Math.round(startVal + dy * 0.9), -100, 100);
            if (input) input.value = newVal;
            if (this.app.spacecraftEngine) this.app.spacecraftEngine.setThrusterCommand(axis, newVal);
          });
        }
      });
    }

    bindOrientationControls() {
      ['pitch', 'yaw', 'roll'].forEach((orient) => {
        const input = $(`#input-orient-${orient}`);
        if (input) {
          input.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            const s = this.stateManager.state;
            const current = s.spacecraft?.orientation || { pitch: 0, yaw: 0, roll: 0 };
            current[orient] = val;
            if (this.app.spacecraftEngine) {
              this.app.spacecraftEngine.setOrientation(current.pitch, current.yaw, current.roll);
            }
          });
        }
      });
    }

    bindEmergencyCutoff() {
      const btn = $('#btn-emergency-cutoff');
      if (btn) {
        btn.addEventListener('click', () => {
          if (this.app.spacecraftEngine) {
            this.app.spacecraftEngine.emergencyShutdown();
            ['x', 'y', 'z'].forEach((a) => {
              const inp = $(`#input-thruster-${a}`);
              if (inp) inp.value = 0;
            });
            this.render();
          }
        });
      }
    }

    bindFlightModeSelector() {
      const modeButtons = document.querySelectorAll('.mode-btn');
      modeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.mode;
          if (this.app.controlManager) {
            this.app.controlManager.setMode(mode);
          }
        });
      });
    }

    render() {
      const s = this.stateManager.state;
      const thrusters = s.thrusters || {};
      const mode = s.controlMode || 'manual';

      // Update active flight mode button
      document.querySelectorAll('.mode-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });

      // Update 3-axis thruster dial rotations & readouts
      ['x', 'y', 'z'].forEach((axis) => {
        const t = thrusters[axis] || { percent: 0, thrustN: 0, tempC: 22, status: 'nominal' };
        const pct = Math.round(t.percent || 0);

        const elVal = $(`#val-thruster-${axis}`);
        if (elVal) elVal.textContent = (pct > 0 ? '+' : '') + pct + '%';

        const elThrustN = $(`#thrust-n-${axis}`);
        if (elThrustN) elThrustN.textContent = U.thousands(Math.abs(t.thrustN || 0)) + ' N';

        const elTemp = $(`#temp-thruster-${axis}`);
        if (elTemp) elTemp.textContent = Math.round(t.tempC || 22) + '°C';

        const elStatus = $(`#status-thruster-${axis}`);
        if (elStatus) {
          elStatus.textContent = t.status.toUpperCase();
          elStatus.className = `thruster-status-pill thruster-status-${t.status}`;
        }

        // Rotate knob pointer
        const dial = $(`#knob-dial-${axis}`);
        if (dial) {
          // Bipolar angle: 0% = 0 deg, +100% = +135 deg, -100% = -135 deg
          const deg = (pct / 100) * 135;
          dial.style.transform = `rotate(${deg}deg)`;
        }

        const input = $(`#input-thruster-${axis}`);
        if (input && document.activeElement !== input) {
          input.value = pct;
        }
      });

      // Total thrust & mass flow summary
      const elTotalThrust = $('#telemetry-total-thrust');
      if (elTotalThrust) elTotalThrust.textContent = U.thousands(Math.round(thrusters.totalThrustN || 0)) + ' N';

      const elFlowRate = $('#telemetry-mass-flow');
      if (elFlowRate) elFlowRate.textContent = U.fixed(thrusters.propellantFlowRateKgS || 0, 3) + ' kg/s';

      const elPropMode = $('#telemetry-prop-mode-label');
      if (elPropMode) elPropMode.textContent = (thrusters.mode || 'chemical').toUpperCase();

      // Orientation readouts
      const orient = s.spacecraft?.orientation || { pitch: 0, yaw: 0, roll: 0 };
      ['pitch', 'yaw', 'roll'].forEach((deg) => {
        const valEl = $(`#val-orient-${deg}`);
        if (valEl) valEl.textContent = U.fixed(orient[deg] || 0, 1) + '°';
      });
    }
  }

  MM.ThrusterControlsView = ThrusterControlsView;
})();
