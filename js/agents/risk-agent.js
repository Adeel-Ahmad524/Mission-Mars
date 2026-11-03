/* MissionMind — Risk Assessment Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class RiskAgent extends MM.Agent {
    constructor() {
      super({
        id: 'risk-agent',
        name: 'Risk Assessment Agent',
        role: 'Environment & Threat Analysis',
        short: 'RSK',
        accent: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.09)',
        border: 'rgba(239, 68, 68, 0.3)'
      });
    }

    evaluate(state) {
      const s = state;
      const t = this.thresholds;
      const reasons = [];
      let score = 6;

      if (s.events.solarStorm) {
        score += 55;
        reasons.push('Simulated solar particle event elevating radiation and thermal load');
      }
      if (s.events.communicationFailure) {
        score += 30;
        reasons.push('Loss of ground command link requiring onboard autonomy');
      }
      if (s.events.powerFailure) {
        score += 34;
        reasons.push('Power bus failure reducing essential system margins');
      }
      if (s.events.fuelShortage) {
        score += 24;
        reasons.push('Active propellant leak reducing resource margins');
      }
      if (s.systems.equipmentHealth < 85) {
        score += (85 - s.systems.equipmentHealth) * 0.75;
        reasons.push(`Equipment health at ${U.fixed(s.systems.equipmentHealth, 1)}%`);
      }
      if (s.resources.fuel <= t.fuelCritical) {
        score += 16;
        reasons.push('Fuel below critical threshold');
      } else if (s.resources.fuel <= t.fuelWarn) {
        score += 7;
        reasons.push('Fuel below warning threshold');
      }
      if (s.resources.power <= t.powerCritical) {
        score += 20;
        reasons.push('Electrical power below critical threshold');
      } else if (s.resources.power <= t.powerWarn) {
        score += 9;
        reasons.push('Electrical power below warning threshold');
      }
      if (s.resources.oxygen <= t.oxygenCritical) {
        score += 26;
        reasons.push('Oxygen below critical threshold');
      } else if (s.resources.oxygen <= t.oxygenWarn) {
        score += 10;
        reasons.push('Oxygen below warning threshold');
      }
      if (s.systems.temperature > 29) {
        score += 7;
        reasons.push('Cabin thermal load above nominal band');
      }
      if (!reasons.length) reasons.push('No environmental or systems threat signatures detected');

      score = U.clamp(Math.round(score), 0, 100);
      const category = MM.riskCategory(score);
      const status = category === 'critical' ? 'critical' : category === 'high' ? 'warning' : category === 'medium' ? 'analysing' : 'monitoring';

      let suggestedAction = 'continue-nominal';
      let recommendation;
      let relatedEvent = null;

      if (s.events.solarStorm) {
        suggestedAction = 'protective-mode';
        relatedEvent = 'solar-storm';
        recommendation = 'Activate protective operating mode, raise shielding and preserve essential systems until the storm front clears.';
      } else if (s.events.communicationFailure) {
        suggestedAction = 'autonomous-operation';
        relatedEvent = 'communication-failure';
        recommendation = 'Transition to onboard autonomous operation and continue risk monitoring without ground support.';
      } else if (s.events.powerFailure || s.resources.power <= t.powerCritical) {
        suggestedAction = 'power-conservation';
        relatedEvent = s.events.powerFailure ? 'power-failure' : null;
        recommendation = 'Shed nonessential electrical loads immediately and protect life-support power margins.';
      } else if (s.systems.equipmentHealth < 60) {
        suggestedAction = 'emergency-repair';
        recommendation = 'Authorise an autonomous repair cycle before equipment degradation propagates to critical assemblies.';
      } else if (s.resources.fuel <= t.fuelCritical) {
        suggestedAction = 'fuel-conservation';
        recommendation = 'Reduce propellant expenditure and re-plan remaining manoeuvres around critical reserves.';
      } else if (s.events.fuelShortage) {
        suggestedAction = 'fuel-conservation';
        recommendation = 'Contain the propellant leak and confirm resource margins before the next mission phase.';
      } else if (category === 'low') {
        recommendation = 'Maintain environmental monitoring. No protective action required at this time.';
      } else {
        recommendation = 'Increase monitoring cadence and hold mission configuration pending further assessment.';
      }

      const confidence = category === 'critical' ? 0.97 : category === 'high' ? 0.94 : category === 'medium' ? 0.9 : 0.88;

      return this.makeReport(s, {
        status,
        severity: category === 'low' ? 'low' : category,
        observation: `Environmental risk classified ${category.toUpperCase()} (index ${score}/100). ${reasons.join('; ')}.`,
        recommendation,
        confidence,
        suggestedAction,
        relatedEvent,
        details: {
          riskScore: score,
          riskCategory: category,
          reasons,
          thresholds: { ...t }
        }
      });
    }
  }

  MM.RiskAgent = RiskAgent;
})();
