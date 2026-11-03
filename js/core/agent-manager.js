/* MissionMind — Agent Manager / coordination loop */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class AgentManager {
    constructor(stateManager, decisionEngine) {
      this.stateManager = stateManager;
      this.decisionEngine = decisionEngine;
      this.commander = new MM.CommanderAgent();
      this.navigation = new MM.NavigationAgent();
      this.fuel = new MM.FuelAgent();
      this.risk = new MM.RiskAgent();
      this.systems = new MM.SystemsAgent();
      this.science = new MM.ScienceAgent();
      this.energy = new MM.EnergyTransitionAgent();
      this.proximity = new MM.ProximityDetectionAgent();
      this.propulsion = new MM.PropulsionControlAgent();
      this.specialists = [
        this.navigation,
        this.fuel,
        this.risk,
        this.systems,
        this.science,
        this.energy,
        this.proximity,
        this.propulsion
      ];
      this.agents = [this.commander, ...this.specialists];
      this.busy = false;
      this.lastCycle = null;
      this.cycleCount = 0;
    }

    syncThresholds() {
      this.agents.forEach((agent) => {
        agent.thresholds = { ...this.stateManager.thresholds };
      });
    }

    getAgent(id) {
      return this.agents.find((a) => a.id === id);
    }

    reset() {
      this.agents.forEach((a) => a.reset());
      this.commander.lastProposal = null;
      this.busy = false;
      this.lastCycle = null;
      this.cycleCount = 0;
    }

    /**
     * Full coordination cycle:
     * specialist observation → structured reports → Commander evaluation →
     * Decision Engine validation/execution → logging → UI event.
     */
    runCycle(options) {
      const opts = options || {};
      const trigger = opts.trigger || 'routine-monitoring';
      const forceRecord = Boolean(opts.forceRecord);
      const manual = Boolean(opts.manual);

      if (this.busy) {
        MM.bus.emit('toast', { type: 'warning', title: 'Cycle in progress', message: 'Wait for the current coordination cycle to finish.' });
        return null;
      }
      this.busy = true;

      try {
        this.syncThresholds();
        const state = this.stateManager.state;
        const reports = [];
        this.specialists.forEach((agent) => {
          const report = agent.safeEvaluate(state);
          if (report) {
            reports.push(report);
            this.stateManager.addReport(report);
          }
        });

        const { proposal, commanderReport } = this.commander.decide(reports, state, trigger);
        this.stateManager.addReport(commanderReport);

        const actionable = proposal.actionId !== 'continue-nominal';
        const shouldRecord = actionable || forceRecord;
        let decision = null;
        if (shouldRecord) {
          decision = this.decisionEngine.execute(proposal, reports);
        }

        if (shouldRecord) {
          reports.forEach((report) => {
            this.stateManager.addLog('observation', `${report.agentName} · ${U.statusLabel(report.status)}`, report.observation, {
              severity: report.severity,
              agentId: report.agentId,
              report,
              detail: report
            });
          });
          this.stateManager.addLog('mission', 'Coordinated agent cycle', `${reports.length} structured reports evaluated · Commander selected ${proposal.actionLabel}.`, {
            severity: proposal.severity === 'critical' ? 'critical' : proposal.severity === 'high' ? 'warning' : 'info',
            detail: { proposal: proposal.actionId, trigger }
          });
        }

        this.cycleCount += 1;
        this.stateManager.markAgentCycle();
        this.lastCycle = {
          day: U.round(state.missionDay, 2),
          reports: reports.length,
          actionId: proposal.actionId,
          actionLabel: proposal.actionLabel,
          decisionId: decision ? decision.id : null,
          executionStatus: decision ? decision.executionStatus : 'monitoring',
          conflicts: proposal.conflicts,
          confidence: proposal.confidence,
          proposal,
          manual,
          trigger
        };

        MM.bus.emit('agents:cycle', {
          reports,
          proposal,
          decision,
          cycle: this.lastCycle
        });

        if (manual) {
          MM.bus.emit('toast', {
            type: decision ? (decision.executionStatus === 'completed' ? 'success' : 'warning') : 'info',
            title: decision ? proposal.actionLabel : 'No action required',
            message: decision
              ? `Commander evaluated ${reports.length} reports and executed ${proposal.actionId}.`
              : `Commander evaluated ${reports.length} reports; all parameters within action thresholds.`
          });
        }

        return this.lastCycle;
      } catch (err) {
        console.error('[MissionMind] Agent coordination cycle failed', err);
        this.stateManager.errorCount += 1;
        this.stateManager.addLog('error', 'Coordination cycle fault', err.message, { severity: 'error' });
        MM.bus.emit('system:error', { message: err.message, source: 'agent-manager' });
        MM.bus.emit('toast', { type: 'critical', title: 'Agent cycle failed', message: err.message });
        return null;
      } finally {
        this.busy = false;
      }
    }

    statusSummary() {
      return this.agents.reduce((acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      }, {});
    }
  }

  MM.AgentManager = AgentManager;
})();
