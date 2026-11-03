/* MissionMind — Telemetry view controller */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;
  const UI = MM.ui;

  class TelemetryView {
    constructor(app) {
      this.app = app;
      this.sm = app.stateManager;
    }

    init() {
      this.bind();
      this.render();
    }

    bind() {
      MM.bus.on('state:change', () => this.render());
      MM.bus.on('mission:reset', () => this.render());
      MM.bus.on('agents:cycle', () => this.render());

      $('#btn-telemetry-export')?.addEventListener('click', () => {
        const samples = this.sm.telemetry;
        if (!samples.length) {
          UI.toast('warning', 'No telemetry to export', 'Start the mission to record samples.');
          return;
        }
        const header = 'mission_day,fuel_pct,power_pct,oxygen_pct,equipment_health_pct,temperature_c,risk_index,progress_pct,agent_cycles,decisions';
        const rows = samples.map((s) => [s.day, s.fuel, s.power, s.oxygen, s.health, s.temp, s.risk, s.progress, s.reports, s.decisions].join(','));
        U.download(`missionmind-telemetry-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows].join('\n'), 'text/csv');
        UI.toast('success', 'Telemetry exported', `${samples.length} samples written to CSV.`);
      });
    }

    setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    render() {
      const s = this.sm.state;
      const performance = this.sm.computePerformance();
      this.setText('tel-performance', String(performance));
      this.setText('tel-emergencies', String(s.metrics.emergenciesDetected));
      this.setText('tel-responses', String(s.metrics.responsesCompleted));
      this.setText('tel-decisions', String(s.metrics.decisions));
      this.setText('tel-cycles', String(s.metrics.agentCycles));
      this.setText('tel-rejected', String(s.metrics.rejectedActions));
      this.setText('chart-agent-note', `${MM.bus.reportCount} messages`);
      this.setText('chart-progress-note', `${U.fixed(s.progress, 1)}%`);
      this.setText('chart-health-note', `${U.fixed(s.systems.equipmentHealth, 1)}%`);

      const performanceEl = document.getElementById('tel-performance');
      if (performanceEl) {
        performanceEl.style.color = performance >= 80 ? '#86efac' : performance >= 55 ? '#fcd34d' : '#fca5a5';
      }

      const fuelFactor = (s.modes.fuelSaving ? 0.45 : 1) * (s.events.solarStorm ? 1.08 : 1);
      const powerFactor = (s.modes.powerSaving ? 0.55 : 1) * (s.modes.lifeSupportPriority ? 0.5 : 1) * (s.events.solarStorm ? 1.25 : 1) * (s.systems.science === 'active' ? 1.06 : 1);
      const oxygenFactor = (s.modes.lifeSupportPriority ? 0.62 : 1) * (s.events.solarStorm ? 1.04 : 1);

      const ledger = $('#resource-ledger');
      if (!ledger) return;
      ledger.innerHTML = `
        <div class="ledger-item">
          <span>Fuel</span>
          <strong>${U.fixed(s.resources.fuel, 1)}%<em> remaining</em></strong>
          <div class="ledger-sub">${U.fixed(s.resources.fuelConsumed, 1)} pts consumed · ≈ ${U.fixed(MM.RATES.fuelPerDay * fuelFactor, 2)}%/day</div>
        </div>
        <div class="ledger-item">
          <span>Electrical power</span>
          <strong>${U.fixed(s.resources.power, 1)}%<em> remaining</em></strong>
          <div class="ledger-sub">${U.fixed(s.resources.powerConsumed, 1)} pts consumed · ≈ ${U.fixed(MM.RATES.powerPerDay * powerFactor, 2)}%/day</div>
        </div>
        <div class="ledger-item">
          <span>Oxygen</span>
          <strong>${U.fixed(s.resources.oxygen, 1)}%<em> remaining</em></strong>
          <div class="ledger-sub">${U.fixed(s.resources.oxygenConsumed, 1)} pts consumed · ≈ ${U.fixed(MM.RATES.oxygenPerDay * oxygenFactor, 2)}%/day</div>
        </div>
        <div class="ledger-item">
          <span>Equipment health</span>
          <strong>${U.fixed(s.systems.equipmentHealth, 1)}%</strong>
          <div class="ledger-sub">Cabin ${U.fixed(s.systems.temperature, 1)} °C · ${s.missionFlags.repairs} repairs</div>
        </div>
        <div class="ledger-item">
          <span>Scientific value</span>
          <strong>${s.metrics.scientificValue}<em> pts</em></strong>
          <div class="ledger-sub">Payload ${s.systems.science} · last window ${s.missionFlags.lastScienceDay >= 0 ? 'D+' + U.fixed(s.missionFlags.lastScienceDay, 0) : 'none'}</div>
        </div>
        <div class="ledger-item">
          <span>Risk index</span>
          <strong>${s.metrics.riskIndex}<em>/100</em></strong>
          <div class="ledger-sub">${MM.riskCategory(s.metrics.riskIndex).toUpperCase()} · ${this.app.events.activeCount()} active events</div>
        </div>`;
    }
  }

  MM.TelemetryView = TelemetryView;
})();
