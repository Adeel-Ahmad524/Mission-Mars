/* MissionMind — Decision History UI */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;
  const UI = MM.ui;

  const MARKER_SVG = {
    decision: '<path d="M5 12.4 9.3 17 19 7" stroke-linecap="round" stroke-linejoin="round"/>',
    event: '<path d="M12 4.5 20 18.5H4L12 4.5Z"/><path d="M12 9.6v3.8M12 16.1v.2"/>',
    observation: '<path d="M2.8 12S6 6.5 12 6.5 21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.4"/>',
    execution: '<path d="M13.2 3.6 5.6 13.2h5.4l-.4 7 7.8-9.8h-5.6l.4-6.8Z" stroke-linejoin="round"/>',
    system: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8.6"/>',
    mission: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5v5l3 2"/>'
  };

  const FILTERS = {
    all: null,
    decision: ['decision'],
    event: ['event', 'mission', 'override', 'system', 'error', 'warning', 'science'],
    observation: ['observation'],
    execution: ['execution']
  };

  class DecisionLog {
    constructor(app) {
      this.app = app;
      this.sm = app.stateManager;
      this.filter = 'all';
      this.lastLogLength = -1;
    }

    init() {
      this.bind();
      this.render();
    }

    bind() {
      MM.bus.on('log:new', () => this.render());
      MM.bus.on('decision:new', () => this.renderAside());
      MM.bus.on('mission:reset', () => this.render());
      MM.bus.on('history:cleared', () => this.render());

      $('#decision-filters')?.addEventListener('click', (event) => {
        const chip = event.target.closest('.filter-chip');
        if (!chip) return;
        this.filter = chip.dataset.filter || 'all';
        MM.$$('#decision-filters .filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
        this.render();
      });

      $('#decision-list')?.addEventListener('click', (event) => {
        const row = event.target.closest('[data-log-id]');
        if (row) UI.openLogDetail(row.dataset.logId);
      });

      $('#btn-export-log')?.addEventListener('click', () => {
        const payload = {
          exportedAt: U.nowISO(),
          missionId: this.sm.state.missionId,
          missionStatus: this.sm.state.missionStatus,
          missionDay: U.round(this.sm.state.missionDay, 2),
          decisions: this.sm.decisions,
          log: this.sm.log
        };
        U.download(`missionmind-decisions-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2));
        UI.toast('success', 'Decision history exported', `${this.sm.decisions.length} decision records written locally.`);
      });

      $('#btn-clear-log')?.addEventListener('click', () => UI.clearHistory());
    }

    getEntries() {
      const allowed = FILTERS[this.filter];
      const entries = this.sm.log.slice().reverse();
      if (!allowed) return entries;
      return entries.filter((entry) => allowed.includes(entry.type));
    }

    render() {
      this.renderAside();
      if (this.sm.log.length === this.lastLogLength && this.filter === this._lastFilter) {
        /* Still refresh in case entries were replaced during reset. */
      }
      this._lastFilter = this.filter;
      this.lastLogLength = this.sm.log.length;

      const list = $('#decision-list');
      const count = $('#decision-count');
      if (!list) return;
      const entries = this.getEntries();
      if (count) count.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
      if (!entries.length) {
        list.innerHTML = '<div class="empty-state">No mission history for this filter yet.</div>';
        return;
      }
      list.innerHTML = entries.slice(0, 120).map((entry) => {
        const markerType = MARKER_SVG[entry.type] ? entry.type : 'system';
        const tags = [];
        if (entry.severity && entry.severity !== 'info') tags.push(`<span class="dec-tag">${MM.esc(entry.severity)}</span>`);
        if (entry.decisionId) tags.push(`<span class="dec-tag">${MM.esc(entry.decisionId)}</span>`);
        if (entry.agentId) tags.push(`<span class="dec-tag">${MM.esc(entry.agentId)}</span>`);
        return `
          <div class="decision-entry" data-log-id="${entry.id}">
            <span class="dec-time">${MM.esc(entry.timestamp)}</span>
            <span class="dec-marker ${markerType}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${MARKER_SVG[markerType]}</svg></span>
            <div class="dec-body">
              <div class="dec-title"><strong>${MM.esc(entry.title)}</strong></div>
              <div class="dec-msg">${MM.esc(entry.message)}</div>
              ${tags.length ? `<div class="dec-tags">${tags.join('')}</div>` : ''}
            </div>
            <span class="dec-chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 5 7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </div>`;
      }).join('');
    }

    renderAside() {
      const conflicts = this.sm.decisions.filter((d) => d.conflicts && d.conflicts.detected).length;
      const conflictsEl = document.getElementById('aside-conflicts');
      if (conflictsEl) conflictsEl.textContent = String(conflicts);
      const lastEl = document.getElementById('aside-last');
      if (lastEl) lastEl.textContent = this.sm.lastDecision ? this.sm.lastDecision.id : '—';
    }
  }

  UI.clearHistory = function () {
    const sm = MM.app?.stateManager;
    if (!sm) return;
    if (!window.confirm('Clear the decision history and activity log? This cannot be undone.')) return;
    sm.log = [];
    sm.decisions = [];
    sm.reportHistory = [];
    sm.latestReports = {};
    sm.logSeq = 0;
    sm.lastDecision = null;
    sm.state.metrics.decisions = 0;
    MM.bus.clear();
    sm.emitChange();
    MM.bus.emit('history:cleared');
    UI.toast('success', 'History cleared', 'Decision records, activity log and message bus were cleared.');
  };

  UI.openLogDetail = function (logId) {
    const sm = MM.app?.stateManager;
    if (!sm) return;
    const entry = sm.log.find((item) => item.id === logId);
    if (!entry) {
      UI.toast('info', 'Entry unavailable', 'This history entry is no longer present.');
      return;
    }

    const decision = entry.decisionId ? sm.decisions.find((d) => d.id === entry.decisionId) : null;
    let body = '';

    if (decision) {
      body = renderDecision(decision);
    } else if (entry.report) {
      body = renderReport(entry.report);
    } else if (entry.detail && entry.detail.scenarioId) {
      body = renderScenarioEvent(entry);
    } else {
      body = `
        <p>${MM.esc(entry.message)}</p>
        ${entry.detail ? `<h4>Record payload</h4><pre class="json-block">${MM.esc(JSON.stringify(entry.detail, null, 2))}</pre>` : ''}
        <div class="modal-kv" style="margin-top:14px">
          <div><span>Log entry</span><strong>${MM.esc(entry.id)}</strong></div>
          <div><span>Mission time</span><strong>${MM.esc(entry.timestamp)}</strong></div>
          <div><span>Type</span><strong>${MM.esc(entry.type)}</strong></div>
          <div><span>Severity</span><strong>${MM.esc(entry.severity)}</strong></div>
        </div>`;
    }

    UI.openModal({
      kicker: `${MM.esc(entry.type)} · ${MM.esc(entry.timestamp)} · ${MM.esc(entry.id)}`,
      title: entry.title,
      body: body + '<div class="modal-close-row"><button class="btn btn-ghost" data-close-modal>Close</button></div>'
    });
    document.getElementById('modal-body')?.querySelector('[data-close-modal]')?.addEventListener('click', () => UI.closeModal());
  };

  function renderReport(report) {
    return `
      <div class="modal-kv">
        <div><span>Agent</span><strong>${MM.esc(report.agentName)}</strong></div>
        <div><span>Status</span><strong>${MM.esc(report.status)}</strong></div>
        <div><span>Confidence</span><strong>${U.fixed((report.confidence || 0) * 100, 0)}%</strong></div>
        <div><span>Suggested action</span><strong>${MM.esc(report.suggestedAction || 'continue-nominal')}</strong></div>
      </div>
      <h4>Observation</h4><p>${MM.esc(report.observation)}</p>
      <h4>Recommendation</h4><p>${MM.esc(report.recommendation)}</p>
      <h4>Protocol payload</h4>
      <pre class="json-block">${MM.esc(JSON.stringify(report, null, 2))}</pre>`;
  }

  function renderScenarioEvent(entry) {
    const detail = entry.detail || {};
    return `
      <p>${MM.esc(entry.message)}</p>
      <div class="modal-kv" style="margin-top:12px">
        <div><span>Scenario</span><strong>${MM.esc(detail.scenarioId || 'n/a')}</strong></div>
        <div><span>Severity</span><strong>${MM.esc(detail.severity || entry.severity)}</strong></div>
      </div>
      ${detail.changes ? `<h4>State modifiers</h4><ul class="limitations-list">${detail.changes.map((c) => `<li>${MM.esc(c)}</li>`).join('')}</ul>` : ''}
      ${detail.expectedAgents ? `<h4>Expected agents</h4><p class="mono">${MM.esc(detail.expectedAgents.join(' · '))}</p>` : ''}`;
  }

  function renderDecision(decision) {
    const consideredRows = (decision.considered || []).map((c) => `
      <tr>
        <td>${MM.esc(c.agentName)}</td>
        <td>${MM.esc(c.status)}</td>
        <td class="mono">${U.fixed((c.confidence || 0) * 100, 0)}%</td>
        <td>${MM.esc(c.recommendation)}</td>
        <td class="mono">${MM.esc(c.suggestedAction)}</td>
      </tr>`).join('');

    const scoreRows = (decision.scoreTable || []).map((row) => `
      <tr>
        <td>${MM.esc(row.label)}</td>
        <td>${MM.esc(row.category)}</td>
        <td class="mono">${row.baseScore}</td>
        <td class="mono">${U.fixed(row.supportScore, 1)}</td>
        <td class="mono">${U.fixed(row.finalScore, 1)}</td>
        <td class="mono" style="color:${row.finalScore === Math.max(...(decision.scoreTable || []).filter((r) => r.valid).map((r) => r.finalScore), -1) && row.valid ? '#86efac' : '#94a3b8'}">${row.valid ? 'valid' : 'rejected'}</td>
      </tr>`).join('');

    const conflictBlock = decision.conflicts && decision.conflicts.detected
      ? `<h4>Conflict resolution</h4>
         <p>${(decision.conflicts.between || []).map((c) => `<span class="dec-tag" style="margin-right:5px">${MM.esc(c.agents.join(' / '))} → ${MM.esc(c.action)}</span>`).join('')}</p>
         <p style="margin-top:8px"><strong>Resolution:</strong> ${MM.esc(decision.conflicts.resolution)}</p>`
      : `<h4>Conflict resolution</h4><p>No conflicting agent recommendations were detected in this cycle.</p>`;

    return `
      <div class="modal-kv">
        <div><span>Decision ID</span><strong>${MM.esc(decision.id)}</strong></div>
        <div><span>Execution</span><strong>${MM.esc(decision.executionStatus).toUpperCase()}</strong></div>
        <div><span>Selected action</span><strong>${MM.esc(decision.actionLabel || decision.selectedDecision)}</strong></div>
        <div><span>Category</span><strong>${MM.esc(decision.category)}</strong></div>
        <div><span>Severity</span><strong>${MM.esc(decision.severity)}</strong></div>
        <div><span>Confidence</span><strong>${U.fixed((decision.confidence || 0) * 100, 0)}%</strong></div>
        <div><span>Trigger</span><strong>${MM.esc(decision.event)}</strong></div>
        <div><span>Mission time</span><strong>${MM.esc(decision.timestamp)}</strong></div>
      </div>
      <h4>Commander explanation</h4>
      <p>${MM.esc(decision.explanation)}</p>
      ${conflictBlock}
      <h4>Reports considered (${(decision.considered || []).length})</h4>
      <div style="overflow-x:auto">
        <table class="report-table">
          <thead><tr><th>Agent</th><th>Status</th><th>Conf.</th><th>Recommendation</th><th>Action</th></tr></thead>
          <tbody>${consideredRows || '<tr><td colspan="5">No reports recorded.</td></tr>'}</tbody>
        </table>
      </div>
      <h4>Priority-weighted evaluation</h4>
      <div style="overflow-x:auto">
        <table class="report-table">
          <thead><tr><th>Candidate action</th><th>Priority</th><th>Base</th><th>Support</th><th>Score</th><th>State</th></tr></thead>
          <tbody>${scoreRows || '<tr><td colspan="6">No score table recorded.</td></tr>'}</tbody>
        </table>
      </div>
      <h4>Simulated effects</h4>
      ${decision.effects && decision.effects.length
        ? `<ul class="limitations-list">${decision.effects.map((e) => `<li>${MM.esc(e)}</li>`).join('')}</ul>`
        : '<p>No state change was applied.</p>'}
      <h4>Verification</h4>
      <p>${MM.esc(decision.verification || 'Not verified.')}</p>
      <h4>State after execution</h4>
      <div class="modal-kv">
        <div><span>Fuel</span><strong>${U.fixed(decision.stateSnapshot?.fuel, 1)}%</strong></div>
        <div><span>Power</span><strong>${U.fixed(decision.stateSnapshot?.power, 1)}%</strong></div>
        <div><span>Oxygen</span><strong>${U.fixed(decision.stateSnapshot?.oxygen, 1)}%</strong></div>
        <div><span>Equipment</span><strong>${U.fixed(decision.stateSnapshot?.health, 1)}%</strong></div>
        <div><span>Communication</span><strong>${MM.esc(decision.stateSnapshot?.communication)}</strong></div>
        <div><span>Science</span><strong>${MM.esc(decision.stateSnapshot?.science)}</strong></div>
      </div>
      <h4>Decision record</h4>
      <pre class="json-block">${MM.esc(JSON.stringify({
        id: decision.id,
        timestamp: decision.timestamp,
        event: decision.event,
        severity: decision.severity,
        involvedAgents: decision.involvedAgents,
        selectedDecision: decision.selectedDecision,
        explanation: decision.explanation,
        executionStatus: decision.executionStatus,
        verification: decision.verification
      }, null, 2))}</pre>`;
  }

  MM.DecisionLog = DecisionLog;
})();
