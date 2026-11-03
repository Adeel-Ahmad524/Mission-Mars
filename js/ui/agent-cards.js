/* MissionMind — Agent Centre UI */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;
  const UI = MM.ui;

  const ACTION_LABELS = {
    'protective-mode': 'PROTECTIVE',
    'autonomous-operation': 'AUTONOMY',
    'power-conservation': 'POWER SAVE',
    'life-support-priority': 'LIFE SUPPORT',
    'fuel-conservation': 'FUEL SAVE',
    'emergency-repair': 'REPAIR',
    'trajectory-correction': 'CORRECTION',
    'suspend-science': 'SUSPEND SCI',
    'resume-science': 'RESUME SCI',
    'science-priority': 'SCIENCE RUN',
    'deploy-solar-panels': 'DEPLOY SOLAR',
    'retract-solar-panels': 'RETRACT SOLAR',
    'align-solar-panels': 'ALIGN SOLAR',
    'switch-solar-electric': 'SOLAR-ELECTRIC',
    'switch-chemical-propulsion': 'CHEMICAL PROP',
    'collision-avoidance-burn': 'AVOIDANCE BURN',
    'emergency-thruster-cutoff': 'THRUSTER CUTOFF',
    'thruster-cooldown': 'THERMAL DERATE',
    'orbital-escape-burn': 'ESCAPE BURN',
    'continue-nominal': 'MONITOR'
  };

  class AgentCards {
    constructor(app) {
      this.app = app;
      this.sm = app.stateManager;
      this.streamReports = [];
    }

    init() {
      this.render();
      MM.bus.on('state:change', () => this.render());
      MM.bus.on('agent:report', () => this.renderStream());
      MM.bus.on('agents:cycle', () => {
        this.render();
        this.updatePhases();
      });
      MM.bus.on('mission:reset', () => {
        this.streamReports = [];
        this.render();
        this.updatePhases(true);
      });
      this.bindClicks();
    }

    bindClicks() {
      const grid = $('#agent-grid');
      grid?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-agent-report]');
        if (!button) return;
        const agent = this.app.agents.getAgent(button.dataset.agentReport);
        if (agent && agent.latestReport) UI.openReport(agent.latestReport);
        else UI.toast('info', 'No report yet', 'Run a coordination cycle to generate a structured report.');
      });

      const stream = $('#agent-stream');
      stream?.addEventListener('click', (event) => {
        const row = event.target.closest('[data-stream-index]');
        if (!row) return;
        const report = this.streamReports[Number(row.dataset.streamIndex)];
        if (report) UI.openReport(report);
      });
    }

    actionLabel(actionId) {
      return ACTION_LABELS[actionId] || String(actionId || 'monitor').toUpperCase();
    }

    initPhaseSteps() {
      const steps = MM.$$('.phase-step');
      steps.forEach((step) => step.classList.remove('done', 'current', 'complete'));
    }

    updatePhases(reset) {
      const steps = MM.$$('.phase-step');
      if (!steps.length) return;
      if (reset) {
        this.initPhaseSteps();
        const note = $('#agent-phase-note');
        if (note) note.textContent = 'Awaiting first cycle';
        return;
      }
      steps.forEach((step, index) => {
        step.classList.remove('current');
        if (index < 6) step.classList.add('done');
        else step.classList.add('complete');
      });
    }

    render() {
      const grid = $('#agent-grid');
      if (!grid) return;

      grid.innerHTML = this.app.agents.agents.map((agent) => {
        const confidence = Math.round((agent.confidence || 0) * 100);
        const statusClass = agent.status === 'warning' ? 'agent-warning' : agent.status === 'critical' ? 'agent-critical' : '';
        return `
          <article class="agent-card ${statusClass}" style="--agent-accent:${agent.accent}">
            <div class="agent-card-head">
              ${UI.avatar(agent)}
              <div class="agent-identity">
                <div class="agent-name">${MM.esc(agent.name)}</div>
                <div class="agent-role">${MM.esc(agent.role)}</div>
              </div>
              <div class="agent-card-status">${UI.agentPill(agent.status)}</div>
            </div>
            <div class="agent-observation">
              <span>Latest observation</span>
              ${MM.esc(agent.observation)}
            </div>
            <div class="agent-recommendation">
              <span>Recommendation</span>
              ${MM.esc(agent.recommendation)}
            </div>
            <div class="agent-meta">
              <div class="confidence-block">
                <div class="confidence-label"><span>Confidence</span><span>${confidence}%</span></div>
                <div class="confidence-track"><span style="width:${confidence}%"></span></div>
              </div>
              <span class="agent-time">${MM.esc(agent.lastActivity || 'not run')}</span>
            </div>
            <div class="agent-card-foot">
              <span class="agent-action-tag">NEXT · ${MM.esc(this.actionLabel(agent.suggestedAction))}</span>
              <button class="link-btn" data-agent-report="${agent.id}">View report →</button>
            </div>
          </article>`;
      }).join('');

      const last = this.app.agents.lastCycle;
      const meta = $('#agent-cycle-meta');
      if (meta) {
        meta.textContent = last
          ? `${U.missionTime(last.day)} · ${last.reports} reports · ${this.actionLabel(last.actionId)}${last.decisionId ? ` · ${last.decisionId}` : ''}`
          : 'No coordination cycle yet';
      }
      const busMeta = $('#agent-bus-meta');
      if (busMeta) busMeta.textContent = `${MM.bus.reportCount} messages · ${this.sm.reportHistory.length} stored`;
      const phaseNote = $('#agent-phase-note');
      if (phaseNote) {
        phaseNote.textContent = last
          ? last.decisionId
            ? `Last execution ${last.decisionId} · ${last.executionStatus}`
            : 'Last cycle: no action required'
          : 'Awaiting first cycle';
      }

      this.renderStream();
    }

    renderStream() {
      const container = $('#agent-stream');
      if (!container) return;
      const reports = MM.bus.recentReports(18);
      this.streamReports = reports;
      const count = $('#bus-count');
      if (count) count.textContent = `${MM.bus.reportCount} reports`;
      if (!reports.length) {
        container.innerHTML = '<div class="empty-state">No messages yet. Start the mission or run an agent cycle.</div>';
        return;
      }
      container.innerHTML = reports.map((report, index) => {
        const agent = this.app.agents.getAgent(report.agentId);
        const color = agent ? agent.accent : '#38bdf8';
        return `
          <div class="message-row clickable" data-stream-index="${index}">
            <span class="msg-time">${MM.esc(report.timestamp)}</span>
            <span class="msg-agent"><i class="dot" style="background:${color};display:inline-block;margin-right:5px"></i>${MM.esc(report.agentName)}</span>
            <span class="msg-text">${MM.esc(report.observation)}</span>
            ${UI.agentPill(report.status)}
          </div>`;
      }).join('');
    }
  }

  UI.openReport = function (report) {
    if (!report) return;
    const agent = MM.app?.agents?.getAgent(report.agentId);
    const payload = {
      agentId: report.agentId,
      agentName: report.agentName,
      timestamp: report.timestamp,
      status: report.status,
      observation: report.observation,
      recommendation: report.recommendation,
      confidence: report.confidence,
      relatedEvent: report.relatedEvent,
      suggestedAction: report.suggestedAction,
      severity: report.severity
    };
    UI.openModal({
      kicker: 'Structured agent report',
      title: report.agentName || 'Agent report',
      body: `
        <div class="modal-kv">
          <div><span>Agent ID</span><strong>${MM.esc(report.agentId)}</strong></div>
          <div><span>Status</span><strong>${MM.esc(report.status)}</strong></div>
          <div><span>Mission time</span><strong>${MM.esc(report.timestamp)}</strong></div>
          <div><span>Confidence</span><strong>${U.fixed((report.confidence || 0) * 100, 0)}%</strong></div>
          <div><span>Severity</span><strong>${MM.esc(report.severity || 'low')}</strong></div>
          <div><span>Suggested action</span><strong>${MM.esc(report.suggestedAction || 'continue-nominal')}</strong></div>
        </div>
        <h4>Observation</h4>
        <p>${MM.esc(report.observation)}</p>
        <h4>Recommendation</h4>
        <p>${MM.esc(report.recommendation)}</p>
        ${agent ? `<p class="card-note">${MM.esc(agent.role)} · ${MM.esc(agent.name)}</p>` : ''}
        <h4>Protocol payload</h4>
        <pre class="json-block">${MM.esc(JSON.stringify(payload, null, 2))}</pre>
        <div class="modal-close-row"><button class="btn btn-ghost" data-close-modal>Close</button></div>`
    });
    const body = document.getElementById('modal-body');
    body?.querySelector('[data-close-modal]')?.addEventListener('click', () => UI.closeModal());
  };

  MM.AgentCards = AgentCards;
})();
