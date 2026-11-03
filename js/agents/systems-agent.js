/* MissionMind — Life Support & Systems Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class SystemsAgent extends MM.Agent {
    constructor() {
      super({
        id: 'systems-agent',
        name: 'Life Support & Systems Agent',
        role: 'Power, Thermal & ECLSS',
        short: 'SYS',
        accent: '#22d3ee',
        bg: 'rgba(34, 211, 238, 0.09)',
        border: 'rgba(34, 211, 238, 0.3)'
      });
    }

    evaluate(state) {
      const s = state;
      const t = this.thresholds;
      const power = s.resources.power;
      const oxygen = s.resources.oxygen;
      const health = s.systems.equipmentHealth;
      const temp = s.systems.temperature;
      const comm = s.systems.communication;

      let status = 'monitoring';
      let severity = 'low';
      let suggestedAction = 'continue-nominal';
      let relatedEvent = null;
      let confidence = 0.95;
      const notes = [];
      const abnormal = [];

      if (comm === 'lost') {
        status = 'critical';
        severity = 'critical';
        suggestedAction = 'autonomous-operation';
        relatedEvent = 'communication-failure';
        abnormal.push('ground communication link lost');
        confidence = 0.96;
      }
      if (power <= t.powerCritical) {
        abnormal.push(`electrical power critical at ${U.fixed(power, 1)}%`);
        status = 'critical';
        severity = 'critical';
        suggestedAction = 'power-conservation';
        confidence = Math.max(confidence, 0.96);
      } else if (power <= t.powerWarn) {
        abnormal.push(`electrical power low at ${U.fixed(power, 1)}%`);
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
      }
      if (oxygen <= t.oxygenCritical) {
        abnormal.push(`oxygen critical at ${U.fixed(oxygen, 1)}%`);
        status = 'critical';
        severity = 'critical';
        suggestedAction = status === 'critical' && suggestedAction === 'autonomous-operation' ? suggestedAction : 'life-support-priority';
        confidence = Math.max(confidence, 0.97);
      } else if (oxygen <= t.oxygenWarn) {
        abnormal.push(`oxygen low at ${U.fixed(oxygen, 1)}%`);
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
      }
      if (health < 50) {
        abnormal.push(`equipment health critical at ${U.fixed(health, 1)}%`);
        status = 'critical';
        severity = 'critical';
        if (suggestedAction === 'continue-nominal') suggestedAction = 'emergency-repair';
      } else if (health < 75) {
        abnormal.push(`equipment health degraded at ${U.fixed(health, 1)}%`);
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
        if (suggestedAction === 'continue-nominal') suggestedAction = 'emergency-repair';
      }
      if (temp > 29) {
        abnormal.push(`cabin temperature elevated at ${U.fixed(temp, 1)} °C`);
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
      }
      if (comm === 'degraded') {
        abnormal.push('communication link degraded');
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
      }

      if (s.events.solarStorm) {
        abnormal.push('solar radiation load requires protective configuration');
        relatedEvent = 'solar-storm';
        if (suggestedAction === 'continue-nominal' || suggestedAction === 'emergency-repair') suggestedAction = 'protective-mode';
        if (MM.U.severityRank(status) < 2) { status = 'warning'; severity = 'high'; }
      }
      if (s.events.powerFailure && suggestedAction !== 'autonomous-operation' && suggestedAction !== 'life-support-priority') {
        relatedEvent = 'power-failure';
        suggestedAction = 'power-conservation';
        status = 'critical';
        severity = 'critical';
      }

      if (suggestedAction === 'continue-nominal' && s.systems.science === 'suspended' && !s.events.solarStorm && power > t.powerWarn && oxygen > t.oxygenWarn) {
        suggestedAction = 'resume-science';
      }

      let recommendation;
      if (suggestedAction === 'autonomous-operation') {
        recommendation = 'Switch to onboard autonomous operation, isolate the failed link and protect essential command functions.';
      } else if (suggestedAction === 'power-conservation') {
        recommendation = 'Prioritise life support and navigation; suspend nonessential loads until power margins recover.';
      } else if (suggestedAction === 'life-support-priority') {
        recommendation = 'Protect oxygen generation above all other loads and restrict activity to essential life-support operations.';
      } else if (suggestedAction === 'protective-mode') {
        recommendation = 'Enter protective mode, raise shielding and preserve essential systems through the radiation event.';
      } else if (suggestedAction === 'emergency-repair') {
        recommendation = 'Run an autonomous repair cycle on degraded equipment while power margins allow.';
      } else if (suggestedAction === 'resume-science') {
        recommendation = 'Safety margins are restored; resume suspended nonessential science operations.';
      } else {
        recommendation = 'Maintain current systems configuration and continue life-support monitoring.';
      }

      const observation = abnormal.length
        ? `Systems attention required: ${abnormal.join('; ')}. Power ${U.fixed(power, 1)}%, O₂ ${U.fixed(oxygen, 1)}%, cabin ${U.fixed(temp, 1)} °C.`
        : `All essential systems within limits. Power ${U.fixed(power, 1)}%, O₂ ${U.fixed(oxygen, 1)}%, cabin ${U.fixed(temp, 1)} °C, link ${comm}.`;

      notes.push(`autonomy=${s.systems.autonomy}`);

      return this.makeReport(s, {
        status,
        severity,
        observation,
        recommendation,
        confidence,
        suggestedAction,
        relatedEvent,
        details: {
          power: U.round(power, 2),
          oxygen: U.round(oxygen, 2),
          temperature: U.round(temp, 2),
          equipmentHealth: U.round(health, 2),
          communication: comm,
          autonomy: s.systems.autonomy,
          thresholds: { ...t },
          notes
        }
      });
    }
  }

  MM.SystemsAgent = SystemsAgent;
})();
