/* MissionMind — authoritative mission state manager */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  const STORAGE_KEY = 'missionmind.settings.v1';
  const MISSION_DAYS = 210;
  const TOTAL_DISTANCE_KM = 225e6; // representative Earth–Mars range (linear visual model)

  const DEFAULT_THRESHOLDS = Object.freeze({
    fuelWarn: 50,
    fuelCritical: 20,
    powerWarn: 45,
    powerCritical: 18,
    oxygenWarn: 35,
    oxygenCritical: 18
  });

  const DEFAULT_SETTINGS = Object.freeze({
    autoAgents: true,
    defaultSpeed: 2,
    thresholds: { ...DEFAULT_THRESHOLDS }
  });

  function createInitialState() {
    return {
      missionId: 'MM-001',
      missionName: 'Ares Transit · Earth → Mars',
      missionStatus: 'standby',
      missionDay: 0,
      missionDurationDays: MISSION_DAYS,
      progress: 0,
      tick: 0,
      speed: 2,
      startedAt: null,
      centralBody: 'earth',
      controlMode: 'manual',
      hybridAuthority: {
        thrusters: true,
        orientation: true,
        solar: false,
        navigation: false
      },
      propulsionMode: 'chemical',
      spacecraft: {
        x: 0,
        y: 0,
        z: 0,
        mass: 22500,
        dryMass: 8500,
        payloadMass: 1500,
        fuelMass: 12500,
        velocityKms: 7.67,
        altitudeKm: 400,
        acceleration: { x: 0, y: 0, z: 0, magnitude: 0 },
        orientation: { pitch: 0, yaw: 0, roll: 0 },
        angularRates: { pitch: 0, yaw: 0, roll: 0 },
        distanceToMarsKm: TOTAL_DISTANCE_KM,
        distanceFromEarthKm: 400,
        navUncertaintyKm: 45
      },
      orbit: {
        bodyId: 'earth',
        bodyName: 'Earth',
        radius: 6.771e6,
        altitudeKm: 400,
        velocityMs: 7670,
        velocityKms: 7.67,
        vCircularMs: 7670,
        vCircularKms: 7.67,
        vEscapeMs: 10847,
        vEscapeKms: 10.85,
        deltaVToCircularMs: 0,
        deltaVToEscapeMs: 3177,
        specificEnergy: -29415000,
        semiMajorAxisKm: 6771,
        eccentricity: 0.001,
        inclinationDeg: 28.5,
        periapsisKm: 400,
        apoapsisKm: 400,
        periodMinutes: 92.5,
        orbitType: 'circular',
        isEscaped: false,
        trueAnomalyDeg: 0
      },
      thrusters: {
        mode: 'chemical',
        x: { cmd: 0, percent: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'X (Fore/Aft)' },
        y: { cmd: 0, percent: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'Y (Port/Starboard)' },
        z: { cmd: 0, percent: 0, thrustN: 0, tempC: 22, active: false, status: 'nominal', axis: 'Z (Dorsal/Ventral)' },
        totalThrustN: 0,
        propellantFlowRateKgS: 0,
        ispSeconds: 320,
        electricalDrawWatts: 0
      },
      solar: {
        deployed: true,
        deploymentProgress: 1.0,
        angleDeg: 15,
        irradiance: 1361,
        efficiency: 0.32,
        area: 28,
        generatedPowerW: 4200,
        panelHealth: 100
      },
      battery: {
        capacityWh: 60000,
        storedEnergyWh: 51000,
        chargePercent: 85.0,
        netPowerW: 2300,
        chargeRateW: 2300,
        dischargeRateW: 0,
        electricalLoadW: 1900
      },
      radar: {
        rangeKm: 50,
        sweepAngleDeg: 0,
        sweepActive: true,
        threatLevel: 'green',
        objects: [],
        selectedId: null
      },
      sensorReadings: {
        accelerometer: { ax: 0, ay: 0, az: 0, total: 0 },
        gyroscope: { pitchRate: 0, yawRate: 0, rollRate: 0, totalRate: 0 },
        distance: { altitudeKm: 400, surfaceDistKm: 400, closestTargetKm: 28.5 },
        temperature: { internal: 21.5, external: -65.0, thruster: 22.0, battery: 24.2 },
        radiation: { intensity: 22.4, accumulatedMSv: 1.2 },
        solar: { irradiance: 1361, exposurePct: 96, incidentAngleDeg: 15, efficiencyPct: 32 },
        fuel: { remainingKg: 12500, percent: 83.3, flowRateKgS: 0 }
      },
      sensorStatuses: {
        accelerometer: 'nominal',
        gyroscope: 'nominal',
        distance: 'nominal',
        temperature: 'nominal',
        radiation: 'nominal',
        solar: 'nominal',
        fuel: 'nominal'
      },
      resources: {
        fuel: 83.3,
        power: 85.0,
        oxygen: 95,
        fuelConsumed: 0,
        powerConsumed: 0,
        oxygenConsumed: 0
      },
      systems: {
        communication: 'stable',
        equipmentHealth: 100,
        temperature: 22,
        temperatureTarget: 22,
        thermalMode: 'auto',
        heaterPercent: 0,
        coolerPercent: 0,
        shield: 'standby',
        science: 'active',
        autonomy: 'ground-linked',
        mode: 'nominal'
      },
      fuelSystem: {
        valveOpen: true,
        pumpPercent: 100,
        feedPressureBar: 25,
        feedPressureNominalBar: 25,
        flowRateKgS: 0,
        remainingKg: 12500,
        capacityKg: 15000,
        status: 'nominal'
      },
      descent: {
        active: false,
        status: 'idle',
        altitudeM: 2500,
        verticalSpeedMs: -25,
        targetDescentMs: 1.5,
        mode: 'auto',
        throttlePercent: 0,
        localGravity: 3.71,
        fuelUsedKg: 0,
        touchdownSpeedMs: null
      },
      modes: {
        protective: false,
        powerSaving: false,
        fuelSaving: false,
        autonomous: false,
        lifeSupportPriority: false
      },
      events: {
        solarStorm: false,
        fuelShortage: false,
        communicationFailure: false,
        powerFailure: false
      },
      eventTimers: {
        solarStorm: 0,
        fuelShortage: 0,
        communicationFailure: 0,
        powerFailure: 0
      },
      missionFlags: {
        midCourseCorrection: false,
        progressBoost: 0,
        lastScienceDay: -99,
        repairs: 0,
        leakSealed: false
      },
      metrics: {
        emergenciesDetected: 0,
        responsesCompleted: 0,
        decisions: 0,
        agentCycles: 0,
        rejectedActions: 0,
        scientificValue: 0,
        riskIndex: 8
      },
      alerts: []
    };
  }

  class MissionStateManager {
    constructor() {
      this.settings = this.loadSettings();
      this.log = [];
      this.decisions = [];
      this.reportHistory = [];
      this.telemetry = [];
      this.latestReports = {};
      this.logSeq = 0;
      this.errorCount = 0;
      this.state = createInitialState();
      this.state.speed = this.settings.defaultSpeed;
      this.lastDecision = null;
      this.samplesSinceChart = 0;
    }

    loadSettings() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return U.deepCopy(DEFAULT_SETTINGS);
        const parsed = JSON.parse(raw);
        const thresholds = { ...DEFAULT_THRESHOLDS, ...(parsed.thresholds || {}) };
        const settings = {
          autoAgents: parsed.autoAgents !== false,
          defaultSpeed: [1, 2, 4, 8].includes(Number(parsed.defaultSpeed)) ? Number(parsed.defaultSpeed) : 2,
          thresholds
        };
        this.validateThresholds(thresholds);
        return settings;
      } catch (err) {
        console.warn('[MissionMind] Could not load settings, using defaults.', err);
        return U.deepCopy(DEFAULT_SETTINGS);
      }
    }

    saveSettings(next) {
      const merged = {
        ...this.settings,
        ...(next || {}),
        thresholds: { ...this.settings.thresholds, ...((next && next.thresholds) || {}) }
      };
      this.validateThresholds(merged.thresholds);
      this.settings = merged;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (err) {
        console.warn('[MissionMind] Settings could not be persisted.', err);
      }
      this.emitChange();
      return merged;
    }

    validateThresholds(t) {
      ['fuel', 'power', 'oxygen'].forEach((key) => {
        const warn = Number(t[`${key}Warn`]);
        const crit = Number(t[`${key}Critical`]);
        if (!Number.isFinite(warn) || !Number.isFinite(crit)) {
          throw new Error(`Threshold settings for ${key} must be numeric.`);
        }
        if (crit >= warn) {
          throw new Error(`${key} critical threshold must be lower than its warning threshold.`);
        }
        if (warn > 100 || crit < 0) {
          throw new Error(`${key} thresholds must lie between 0 and 100.`);
        }
      });
    }

    resetMission() {
      this.state = createInitialState();
      this.state.speed = this.settings.defaultSpeed;
      this.log = [];
      this.decisions = [];
      this.reportHistory = [];
      this.telemetry = [];
      this.latestReports = {};
      this.logSeq = 0;
      this.lastDecision = null;
      this.samplesSinceChart = 0;
      this.addLog('system', 'Mission initialised', 'Simulation state reset. Six agents registered and awaiting start command.');
      this.emit('state:reset', this.state);
      this.emitChange();
    }

    get thresholds() {
      return this.settings.thresholds;
    }

    emitChange() {
      this.emit('state:change', this.state);
    }

    emit(topic, payload) {
      MM.bus.emit(topic, payload);
    }

    update(mutator, reason) {
      if (typeof mutator !== 'function') return this.state;
      const before = this.snapshot();
      mutator(this.state);
      this.normalise();
      this.state.alerts = this.buildAlerts();
      this.state.metrics.riskIndex = MM.riskIndex(this.state, this.thresholds);
      this.state.version = (this.state.version || 0) + 1;
      this.emitChange();
      if (reason) this.emit('state:mutated', { reason, state: this.state });
      void before;
      return this.state;
    }

    normalise() {
      const r = this.state.resources;
      ['fuel', 'power', 'oxygen'].forEach((key) => {
        r[key] = U.clamp(r[key], 0, 100);
        r[`${key}Consumed`] = U.clamp(r[`${key}Consumed`], 0, 100);
      });
      this.state.systems.equipmentHealth = U.clamp(this.state.systems.equipmentHealth, 0, 100);
      this.state.systems.temperature = U.clamp(this.state.systems.temperature, -50, 80);
      this.state.systems.temperatureTarget = U.clamp(Number(this.state.systems.temperatureTarget) || 22, 10, 35);
      this.state.systems.heaterPercent = U.clamp(Number(this.state.systems.heaterPercent) || 0, 0, 100);
      this.state.systems.coolerPercent = U.clamp(Number(this.state.systems.coolerPercent) || 0, 0, 100);
      this.state.progress = U.clamp(this.state.progress, 0, 100);
      this.state.missionDay = Math.max(0, this.state.missionDay);
      this.state.spacecraft.distanceToMarsKm = Math.max(0, TOTAL_DISTANCE_KM * (1 - this.state.progress / 100));
      this.state.spacecraft.distanceFromEarthKm = U.clamp(TOTAL_DISTANCE_KM * (this.state.progress / 100), 0, TOTAL_DISTANCE_KM);
    }

    setStatus(status) {
      this.update((s) => {
        s.missionStatus = status;
        if (status === 'active' && !s.startedAt) s.startedAt = new Date().toISOString();
      }, `status:${status}`);
      this.emit(`mission:${status}`, this.state);
    }

    addLog(type, title, message, options) {
      const opts = options || {};
      this.logSeq += 1;
      const entry = {
        id: `LOG-${String(this.logSeq).padStart(3, '0')}`,
        at: Date.now(),
        day: this.state.missionDay,
        timestamp: U.missionTime(this.state.missionDay),
        type,
        title,
        message: message || '',
        severity: opts.severity || 'info',
        agentId: opts.agentId || null,
        report: opts.report || null,
        detail: opts.detail || null,
        decisionId: opts.decisionId || null
      };
      this.log.push(entry);
      if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
      this.emit('log:new', entry);
      return entry;
    }

    addReport(report) {
      this.latestReports[report.agentId] = report;
      this.reportHistory.push(report);
      if (this.reportHistory.length > 200) this.reportHistory.shift();
      return report;
    }

    addDecision(record) {
      this.decisions.push(record);
      if (this.decisions.length > 120) this.decisions.shift();
      this.lastDecision = record;
      this.state.metrics.decisions = this.decisions.length;
      this.emit('decision:new', record);
      return record;
    }

    recordSample() {
      const s = this.state;
      this.telemetry.push({
        day: U.round(s.missionDay, 2),
        fuel: U.round(s.resources.fuel, 2),
        power: U.round(s.resources.power, 2),
        oxygen: U.round(s.resources.oxygen, 2),
        health: U.round(s.systems.equipmentHealth, 2),
        temp: U.round(s.systems.temperature, 2),
        risk: U.round(s.metrics.riskIndex, 1),
        progress: U.round(s.progress, 2),
        reports: U.round(s.metrics.agentCycles, 0),
        decisions: s.metrics.decisions
      });
      if (this.telemetry.length > 300) this.telemetry.shift();
      this.emit('telemetry:sample', this.telemetry[this.telemetry.length - 1]);
    }

    buildAlerts() {
      const s = this.state;
      const t = this.thresholds;
      const alerts = [];
      const push = (severity, title, detail, source) => alerts.push({ severity, title, detail, source });

      if (s.events.solarStorm) {
        push('critical', 'Solar storm in progress', `Shielding ${s.systems.shield === 'active' ? 'active' : 'standby'}; equipment stress elevated.`, 'Risk Agent');
      }
      if (s.events.communicationFailure) {
        push('critical', 'Communication link lost', 'Onboard autonomous operation required. Ground commanding unavailable.', 'Systems Agent');
      }
      if (s.events.fuelShortage) {
        push('warning', 'Propellant anomaly', `Fuel ${U.fixed(s.resources.fuel, 1)}%. Leak containment ${s.modes.fuelSaving ? 'engaged' : 'pending'}.`, 'Fuel Agent');
      }
      if (s.events.powerFailure) {
        push('critical', 'Power bus degraded', `Electrical power ${U.fixed(s.resources.power, 1)}%. Essential loads only.`, 'Systems Agent');
      }
      if (s.resources.fuel <= t.fuelCritical) {
        push('critical', 'Fuel critically low', `${U.fixed(s.resources.fuel, 1)}% remaining. Threshold ${t.fuelCritical}%.`, 'Fuel Agent');
      } else if (s.resources.fuel <= t.fuelWarn) {
        push('warning', 'Fuel reserves below warning', `${U.fixed(s.resources.fuel, 1)}% remaining. Threshold ${t.fuelWarn}%.`, 'Fuel Agent');
      }
      if (s.resources.power <= t.powerCritical) {
        push('critical', 'Electrical power critical', `${U.fixed(s.resources.power, 1)}% remaining. Threshold ${t.powerCritical}%.`, 'Systems Agent');
      } else if (s.resources.power <= t.powerWarn) {
        push('warning', 'Power reserves below warning', `${U.fixed(s.resources.power, 1)}% remaining. Threshold ${t.powerWarn}%.`, 'Systems Agent');
      }
      if (s.resources.oxygen <= t.oxygenCritical) {
        push('critical', 'Oxygen critical', `${U.fixed(s.resources.oxygen, 1)}% remaining. Life support priority.`, 'Systems Agent');
      } else if (s.resources.oxygen <= t.oxygenWarn) {
        push('warning', 'Oxygen below warning', `${U.fixed(s.resources.oxygen, 1)}% remaining. Threshold ${t.oxygenWarn}%.`, 'Systems Agent');
      }
      if (s.systems.equipmentHealth < 70) {
        push(s.systems.equipmentHealth < 45 ? 'critical' : 'warning', 'Equipment health degraded', `${U.fixed(s.systems.equipmentHealth, 1)}% structural/assembly health.`, 'Risk Agent');
      }
      if (s.systems.temperature > 29) {
        push('warning', 'Thermal load elevated', `Cabin ${U.fixed(s.systems.temperature, 1)} °C. Active thermal control required.`, 'Systems Agent');
      } else if (s.systems.temperature < 16) {
        push('warning', 'Cabin thermal low', `Cabin ${U.fixed(s.systems.temperature, 1)} °C. Heater loop adjustment recommended.`, 'Systems Agent');
      }
      if (s.systems.communication !== 'stable' && !s.events.communicationFailure) {
        push('warning', 'Communication degraded', `Link state: ${s.systems.communication}.`, 'Systems Agent');
      }
      if (!alerts.length) {
        push('info', 'All monitored systems nominal', 'No threshold breaches. Autonomous monitoring continues.', 'Mission Control');
      }
      return alerts;
    }

    computeRisk() {
      const score = MM.riskIndex(this.state, this.thresholds);
      return { score, category: MM.riskCategory(score) };
    }

    computePerformance() {
      const s = this.state;
      let score = 100;
      score -= (100 - s.systems.equipmentHealth) * 0.45;
      score -= Object.values(s.events).filter(Boolean).length * 3;
      score -= s.metrics.rejectedActions * 1.5;
      const t = this.thresholds;
      if (s.resources.fuel < t.fuelCritical) score -= 5;
      else if (s.resources.fuel < t.fuelWarn) score -= 2;
      if (s.resources.power < t.powerCritical) score -= 6;
      else if (s.resources.power < t.powerWarn) score -= 2;
      if (s.resources.oxygen < t.oxygenCritical) score -= 8;
      else if (s.resources.oxygen < t.oxygenWarn) score -= 3;
      if (s.missionStatus === 'failed') score = Math.min(score, 12);
      return U.clamp(Math.round(score), 0, 100);
    }

    modeLabel() {
      const s = this.state;
      if (s.missionStatus === 'complete') return 'Mission complete';
      if (s.missionStatus === 'failed') return 'Mission failure';
      if (s.missionStatus === 'standby') return 'Pre-launch configuration';
      if (s.modes.autonomous) return 'Onboard autonomous operation';
      if (s.modes.protective) return 'Protective operating mode';
      if (s.modes.powerSaving) return 'Essential power mode';
      if (s.modes.fuelSaving) return 'Fuel conservation mode';
      if (s.systems.science === 'suspended') return 'Science operations suspended';
      return 'Nominal operations';
    }

    phaseInfo() {
      const s = this.state;
      if (s.missionStatus === 'standby') {
        return { name: 'Pre-launch · systems configuring', sub: 'Start the mission to begin autonomous monitoring and resource simulation.' };
      }
      if (s.missionStatus === 'failed') {
        return { name: 'Mission failure · safe mode', sub: 'A critical consumable or structural limit was reached. Reset to run a new simulation.' };
      }
      if (s.missionStatus === 'complete') {
        return { name: 'Mars arrival · mission complete', sub: 'Simulated spacecraft reached the destination marker. Review decisions and telemetry.' };
      }
      if (s.missionStatus === 'paused') {
        return { name: 'Simulation paused', sub: 'Mission state is frozen. Resume to continue agent monitoring.' };
      }
      if (s.progress < 25) return { name: 'Departure phase · outbound cruise', sub: 'Spacecraft is climbing out of the Earth departure corridor in the visual model.' };
      if (s.progress < 60) return { name: 'Deep-space cruise · monitoring active', sub: 'Autonomous agents track consumables, thermal state and environmental risk.' };
      if (s.progress < 85) return { name: 'Approach phase · trajectory refinement', sub: 'Navigation agent evaluates the mid-course correction window.' };
      return { name: 'Mars approach · terminal guidance', sub: 'Destination marker approaching. Consumables and systems remain under agent watch.' };
    }

    snapshot() {
      return U.deepCopy(this.state);
    }

    totalDistanceKm() {
      return TOTAL_DISTANCE_KM;
    }

    autoCycleDay() {
      return this.state.lastAgentCycleDay ?? -999;
    }

    markAgentCycle() {
      this.update((s) => {
        s.lastAgentCycleDay = s.missionDay;
        s.metrics.agentCycles += 1;
      }, 'agent-cycle');
    }
  }

  /* Shared risk score used for telemetry (the Risk Agent owns its own richer reasoning). */
  MM.riskIndex = function riskIndex(state, thresholds) {
    if (!state) return 0;
    const t = thresholds || DEFAULT_THRESHOLDS;
    let score = 7;
    if (state.events.solarStorm) score += 48;
    if (state.events.communicationFailure) score += 20;
    if (state.events.fuelShortage) score += 12;
    if (state.events.powerFailure) score += 18;
    score += Math.max(0, 90 - state.systems.equipmentHealth) * 0.55;
    if (state.resources.fuel <= t.fuelCritical) score += 16;
    else if (state.resources.fuel <= t.fuelWarn) score += 7;
    if (state.resources.power <= t.powerCritical) score += 18;
    else if (state.resources.power <= t.powerWarn) score += 8;
    if (state.resources.oxygen <= t.oxygenCritical) score += 22;
    else if (state.resources.oxygen <= t.oxygenWarn) score += 9;
    if (state.systems.temperature > 30) score += 8;
    if (state.systems.communication === 'lost') score += 6;
    return U.clamp(Math.round(score), 0, 100);
  };

  MM.riskCategory = function riskCategory(score) {
    if (score >= 78) return 'critical';
    if (score >= 52) return 'high';
    if (score >= 26) return 'medium';
    return 'low';
  };

  MM.MISSION_CONSTANTS = Object.freeze({
    MISSION_DAYS,
    TOTAL_DISTANCE_KM,
    DEFAULT_THRESHOLDS,
    DEFAULT_SETTINGS
  });
  MM.RATES = Object.freeze({
    fuelPerDay: 0.28,
    powerPerDay: 0.24,
    oxygenPerDay: 0.16
  });
  MM.MissionStateManager = MissionStateManager;
  MM.createInitialState = createInitialState;
})();
