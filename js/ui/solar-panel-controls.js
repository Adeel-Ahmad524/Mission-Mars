/* MissionMind 2.0 — Solar Energy & Propulsion Power Management View */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;

  class SolarPanelControlsView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
    }

    init() {
      this.bindButtons();
      this.bindAngleSlider();
      this.bindPropulsionModeSelector();
      this.render();

      MM.bus.on('energy:updated', () => this.render());
      MM.bus.on('sim:tick', () => this.render());
      MM.bus.on('propulsion:mode-changed', () => this.render());
    }

    bindButtons() {
      const btnToggle = $('#btn-toggle-solar-panels');
      if (btnToggle) {
        btnToggle.addEventListener('click', () => {
          if (this.app.energyEngine) {
            this.app.energyEngine.togglePanels();
            this.render();
          }
        });
      }

      const btnAutoAlign = $('#btn-align-sun');
      if (btnAutoAlign) {
        btnAutoAlign.addEventListener('click', () => {
          if (this.app.energyEngine) {
            this.app.energyEngine.setPanelAngle(0);
            this.stateManager.addLog('systems', 'Solar Panels Aligned to Sun Vector', 'Incident angle zeroed. Photovoltaic yield maximized.', { severity: 'info' });
            MM.bus.emit('toast', { type: 'success', title: 'Solar Array Aligned', message: 'Sun tracking locked at 0° incident angle.' });
            this.render();
          }
        });
      }
    }

    bindAngleSlider() {
      const slider = $('#input-solar-angle');
      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = Number(e.target.value);
          if (this.app.energyEngine) {
            this.app.energyEngine.setPanelAngle(val);
            this.render();
          }
        });
      }
    }

    bindPropulsionModeSelector() {
      const pills = document.querySelectorAll('.prop-pill');
      pills.forEach((pill) => {
        pill.addEventListener('click', () => {
          const mode = pill.dataset.propMode;
          if (this.app.spacecraftEngine) {
            this.app.spacecraftEngine.setPropulsionMode(mode);
            this.render();
          }
        });
      });
    }

    render() {
      const s = this.stateManager.state;
      const solar = s.solar || {};
      const battery = s.battery || {};
      const propMode = s.propulsionMode || 'chemical';

      // Toggle button text & state
      const btnToggle = $('#btn-toggle-solar-panels');
      if (btnToggle) {
        const isDeployed = solar.deployed;
        btnToggle.textContent = isDeployed ? 'Retract Solar Panels' : 'Deploy Solar Panels';
        btnToggle.className = isDeployed ? 'btn btn-warning' : 'btn btn-primary';
      }

      const elDeployStatus = $('#solar-deploy-status');
      if (elDeployStatus) {
        const pct = Math.round((solar.deploymentProgress || 1.0) * 100);
        elDeployStatus.textContent = solar.deployed ? `DEPLOYED (${pct}%)` : `RETRACTED (${pct}%)`;
        elDeployStatus.className = 'badge ' + (solar.deployed ? 'badge-blue' : 'badge-amber');
      }

      // Live power generation & battery readouts
      const elGenPower = $('#telemetry-solar-generated-w');
      if (elGenPower) elGenPower.textContent = U.thousands(Math.round(solar.generatedPowerW || 0)) + ' W';

      const elIrradiance = $('#telemetry-solar-irradiance');
      if (elIrradiance) elIrradiance.textContent = U.thousands(solar.irradiance || 1361) + ' W/m²';

      const elAngle = $('#telemetry-solar-angle');
      if (elAngle) elAngle.textContent = (solar.angleDeg != null ? solar.angleDeg : 15) + '°';

      const elCosLoss = $('#telemetry-solar-cos-loss');
      if (elCosLoss) {
        const ang = (solar.angleDeg || 0) * Math.PI / 180;
        const loss = Math.round((1 - Math.max(0, Math.cos(ang))) * 100);
        elCosLoss.textContent = `${loss}%`;
      }

      const elBatPct = $('#telemetry-battery-pct');
      if (elBatPct) elBatPct.textContent = U.pct(battery.chargePercent || 85, 1);

      const elBatWh = $('#telemetry-battery-wh');
      if (elBatWh) elBatWh.textContent = `${U.thousands(battery.storedEnergyWh || 51000)} / ${U.thousands(battery.capacityWh || 60000)} Wh`;

      const elNetPower = $('#telemetry-battery-net-w');
      if (elNetPower) {
        const net = Math.round(battery.netPowerW || 0);
        elNetPower.textContent = (net >= 0 ? '+' : '') + U.thousands(net) + ' W';
        elNetPower.style.color = net >= 0 ? '#4ade80' : '#f87171';
      }

      const elBatBar = $('#battery-charge-bar');
      if (elBatBar) {
        const pct = U.clamp(battery.chargePercent || 85, 0, 100);
        elBatBar.style.width = `${pct}%`;
        elBatBar.className = pct < 20 ? 'bar-red' : pct < 45 ? 'bar-amber' : 'bar-green';
      }

      // Propulsion mode buttons
      document.querySelectorAll('.prop-pill').forEach((pill) => {
        pill.classList.toggle('active', pill.dataset.propMode === propMode);
      });
    }
  }

  MM.SolarPanelControlsView = SolarPanelControlsView;
})();
