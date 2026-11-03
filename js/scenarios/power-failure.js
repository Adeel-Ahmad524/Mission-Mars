/* MissionMind — Electrical Power Failure scenario */
(function () {
  'use strict';
  const MM = window.MM;
  MM.scenarios = MM.scenarios || {};

  MM.scenarios['power-failure'] = {
    id: 'power-failure',
    title: 'Electrical Power Failure',
    severity: 'critical',
    accent: '#ef4444',
    icon: 'power',
    summary: 'A main bus fault causes a severe electrical power shortfall.',
    description: 'Available power falls by approximately 38 percentage points. Essential loads must be prioritised and nonessential activities suspended.',
    affected: ['Power bus', 'Life support margin', 'Thermal control', 'Science payload'],
    expectedAgents: ['systems-agent', 'science-agent', 'fuel-agent', 'commander-agent'],
    changes: ['Electrical power −38%', 'Essential-load margins reduced', 'Thermal control degraded'],
    eventKey: 'powerFailure',

    apply(stateManager) {
      const s = stateManager.state;
      if (s.events.powerFailure) return { ok: false, message: 'The power bus fault is already active.' };
      stateManager.update((st) => {
        st.events.powerFailure = true;
        st.eventTimers.powerFailure = 12;
        st.resources.power = MM.U.clamp(st.resources.power - 38, 0, 100);
        st.resources.powerConsumed = MM.U.clamp(st.resources.powerConsumed + 38, 0, 100);
        st.systems.temperature = MM.U.clamp(st.systems.temperature - 1.5, -50, 80);
        st.metrics.emergenciesDetected += 1;
      }, 'scenario:power-failure');
      return {
        ok: true,
        message: 'Main power bus fault simulated. Available electrical power critically reduced.',
        changes: this.changes
      };
    },

    resolve(stateManager) {
      const s = stateManager.state;
      if (!s.events.powerFailure) return null;
      const saved = s.modes.powerSaving || s.modes.lifeSupportPriority;
      stateManager.update((st) => {
        st.events.powerFailure = false;
        st.eventTimers.powerFailure = 0;
        st.resources.power = MM.U.clamp(st.resources.power + (saved ? 14 : 5), 0, 100);
      }, 'scenario:power-failure-resolved');
      return {
        message: saved
          ? 'Backup bus restored with conservation active. Power margin recovered by 14 percentage points.'
          : 'Backup bus restored without load shedding. Power margin recovered by only 5 percentage points.'
      };
    }
  };
})();
