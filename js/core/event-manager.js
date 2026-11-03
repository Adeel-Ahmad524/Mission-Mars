/* MissionMind — Emergency Scenario / Event Manager */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class EventManager {
    constructor(stateManager, agentManager) {
      this.stateManager = stateManager;
      this.agentManager = agentManager;
      this.simulation = null;
      this.scenarios = MM.scenarios || {};
      this.order = ['solar-storm', 'fuel-shortage', 'communication-failure', 'power-failure'];
    }

    attachSimulation(simulation) {
      this.simulation = simulation;
    }

    get(id) {
      return this.scenarios[id] || null;
    }

    list() {
      return this.order.map((id) => this.scenarios[id]).filter(Boolean);
    }

    isActive(id) {
      const scenario = this.get(id);
      return Boolean(scenario && this.stateManager.state.events[scenario.eventKey]);
    }

    activeCount() {
      return this.list().filter((s) => this.isActive(s.id)).length;
    }

    trigger(id) {
      const scenario = this.get(id);
      if (!scenario) {
        MM.bus.emit('toast', { type: 'critical', title: 'Unknown scenario', message: `No scenario registered for "${id}".` });
        return null;
      }
      const state = this.stateManager.state;
      if (state.missionStatus === 'complete') {
        MM.bus.emit('toast', { type: 'warning', title: 'Mission complete', message: 'Reset the mission before injecting a new emergency.' });
        return null;
      }
      if (state.missionStatus === 'failed') {
        MM.bus.emit('toast', { type: 'warning', title: 'Mission failed', message: 'Reset the mission before injecting a new emergency.' });
        return null;
      }
      if (this.isActive(id)) {
        MM.bus.emit('toast', { type: 'warning', title: 'Scenario already active', message: `${scenario.title} is already affecting the spacecraft.` });
        return null;
      }

      let autoStarted = false;
      if (state.missionStatus === 'standby' && this.simulation) {
        autoStarted = this.simulation.start({ silent: true });
        if (autoStarted) {
          this.stateManager.addLog('mission', 'Mission auto-start', 'Mission started automatically so the injected emergency could be evaluated and resolved.', { severity: 'info' });
        }
      }

      const result = scenario.apply(this.stateManager);
      if (!result || !result.ok) {
        MM.bus.emit('toast', { type: 'warning', title: 'Scenario not applied', message: (result && result.message) || 'Unknown error.' });
        return null;
      }

      this.stateManager.addLog('event', `${scenario.title} detected`, result.message, {
        severity: scenario.severity,
        detail: {
          scenarioId: scenario.id,
          severity: scenario.severity,
          changes: result.changes,
          affected: scenario.affected,
          expectedAgents: scenario.expectedAgents
        }
      });

      MM.bus.emit('scenario:triggered', { scenario, result, autoStarted });
      MM.bus.emit('toast', {
        type: scenario.severity === 'critical' ? 'critical' : 'warning',
        title: `${scenario.title} injected`,
        message: result.message
      });

      if (this.stateManager.state.missionStatus === 'paused') {
        MM.bus.emit('toast', {
          type: 'info',
          title: 'Simulation paused',
          message: 'Agents can respond now, but event timers only advance while the mission is running.'
        });
      }

      this.agentManager.runCycle({ trigger: scenario.id, forceRecord: true });

      if (autoStarted) {
        MM.bus.emit('toast', { type: 'info', title: 'Mission started', message: 'Simulation resumed so the emergency can resolve over time.' });
      }
      return { scenario, result, autoStarted };
    }

    resolve(id) {
      const scenario = this.get(id);
      if (!scenario || !this.isActive(id)) return null;
      const outcome = scenario.resolve(this.stateManager);
      if (!outcome) return null;
      this.stateManager.update((s) => {
        s.eventTimers[scenario.eventKey] = 0;
      }, `resolve:${id}`);

      this.stateManager.addLog('event', `${scenario.title} cleared`, outcome.message, {
        severity: 'info',
        detail: { scenarioId: id, resolved: true }
      });
      MM.bus.emit('scenario:resolved', { scenario, outcome, day: this.stateManager.state.missionDay });
      MM.bus.emit('toast', { type: 'success', title: `${scenario.title} resolved`, message: outcome.message });

      /* Verification pass: agents re-evaluate the recovered state. */
      this.agentManager.runCycle({ trigger: `resolution:${id}`, forceRecord: true });
      return outcome;
    }

    checkExpired() {
      const expired = [];
      const s = this.stateManager.state;
      this.list().forEach((scenario) => {
        if (s.events[scenario.eventKey] && s.eventTimers[scenario.eventKey] <= 0) expired.push(scenario.id);
      });
      expired.forEach((id) => this.resolve(id));
      return expired;
    }

    restoreNominal() {
      const s = this.stateManager.state;
      const active = this.activeCount();
      const modesActive = Object.values(s.modes).some(Boolean);
      if (!active && !modesActive && s.systems.communication === 'stable') {
        MM.bus.emit('toast', { type: 'info', title: 'Already nominal', message: 'No active emergency or non-nominal operating mode to clear.' });
        return false;
      }

      this.stateManager.update((st) => {
        const t = this.stateManager.thresholds;
        Object.keys(st.events).forEach((key) => { st.events[key] = false; });
        Object.keys(st.eventTimers).forEach((key) => { st.eventTimers[key] = 0; });
        Object.keys(st.modes).forEach((key) => { st.modes[key] = false; });
        st.systems.communication = 'stable';
        st.systems.autonomy = 'ground-linked';
        st.systems.shield = 'standby';
        st.systems.science = 'active';
        st.systems.mode = 'nominal';
        st.systems.temperature = 22;
        st.missionFlags.leakSealed = true;
        st.resources.fuel = U.clamp(Math.max(st.resources.fuel, t.fuelWarn + 10), 0, 100);
        st.resources.power = U.clamp(Math.max(st.resources.power, t.powerWarn + 10), 0, 100);
        st.resources.oxygen = U.clamp(Math.max(st.resources.oxygen, t.oxygenWarn + 10), 0, 100);
        st.systems.equipmentHealth = U.clamp(st.systems.equipmentHealth + 4, 0, 100);
      }, 'manual:restore-nominal');

      this.stateManager.addLog('override', 'Manual override · nominal systems restored', 'Operator restored nominal configuration. All simulated emergencies cleared and essential systems reset.', {
        severity: 'warning',
        detail: { override: true, clearedEvents: active }
      });

      MM.bus.emit('toast', { type: 'success', title: 'Nominal systems restored', message: 'All simulated emergencies and operating modes reset.' });
      this.agentManager.runCycle({ trigger: 'manual-restore', forceRecord: true });
      return true;
    }
  }

  MM.EventManager = EventManager;
})();
