/* MissionMind 2.0 — Proximity Detection Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class ProximityDetectionAgent extends MM.BaseAgent {
    constructor() {
      super({
        id: 'proximity',
        name: 'Proximity Detection Agent',
        role: 'Radar Surveillance, Orbital Debris Tracking & Collision Avoidance',
        short: 'PROXIMITY',
        accent: '#f43f5e',
        bg: 'rgba(244, 63, 94, 0.09)',
        border: 'rgba(244, 63, 94, 0.35)'
      });
    }

    evaluate(state) {
      const radar = state.radar || {};
      const objects = radar.objects || [];

      // 1. Identify Collision Risks (threat: 'red')
      const criticalThreat = objects.find((o) => o.threat === 'red');
      if (criticalThreat) {
        return this.makeReport(state, {
          status: 'critical',
          observation: `COLLISION ALERT: Track ${criticalThreat.name} (${criticalThreat.label}) on close intercept. Miss distance: ${U.fixed(criticalThreat.dcaKm, 2)} km in ${Math.round(criticalThreat.tcaSeconds)} seconds!`,
          recommendation: `Execute immediate collision avoidance burn along transverse axis to open miss-distance beyond safety perimeter.`,
          confidence: 0.98,
          suggestedAction: 'collision-avoidance-burn',
          severity: 'critical',
          details: {
            target: criticalThreat.name,
            dcaKm: criticalThreat.dcaKm,
            tcaSec: criticalThreat.tcaSeconds,
            relSpeedKms: criticalThreat.relativeSpeedKms
          }
        });
      }

      // 2. Identify Monitoring Warnings (threat: 'yellow')
      const warningThreat = objects.find((o) => o.threat === 'yellow');
      if (warningThreat) {
        return this.makeReport(state, {
          status: 'warning',
          observation: `Proximity advisory: Track ${warningThreat.name} passing at ${U.fixed(warningThreat.dcaKm, 2)} km in ${Math.round(warningThreat.tcaSeconds)} seconds (rel speed: ${U.fixed(warningThreat.relativeSpeedKms, 1)} km/s).`,
          recommendation: 'Lock active radar track, compute contingency orbital deflection vectors, and prepare thruster readiness.',
          confidence: 0.91,
          suggestedAction: 'monitor-radar-track',
          severity: 'high',
          details: {
            target: warningThreat.name,
            dcaKm: warningThreat.dcaKm,
            tcaSec: warningThreat.tcaSeconds
          }
        });
      }

      // 3. Nominal Radar Surveillance
      const count = objects.length;
      const closest = objects.reduce((min, o) => (!min || o.distanceKm < min.distanceKm ? o : min), null);

      return this.makeReport(state, {
        status: 'monitoring',
        observation: `Radar perimeter secure. Tracking ${count} orbital contacts within ${radar.rangeKm || 50} km envelope. Closest track: ${closest ? closest.name + ' at ' + U.fixed(closest.distanceKm, 1) + ' km' : 'None'}.`,
        recommendation: 'Maintain continuous 360° radar sweep and orbital debris trajectory filtering.',
        confidence: 0.95,
        suggestedAction: 'continue-nominal',
        severity: 'low',
        details: { tracksCount: count, radarRangeKm: radar.rangeKm }
      });
    }
  }

  MM.ProximityDetectionAgent = ProximityDetectionAgent;
})();
