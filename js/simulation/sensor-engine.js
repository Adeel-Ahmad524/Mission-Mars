/* MissionMind 2.0 — Spacecraft Sensor Simulation Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class SensorEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.historyCapacity = 30;

      // 7 Specialized Sensors
      this.sensors = {
        accelerometer: {
          id: 'accel',
          name: 'Tri-Axial Inertial Accelerometer',
          unit: 'm/s²',
          readings: { ax: 0, ay: 0, az: 0, total: 0 },
          status: 'nominal',
          threshold: { warn: 12.0, critical: 25.0 },
          history: []
        },
        gyroscope: {
          id: 'gyro',
          name: 'Optical Ring-Laser Gyroscope',
          unit: 'deg/s',
          readings: { pitchRate: 0, yawRate: 0, rollRate: 0, totalRate: 0 },
          status: 'nominal',
          threshold: { warn: 5.0, critical: 15.0 },
          history: []
        },
        distance: {
          id: 'dist',
          name: 'Deep-Space LIDAR & Ranging Array',
          unit: 'km',
          readings: { altitudeKm: 400, surfaceDistKm: 400, closestTargetKm: 28.5 },
          status: 'nominal',
          threshold: { warn: 100, critical: 50 },
          history: []
        },
        temperature: {
          id: 'temp',
          name: 'Multi-Zone Thermal Radiometer',
          unit: '°C',
          readings: { internal: 21.5, external: -65.0, thruster: 22.0, battery: 24.2 },
          status: 'nominal',
          threshold: { warn: 70.0, critical: 95.0 },
          history: []
        },
        radiation: {
          id: 'rad',
          name: 'Silicon Dosimetric Radiation Sensor',
          unit: 'μSv/h',
          readings: { intensity: 22.4, accumulatedMSv: 1.2 },
          status: 'nominal',
          threshold: { warn: 80.0, critical: 200.0 },
          history: []
        },
        solar: {
          id: 'solar',
          name: 'Solar Flux & Pyranometer Spectrometer',
          unit: 'W/m²',
          readings: { irradiance: 1361, exposurePct: 96, incidentAngleDeg: 15, efficiencyPct: 32 },
          status: 'nominal',
          threshold: { warn: 400, critical: 150 },
          history: []
        },
        fuel: {
          id: 'fuel',
          name: 'Capacitive Propellant Quantity Sensor',
          unit: 'kg',
          readings: { remainingKg: 12500, percent: 83.3, flowRateKgS: 0 },
          status: 'nominal',
          threshold: { warn: 3000, critical: 1000 },
          history: []
        }
      };
    }

    /**
     * Update all sensors from authoritative simulation state
     */
    update() {
      const s = this.stateManager.state;
      const thrusters = s.thrusters || {};
      const orbit = s.orbit || {};
      const solar = s.solar || {};
      const sc = s.spacecraft || {};
      const isStorm = s.events && s.events.solarStorm;

      // 1. Accelerometer (directly from thrust acceleration + tiny microgravity jitter)
      const accel = sc.acceleration || { x: 0, y: 0, z: 0, magnitude: 0 };
      const jitter = (Math.sin(Date.now() / 300) * 0.002);
      this.sensors.accelerometer.readings = {
        ax: U.round(accel.x + jitter, 3),
        ay: U.round(accel.y, 3),
        az: U.round(accel.z, 3),
        total: U.round(accel.magnitude + Math.abs(jitter), 3)
      };
      this.evaluateStatus(this.sensors.accelerometer, this.sensors.accelerometer.readings.total);

      // 2. Gyroscope (orientation rates)
      const pr = U.round(sc.angularRates ? sc.angularRates.pitch : 0.01 * Math.sin(Date.now() / 400), 2);
      const yr = U.round(sc.angularRates ? sc.angularRates.yaw : 0.01 * Math.cos(Date.now() / 500), 2);
      const rr = U.round(sc.angularRates ? sc.angularRates.roll : 0.005, 2);
      const totalRate = U.round(Math.hypot(pr, yr, rr), 2);
      this.sensors.gyroscope.readings = { pitchRate: pr, yawRate: yr, rollRate: rr, totalRate };
      this.evaluateStatus(this.sensors.gyroscope, totalRate);

      // 3. Distance Sensor (altitude above central body + radar closest contact)
      const altKm = orbit.altitudeKm != null ? Math.max(0, orbit.altitudeKm) : 400;
      let closestContactKm = 999;
      if (s.radar && s.radar.objects && s.radar.objects.length > 0) {
        closestContactKm = Math.min(...s.radar.objects.map((o) => o.distanceKm || 999));
      }
      this.sensors.distance.readings = {
        altitudeKm: U.round(altKm, 1),
        surfaceDistKm: U.round(altKm, 1),
        closestTargetKm: closestContactKm !== 999 ? U.round(closestContactKm, 2) : 999
      };
      this.sensors.distance.status = altKm < 80 ? 'critical' : altKm < 150 ? 'warning' : 'nominal';

      // 4. Temperature Sensor (linked to thruster status, solar angle, and storm)
      const thrusterMaxTemp = Math.max(
        thrusters.x ? thrusters.x.tempC : 22,
        thrusters.y ? thrusters.y.tempC : 22,
        thrusters.z ? thrusters.z.tempC : 22
      );
      const cabinBase = s.systems ? s.systems.temperature : 21.5;
      this.sensors.temperature.readings = {
        internal: U.round(cabinBase, 1),
        external: U.round(-65 + (isStorm ? 35 : 0) + (solar.angleDeg < 45 ? 18 : 0), 1),
        thruster: U.round(thrusterMaxTemp, 1),
        battery: U.round(24 + (s.battery ? Math.abs(s.battery.netPowerW) / 600 : 0), 1)
      };
      this.evaluateStatus(this.sensors.temperature, thrusterMaxTemp);

      // 5. Radiation Sensor (baseline + solar flare spike)
      const baseRad = isStorm ? 165.0 : 21.5;
      const radNoise = Math.sin(Date.now() / 600) * 2.2;
      const radValue = U.round(Math.max(1, baseRad + radNoise), 1);
      this.sensors.radiation.readings = {
        intensity: radValue,
        accumulatedMSv: U.round(1.2 + (s.tick * 0.001) + (isStorm ? s.tick * 0.015 : 0), 3)
      };
      this.evaluateStatus(this.sensors.radiation, radValue);

      // 6. Solar Sensor
      this.sensors.solar.readings = {
        irradiance: solar.irradiance || 1361,
        exposurePct: solar.deployed ? U.round(Math.max(0, Math.cos((solar.angleDeg || 0) * Math.PI / 180) * 100), 1) : 0,
        incidentAngleDeg: solar.angleDeg != null ? solar.angleDeg : 15,
        efficiencyPct: 32
      };
      this.sensors.solar.status = !solar.deployed ? 'warning' : 'nominal';

      // 7. Fuel Sensor
      const fuelKg = sc.fuelMass != null ? sc.fuelMass : 12500;
      const fuelFlow = thrusters.propellantFlowRateKgS || 0;
      this.sensors.fuel.readings = {
        remainingKg: U.round(fuelKg, 1),
        percent: U.round((fuelKg / 15000) * 100, 1),
        flowRateKgS: U.round(fuelFlow, 3)
      };
      this.sensors.fuel.status = fuelKg < 1000 ? 'critical' : fuelKg < 3000 ? 'warning' : 'nominal';

      // Update rolling history buffer for sparklines
      this.recordHistory();

      // Sync into mission state
      this.stateManager.update((st) => {
        st.sensorReadings = {
          accelerometer: this.sensors.accelerometer.readings,
          gyroscope: this.sensors.gyroscope.readings,
          distance: this.sensors.distance.readings,
          temperature: this.sensors.temperature.readings,
          radiation: this.sensors.radiation.readings,
          solar: this.sensors.solar.readings,
          fuel: this.sensors.fuel.readings
        };
        st.sensorStatuses = {
          accelerometer: this.sensors.accelerometer.status,
          gyroscope: this.sensors.gyroscope.status,
          distance: this.sensors.distance.status,
          temperature: this.sensors.temperature.status,
          radiation: this.sensors.radiation.status,
          solar: this.sensors.solar.status,
          fuel: this.sensors.fuel.status
        };
      }, 'sensors:sync');
    }

    evaluateStatus(sensor, value) {
      if (value >= sensor.threshold.critical) {
        sensor.status = 'critical';
      } else if (value >= sensor.threshold.warn) {
        sensor.status = 'warning';
      } else {
        sensor.status = 'nominal';
      }
    }

    recordHistory() {
      const ts = Date.now();
      const s = this.sensors;

      const append = (sensor, val) => {
        sensor.history.push({ t: ts, val });
        if (sensor.history.length > this.historyCapacity) sensor.history.shift();
      };

      append(s.accelerometer, s.accelerometer.readings.total);
      append(s.gyroscope, s.gyroscope.readings.totalRate);
      append(s.distance, s.distance.readings.altitudeKm);
      append(s.temperature, s.temperature.readings.thruster);
      append(s.radiation, s.radiation.readings.intensity);
      append(s.solar, s.solar.readings.exposurePct);
      append(s.fuel, s.fuel.readings.remainingKg);
    }

    getSensor(id) {
      return this.sensors[id];
    }
  }

  MM.SensorEngine = SensorEngine;
})();
