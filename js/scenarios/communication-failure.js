/* MissionMind — Communication Failure scenario */
(function () {
  'use strict';
  const MM = window.MM;
  MM.scenarios = MM.scenarios || {};

  MM.scenarios['communication-failure'] = {
    id: 'communication-failure',
    title: 'Communication Failure',
    severity: 'high',
    accent: '#8b5cf6',
    icon: 'comm',
    summary: 'The simulated deep-space link to ground control is lost.',
    description: 'Ground commanding becomes unavailable. The crewed spacecraft must transition to onboard autonomous operation while the link recovers.',
    affected: ['Ground link', 'Command authority', 'Science uplink', 'Navigation updates'],
    expectedAgents: ['systems-agent', 'risk-agent', 'commander-agent'],
    changes: ['DSN link lost', 'Ground command authority unavailable', 'Autonomous mode recommended'],
    eventKey: 'communicationFailure',

    apply(stateManager) {
      const s = stateManager.state;
      if (s.events.communicationFailure) return { ok: false, message: 'The communication link is already lost.' };
      stateManager.update((st) => {
        st.events.communicationFailure = true;
        st.eventTimers.communicationFailure = 12;
        st.systems.communication = 'lost';
        st.metrics.emergenciesDetected += 1;
      }, 'scenario:communication-failure');
      return {
        ok: true,
        message: 'Simulated ground link lost. No command uplink is available; onboard autonomy is required.',
        changes: this.changes
      };
    },

    resolve(stateManager) {
      const s = stateManager.state;
      if (!s.events.communicationFailure) return null;
      stateManager.update((st) => {
        st.events.communicationFailure = false;
        st.eventTimers.communicationFailure = 0;
        st.systems.communication = 'stable';
        st.systems.autonomy = 'ground-linked';
        st.modes.autonomous = false;
      }, 'scenario:communication-failure-resolved');
      return { message: 'Ground link reacquired. Autonomous command authority returned to mission control.' };
    }
  };
})();
