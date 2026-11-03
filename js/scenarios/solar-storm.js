/* MissionMind — Solar Storm scenario */
(function () {
  'use strict';
  const MM = window.MM;
  MM.scenarios = MM.scenarios || {};

  MM.scenarios['solar-storm'] = {
    id: 'solar-storm',
    title: 'Solar Storm',
    severity: 'high',
    accent: '#f59e0b',
    icon: 'sun',
    summary: 'A simulated solar particle event approaches the spacecraft.',
    description: 'Radiation flux and thermal load rise for roughly 12 simulated days. Shielding, power routing and nonessential payloads are affected.',
    affected: ['Radiation shielding', 'Thermal control', 'Power budget', 'Science payload'],
    expectedAgents: ['risk-agent', 'systems-agent', 'science-agent', 'commander-agent'],
    changes: ['Radiation flux +480%', 'Thermal load +3.5 °C', 'Science operations exposed'],
    eventKey: 'solarStorm',

    apply(stateManager) {
      const s = stateManager.state;
      if (s.events.solarStorm) return { ok: false, message: 'A solar storm is already active.' };
      stateManager.update((st) => {
        st.events.solarStorm = true;
        st.eventTimers.solarStorm = 12;
        st.metrics.emergenciesDetected += 1;
        st.systems.shield = 'standby';
        st.systems.temperature = MM.U.clamp(st.systems.temperature + 3.5, -50, 80);
      }, 'scenario:solar-storm');
      return {
        ok: true,
        message: 'Simulated solar storm front detected. Radiation and thermal stress inbound for ~12 mission days.',
        changes: this.changes
      };
    },

    resolve(stateManager) {
      const s = stateManager.state;
      if (!s.events.solarStorm) return null;
      stateManager.update((st) => {
        st.events.solarStorm = false;
        st.eventTimers.solarStorm = 0;
        st.modes.protective = false;
        st.systems.shield = 'standby';
        st.systems.temperature = MM.U.clamp(st.systems.temperature - 2.5, -50, 80);
      }, 'scenario:solar-storm-resolved');
      return { message: 'Solar storm front has cleared. Radiation flux returning to background levels; protective posture released.' };
    }
  };
})();
