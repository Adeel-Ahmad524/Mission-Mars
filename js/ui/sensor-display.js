/* MissionMind 2.0 — Sensor Monitoring Dashboard & Sparkline Telemetry */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;

  class SensorDisplayView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
    }

    init() {
      this.render();
      MM.bus.on('sensors:sync', () => this.render());
      MM.bus.on('sim:tick', () => this.render());
    }

    render() {
      const container = $('#sensor-cards-grid');
      if (!container || !this.app.sensorEngine) return;

      const engine = this.app.sensorEngine;
      const s = this.stateManager.state;
      const sensors = engine.sensors;

      const items = [
        {
          key: 'accelerometer',
          title: sensors.accelerometer.name,
          unit: sensors.accelerometer.unit,
          val: `${sensors.accelerometer.readings.total} ${sensors.accelerometer.unit}`,
          sub: `Ax: ${sensors.accelerometer.readings.ax} | Ay: ${sensors.accelerometer.readings.ay} | Az: ${sensors.accelerometer.readings.az}`,
          status: sensors.accelerometer.status,
          history: sensors.accelerometer.history
        },
        {
          key: 'gyroscope',
          title: sensors.gyroscope.name,
          unit: sensors.gyroscope.unit,
          val: `${sensors.gyroscope.readings.totalRate} ${sensors.gyroscope.unit}`,
          sub: `Pitch: ${sensors.gyroscope.readings.pitchRate}°/s | Yaw: ${sensors.gyroscope.readings.yawRate}°/s | Roll: ${sensors.gyroscope.readings.rollRate}°/s`,
          status: sensors.gyroscope.status,
          history: sensors.gyroscope.history
        },
        {
          key: 'distance',
          title: sensors.distance.name,
          unit: sensors.distance.unit,
          val: `${sensors.distance.readings.altitudeKm} km`,
          sub: `Surface Altitude: ${sensors.distance.readings.altitudeKm} km | Nearest Target: ${sensors.distance.readings.closestTargetKm} km`,
          status: sensors.distance.status,
          history: sensors.distance.history
        },
        {
          key: 'temperature',
          title: sensors.temperature.name,
          unit: sensors.temperature.unit,
          val: `${sensors.temperature.readings.thruster} °C (Thruster)`,
          sub: `Cabin: ${sensors.temperature.readings.internal}°C | Hull: ${sensors.temperature.readings.external}°C | Battery: ${sensors.temperature.readings.battery}°C`,
          status: sensors.temperature.status,
          history: sensors.temperature.history
        },
        {
          key: 'radiation',
          title: sensors.radiation.name,
          unit: sensors.radiation.unit,
          val: `${sensors.radiation.readings.intensity} ${sensors.radiation.unit}`,
          sub: `Cumulative Mission Dose: ${sensors.radiation.readings.accumulatedMSv} mSv`,
          status: sensors.radiation.status,
          history: sensors.radiation.history
        },
        {
          key: 'solar',
          title: sensors.solar.name,
          unit: sensors.solar.unit,
          val: `${sensors.solar.readings.irradiance} ${sensors.solar.unit}`,
          sub: `Sun Exposure: ${sensors.solar.readings.exposurePct}% | Incident Angle: ${sensors.solar.readings.incidentAngleDeg}° | Efficiency: ${sensors.solar.readings.efficiencyPct}%`,
          status: sensors.solar.status,
          history: sensors.solar.history
        },
        {
          key: 'fuel',
          title: sensors.fuel.name,
          unit: sensors.fuel.unit,
          val: `${U.thousands(sensors.fuel.readings.remainingKg)} kg (${sensors.fuel.readings.percent}%)`,
          sub: `Propellant Mass Flow: ${sensors.fuel.readings.flowRateKgS} kg/s`,
          status: sensors.fuel.status,
          history: sensors.fuel.history
        }
      ];

      container.innerHTML = items.map((item) => {
        const badgeClass = item.status === 'critical' ? 'badge-red' : item.status === 'warning' ? 'badge-amber' : 'badge-green';
        const sparklineSvg = this.generateSparkline(item.history);
        return `
          <div class="card sensor-card">
            <div class="card-head tight">
              <div>
                <span class="card-kicker">SENSOR MODULE</span>
                <h4>${item.title}</h4>
              </div>
              <span class="badge ${badgeClass}">${item.status.toUpperCase()}</span>
            </div>
            <div style="font-family:var(--mono);font-size:1.3rem;font-weight:700;color:#38bdf8;margin:4px 0;">
              ${item.val}
            </div>
            <div class="sensor-subtext" style="font-family:var(--mono);font-size:0.7rem;color:var(--text-2);margin-bottom:8px;">
              ${item.sub}
            </div>
            <div class="sensor-sparkline" style="height:36px;width:100%;margin-top:4px;">
              ${sparklineSvg}
            </div>
          </div>
        `;
      }).join('');
    }

    generateSparkline(history) {
      if (!history || history.length < 2) {
        return `<svg viewBox="0 0 200 36" style="width:100%;height:100%;"><line x1="0" y1="18" x2="200" y2="18" stroke="rgba(148,163,184,0.2)" stroke-width="1.2"/></svg>`;
      }
      const vals = history.map((h) => h.val || 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min === 0 ? 1 : max - min;

      const pts = history.map((h, i) => {
        const x = (i / (history.length - 1)) * 200;
        const y = 32 - ((h.val - min) / span) * 26;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      return `
        <svg viewBox="0 0 200 36" style="width:100%;height:100%;overflow:visible;">
          <polyline fill="none" stroke="#38bdf8" stroke-width="1.8" points="${pts}" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }
  }

  MM.SensorDisplayView = SensorDisplayView;
})();
