/* MissionMind 2.0 — Spacecraft Dynamics & 3-Axis Thruster Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  class SpacecraftEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.physics = MM.physics;

      // Mass properties
      this.dryMass = CFG.SPACECRAFT.defaultDryMass;
      this.payloadMass = CFG.SPACECRAFT.defaultPayloadMass;
      this.fuelMass = CFG.SPACECRAFT.initialFuelMass;
      this.maxFuel = CFG.SPACECRAFT.maxFuelCapacity;

      // Orientation (degrees) and angular rates (deg/s)
      this.pitchDeg = 0;
      this.yawDeg = 0;
      this.rollDeg = 0;
      this.pitchRate = 0;
      this.yawRate = 0;
      this.rollRate = 0;

      // Three independent thruster commands: [-1.0, +1.0] (-100% to +100%)
      this.thrusters = {
        x: { cmd: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'X (Fore/Aft)' },
        y: { cmd: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'Y (Port/Starboard)' },
        z: { cmd: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'Z (Dorsal/Ventral)' }
      };

      // Active propulsion mode: 'chemical' | 'solar-electric' | 'hybrid'
      this.propulsionMode = 'chemical';
      this.emergencyShutdownActive = false;

      // Manual fuel-operator state
      this.fuelPumpPercent = 100;
      this.feedValveOpen = true;
      this.feedPressureNominalBar = 25;
      this.feedPressureBar = 25;

      // Telemetry cache
      this.lastAcceleration = { x: 0, y: 0, z: 0, magnitude: 0 };
      this.totalFlowRateKgS = 0;

      MM.bus.on('mission:reset', () => this.reset());
    }

    get totalMass() {
      return this.dryMass + this.payloadMass + this.fuelMass;
    }

    get currentConfig() {
      return this.propulsionMode === 'solar-electric'
        ? CFG.PROPULSION.solarElectric
        : CFG.PROPULSION.chemical;
    }

    /**
     * Set thrust command on a specific axis (axis: 'x'|'y'|'z', percent: -100 to +100)
     */
    setThrusterCommand(axis, percent) {
      if (this.emergencyShutdownActive) return false;
      const key = String(axis).toLowerCase();
      if (!this.thrusters[key]) return false;

      const norm = U.clamp(Number(percent) || 0, -100, 100) / 100;

      // Manual fuel-operator interlocks
      if (Math.abs(norm) > 0.01 && !this.feedValveOpen) {
        MM.bus.emit('toast', { type: 'warning', title: 'Main feed valve closed', message: 'Open the propellant feed valve before commanding thrust.' });
        return false;
      }
      if (Math.abs(norm) > 0.01 && this.fuelPumpPercent <= 0) {
        MM.bus.emit('toast', { type: 'warning', title: 'Fuel pump at zero', message: 'Raise the fuel pump throttle to pressurise the feed line.' });
        return false;
      }

      // Check propellant availability
      if (this.fuelMass <= 0 && Math.abs(norm) > 0) {
        MM.bus.emit('toast', { type: 'critical', title: 'Propellant Depleted', message: 'Main tanks empty. Thruster ignition failed.' });
        this.thrusters[key].cmd = 0;
        this.recalculateThrust();
        return false;
      }

      this.thrusters[key].cmd = norm;
      this.thrusters[key].active = Math.abs(norm) > 0.01;
      this.recalculateThrust();
      return true;
    }

    /**
     * Manual fuel-operator controls: pump throttle and main feed valve.
     */
    setFuelPump(percent) {
      this.fuelPumpPercent = U.clamp(Math.round(Number(percent) || 0), 0, 100);
      this.recalculateThrust();
      MM.bus.emit('fuel:updated', this.getFuelTelemetry());
      return this.fuelPumpPercent;
    }

    setFeedValve(open, options) {
      const next = Boolean(open);
      if (this.feedValveOpen === next) {
        this.recalculateThrust();
        return this.feedValveOpen;
      }
      this.feedValveOpen = next;

      if (!next) {
        ['x', 'y', 'z'].forEach((axis) => {
          this.thrusters[axis].cmd = 0;
          this.thrusters[axis].active = false;
        });
      }

      this.recalculateThrust();
      MM.bus.emit('fuel:updated', this.getFuelTelemetry());
      MM.bus.emit('thrusters:update', {});

      if (!options || !options.silent) {
        this.stateManager.addLog('fuel', next ? 'Main Feed Valve Opened' : 'Main Feed Valve Closed',
          next ? 'Propellant manifold pressurised. Thruster commands re-enabled.' : 'Propellant feed isolated. All thruster commands zeroed.',
          { severity: next ? 'info' : 'warning' });
        MM.bus.emit('toast', {
          type: next ? 'success' : 'warning',
          title: `Fuel feed ${next ? 'open' : 'isolated'}`,
          message: next ? 'Propellant manifold is pressurised.' : 'All engines are isolated from the main tanks.'
        });
      }
      return this.feedValveOpen;
    }

    toggleFeedValve() {
      return this.setFeedValve(!this.feedValveOpen);
    }

    getFuelTelemetry() {
      return {
        valveOpen: this.feedValveOpen,
        pumpPercent: this.fuelPumpPercent,
        feedPressureBar: U.round(this.feedPressureBar, 1),
        feedPressureNominalBar: this.feedPressureNominalBar,
        flowRateKgS: U.round(this.totalFlowRateKgS, 3),
        remainingKg: U.round(this.fuelMass, 1),
        capacityKg: this.maxFuel,
        status: !this.feedValveOpen ? 'isolated' : this.fuelMass <= 0 ? 'empty' : this.fuelPumpPercent < 25 ? 'low-feed' : 'nominal'
      };
    }

    /**
     * Deduct propellant from the shared mission tanks (used by the descent trainer).
     */
    consumeFuel(kg) {
      const requested = Math.max(0, Number(kg) || 0);
      if (requested <= 0) return 0;
      const used = Math.min(this.fuelMass, requested);
      if (used <= 0) return 0;

      this.fuelMass = Math.max(0, this.fuelMass - used);
      const fuelPct = (this.fuelMass / this.maxFuel) * 100;
      const consumedPct = (used / this.maxFuel) * 100;
      this.stateManager.update((s) => {
        s.resources.fuel = U.round(fuelPct, 1);
        s.resources.fuelConsumed = U.clamp(s.resources.fuelConsumed + consumedPct, 0, 100);
      }, 'sim:fuel-consume');

      this.recalculateThrust();
      if (this.fuelMass <= 0) {
        this.stateManager.addLog('fuel', 'Main Propellant Depleted', 'Fuel tanks have zero usable mass remaining. All engines cut off.', { severity: 'critical' });
      }
      return used;
    }

    /**
     * Restore the propulsion plant to its initial condition on mission reset.
     */
    reset() {
      this.fuelMass = CFG.SPACECRAFT.initialFuelMass;
      this.pitchDeg = 0;
      this.yawDeg = 0;
      this.rollDeg = 0;
      this.pitchRate = 0;
      this.yawRate = 0;
      this.rollRate = 0;

      ['x', 'y', 'z'].forEach((axis) => {
        const t = this.thrusters[axis];
        t.cmd = 0;
        t.thrustN = 0;
        t.tempC = 22;
        t.active = false;
        t.status = 'nominal';
      });

      this.propulsionMode = 'chemical';
      this.emergencyShutdownActive = false;
      this.fuelPumpPercent = 100;
      this.feedValveOpen = true;
      this.feedPressureBar = this.feedPressureNominalBar;
      this.lastAcceleration = { x: 0, y: 0, z: 0, magnitude: 0 };
      this.totalFlowRateKgS = 0;
      this.recalculateThrust();

      this.stateManager.update((s) => {
        s.spacecraft.fuelMass = this.fuelMass;
        s.spacecraft.mass = this.totalMass;
        s.spacecraft.acceleration = this.lastAcceleration;
        s.spacecraft.orientation = { pitch: 0, yaw: 0, roll: 0 };
        s.propulsionMode = this.propulsionMode;
        s.fuelSystem = this.getFuelTelemetry();
      }, 'spacecraft:reset');

      MM.bus.emit('fuel:updated', this.getFuelTelemetry());
      MM.bus.emit('thrusters:update', {});
    }

    /**
     * Emergency thruster shutdown: instantly zeroes all thruster commands
     */
    emergencyShutdown() {
      this.emergencyShutdownActive = true;
      this.thrusters.x.cmd = 0;
      this.thrusters.y.cmd = 0;
      this.thrusters.z.cmd = 0;
      this.thrusters.x.active = false;
      this.thrusters.y.active = false;
      this.thrusters.z.active = false;
      this.recalculateThrust();

      this.stateManager.addLog('safety', 'Emergency Propulsion Cutoff', 'All thrusters commanded to 0% immediately. Engine valves isolated.', { severity: 'warning' });
      MM.bus.emit('toast', { type: 'warning', title: 'Thruster Cutoff Active', message: 'Emergency propulsion cutoff engaged.' });

      setTimeout(() => {
        this.emergencyShutdownActive = false;
      }, 800);

      return true;
    }

    /**
     * Switch propulsion mode ('chemical' | 'solar-electric' | 'hybrid')
     */
    setPropulsionMode(mode) {
      if (!['chemical', 'solar-electric', 'hybrid'].includes(mode)) return false;

      // Precondition check for solar-electric
      if (mode === 'solar-electric') {
        const s = this.stateManager.state;
        if (!s.solar || !s.solar.deployed) {
          MM.bus.emit('toast', { type: 'warning', title: 'Solar Panels Retracted', message: 'Solar-electric propulsion requires deployed solar arrays.' });
          return false;
        }
        if (s.resources.power < 20) {
          MM.bus.emit('toast', { type: 'warning', title: 'Insufficient Battery', message: 'Solar-electric mode requires > 20% battery reserve.' });
          return false;
        }
      }

      this.propulsionMode = mode;
      this.recalculateThrust();

      this.stateManager.update((s) => {
        s.propulsionMode = mode;
      }, 'propulsion:mode-change');

      this.stateManager.addLog('systems', `Propulsion Mode: ${mode.toUpperCase()}`, `Engaged ${mode} propulsion parameters.`, { severity: 'info' });
      MM.bus.emit('propulsion:mode-changed', mode);
      return true;
    }

    /**
     * Rotate spacecraft orientation (Euler angles)
     */
    adjustOrientation(pitchDelta, yawDelta, rollDelta) {
      this.pitchDeg = (this.pitchDeg + (Number(pitchDelta) || 0)) % 360;
      this.yawDeg = (this.yawDeg + (Number(yawDelta) || 0)) % 360;
      this.rollDeg = (this.rollDeg + (Number(rollDelta) || 0)) % 360;
      this.syncOrientationState();
    }

    setOrientation(pitch, yaw, roll) {
      this.pitchDeg = Number(pitch) || 0;
      this.yawDeg = Number(yaw) || 0;
      this.rollDeg = Number(roll) || 0;
      this.syncOrientationState();
    }

    syncOrientationState() {
      this.stateManager.update((s) => {
        s.spacecraft.orientation = {
          pitch: this.pitchDeg,
          yaw: this.yawDeg,
          roll: this.rollDeg
        };
      }, 'spacecraft:orientation');
      MM.bus.emit('spacecraft:oriented', { pitch: this.pitchDeg, yaw: this.yawDeg, roll: this.rollDeg });
    }

    /**
     * Recalculate forces, mass flow, and acceleration
     */
    recalculateThrust() {
      const cfg = this.currentConfig;
      const maxF = cfg.maxThrustN;
      const feedFactor = this.feedValveOpen ? this.fuelPumpPercent / 100 : 0;
      const propellantAvailable = this.fuelMass > 0;
      let totalForceSq = 0;

      ['x', 'y', 'z'].forEach((axis) => {
        const t = this.thrusters[axis];
        t.thrustN = propellantAvailable ? t.cmd * maxF * feedFactor : 0;
        t.feedLimited = Math.abs(t.cmd) > 0.01 && !propellantAvailable;
        totalForceSq += t.thrustN * t.thrustN;
      });

      const totalForceMagnitude = Math.sqrt(totalForceSq);
      this.totalFlowRateKgS = this.physics.propellantFlowRate(totalForceMagnitude, cfg.ispSeconds);
      this.feedPressureBar = !this.feedValveOpen ? 0 : 5 + this.feedPressureNominalBar * (this.fuelPumpPercent / 100);

      // Convert local thruster forces [Fx, Fy, Fz] into world coordinates via Euler angles
      const localF = {
        x: this.thrusters.x.thrustN,
        y: this.thrusters.y.thrustN,
        z: this.thrusters.z.thrustN
      };

      const worldF = this.localToWorld(localF);
      const m = this.totalMass;

      this.lastAcceleration = {
        x: this.physics.accelerationFromThrust(worldF.x, m),
        y: this.physics.accelerationFromThrust(worldF.y, m),
        z: this.physics.accelerationFromThrust(worldF.z, m),
        magnitude: this.physics.accelerationFromThrust(totalForceMagnitude, m)
      };

      // Sync with mission state
      this.stateManager.update((s) => {
        s.thrusters = {
          mode: this.propulsionMode,
          x: { ...this.thrusters.x, percent: this.thrusters.x.cmd * 100 },
          y: { ...this.thrusters.y, percent: this.thrusters.y.cmd * 100 },
          z: { ...this.thrusters.z, percent: this.thrusters.z.cmd * 100 },
          totalThrustN: totalForceMagnitude,
          propellantFlowRateKgS: this.totalFlowRateKgS,
          ispSeconds: cfg.ispSeconds,
          electricalDrawWatts: this.getPropulsionElectricalDraw()
        };
        s.spacecraft.mass = this.totalMass;
        s.spacecraft.fuelMass = this.fuelMass;
        s.spacecraft.acceleration = this.lastAcceleration;
        s.fuelSystem = this.getFuelTelemetry();
      }, 'thrusters:update');
    }

    getPropulsionElectricalDraw() {
      if (this.propulsionMode !== 'solar-electric') return 0;
      const cfg = CFG.PROPULSION.solarElectric;
      let sumPct = 0;
      ['x', 'y', 'z'].forEach((a) => {
        sumPct += Math.abs(this.thrusters[a].cmd);
      });
      return sumPct * cfg.electricalDrawWatts;
    }

    /**
     * Transform local body vector into world coordinates using pitch, yaw, roll
     */
    localToWorld(v) {
      const rad = Math.PI / 180;
      const p = this.pitchDeg * rad;
      const y = this.yawDeg * rad;
      const r = this.rollDeg * rad;

      // Rotation matrix R = Rz(yaw) * Ry(pitch) * Rx(roll)
      const cp = Math.cos(p), sp = Math.sin(p);
      const cy = Math.cos(y), sy = Math.sin(y);
      const cr = Math.cos(r), sr = Math.sin(r);

      const r00 = cy * cp;
      const r01 = cy * sp * sr - sy * cr;
      const r02 = cy * sp * cr + sy * sr;

      const r10 = sy * cp;
      const r11 = sy * sp * sr + cy * cr;
      const r12 = sy * sp * cr - cy * sr;

      const r20 = -sp;
      const r21 = cp * sr;
      const r22 = cp * cr;

      return {
        x: r00 * v.x + r01 * v.y + r02 * v.z,
        y: r10 * v.x + r11 * v.y + r12 * v.z,
        z: r20 * v.x + r21 * v.y + r22 * v.z
      };
    }

    /**
     * Physical step (dt in seconds)
     */
    step(dt) {
      if (dt <= 0) return;
      const cfg = this.currentConfig;

      // Update thruster temperatures & propellant consumption
      ['x', 'y', 'z'].forEach((axis) => {
        const t = this.thrusters[axis];
        const pct = Math.abs(t.cmd) * 100;
        if (pct > 0) {
          t.tempC = Math.min(cfg.maxTempC, t.tempC + pct * cfg.tempRiseRate * 0.05 * dt);
        } else {
          t.tempC = Math.max(cfg.minTempC, t.tempC - cfg.coolingRate * 1.5 * dt);
        }

        // Check overheat
        if (t.tempC > cfg.maxTempC * 0.9) {
          t.status = 'overheated';
        } else if (t.tempC > cfg.maxTempC * 0.75) {
          t.status = 'warning';
        } else {
          t.status = 'nominal';
        }
      });

      // Propellant mass consumption
      if (this.totalFlowRateKgS > 0 && this.fuelMass > 0) {
        const deltaFuel = this.totalFlowRateKgS * dt;
        this.fuelMass = Math.max(0, this.fuelMass - deltaFuel);

        // Update resources percentage (fuel %)
        const fuelPct = (this.fuelMass / this.maxFuel) * 100;
        const consumedPct = (deltaFuel / this.maxFuel) * 100;
        this.stateManager.update((s) => {
          s.resources.fuel = U.round(fuelPct, 1);
          s.resources.fuelConsumed = U.clamp(s.resources.fuelConsumed + consumedPct, 0, 100);
        }, 'sim:fuel-consume');

        if (this.fuelMass <= 0) {
          this.emergencyShutdown();
          this.stateManager.addLog('fuel', 'Main Propellant Depleted', 'Fuel tanks have zero usable mass remaining. All engines cut off.', { severity: 'critical' });
        }
      }

      this.recalculateThrust();
    }
  }

  MM.SpacecraftEngine = SpacecraftEngine;
})();
