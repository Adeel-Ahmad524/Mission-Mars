/* MissionMind — Navigation Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class NavigationAgent extends MM.Agent {
    constructor() {
      super({
        id: 'navigation-agent',
        name: 'Navigation Agent',
        role: 'Trajectory & Guidance',
        short: 'NAV',
        accent: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.09)',
        border: 'rgba(56, 189, 248, 0.3)'
      });
    }

    evaluate(state) {
      const p = MM.physics;
      const s = state;
      const progress = s.progress;
      const distanceKm = s.spacecraft.distanceToMarsKm;
      const etaDays = Math.max(0, ((100 - progress) / 100) * s.missionDurationDays);
      const vEarth = p.circularOrbitalVelocity(p.CONST.M_SUN, p.CONST.R_EARTH_ORBIT) / 1000;
      const vMars = p.circularOrbitalVelocity(p.CONST.M_SUN, p.CONST.R_MARS_ORBIT) / 1000;

      let uncertainty = 850 + Math.max(0, 92 - s.systems.equipmentHealth) * 22;
      if (s.events.solarStorm) uncertainty += 2800;
      if (s.events.communicationFailure) uncertainty += 1400;
      if (s.resources.fuel < 20) uncertainty += 500;
      uncertainty = Math.round(uncertainty);

      let status = 'monitoring';
      let severity = 'low';
      let observation;
      let recommendation;
      let suggestedAction = 'continue-nominal';
      let relatedEvent = null;
      let confidence = 0.96;

      const correctionOpen = progress >= 35
        && progress < 88
        && !s.missionFlags.midCourseCorrection
        && s.resources.fuel > 45
        && s.systems.equipmentHealth > 75
        && !s.events.solarStorm;

      if (s.events.solarStorm) {
        status = 'warning';
        severity = 'high';
        confidence = 0.79;
        relatedEvent = 'solar-storm';
        observation = `Particle noise is degrading star-tracker accuracy. Position uncertainty is ±${U.thousands(uncertainty)} km.`;
        recommendation = 'Maintain the current coast trajectory; no immediate navigation burn is required while the storm persists.';
      } else if (s.events.communicationFailure) {
        status = 'analysing';
        severity = 'medium';
        confidence = 0.76;
        relatedEvent = 'communication-failure';
        observation = 'Ground tracking unavailable. Inertial navigation solution remains valid with growing drift.';
        recommendation = 'Continue inertial coast and defer trajectory updates until the ground link is restored.';
      } else if (s.systems.equipmentHealth < 65) {
        status = 'warning';
        severity = 'high';
        confidence = 0.84;
        observation = `Guidance hardware health at ${U.fixed(s.systems.equipmentHealth, 1)}% is reducing navigation reliability.`;
        recommendation = 'Limit nonessential guidance activity and request a systems repair assessment.';
      } else if (correctionOpen) {
        status = 'warning';
        severity = 'medium';
        confidence = 0.9;
        observation = `Mid-course correction window is open at ${U.fixed(progress, 1)}% transit. Tracking uncertainty ±${U.thousands(uncertainty)} km.`;
        recommendation = 'Execute a 4.5% propellant burn to refine the approach trajectory and close position error.';
        suggestedAction = 'trajectory-correction';
      } else {
        observation = `On nominal transfer. Range ${U.millions(distanceKm)}, position uncertainty ±${U.thousands(uncertainty)} km.`;
        recommendation = s.resources.fuel < 20
          ? 'Preserve remaining propellant; defer all nonessential manoeuvres and re-plan the approach.'
          : 'Maintain current guidance solution and continue autonomous trajectory monitoring.';
        if (s.resources.fuel < 20) suggestedAction = 'fuel-conservation';
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
          distanceKm: Math.round(distanceKm),
          progress: U.round(progress, 2),
          velocityKms: U.round(s.spacecraft.velocityKms, 3),
          etaDays: U.round(etaDays, 1),
          uncertaintyKm: uncertainty,
          earthCircularVelocityKms: U.round(vEarth, 3),
          marsCircularVelocityKms: U.round(vMars, 3),
          midCourseCorrectionDone: Boolean(s.missionFlags.midCourseCorrection),
          visualModel: 'Linear visual progress; not a physically accurate interplanetary trajectory.'
        }
      });
    }
  }

  MM.NavigationAgent = NavigationAgent;
})();
