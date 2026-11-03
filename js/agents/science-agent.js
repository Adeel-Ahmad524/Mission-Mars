/* MissionMind — Science Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class ScienceAgent extends MM.Agent {
    constructor() {
      super({
        id: 'science-agent',
        name: 'Science Agent',
        role: 'Research Prioritisation',
        short: 'SCI',
        accent: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.09)',
        border: 'rgba(34, 197, 94, 0.3)'
      });
    }

    evaluate(state) {
      const s = state;
      const t = this.thresholds;
      const constraints = [];

      if (s.events.solarStorm) constraints.push('radiation environment');
      if (s.events.communicationFailure) constraints.push('loss of ground science uplink');
      if (s.resources.power < t.powerWarn) constraints.push('power margin');
      if (s.resources.oxygen < t.oxygenWarn) constraints.push('life-support margin');
      if (s.systems.equipmentHealth < 70) constraints.push('equipment health');
      if (s.resources.fuel < t.fuelCritical) constraints.push('propellant margin');

      const unsafe = constraints.length > 0;
      const scienceActive = s.systems.science === 'active';
      const sinceRun = s.missionDay - (s.missionFlags.lastScienceDay ?? -99);
      const windowOpen = s.missionStatus === 'active' && s.missionDay > 8 && sinceRun > 40 && scienceActive;

      let status = 'monitoring';
      let severity = 'low';
      let confidence = 0.9;
      let observation;
      let recommendation;
      let suggestedAction = 'continue-nominal';
      let relatedEvent = null;

      if (unsafe) {
        status = constraints.length >= 2 ? 'warning' : 'analysing';
        severity = constraints.length >= 2 ? 'high' : 'medium';
        confidence = 0.93;
        if (s.events.solarStorm) relatedEvent = 'solar-storm';
        else if (s.events.communicationFailure) relatedEvent = 'communication-failure';
        observation = `Scientific operations constrained by ${constraints.join(', ')}. Experiment queue is ready but nonessential.`;
        recommendation = 'Postpone nonessential experiments and release power and crew attention to safety-critical operations.';
        if (scienceActive) suggestedAction = 'suspend-science';
      } else if (!scienceActive) {
        status = 'analysing';
        severity = 'medium';
        confidence = 0.91;
        observation = 'Science payload is suspended while all safety margins are now within nominal limits.';
        recommendation = 'Resume the nonessential science schedule; safety constraints have cleared.';
        suggestedAction = 'resume-science';
      } else if (windowOpen) {
        status = 'monitoring';
        severity = 'low';
        confidence = 0.86;
        observation = `Observation window open: 34% illumination gain expected. Available power margin ${U.fixed(s.resources.power, 1)}%.`;
        recommendation = 'Run the prioritised spectroscopy observation; estimated +7 scientific value for 2.2% power.';
        suggestedAction = 'science-priority';
      } else {
        observation = scienceActive
          ? 'Science payload healthy. No observation window currently exceeds the resource cost threshold.'
          : 'Science payload suspended; no safe window available.';
        recommendation = 'Maintain the experiment queue and defer nonessential observations until the next window.';
      }

      return this.makeReport(s, {
        status,
        severity,
        observation,
        recommendation,
        confidence,
        suggestedAction,
        relatedEvent,
        details: {
          scienceActive,
          safetyConstraints: constraints,
          safetyOverride: unsafe ? 'Safety constraints supersede all science objectives.' : 'No safety conflict detected.',
          scientificValue: s.metrics.scientificValue,
          nextWindowInDays: windowOpen ? 0 : Math.max(0, 40 - sinceRun),
          thresholds: { ...t }
        }
      });
    }
  }

  MM.ScienceAgent = ScienceAgent;
})();
