/* MissionMind — base agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class BaseAgent {
    constructor(config) {
      this.id = config.id;
      this.name = config.name;
      this.role = config.role;
      this.short = config.short;
      this.accent = config.accent || '#38bdf8';
      this.bg = config.bg || 'rgba(56, 189, 248, 0.09)';
      this.border = config.border || 'rgba(56, 189, 248, 0.3)';
      this.thresholds = {
        fuelWarn: 50,
        fuelCritical: 20,
        powerWarn: 45,
        powerCritical: 18,
        oxygenWarn: 35,
        oxygenCritical: 18
      };
      this.status = 'monitoring';
      this.observation = 'Awaiting first autonomous scan.';
      this.recommendation = 'Continue monitoring assigned subsystem.';
      this.confidence = 0.9;
      this.lastActivity = null;
      this.latestReport = null;
      this.suggestedAction = 'continue-nominal';
    }

    /**
     * Build, validate and publish a structured report.
     * The report schema is shared by every specialised agent.
     */
    makeReport(state, data) {
      const report = {
        agentId: this.id,
        agentName: this.name,
        role: this.role,
        timestamp: U.missionTime(state.missionDay),
        missionDay: U.round(state.missionDay, 2),
        status: data.status,
        observation: data.observation,
        recommendation: data.recommendation,
        confidence: U.round(U.clamp(Number(data.confidence), 0.05, 0.99), 2),
        relatedEvent: data.relatedEvent || null,
        suggestedAction: data.suggestedAction || 'continue-nominal',
        severity: data.severity || this.statusToSeverity(data.status),
        details: data.details || {}
      };

      this.status = report.status;
      this.observation = report.observation;
      this.recommendation = report.recommendation;
      this.confidence = report.confidence;
      this.suggestedAction = report.suggestedAction;
      this.lastActivity = report.timestamp;
      this.latestReport = report;

      try {
        MM.bus.publishReport(report);
      } catch (err) {
        console.error(err);
        MM.bus.emit('system:error', { message: err.message, source: this.id });
      }
      return report;
    }

    statusToSeverity(status) {
      return ({ idle: 'low', monitoring: 'low', analysing: 'medium', warning: 'high', critical: 'critical', completed: 'low' })[status] || 'low';
    }

    evaluate() {
      throw new Error(`Agent ${this.id} does not implement evaluate().`);
    }

    safeEvaluate(state) {
      try {
        return this.evaluate(state);
      } catch (err) {
        console.error(`[MissionMind] ${this.name} evaluation failed`, err);
        MM.bus.emit('system:error', { message: err.message, source: this.id });
        return this.makeReport(state, {
          status: 'warning',
          observation: 'Agent evaluation fault detected; using degraded ruleset.',
          recommendation: 'Continue mission monitoring while the agent recovers.',
          confidence: 0.2,
          suggestedAction: 'continue-nominal',
          severity: 'medium'
        });
      }
    }

    reset() {
      this.status = 'monitoring';
      this.observation = 'Awaiting first autonomous scan.';
      this.recommendation = 'Continue monitoring assigned subsystem.';
      this.confidence = 0.9;
      this.lastActivity = null;
      this.latestReport = null;
      this.suggestedAction = 'continue-nominal';
    }

    toJSON() {
      return {
        id: this.id,
        name: this.name,
        role: this.role,
        status: this.status,
        observation: this.observation,
        recommendation: this.recommendation,
        confidence: this.confidence,
        lastActivity: this.lastActivity,
        suggestedAction: this.suggestedAction,
        latestReport: this.latestReport
      };
    }
  }

  MM.Agent = BaseAgent;
  MM.BaseAgent = BaseAgent;
})();
