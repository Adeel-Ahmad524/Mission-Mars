/* MissionMind — Fuel Shortage scenario */
(function () {
  'use strict';
  const MM = window.MM;
  MM.scenarios = MM.scenarios || {};

  MM.scenarios['fuel-shortage'] = {
    id: 'fuel-shortage',
    title: 'Fuel Shortage',
    severity: 'high',
    accent: '#38bdf8',
    icon: 'fuel',
    summary: 'An unexpected propellant leak drains reserve during transit.',
    description: 'Fuel drops by approximately 22 percentage points and continues to leak until conservation and containment are engaged.',
    affected: ['Propellant reserve', 'Manoeuvre budget', 'Trajectory plan', 'Mission continuity'],
    expectedAgents: ['fuel-agent', 'navigation-agent', 'science-agent', 'commander-agent'],
    changes: ['Fuel reserve −22%', 'Active leak signature', 'Manoeuvre budget reduced'],
    eventKey: 'fuelShortage',

    apply(stateManager) {
      const s = stateManager.state;
      if (s.events.fuelShortage) return { ok: false, message: 'The propellant anomaly is already active.' };
      stateManager.update((st) => {
        st.events.fuelShortage = true;
        st.eventTimers.fuelShortage = 10;
        st.resources.fuel = MM.U.clamp(st.resources.fuel - 22, 0, 100);
        st.resources.fuelConsumed = MM.U.clamp(st.resources.fuelConsumed + 22, 0, 100);
        st.missionFlags.leakSealed = false;
        st.metrics.emergenciesDetected += 1;
      }, 'scenario:fuel-shortage');
      return {
        ok: true,
        message: 'Propellant pressure anomaly detected. An estimated 22% of reserve was lost before isolation, and the leak remains active.',
        changes: this.changes
      };
    },

    resolve(stateManager) {
      const s = stateManager.state;
      if (!s.events.fuelShortage) return null;
      const contained = s.modes.fuelSaving;
      stateManager.update((st) => {
        st.events.fuelShortage = false;
        st.eventTimers.fuelShortage = 0;
        st.missionFlags.leakSealed = true;
      }, 'scenario:fuel-shortage-resolved');
      return {
        message: contained
          ? 'Propellant leak sealed after conservation and containment actions. Reserve stable.'
          : 'Propellant anomaly self-sealed. Reserve is stable but lower than planned.'
      };
    }
  };
})();
