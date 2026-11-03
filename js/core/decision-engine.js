/* MissionMind — Decision Execution Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  function ok() { return { ok: true, reason: 'Preconditions satisfied.' }; }
  function no(reason) { return { ok: false, reason }; }

  /**
   * Action catalogue: every executable simulated response.
   * validate() is checked before apply(); verify() confirms the post-condition.
   */
  MM.ActionCatalog = {
    'protective-mode': {
      label: 'Activate protective operating mode',
      short: 'PROTECTIVE MODE',
      category: 'safety',
      base: 100,
      description: 'Raise radiation shielding, suspend science payloads and preserve essential systems.',
      validate: () => ok(),
      apply: (s) => {
        s.modes.protective = true;
        s.systems.shield = 'active';
        s.systems.science = 'suspended';
        s.systems.mode = 'protective';
        s.systems.temperature = U.clamp(s.systems.temperature + 1.2, -50, 80);
        return ['Radiation shielding raised to active', 'Science payload suspended', 'Essential systems protected'];
      },
      verify: (s) => ({ ok: s.modes.protective && s.systems.shield === 'active', message: s.modes.protective ? 'Protective mode confirmed active.' : 'Protective mode did not latch.' })
    },
    'autonomous-operation': {
      label: 'Transition to onboard autonomous operation',
      short: 'AUTONOMOUS',
      category: 'essential',
      base: 92,
      description: 'Operate without ground commanding and preserve essential command functions.',
      validate: (s) => (s.systems.communication !== 'stable' || s.events.communicationFailure)
        ? ok()
        : no('Autonomous transition is only valid when the communication link is unavailable.'),
      apply: (s) => {
        s.modes.autonomous = true;
        s.systems.autonomy = 'onboard-autonomous';
        s.systems.mode = 'autonomous';
        s.eventTimers.communicationFailure = s.eventTimers.communicationFailure || 12;
        return ['Onboard autonomy enabled', 'Ground command authority suspended', 'Link recovery attempt scheduled'];
      },
      verify: (s) => ({ ok: s.modes.autonomous && s.systems.autonomy === 'onboard-autonomous', message: s.modes.autonomous ? 'Autonomous command authority verified.' : 'Autonomy flag not set.' })
    },
    'power-conservation': {
      label: 'Prioritise essential power loads',
      short: 'POWER SAVE',
      category: 'essential',
      base: 93,
      description: 'Shed nonessential loads, suspend science and protect life-support margins.',
      validate: (s) => s.resources.power > 0.5 ? ok() : no('Insufficient power remains to execute the load-shedding routine.'),
      apply: (s) => {
        s.modes.powerSaving = true;
        s.systems.science = 'suspended';
        s.systems.mode = 'power-saving';
        s.systems.temperature = U.clamp(s.systems.temperature - 1.8, -50, 80);
        s.resources.power = U.clamp(s.resources.power + 2.2, 0, 100);
        return ['Nonessential electrical loads shed', 'Science payload suspended', 'Life-support power margin protected'];
      },
      verify: (s) => ({ ok: s.modes.powerSaving, message: s.modes.powerSaving ? 'Essential-load configuration verified.' : 'Power-saving mode not active.' })
    },
    'life-support-priority': {
      label: 'Prioritise life support over all loads',
      short: 'LIFE SUPPORT',
      category: 'safety',
      base: 98,
      description: 'Restrict operations to oxygen generation and essential life support.',
      validate: (s) => (s.resources.oxygen > 0.5 && s.resources.power > 3) ? ok() : no('Life-support priority requires at least 0.5% oxygen and 3% power.'),
      apply: (s) => {
        s.modes.lifeSupportPriority = true;
        s.modes.powerSaving = true;
        s.systems.science = 'suspended';
        s.systems.mode = 'life-support';
        s.systems.temperature = U.clamp(s.systems.temperature - 1, -50, 80);
        s.resources.power = U.clamp(s.resources.power - 1, 0, 100);
        return ['Life support placed at highest load priority', 'Nonessential systems suspended', 'Oxygen scrubber efficiency raised'];
      },
      verify: (s) => ({ ok: Boolean(s.modes.lifeSupportPriority), message: s.modes.lifeSupportPriority ? 'Life-support priority confirmed.' : 'Life-support priority not set.' })
    },
    'fuel-conservation': {
      label: 'Engage fuel conservation and contain leak',
      short: 'FUEL SAVE',
      category: 'resource',
      base: 81,
      description: 'Reduce propellant burn, cancel nonessential manoeuvres and seal the leak.',
      validate: (s) => s.resources.fuel > 0.2 ? ok() : no('No usable propellant remains to configure the conservation mode.'),
      apply: (s) => {
        s.modes.fuelSaving = true;
        s.systems.mode = 'fuel-saving';
        s.missionFlags.leakSealed = Boolean(s.events.fuelShortage);
        s.spacecraft.velocityKms = U.round(Math.max(20, s.spacecraft.velocityKms - 0.35), 3);
        return ['Propellant burn reduced by 55%', 'Nonessential manoeuvres cancelled', s.events.fuelShortage ? 'Leak containment engaged' : 'Reserve preservation active'];
      },
      verify: (s) => ({ ok: s.modes.fuelSaving, message: s.modes.fuelSaving ? 'Fuel conservation mode verified.' : 'Fuel conservation not active.' })
    },
    'emergency-repair': {
      label: 'Run autonomous equipment repair',
      short: 'REPAIR',
      category: 'safety',
      base: 89,
      description: 'Use available power to repair degraded assemblies.',
      validate: (s) => (s.resources.power > 15 && s.systems.equipmentHealth < 95)
        ? ok()
        : no('Repair requires more than 15% power and equipment health below 95%.'),
      apply: (s) => {
        s.systems.equipmentHealth = U.clamp(s.systems.equipmentHealth + 10, 0, 100);
        s.resources.power = U.clamp(s.resources.power - 2, 0, 100);
        s.systems.temperature = U.clamp(s.systems.temperature + 0.8, -50, 80);
        s.missionFlags.repairs += 1;
        return ['Autonomous repair cycle completed', 'Equipment health restored by 10 points', 'Repair power cost applied'];
      },
      verify: (s) => ({ ok: s.systems.equipmentHealth > 0, message: `Post-repair equipment health ${U.fixed(s.systems.equipmentHealth, 1)}%.` })
    },
    'trajectory-correction': {
      label: 'Execute mid-course trajectory correction',
      short: 'CORRECTION',
      category: 'mission',
      base: 66,
      description: 'Spend propellant to refine the approach trajectory.',
      validate: (s) => (s.resources.fuel >= 6 && !s.events.solarStorm && s.systems.equipmentHealth > 60)
        ? ok()
        : no('Trajectory correction requires 6% fuel, nominal guidance hardware and no active solar storm.'),
      apply: (s) => {
        s.resources.fuel = U.clamp(s.resources.fuel - 4.5, 0, 100);
        s.resources.fuelConsumed = U.clamp(s.resources.fuelConsumed + 4.5, 0, 100);
        s.spacecraft.velocityKms = U.round(s.spacecraft.velocityKms + 0.6, 3);
        s.spacecraft.navUncertaintyKm = Math.max(420, Math.round(s.spacecraft.navUncertaintyKm * 0.55));
        s.missionFlags.midCourseCorrection = true;
        s.missionFlags.progressBoost = U.clamp((s.missionFlags.progressBoost || 0) + 0.8, 0, 12);
        return ['Guidance burn executed (4.5% propellant)', 'Approach trajectory refined', 'Navigation uncertainty reduced'];
      },
      verify: (s) => ({ ok: s.missionFlags.midCourseCorrection === true, message: 'Correction burn recorded in guidance state.' })
    },
    'suspend-science': {
      label: 'Suspend nonessential science payload',
      short: 'SUSPEND SCIENCE',
      category: 'mission',
      base: 58,
      description: 'Release power and attention to safety-critical operations.',
      validate: (s) => s.systems.science === 'active' ? ok() : no('Science payload is already suspended.'),
      apply: (s) => {
        s.systems.science = 'suspended';
        return ['Science payload suspended', 'Nonessential power released'];
      },
      verify: (s) => ({ ok: s.systems.science === 'suspended', message: 'Science payload confirmed suspended.' })
    },
    'resume-science': {
      label: 'Resume nonessential science operations',
      short: 'RESUME SCIENCE',
      category: 'science',
      base: 46,
      description: 'Restore the science schedule when safety margins allow.',
      validate: (s) => {
        const t = MM.currentThresholds || MM.MISSION_CONSTANTS.DEFAULT_THRESHOLDS;
        return (s.systems.science === 'suspended' && !s.events.solarStorm && s.resources.power > t.powerWarn && s.resources.oxygen > t.oxygenWarn && s.systems.equipmentHealth >= 70)
          ? ok()
          : no('Science cannot resume until power, oxygen, communications and thermal margins are nominal.');
      },
      apply: (s) => {
        s.systems.science = 'active';
        s.modes.protective = false;
        s.systems.shield = 'standby';
        s.systems.mode = s.modes.autonomous
          ? 'autonomous'
          : s.modes.lifeSupportPriority
            ? 'life-support'
            : s.modes.powerSaving
              ? 'power-saving'
              : s.modes.fuelSaving
                ? 'fuel-saving'
                : 'nominal';
        return ['Science payload restored to active', 'Protective posture released'];
      },
      verify: (s) => ({ ok: s.systems.science === 'active', message: 'Science payload confirmed active.' })
    },
    'science-priority': {
      label: 'Run prioritised science observation',
      short: 'SCIENCE RUN',
      category: 'science',
      base: 42,
      description: 'Execute a high-value observation while resources allow.',
      validate: (s) => {
        const t = MM.currentThresholds || MM.MISSION_CONSTANTS.DEFAULT_THRESHOLDS;
        return (s.systems.science === 'active' && !s.events.solarStorm && s.resources.power > t.powerWarn && s.resources.oxygen > t.oxygenWarn && s.systems.equipmentHealth >= 70)
          ? ok()
          : no('Science observation requires nominal safety margins.');
      },
      apply: (s) => {
        s.resources.power = U.clamp(s.resources.power - 2.2, 0, 100);
        s.resources.powerConsumed = U.clamp(s.resources.powerConsumed + 2.2, 0, 100);
        s.metrics.scientificValue += 7;
        s.missionFlags.lastScienceDay = s.missionDay;
        s.systems.temperature = U.clamp(s.systems.temperature + 0.3, -50, 80);
        return ['Spectroscopy observation executed', 'Scientific value +7', 'Power cost 2.2% applied'];
      },
      verify: (s) => ({ ok: s.metrics.scientificValue >= 0, message: 'Observation logged in science telemetry.' })
    },
    'deploy-solar-panels': {
      label: 'Deploy photovoltaic solar arrays',
      short: 'DEPLOY SOLAR',
      category: 'energy',
      base: 85,
      description: 'Extend solar panel wings to harvest solar irradiance and charge batteries.',
      validate: (s) => {
        if (s.events && s.events.solarStorm) return no('Cannot deploy solar arrays during an active solar particle storm.');
        return ok();
      },
      apply: (s) => {
        if (!s.solar) s.solar = {};
        s.solar.deployed = true;
        s.solar.deploymentProgress = 1.0;
        if (MM.app && MM.app.energyEngine) MM.app.energyEngine.deployPanels();
        return ['Solar panels commanded to deploy', 'Dual photovoltaic arrays locked in sunlight', 'Battery charging initiated'];
      },
      verify: (s) => ({ ok: Boolean(s.solar && s.solar.deployed), message: 'Solar array deployment verified.' })
    },
    'retract-solar-panels': {
      label: 'Retract solar arrays into protective locks',
      short: 'RETRACT SOLAR',
      category: 'safety',
      base: 95,
      description: 'Fold solar panels into hull bays to protect from particle flux or high dynamic stress.',
      validate: () => ok(),
      apply: (s) => {
        if (!s.solar) s.solar = {};
        s.solar.deployed = false;
        s.solar.deploymentProgress = 0.0;
        if (MM.app && MM.app.energyEngine) MM.app.energyEngine.retractPanels();
        return ['Solar panels commanded to retract', 'Photovoltaic cells stowed safely in shielded bays'];
      },
      verify: (s) => ({ ok: Boolean(s.solar && !s.solar.deployed), message: 'Solar array retraction confirmed.' })
    },
    'align-solar-panels': {
      label: 'Optimize solar array sun-tracking angle',
      short: 'ALIGN SOLAR',
      category: 'energy',
      base: 65,
      description: 'Gimbal solar panels to normal incident angle (0°) relative to the Sun.',
      validate: (s) => (s.solar && s.solar.deployed) ? ok() : no('Solar panels must be deployed before gimbal alignment.'),
      apply: (s) => {
        if (!s.solar) s.solar = {};
        s.solar.angleDeg = 0;
        if (MM.app && MM.app.energyEngine) MM.app.energyEngine.setPanelAngle(0);
        return ['Solar array gimbals adjusted to 0° normal incident angle', 'Cosine loss eliminated'];
      },
      verify: (s) => ({ ok: s.solar && s.solar.angleDeg === 0, message: 'Solar array sun tracking aligned.' })
    },
    'switch-solar-electric': {
      label: 'Transition to solar-electric propulsion',
      short: 'SOLAR-ELECTRIC',
      category: 'energy',
      base: 78,
      description: 'Engage high-efficiency 3100s Isp Hall thrusters powered by solar and battery energy.',
      validate: (s) => {
        if (!s.solar || !s.solar.deployed) return no('Solar panels must be deployed to power solar-electric propulsion.');
        if (s.resources.power < 20) return no('Battery reserves must exceed 20% for solar-electric propulsion.');
        return ok();
      },
      apply: (s) => {
        s.propulsionMode = 'solar-electric';
        if (MM.app && MM.app.spacecraftEngine) MM.app.spacecraftEngine.setPropulsionMode('solar-electric');
        return ['Propulsion mode set to SOLAR-ELECTRIC', 'Specific impulse upgraded to 3100s', 'Chemical propellant consumption throttled'];
      },
      verify: (s) => ({ ok: s.propulsionMode === 'solar-electric', message: 'Solar-electric propulsion mode active.' })
    },
    'switch-chemical-propulsion': {
      label: 'Transition to high-thrust chemical propulsion',
      short: 'CHEMICAL MODE',
      category: 'mission',
      base: 72,
      description: 'Engage 5000N bi-propellant chemical rocket thrusters for rapid orbital manoeuvres.',
      validate: (s) => s.resources.fuel > 1.0 ? ok() : no('Insufficient chemical propellant remains in storage tanks.'),
      apply: (s) => {
        s.propulsionMode = 'chemical';
        if (MM.app && MM.app.spacecraftEngine) MM.app.spacecraftEngine.setPropulsionMode('chemical');
        return ['Propulsion mode set to CHEMICAL', 'High-thrust 5000N rocket mode engaged'];
      },
      verify: (s) => ({ ok: s.propulsionMode === 'chemical', message: 'Chemical propulsion mode confirmed.' })
    },
    'collision-avoidance-burn': {
      label: 'Execute emergency collision avoidance burn',
      short: 'AVOIDANCE BURN',
      category: 'safety',
      base: 99,
      description: 'Apply lateral thruster pulse to open miss-distance on incoming radar obstacle.',
      validate: (s) => s.resources.fuel > 0.5 ? ok() : no('No propellant available for avoidance burn.'),
      apply: (s) => {
        s.resources.fuel = U.clamp(s.resources.fuel - 1.2, 0, 100);
        if (MM.app && MM.app.spacecraftEngine) {
          MM.app.spacecraftEngine.setThrusterCommand('y', 40);
          setTimeout(() => MM.app.spacecraftEngine.setThrusterCommand('y', 0), 1200);
        }
        if (s.radar && s.radar.objects) {
          s.radar.objects.forEach((o) => {
            if (o.threat === 'red') {
              o.pos.x += 8000;
              o.pos.y += 8000;
              o.threat = 'green';
            }
          });
          s.radar.threatLevel = 'green';
        }
        return ['Emergency lateral burn executed (+40% Y thruster)', 'Orbital miss-distance opened beyond safety envelope', 'Proximity alert cleared'];
      },
      verify: (s) => ({ ok: true, message: 'Collision avoidance burn successfully executed.' })
    },
    'emergency-thruster-cutoff': {
      label: 'Engage emergency thruster cutoff',
      short: 'THRUSTER CUTOFF',
      category: 'safety',
      base: 100,
      description: 'Zero all 3-axis thruster commands instantly and isolate propellant feedlines.',
      validate: () => ok(),
      apply: (s) => {
        if (MM.app && MM.app.spacecraftEngine) MM.app.spacecraftEngine.emergencyShutdown();
        return ['Emergency thruster cutoff triggered', 'All thruster axes commanded to 0%', 'Propellant valves isolated'];
      },
      verify: (s) => ({ ok: true, message: 'Thruster cutoff engaged.' })
    },
    'thruster-cooldown': {
      label: 'Derate thruster power for thermal relief',
      short: 'THERMAL DERATE',
      category: 'safety',
      base: 88,
      description: 'Throttle back thrusters to idle to permit radiative thermal dissipation.',
      validate: () => ok(),
      apply: (s) => {
        if (MM.app && MM.app.spacecraftEngine) {
          ['x', 'y', 'z'].forEach((a) => MM.app.spacecraftEngine.setThrusterCommand(a, 0));
        }
        return ['Thrusters derated to idle', 'Radiative thermal cooling cycle underway'];
      },
      verify: (s) => ({ ok: true, message: 'Thruster thermal relief initiated.' })
    },
    'orbital-escape-burn': {
      label: 'Execute orbital escape delta-v burn',
      short: 'ESCAPE BURN',
      category: 'mission',
      base: 82,
      description: 'Prograde burn to accelerate spacecraft velocity past escape threshold (v >= v_esc).',
      validate: (s) => s.resources.fuel >= 8.0 ? ok() : no('Escape burn requires at least 8% propellant reserve.'),
      apply: (s) => {
        s.resources.fuel = U.clamp(s.resources.fuel - 8.0, 0, 100);
        if (MM.app && MM.app.orbitalEngine) {
          const deltaV = (s.orbit ? s.orbit.deltaVToEscapeMs : 3200) + 150;
          MM.app.orbitalEngine.applyDeltaV(deltaV);
        }
        return ['Prograde escape burn completed', 'Specific orbital energy elevated to positive value (unbound)', 'Hyperbolic departure trajectory achieved'];
      },
      verify: (s) => ({ ok: Boolean(s.orbit && s.orbit.isEscaped), message: 'Escape trajectory confirmed by orbital mechanics.' })
    },
    'continue-nominal': {
      label: 'Continue nominal monitoring',
      short: 'MONITOR',
      category: 'ops',
      base: 20,
      description: 'No state change; agents continue monitoring.',
      validate: () => ok(),
      apply: () => [],
      verify: () => ({ ok: true, message: 'Nominal monitoring confirmed.' })
    }
  };

  class DecisionEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.actions = MM.ActionCatalog;
      this.executionCount = 0;
    }

    validate(actionId, state) {
      MM.currentThresholds = this.stateManager.thresholds;
      const meta = this.actions[actionId];
      if (!meta) return no(`Unknown action "${actionId}" rejected by validation.`);
      try {
        return meta.validate(state);
      } catch (err) {
        return no(`Validation error: ${err.message}`);
      }
    }

    /**
     * Execute a Commander proposal after validating it.
     * Records both successful and rejected decisions for traceability.
     */
    execute(proposal, reports) {
      const state = this.stateManager.state;
      const meta = this.actions[proposal.actionId];
      const decisionId = `DEC-${String(this.stateManager.decisions.length + 1).padStart(3, '0')}`;

      if (!meta) {
        return this.recordRejection(proposal, reports, decisionId, `Unknown action "${proposal.actionId}".`);
      }

      const check = this.validate(proposal.actionId, state);
      if (!check.ok) {
        return this.recordRejection(proposal, reports, decisionId, check.reason);
      }

      let effects = [];
      let applyError = null;
      try {
        this.stateManager.update((s) => {
          effects = meta.apply(s, this.stateManager, proposal) || [];
          s.lastDecisionId = decisionId;
        }, `execute:${proposal.actionId}`);
      } catch (err) {
        applyError = err;
        console.error('[MissionMind] Action execution failed', err);
      }

      let verification = { ok: false, message: 'Verification did not run.' };
      if (!applyError) {
        try {
          verification = meta.verify(this.stateManager.state) || { ok: true, message: 'Executed.' };
        } catch (err) {
          verification = { ok: false, message: `Verification error: ${err.message}` };
        }
      }

      const executionStatus = applyError ? 'failed' : verification.ok ? 'completed' : 'unverified';
      if (!applyError && proposal.actionId !== 'continue-nominal') {
        this.stateManager.update((s) => {
          if (executionStatus === 'completed') s.metrics.responsesCompleted += 1;
        }, 'metrics:response');
      }

      const decision = this.buildRecord(proposal, reports, decisionId, {
        executionStatus,
        effects,
        verification: applyError ? `Execution error: ${applyError.message}` : verification.message,
        error: applyError ? applyError.message : null
      });
      this.stateManager.addDecision(decision);

      const severity = executionStatus === 'completed' ? 'info' : 'warning';
      this.stateManager.addLog('decision', `Commander decision · ${meta.short}`, proposal.explanation, {
        severity: proposal.severity === 'critical' ? 'critical' : proposal.severity === 'high' ? 'warning' : 'info',
        decisionId,
        detail: decision
      });
      this.stateManager.addLog('execution', `Executed · ${meta.label}`, effects.length ? effects.join(' · ') : 'No state change required.', {
        severity,
        decisionId,
        detail: decision
      });

      if (proposal.actionId !== 'continue-nominal' && executionStatus === 'completed') {
        MM.bus.emit('toast', {
          type: 'success',
          title: meta.short,
          message: effects[0] || meta.label
        });
      }
      if (executionStatus !== 'completed') {
        MM.bus.emit('toast', {
          type: 'warning',
          title: 'Execution not verified',
          message: actionSummarySafe(verification.message)
        });
      }

      MM.bus.emit('decision:executed', decision);
      this.executionCount += 1;
      return decision;
    }

    recordRejection(proposal, reports, decisionId, reason) {
      const decision = this.buildRecord(proposal, reports, decisionId, {
        executionStatus: 'rejected',
        effects: [],
        verification: `Rejected by Decision Engine: ${reason}`,
        error: reason
      });
      this.stateManager.update((s) => {
        s.metrics.rejectedActions += 1;
      }, 'metrics:rejected');
      this.stateManager.addDecision(decision);
      this.stateManager.addLog('decision', 'Commander decision · REJECTED', proposal.explanation, {
        severity: 'warning',
        decisionId,
        detail: decision
      });
      this.stateManager.addLog('execution', 'Action rejected by validation', reason, {
        severity: 'error',
        decisionId,
        detail: decision
      });
      MM.bus.emit('toast', { type: 'warning', title: 'Action rejected', message: reason });
      MM.bus.emit('decision:executed', decision);
      return decision;
    }

    buildRecord(proposal, reports, decisionId, execution) {
      const s = this.stateManager.state;
      return {
        id: decisionId,
        timestamp: U.missionTime(s.missionDay),
        at: Date.now(),
        day: U.round(s.missionDay, 2),
        event: proposal.trigger || 'routine-monitoring',
        severity: proposal.severity,
        category: proposal.category,
        involvedAgents: proposal.involvedAgents,
        selectedDecision: proposal.actionId,
        actionLabel: proposal.actionLabel,
        explanation: proposal.explanation,
        confidence: proposal.confidence,
        conflicts: proposal.conflicts,
        considered: proposal.considered,
        scoreTable: proposal.scoreTable,
        riskCategory: proposal.riskCategory,
        effects: execution.effects || [],
        executionStatus: execution.executionStatus,
        verification: execution.verification,
        error: execution.error || null,
        stateSnapshot: {
          fuel: U.round(s.resources.fuel, 2),
          power: U.round(s.resources.power, 2),
          oxygen: U.round(s.resources.oxygen, 2),
          health: U.round(s.systems.equipmentHealth, 2),
          temperature: U.round(s.systems.temperature, 2),
          communication: s.systems.communication,
          science: s.systems.science,
          shield: s.systems.shield,
          autonomy: s.systems.autonomy,
          progress: U.round(s.progress, 2),
          eventFlags: { ...s.events }
        },
        reports: (reports || []).map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName,
          status: r.status,
          severity: r.severity,
          confidence: r.confidence,
          observation: r.observation,
          recommendation: r.recommendation,
          suggestedAction: r.suggestedAction,
          timestamp: r.timestamp
        }))
      };
    }
  }

  function actionSummarySafe(text) {
    return String(text || '').slice(0, 160);
  }

  MM.DecisionEngine = DecisionEngine;
})();
