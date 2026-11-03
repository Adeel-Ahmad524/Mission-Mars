/* MissionMind — Fuel Management Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class FuelAgent extends MM.Agent {
    constructor() {
      super({
        id: 'fuel-agent',
        name: 'Fuel Management Agent',
        role: 'Propellant & Resource Control',
        short: 'FUE',
        accent: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.09)',
        border: 'rgba(245, 158, 11, 0.3)'
      });
    }

    evaluate(state) {
      const s = state;
      const t = this.thresholds;
      const fuel = s.resources.fuel;
      const rate = MM.RATES.fuelPerDay
        * (s.modes.fuelSaving ? 0.45 : 1)
        * (s.events.fuelShortage && !s.modes.fuelSaving ? 1.9 : 1)
        * (s.events.solarStorm ? 1.08 : 1);
      const daysRemaining = rate > 0 ? fuel / rate : Infinity;

      let status = 'monitoring';
      let severity = 'low';
      let confidence = 0.96;
      let observation;
      let recommendation;
      let suggestedAction = 'continue-nominal';
      let relatedEvent = null;

      if (s.events.fuelShortage) relatedEvent = 'fuel-shortage';

      if (fuel <= t.fuelCritical) {
        status = 'critical';
        severity = 'critical';
        observation = `Fuel critically low at ${U.fixed(fuel, 1)}% (critical threshold ${t.fuelCritical}%). Projected endurance ${U.fixed(daysRemaining, 1)} simulated days.`;
        recommendation = 'Enter fuel conservation immediately, seal the suspected leak and cancel all nonessential manoeuvres.';
        suggestedAction = 'fuel-conservation';
      } else if (fuel <= t.fuelWarn) {
        status = 'warning';
        severity = 'high';
        observation = s.events.fuelShortage
          ? `Propellant leak detected. Fuel is ${U.fixed(fuel, 1)}% and falling faster than the planned profile.`
          : `Fuel reserves at ${U.fixed(fuel, 1)}% are below the ${t.fuelWarn}% warning threshold. Projected endurance ${U.fixed(daysRemaining, 1)} simulated days.`;
        recommendation = 'Reduce nonessential fuel consumption and contain the propellant anomaly before the next manoeuvre window.';
        suggestedAction = 'fuel-conservation';
      } else if (s.events.fuelShortage) {
        status = 'warning';
        severity = 'medium';
        observation = `Fuel at ${U.fixed(fuel, 1)}% with an active leak signature; reserves still above the warning threshold.`;
        recommendation = 'Seal the leak now while reserves remain adequate.';
        suggestedAction = 'fuel-conservation';
      } else if (s.modes.fuelSaving) {
        observation = `Conservation mode active. Fuel at ${U.fixed(fuel, 1)}%; burn rate reduced to ${U.fixed(rate, 2)}%/day.`;
        recommendation = 'Maintain conservation until reserves recover to the planned profile.';
      } else {
        observation = `Fuel reserves healthy at ${U.fixed(fuel, 1)}%. Current burn ${U.fixed(rate, 2)}% of tank per simulated day.`;
        recommendation = 'Continue nominal consumption; reserve is sufficient for the planned simulated transfer.';
      }

      if (s.events.solarStorm) confidence = Math.min(confidence, 0.9);

      return this.makeReport(s, {
        status,
        severity,
        observation,
        recommendation,
        confidence,
        suggestedAction,
        relatedEvent,
        details: {
          fuelPercent: U.round(fuel, 2),
          burnRatePerDay: U.round(rate, 3),
          daysRemaining: Number.isFinite(daysRemaining) ? U.round(daysRemaining, 1) : null,
          thresholds: { ...t },
          conservationActive: Boolean(s.modes.fuelSaving),
          leakActive: Boolean(s.events.fuelShortage)
        }
      });
    }
  }

  MM.FuelAgent = FuelAgent;
})();
