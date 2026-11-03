/* MissionMind — Commander Agent (central coordinator) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  const SEVERITY_URGENCY = { critical: 32, high: 22, medium: 12, low: 3, info: 1, warning: 22 };
  const PRIORITY_ORDER = ['safety', 'essential', 'resource', 'mission', 'science', 'ops'];

  class CommanderAgent extends MM.Agent {
    constructor() {
      super({
        id: 'commander-agent',
        name: 'Commander Agent',
        role: 'Central Mission Coordination',
        short: 'CMD',
        accent: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.1)',
        border: 'rgba(139, 92, 246, 0.32)'
      });
      this.lastProposal = null;
      this.status = 'monitoring';
      this.observation = 'Standing by for specialised agent reports.';
      this.recommendation = 'Collect and evaluate all reports before selecting an action.';
      this.confidence = 0.94;
    }

    catalogFor(actionId) {
      const catalog = MM.ActionCatalog || {};
      return catalog[actionId] || { label: 'Continue nominal operations', short: 'MONITOR', category: 'ops', base: 20, description: 'No state change.' };
    }

    isActionViable(actionId, state) {
      const s = state;
      const t = this.thresholds;
      switch (actionId) {
        case 'autonomous-operation':
          return s.systems.communication !== 'stable' || s.events.communicationFailure;
        case 'protective-mode':
          return true;
        case 'power-conservation':
          return s.resources.power > 0.5;
        case 'life-support-priority':
          return s.resources.oxygen > 0.5 && s.resources.power > 3;
        case 'fuel-conservation':
          return s.resources.fuel > 0.2;
        case 'emergency-repair':
          return s.resources.power > 15 && s.systems.equipmentHealth < 95;
        case 'trajectory-correction':
          return s.resources.fuel >= 6 && !s.events.solarStorm && s.systems.equipmentHealth > 60;
        case 'suspend-science':
          return s.systems.science === 'active';
        case 'resume-science':
          return s.systems.science === 'suspended'
            && !s.events.solarStorm
            && s.resources.power > t.powerWarn
            && s.resources.oxygen > t.oxygenWarn
            && s.systems.equipmentHealth >= 70;
        case 'science-priority':
          return s.systems.science === 'active'
            && !s.events.solarStorm
            && s.resources.power > t.powerWarn
            && s.resources.oxygen > t.oxygenWarn
            && s.systems.equipmentHealth >= 70;
        case 'deploy-solar-panels':
          return !s.events.solarStorm;
        case 'retract-solar-panels':
          return true;
        case 'align-solar-panels':
          return Boolean(s.solar && s.solar.deployed);
        case 'switch-solar-electric':
          return Boolean(s.solar && s.solar.deployed && s.resources.power > 20);
        case 'switch-chemical-propulsion':
          return s.resources.fuel > 1.0;
        case 'collision-avoidance-burn':
          return s.resources.fuel > 0.5;
        case 'emergency-thruster-cutoff':
          return true;
        case 'thruster-cooldown':
          return true;
        case 'orbital-escape-burn':
          return s.resources.fuel >= 8.0;
        case 'continue-nominal':
          return true;
        default:
          return Boolean(MM.ActionCatalog && MM.ActionCatalog[actionId]);
      }
    }

    mandatoryCandidates(state) {
      const s = state;
      const t = this.thresholds;
      const candidates = [];
      if (s.events.solarStorm) candidates.push({ actionId: 'protective-mode', reason: 'Active solar storm detected', urgency: 55 });
      if (s.radar && s.radar.threatLevel === 'red') {
        candidates.push({ actionId: 'collision-avoidance-burn', reason: 'Collision course detected on radar tracking', urgency: 65 });
      }
      if (s.thrusters && Math.max(s.thrusters.x?.tempC || 0, s.thrusters.y?.tempC || 0, s.thrusters.z?.tempC || 0) > 320) {
        candidates.push({ actionId: 'emergency-thruster-cutoff', reason: 'Thruster core temperature critical excursion', urgency: 62 });
      }
      if (s.systems.communication !== 'stable' || s.events.communicationFailure) {
        candidates.push({ actionId: 'autonomous-operation', reason: 'Ground communication unavailable', urgency: 48 });
      }
      if (s.resources.oxygen <= t.oxygenCritical) {
        candidates.push({ actionId: 'life-support-priority', reason: 'Oxygen below critical threshold', urgency: 60 });
      }
      if (s.resources.power <= t.powerCritical || s.events.powerFailure) {
        candidates.push({ actionId: 'power-conservation', reason: 'Power margin critical', urgency: 44 });
      }
      if (s.systems.equipmentHealth < 50) {
        candidates.push({ actionId: 'emergency-repair', reason: 'Equipment health critical', urgency: 42 });
      }
      if (s.resources.fuel <= t.fuelCritical) {
        candidates.push({ actionId: 'fuel-conservation', reason: 'Fuel below critical threshold', urgency: 40 });
      }
      return candidates;
    }

    buildExplanation(actionId, candidate, state, reports, conflicts) {
      const meta = this.catalogFor(actionId);
      const reasons = {
        'protective-mode': 'spacecraft safety outranks all other objectives during a simulated solar particle event',
        'autonomous-operation': 'preserving essential command functions requires a transition to onboard autonomy',
        'power-conservation': 'essential system availability is at risk from the reduced power margin',
        'life-support-priority': 'oxygen generation is the highest-priority essential system',
        'fuel-conservation': 'resource preservation is required to retain mission continuity',
        'emergency-repair': 'degraded equipment threatens essential system availability',
        'trajectory-correction': 'the correction window improves mission continuity without a safety conflict',
        'suspend-science': 'nonessential science must yield to the current safety posture',
        'resume-science': 'safety margins have recovered, allowing nonessential science to resume',
        'science-priority': 'all higher-priority conditions are nominal, so the science opportunity can proceed',
        'deploy-solar-panels': 'solar array deployment required to restore battery charge equilibrium',
        'retract-solar-panels': 'solar array retracted to prevent space hazard damage',
        'align-solar-panels': 'solar panel sun tracking optimized for peak irradiance',
        'switch-solar-electric': 'propulsion transitioned to high-Isp solar-electric mode',
        'switch-chemical-propulsion': 'propulsion shifted to high-thrust chemical mode for mission burn',
        'collision-avoidance-burn': 'immediate avoidance impulse required to avert radar-detected impact',
        'emergency-thruster-cutoff': 'emergency shutdown engaged to prevent propulsion structural failure',
        'thruster-cooldown': 'thrusters derated for thermal cooldown',
        'orbital-escape-burn': 'orbital mechanics criteria satisfied to enter hyperbolic escape trajectory',
        'continue-nominal': 'no report crossed an actionable threshold; continued monitoring is appropriate'
      };
      const base = reasons[actionId] || meta.description;
      const supportList = candidate.supportingAgents || [];
      const supportText = supportList.length
        ? `${supportList.length} agent${supportList.length === 1 ? '' : 's'} supported this option (${supportList.join(', ')})`
        : 'Commander-derived safety override';
      const conflictText = conflicts.detected
        ? ` Conflicting recommendations (${conflicts.summary}) were resolved by the mission priority ladder.`
        : ' No conflicting recommendations required resolution.';
      return `${supportText}. ${base.charAt(0).toUpperCase() + base.slice(1)}.${conflictText} Evaluated ${reports.length} structured reports before selecting "${meta.label}".`;
    }

    /**
     * Evaluate all specialised reports and select a priority-weighted action.
     * This is deliberately not a "first recommendation wins" policy.
     */
    decide(reports, state, trigger) {
      this.status = 'analysing';
      this.lastActivity = U.missionTime(state.missionDay);
      const considered = reports.map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName,
        status: r.status,
        severity: r.severity,
        confidence: r.confidence,
        recommendation: r.recommendation,
        suggestedAction: r.suggestedAction || 'continue-nominal',
        relatedEvent: r.relatedEvent
      }));

      const candidates = new Map();
      const ensureCandidate = (actionId) => {
        if (!candidates.has(actionId)) {
          const meta = this.catalogFor(actionId);
          candidates.set(actionId, {
            actionId,
            label: meta.label,
            category: meta.category,
            baseScore: meta.base,
            supportScore: 0,
            supportingAgents: [],
            avgConfidence: 0,
            confidenceSum: 0,
            confidenceCount: 0,
            mandatory: false,
            mandatoryReason: null,
            urgency: 0
          });
        }
        return candidates.get(actionId);
      };

      reports.forEach((r) => {
        const id = r.suggestedAction || 'continue-nominal';
        if (id === 'continue-nominal') return;
        const c = ensureCandidate(id);
        const urgency = (SEVERITY_URGENCY[r.severity] || 2) + (r.status === 'critical' ? 8 : r.status === 'warning' ? 3 : 0);
        c.supportScore += urgency;
        c.urgency = Math.max(c.urgency, urgency);
        if (!c.supportingAgents.includes(r.agentName)) c.supportingAgents.push(r.agentName);
        c.confidenceSum += Number(r.confidence) || 0;
        c.confidenceCount += 1;
      });

      this.mandatoryCandidates(state).forEach((m) => {
        const c = ensureCandidate(m.actionId);
        c.mandatory = true;
        c.mandatoryReason = m.reason;
        c.urgency += m.urgency;
        c.supportScore += m.urgency * 0.4;
        if (!c.supportingAgents.includes('Commander Agent')) c.supportingAgents.push('Commander Agent');
      });

      if (!candidates.size) ensureCandidate('continue-nominal');

      const scoreTable = [];
      candidates.forEach((c) => {
        c.avgConfidence = c.confidenceCount ? c.confidenceSum / c.confidenceCount : 0.9;
        c.valid = this.isActionViable(c.actionId, state);
        c.finalScore = c.valid
          ? U.round(c.baseScore + c.supportScore + c.urgency + c.avgConfidence * 6, 2)
          : -1;
        scoreTable.push({
          actionId: c.actionId,
          label: c.label,
          category: c.category,
          baseScore: c.baseScore,
          supportScore: U.round(c.supportScore, 2),
          urgency: U.round(c.urgency, 2),
          confidence: U.round(c.avgConfidence, 2),
          finalScore: c.finalScore,
          valid: c.valid,
          mandatory: c.mandatory,
          supportingAgents: c.supportingAgents.slice()
        });
      });

      const prioritise = (a, b) => {
        if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return PRIORITY_ORDER.indexOf(a.category) - PRIORITY_ORDER.indexOf(b.category);
      };
      scoreTable.sort(prioritise);
      const chosenRow = scoreTable.find((row) => row.valid) || scoreTable[0];
      const selected = candidates.get(chosenRow.actionId);

      /* Conflict analysis: different actionable recommendations from different agents. */
      const actionable = new Map();
      reports.forEach((r) => {
        const id = r.suggestedAction || 'continue-nominal';
        if (id === 'continue-nominal') return;
        if (!actionable.has(id)) actionable.set(id, []);
        actionable.get(id).push(r.agentName.replace(' Agent', ''));
      });
      const distinct = Array.from(actionable.entries());
      const conflicts = {
        detected: distinct.length > 1,
        between: distinct.map(([action, agents]) => ({ action, agents })),
        summary: distinct.length > 1
          ? distinct.map(([action, agents]) => `${agents.join('/')} → ${this.catalogFor(action).short}`).join(' vs ')
          : 'none',
        resolution: distinct.length > 1
          ? `Selected ${this.catalogFor(chosenRow.actionId).short} using safety → essential systems → resources → mission → science.`
          : 'No action conflict detected.'
      };

      const involvedAgents = Array.from(new Set(
        reports
          .filter((r) => r.suggestedAction === chosenRow.actionId || U.severityRank(r.severity) >= 2 || (r.status === 'critical'))
          .map((r) => r.agentId)
          .concat('commander-agent')
      ));

      const confidencePool = reports.filter((r) => r.suggestedAction === chosenRow.actionId);
      const confidence = confidencePool.length
        ? U.round(confidencePool.reduce((sum, r) => sum + r.confidence, 0) / confidencePool.length, 2)
        : U.round(selected.avgConfidence || 0.9, 2);

      const severity = U.worstSeverity(reports.map((r) => r.severity));
      const explanation = this.buildExplanation(chosenRow.actionId, selected, state, reports, conflicts);

      this.status = 'completed';
      this.confidence = confidence;
      this.observation = `Evaluated ${reports.length} reports at ${U.missionTime(state.missionDay)} (${trigger}). Selected ${this.catalogFor(chosenRow.actionId).label}.`;
      this.recommendation = this.catalogFor(chosenRow.actionId).label;
      this.suggestedAction = chosenRow.actionId;

      const proposal = {
        actionId: chosenRow.actionId,
        actionLabel: this.catalogFor(chosenRow.actionId).label,
        category: chosenRow.category,
        explanation,
        confidence,
        severity: severity === 'low' ? 'low' : severity,
        involvedAgents,
        considered,
        conflicts,
        scoreTable,
        trigger,
        riskCategory: MM.riskCategory(state.metrics.riskIndex || 0)
      };

      this.lastProposal = proposal;

      const commanderReport = this.makeReport(state, {
        status: 'completed',
        severity: severity === 'low' ? 'low' : severity,
        observation: this.observation,
        recommendation: proposal.actionLabel,
        confidence,
        suggestedAction: chosenRow.actionId,
        relatedEvent: trigger && trigger !== 'routine-monitoring' ? trigger : null,
        details: {
          scoreTable: scoreTable.slice(0, 4),
          conflicts,
          missionDay: U.round(state.missionDay, 2)
        }
      });

      return { proposal, commanderReport };
    }
  }

  MM.CommanderAgent = CommanderAgent;
})();
