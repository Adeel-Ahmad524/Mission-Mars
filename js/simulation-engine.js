/* MissionMind — simulation engine (time, resources, mission progression) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const DAYS_PER_TICK = 0.5;
  const AUTO_CYCLE_DAYS = 12;

  class SimulationEngine {
    constructor(stateManager, agentManager, eventManager) {
      this.stateManager = stateManager;
      this.agentManager = agentManager;
      this.eventManager = eventManager;
      this.interval = null;
      this.tickCounter = 0;
    }

    get running() {
      return Boolean(this.interval);
    }

    start(options) {
      const opts = options || {};
      const s = this.stateManager.state;
      if (s.missionStatus === 'active') return false;
      if (s.missionStatus === 'complete' || s.missionStatus === 'failed') {
        MM.bus.emit('toast', { type: 'warning', title: 'Mission ended', message: 'Reset the mission to begin a new transit.' });
        return false;
      }

      this.stateManager.setStatus('active');
      this.stateManager.update((st) => {
        st.speed = Number(this.stateManager.settings.defaultSpeed) || 2;
        if (!st.startedAt) st.startedAt = new Date().toISOString();
      }, 'sim:start');

      this.startClock();
      this.stateManager.addLog('mission', s.missionStatus === 'paused' ? 'Mission resumed' : 'Mission started', `Simulation running at ${this.stateManager.state.speed}× (${DAYS_PER_TICK * this.stateManager.state.speed} simulated days per tick).`, { severity: 'info' });
      if (!opts.silent) {
        MM.bus.emit('toast', { type: 'success', title: 'Mission started', message: 'Autonomous monitoring is now active.' });
      }
      if (!opts.silent) {
        this.agentManager.runCycle({ trigger: 'mission-start' });
      }
      MM.bus.emit('mission:started', this.stateManager.state);
      return true;
    }

    startClock() {
      if (this.interval) clearInterval(this.interval);
      this.interval = setInterval(() => this.tick(), 1000);
    }

    pause(silent) {
      const s = this.stateManager.state;
      if (s.missionStatus !== 'active') return false;
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.stateManager.setStatus('paused');
      this.stateManager.addLog('mission', 'Simulation paused', 'Mission clock and resource consumption are frozen. Agent state is retained.', { severity: 'info' });
      if (!silent) MM.bus.emit('toast', { type: 'info', title: 'Mission paused', message: 'Simulation time is frozen.' });
      MM.bus.emit('mission:paused', this.stateManager.state);
      return true;
    }

    resume() {
      const s = this.stateManager.state;
      if (s.missionStatus !== 'paused') return false;
      this.stateManager.setStatus('active');
      this.startClock();
      this.stateManager.addLog('mission', 'Mission resumed', 'Simulation clock restarted.', { severity: 'info' });
      MM.bus.emit('toast', { type: 'success', title: 'Mission resumed', message: 'Autonomous monitoring continues.' });
      MM.bus.emit('mission:resumed', this.stateManager.state);
      return true;
    }

    togglePause() {
      const s = this.stateManager.state;
      if (s.missionStatus === 'active') return this.pause();
      if (s.missionStatus === 'paused') return this.resume();
      return false;
    }

    setSpeed(multiplier) {
      const speed = [1, 2, 4, 8].includes(Number(multiplier)) ? Number(multiplier) : 2;
      this.stateManager.update((s) => { s.speed = speed; }, 'sim:speed');
      this.stateManager.settings.defaultSpeed = speed;
      return speed;
    }

    reset(silent) {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.tickCounter = 0;
      this.agentManager.reset();
      MM.bus.clear();
      this.stateManager.resetMission();
      MM.bus.emit('mission:reset', this.stateManager.state);
      if (!silent) MM.bus.emit('toast', { type: 'success', title: 'Mission reset', message: 'All simulation state, alerts and decision history cleared.' });
      return true;
    }

    tick() {
      const s = this.stateManager.state;
      if (s.missionStatus !== 'active') return;

      try {
        const speed = Math.max(1, Number(s.speed) || 1);
        const days = DAYS_PER_TICK * speed;
        const expired = [];

        this.stateManager.update((st) => {
          st.tick += 1;
          this.tickCounter += 1;
          st.missionDay += days;

          const baseProgress = (st.missionDay / st.missionDurationDays) * 100;
          st.progress = U.clamp(baseProgress + (st.missionFlags.progressBoost || 0), 0, 100);

          const storm = st.events.solarStorm;
          const fuelRate = MM.RATES.fuelPerDay
            * (st.modes.fuelSaving ? 0.45 : 1)
            * (storm ? 1.08 : 1)
            * (st.modes.autonomous ? 1.02 : 1);
          const leakRate = st.events.fuelShortage && !st.missionFlags.leakSealed && !st.modes.fuelSaving ? 0.34 : 0;
          const powerRate = MM.RATES.powerPerDay
            * (st.modes.powerSaving ? 0.55 : 1)
            * (st.modes.lifeSupportPriority ? 0.5 : 1)
            * (storm ? 1.25 : 1)
            * (st.systems.science === 'active' ? 1.06 : 1);
          const oxygenRate = MM.RATES.oxygenPerDay
            * (st.modes.lifeSupportPriority ? 0.62 : 1)
            * (storm ? 1.04 : 1);

          st.resources.fuel = U.clamp(st.resources.fuel - (fuelRate + leakRate) * days, 0, 100);
          st.resources.fuelConsumed = U.clamp(st.resources.fuelConsumed + (fuelRate + leakRate) * days, 0, 100);
          st.resources.power = U.clamp(st.resources.power - powerRate * days, 0, 100);
          st.resources.powerConsumed = U.clamp(st.resources.powerConsumed + powerRate * days, 0, 100);
          st.resources.oxygen = U.clamp(st.resources.oxygen - oxygenRate * days, 0, 100);
          st.resources.oxygenConsumed = U.clamp(st.resources.oxygenConsumed + oxygenRate * days, 0, 100);

          let healthDecay = 0.012;
          if (storm) healthDecay += st.modes.protective ? 0.02 : 0.09;
          if (st.resources.power < 15) healthDecay += 0.06;
          if (st.resources.fuel < 10) healthDecay += 0.03;
          if (st.systems.temperature > 30) healthDecay += 0.02;
          st.systems.equipmentHealth = U.clamp(st.systems.equipmentHealth - healthDecay * days, 0, 100);

          const thermalMode = st.systems.thermalMode || 'auto';
          const setpoint = U.clamp(Number(st.systems.temperatureTarget) || 22, 10, 35);
          const tempTarget = setpoint
            + (storm ? 4.5 : 0)
            - (st.modes.powerSaving ? 2.5 : 0)
            - (st.modes.lifeSupportPriority ? 1.2 : 0)
            - (st.resources.power < 15 ? 1.5 : 0);
          let thermalDelta = 0;
          if (thermalMode === 'off') {
            thermalDelta = (12 - st.systems.temperature) * 0.06 * days;
          } else if (thermalMode === 'manual') {
            const heater = U.clamp(Number(st.systems.heaterPercent) || 0, 0, 100) / 100;
            const cooler = U.clamp(Number(st.systems.coolerPercent) || 0, 0, 100) / 100;
            const ambientLoss = (st.systems.temperature - 18) * 0.06;
            thermalDelta = (heater * 1.15 - cooler * 1.15 - ambientLoss) * days;
          } else {
            thermalDelta = (tempTarget - st.systems.temperature) * 0.55 * days;
          }
          st.systems.temperature = U.clamp(
            st.systems.temperature + U.clamp(thermalDelta, -0.75, 0.75),
            -50, 80
          );

          st.spacecraft.velocityKms = U.round(
            24.8 + (st.progress / 100) * 0.5 + (st.missionFlags.midCourseCorrection ? 0.6 : 0) + Math.sin(st.missionDay / 9) * 0.03,
            3
          );
          st.spacecraft.navUncertaintyKm = Math.round(
            850 + (storm ? 2800 : 0) + (st.events.communicationFailure ? 1400 : 0) + Math.max(0, 92 - st.systems.equipmentHealth) * 22
          );

          Object.keys(st.eventTimers).forEach((key) => {
            if (st.events[key] && st.eventTimers[key] > 0) {
              st.eventTimers[key] = Math.max(0, st.eventTimers[key] - days);
              if (st.eventTimers[key] === 0) expired.push(key);
            }
          });
        }, 'sim:tick');

        // Physical engines integration step
        const dtSeconds = speed * 1.0;
        if (MM.app) {
          if (MM.app.spacecraftEngine) MM.app.spacecraftEngine.step(dtSeconds);
          if (MM.app.orbitalEngine) MM.app.orbitalEngine.step(dtSeconds);
          if (MM.app.energyEngine) MM.app.energyEngine.step(dtSeconds);
          if (MM.app.radarEngine) MM.app.radarEngine.step(dtSeconds);
          if (MM.app.sensorEngine) MM.app.sensorEngine.update();
        }

        this.stateManager.recordSample();

        if (s.progress >= 100 && s.missionStatus === 'active') {
          this.completeMission();
          return;
        }
        if ((s.resources.oxygen <= 0 || s.systems.equipmentHealth <= 0) && s.missionStatus === 'active') {
          this.failMission(s.resources.oxygen <= 0 ? 'Oxygen reserves exhausted.' : 'Spacecraft structural integrity lost.');
          return;
        }

        if (expired.length) {
          expired.forEach((key) => {
            const scenario = this.eventManager.list().find((sc) => sc.eventKey === key);
            if (scenario) this.eventManager.resolve(scenario.id);
          });
        }

        this.eventManager.checkExpired();

        if (this.stateManager.settings.autoAgents && s.missionStatus === 'active') {
          const sinceCycle = s.missionDay - (s.lastAgentCycleDay ?? -999);
          if (sinceCycle >= AUTO_CYCLE_DAYS && !this.agentManager.busy) {
            this.agentManager.runCycle({ trigger: 'routine-monitoring' });
          }
        }

        MM.bus.emit('sim:tick', { day: s.missionDay, days, tick: s.tick });
      } catch (err) {
        console.error('[MissionMind] Simulation tick failed', err);
        this.stateManager.errorCount += 1;
        this.stateManager.addLog('error', 'Simulation tick fault', err.message, { severity: 'error' });
        MM.bus.emit('system:error', { message: err.message, source: 'simulation' });
      }
    }

    completeMission() {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.stateManager.update((s) => {
        s.missionStatus = 'complete';
        s.progress = 100;
        s.systems.science = 'suspended';
        s.systems.mode = 'arrival';
      }, 'mission:complete');
      this.stateManager.addLog('mission', 'Mars arrival · mission complete', `Simulated transit complete after ${U.fixed(this.stateManager.state.missionDay, 1)} mission days. Final performance score ${this.stateManager.computePerformance()}/100.`, {
        severity: 'info',
        detail: {
          performance: this.stateManager.computePerformance(),
          fuelRemaining: U.round(this.stateManager.state.resources.fuel, 1),
          decisions: this.stateManager.state.metrics.decisions
        }
      });
      MM.bus.emit('toast', {
        type: 'success',
        title: 'Mars arrival',
        message: `Mission complete. Performance ${this.stateManager.computePerformance()}/100.`
      });
      MM.bus.emit('mission:complete', this.stateManager.state);
    }

    failMission(reason) {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      this.stateManager.update((s) => {
        s.missionStatus = 'failed';
        s.systems.mode = 'failed';
      }, 'mission:failed');
      this.stateManager.addLog('mission', 'Mission failure declared', reason, { severity: 'critical' });
      MM.bus.emit('toast', { type: 'critical', title: 'Mission failure', message: reason });
      MM.bus.emit('mission:failed', { reason, state: this.stateManager.state });
    }
  }

  MM.SimulationEngine = SimulationEngine;
  MM.DAYS_PER_TICK = DAYS_PER_TICK;
})();
