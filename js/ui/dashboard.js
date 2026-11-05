/* MissionMind — dashboard controller and shared UI helpers */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const $ = MM.$;
  const $$ = MM.$$;
  const UI = (MM.ui = MM.ui || {});

  const TOAST_ICONS = {
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5v5M12 7.6v.3"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.7 2.7L16.4 9"/>',
    warning: '<path d="M12 3.7 21 19.3H3L12 3.7Z"/><path d="M12 9.3v4.2M12 16.4v.2"/>',
    critical: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.2"/>'
  };

  UI.toast = function (type, title, message) {
    const container = $('#toasts');
    if (!container) return;
    const kind = ['info', 'success', 'warning', 'critical'].includes(type) ? type : 'info';
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">${TOAST_ICONS[kind]}</svg>
      <div class="toast-body">
        <div class="toast-title">${MM.esc(title)}</div>
        ${message ? `<div class="toast-msg">${MM.esc(message)}</div>` : ''}
      </div>`;
    container.appendChild(el);
    while (container.children.length > 4) container.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 260);
    }, 5200);
  };

  UI.openModal = function (options) {
    const modal = $('#modal');
    if (!modal) return;
    $('#modal-kicker').textContent = options.kicker || 'Detail';
    $('#modal-title').textContent = options.title || 'Record';
    $('#modal-body').innerHTML = options.body || '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#modal-close')?.focus(), 30);
  };

  UI.closeModal = function () {
    const modal = $('#modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  UI.agentPill = function (status) {
    const safe = String(status || 'monitoring').toLowerCase();
    return `<span class="agent-status-pill agent-status-${safe}"><i class="dot" style="background:currentColor"></i>${MM.esc(safe)}</span>`;
  };

  UI.severityPill = function (severity) {
    const map = {
      critical: ['red', 'CRITICAL'],
      high: ['amber', 'HIGH'],
      warning: ['amber', 'WARNING'],
      medium: ['blue', 'MEDIUM'],
      low: ['green', 'LOW'],
      info: ['blue', 'INFO']
    };
    const [color, label] = map[severity] || ['blue', String(severity || 'INFO').toUpperCase()];
    return `<span class="pill pill-${color}">${label}</span>`;
  };

  UI.avatar = function (agent) {
    return `<span class="agent-avatar" style="--agent-accent:${agent.accent};--agent-bg:${agent.bg};--agent-border:${agent.border}">${MM.esc(agent.short)}</span>`;
  };

  UI.agentAvatarSmall = function (agent) {
    return `<span class="agent-avatar-xs" style="color:${agent.accent};background:${agent.bg};border-color:${agent.border}">${MM.esc(agent.short)}</span>`;
  };

  UI.scenarioIcon = function (icon, color) {
    const paths = {
      sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
      fuel: '<path d="M12 3.2c3.4 4 6 6.7 6 10a6 6 0 0 1-12 0c0-3.3 2.6-6 6-10Z"/><path d="M9.3 13.4a2.8 2.8 0 0 0 2.7 3.2"/>',
      comm: '<path d="M4.4 10.2a11 11 0 0 1 15.2 0M7.4 13.3a6.8 6.8 0 0 1 9.2 0M10.4 16.3a2.7 2.7 0 0 1 3.2 0"/><circle cx="12" cy="19.3" r="1.1" fill="currentColor" stroke="none"/>',
      power: '<path d="M13.1 2.8 5.4 13h5.6l-.8 8.2L18.6 11h-5.7l.2-8.2Z" stroke-linejoin="round"/>'
    };
    return `<span class="scenario-icon" style="color:${color};background:${color}18;border-color:${color}44"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${paths[icon] || paths.sun}</svg></span>`;
  };

  UI.logDotColor = function (type) {
    return {
      decision: '#8b5cf6',
      execution: '#22c55e',
      observation: '#38bdf8',
      event: '#f59e0b',
      mission: '#22d3ee',
      system: '#64748b',
      override: '#a78bfa',
      warning: '#f59e0b',
      error: '#ef4444',
      science: '#22c55e'
    }[type] || '#64748b';
  };

  UI.setBar = function (id, percent, colorClass) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = `${U.clamp(percent, 0, 100)}%`;
    if (colorClass !== undefined) el.className = colorClass;
  };

  UI.levelFor = function (value, warn, critical) {
    if (value <= critical) return 'critical';
    if (value <= warn) return 'warning';
    return 'normal';
  };

  const STATUS_LABEL = {
    standby: 'STANDBY',
    active: 'ACTIVE',
    paused: 'PAUSED',
    complete: 'COMPLETE',
    failed: 'FAILED'
  };

  const AGENT_NAMES = {
    'risk-agent': 'Risk',
    'systems-agent': 'Systems',
    'science-agent': 'Science',
    'fuel-agent': 'Fuel',
    'navigation-agent': 'Navigation',
    'commander-agent': 'Commander',
    'energy': 'Energy',
    'proximity': 'Proximity',
    'propulsion': 'Propulsion'
  };

  class Dashboard {
    constructor(app) {
      this.app = app;
      this.sm = app.stateManager;
      this.view = 'overview';
      this.mapPlaying = true;
      this.markers = true;
      this.overviewMap = null;
      this.fullMap = null;
      this.boundGlobal = false;
    }

    init() {
      this.createMaps();
      this.bindNavigation();
      this.bindMissionControls();
      this.bindMapControls();
      this.bindSettings();
      this.bindToasts();
      this.bindGlobalClicks();
      MM.bus.on('state:change', () => this.render());
      MM.bus.on('decision:new', () => this.render());
      MM.bus.on('log:new', () => this.renderActivity());
      MM.bus.on('mission:reset', () => {
        this.renderScenarioGrid();
        this.render();
        this.syncSpeedControls();
      });
      this.renderScenarioGrid();
      this.populateSettings();
      this.renderReferencePhysics();
      this.render();
      this.syncSpeedControls();
    }

    createMaps() {
      if (!this.overviewMap) this.overviewMap = new MM.MissionMap('overview-map', this.sm, { compact: true });
      if (!this.fullMap) this.fullMap = new MM.MissionMap('mission-map', this.sm, { compact: false });
    }

    bindNavigation() {
      $$('.nav-item').forEach((item) => {
        item.addEventListener('click', () => this.showView(item.dataset.view));
      });
      $('#btn-top-settings')?.addEventListener('click', () => this.showView('settings'));
      $('#btn-mobile-nav')?.addEventListener('click', () => {
        $('#sidebar')?.classList.toggle('open');
      });
    }

    showView(name) {
      if (!name) return;
      this.view = name;
      $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
      $$('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === name));
      $('#sidebar')?.classList.remove('open');
      if (name === 'visualization' && this.fullMap) setTimeout(() => this.fullMap.resize(), 40);
      if (name === 'overview' && this.overviewMap) setTimeout(() => this.overviewMap.resize(), 40);
      if (name === 'telemetry' && this.app.charts) this.app.charts.render();
      if (name === 'spacecraft' && this.app.spacecraftView) setTimeout(() => this.app.spacecraftView.resize(), 40);
      if (name === 'orbital' && this.app.orbitalControls) setTimeout(() => { this.app.orbitalControls.resizeCanvas(); this.app.orbitalControls.render(); }, 40);
      if (name === 'radar' && this.app.radarDisplay) setTimeout(() => this.app.radarDisplay.resize(), 40);
      if (name === 'sensors' && this.app.sensorDisplay) setTimeout(() => this.app.sensorDisplay.render(), 40);
      if (name === 'physics' && this.app.physicsLab) setTimeout(() => this.app.physicsLab.render(), 40);
      if (name === 'thrusters' && this.app.thrusterControls) setTimeout(() => this.app.thrusterControls.render(), 40);
      if (name === 'flightops' && this.app.flightControls) setTimeout(() => this.app.flightControls.render(), 40);
      if (name === 'solar' && this.app.solarPanelControls) setTimeout(() => this.app.solarPanelControls.render(), 40);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    bindMissionControls() {
      $('#btn-start')?.addEventListener('click', () => {
        const sim = this.app.simulation;
        const status = this.sm.state.missionStatus;
        if (status === 'paused') sim.resume();
        else if (!sim.start()) {
          UI.toast('info', 'Mission not started', 'Reset the mission to begin a new transit.');
        }
      });

      $('#btn-pause')?.addEventListener('click', () => {
        const sim = this.app.simulation;
        if (this.sm.state.missionStatus === 'paused') sim.resume();
        else sim.pause();
      });

      $('#btn-reset')?.addEventListener('click', () => {
        if (window.confirm('Reset the mission? All telemetry, decisions and active emergencies will be cleared.')) {
          this.app.simulation.reset();
        }
      });

      $('#speed-select')?.addEventListener('change', (event) => {
        this.app.simulation.setSpeed(event.target.value);
        UI.toast('info', 'Simulation rate changed', `Now running at ${event.target.value}×.`);
        this.syncSpeedControls();
      });

      $('#btn-agent-cycle')?.addEventListener('click', () => {
        this.app.agents.runCycle({ trigger: 'manual-cycle', manual: true });
      });

      $('#btn-restore-systems')?.addEventListener('click', () => {
        this.app.events.restoreNominal();
      });

      $('#map-play')?.addEventListener('click', () => {
        this.mapPlaying = !this.mapPlaying;
        this.overviewMap?.setPlaying(this.mapPlaying);
        this.fullMap?.setPlaying(this.mapPlaying);
        const button = $('#map-play');
        if (button) {
          button.innerHTML = this.mapPlaying
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg><span>Pause animation</span>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.4v13.2a.8.8 0 0 0 1.2.7l10.4-6.6a.8.8 0 0 0 0-1.4L9.2 4.7A.8.8 0 0 0 8 5.4Z"/></svg><span>Resume animation</span>';
        }
      });

      $('#map-markers')?.addEventListener('click', (event) => {
        this.markers = !this.markers;
        this.overviewMap?.setMarkers(this.markers);
        this.fullMap?.setMarkers(this.markers);
        event.currentTarget.textContent = `Markers: ${this.markers ? 'On' : 'Off'}`;
      });
    }

    bindMapControls() {
      $('#map-scale')?.addEventListener('change', (event) => {
        this.fullMap?.setZoom(Number(event.target.value));
      });
    }

    bindGlobalClicks() {
      if (this.boundGlobal) return;
      this.boundGlobal = true;
      document.addEventListener('click', (event) => {
        const scenarioButton = event.target.closest('[data-scenario]');
        if (scenarioButton && !scenarioButton.disabled) {
          event.preventDefault();
          this.app.events.trigger(scenarioButton.dataset.scenario);
          return;
        }
        const navLink = event.target.closest('[data-nav]');
        if (navLink) {
          event.preventDefault();
          this.showView(navLink.dataset.nav);
          return;
        }
        const logRow = event.target.closest('[data-log-id]');
        if (logRow) {
          const id = logRow.dataset.logId;
          if (typeof UI.openLogDetail === 'function') UI.openLogDetail(id);
        }
      });
    }

    bindToasts() {
      MM.bus.on('toast', (payload) => {
        if (!payload) return;
        UI.toast(payload.type, payload.title, payload.message);
      });
      MM.bus.on('system:error', (payload) => {
        this.sm.errorCount += 1;
        UI.toast('critical', 'System error', payload?.message || 'Unknown error');
        const about = $('#about-errors');
        if (about) about.textContent = String(this.sm.errorCount);
      });
    }

    bindSettings() {
      $('#btn-save-settings')?.addEventListener('click', () => {
        try {
          const autoAgents = $('#set-auto-agents').checked;
          const defaultSpeed = Number($('#set-default-speed').value);
          this.sm.saveSettings({ autoAgents, defaultSpeed });
          this.sm.addLog('system', 'Settings updated', `Automatic agent monitoring ${autoAgents ? 'enabled' : 'disabled'}; default rate ${defaultSpeed}×.`, { severity: 'info' });
          this.app.agents.syncThresholds();
          UI.toast('success', 'Settings saved', 'Runtime preferences stored locally.');
          this.syncSpeedControls();
        } catch (err) {
          UI.toast('critical', 'Settings not saved', err.message);
        }
      });

      $('#btn-save-thresholds')?.addEventListener('click', () => {
        try {
          const thresholds = {};
          $$('[data-threshold]').forEach((input) => {
            const value = Number(input.value);
            if (!Number.isFinite(value)) throw new Error(`Invalid value for ${input.dataset.threshold}.`);
            thresholds[input.dataset.threshold] = value;
          });
          this.sm.validateThresholds(thresholds);
          this.sm.saveSettings({ thresholds });
          this.app.agents.syncThresholds();
          this.sm.addLog('system', 'Agent thresholds updated', `Fuel warn/critical ${thresholds.fuelWarn}/${thresholds.fuelCritical}%; power ${thresholds.powerWarn}/${thresholds.powerCritical}%; oxygen ${thresholds.oxygenWarn}/${thresholds.oxygenCritical}%.`, { severity: 'info' });
          this.populateSettings();
          UI.toast('success', 'Thresholds applied', 'Specialised agents now use the new limits.');
        } catch (err) {
          UI.toast('critical', 'Thresholds rejected', err.message);
        }
      });

      $('#btn-default-settings')?.addEventListener('click', () => {
        this.sm.saveSettings(MM.U.deepCopy(MM.MISSION_CONSTANTS.DEFAULT_SETTINGS));
        this.app.agents.syncThresholds();
        this.populateSettings();
        this.syncSpeedControls();
        UI.toast('success', 'Defaults restored', 'Simulation settings returned to baseline.');
      });

      $('#btn-physics-test')?.addEventListener('click', () => this.runPhysicsTest());

      $('#btn-export-mission')?.addEventListener('click', () => {
        const archive = {
          exportedAt: U.nowISO(),
          application: 'MissionMind MVP 1.0',
          notice: 'All values are simulated. Not real spacecraft telemetry.',
          mission: this.sm.state,
          settings: this.sm.settings,
          decisions: this.sm.decisions,
          log: this.sm.log,
          telemetry: this.sm.telemetry,
          agentReports: this.sm.reportHistory,
          physicsValidation: MM.physics.selfTest()
        };
        U.download(`missionmind-${this.sm.state.missionId}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(archive, null, 2));
        UI.toast('success', 'Archive exported', 'Mission state, decisions, telemetry and validation data saved locally.');
      });

      $('#btn-reset-settings-mission')?.addEventListener('click', () => {
        if (window.confirm('Reset the mission from Settings? All history will be cleared.')) this.app.simulation.reset();
      });

      $('#btn-clear-settings-decisions')?.addEventListener('click', () => {
        if (typeof UI.clearHistory === 'function') UI.clearHistory();
      });

      MM.bus.on('state:change', () => {
        const about = $('#about-bus');
        if (about) about.textContent = `${MM.bus.reportCount} messages`;
      });
    }

    populateSettings() {
      const settings = this.sm.settings;
      const auto = $('#set-auto-agents');
      if (auto) auto.checked = Boolean(settings.autoAgents);
      const speed = $('#set-default-speed');
      if (speed) speed.value = String(settings.defaultSpeed);
      $$('[data-threshold]').forEach((input) => {
        input.value = settings.thresholds[input.dataset.threshold];
      });
      const errors = $('#about-errors');
      if (errors) errors.textContent = String(this.sm.errorCount);
    }

    syncSpeedControls() {
      const main = $('#speed-select');
      if (main) main.value = String(this.sm.state.speed || 2);
      const setting = $('#set-default-speed');
      if (setting) setting.value = String(this.sm.settings.defaultSpeed);
    }

    renderReferencePhysics() {
      const p = MM.physics;
      const transfer = p.hohmannTransfer(p.CONST.R_EARTH_ORBIT, p.CONST.R_MARS_ORBIT, p.CONST.M_SUN);
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set('ref-earth-period', `${U.fixed(p.orbitalPeriod(p.CONST.M_SUN, p.CONST.AU) / p.DAY, 1)} d`);
      set('ref-mars-period', `${U.fixed(p.orbitalPeriod(p.CONST.M_SUN, p.CONST.R_MARS_ORBIT) / p.DAY, 1)} d`);
      set('ref-transfer', `${U.fixed(transfer.timeDays, 1)} d`);
      set('ref-dv', `${U.fixed(transfer.totalDeltaV / 1000, 2)} km/s`);
    }

    runPhysicsTest() {
      const results = MM.physics.selfTest();
      const container = $('#physics-results');
      const pill = $('#physics-status');
      if (pill) {
        pill.textContent = `${results.passed}/${results.total} passed`;
        pill.className = `pill ${results.allPassed ? 'pill-green' : 'pill-red'}`;
      }
      if (!container) return;
      container.innerHTML = `
        <div class="physics-row head"><span>Validation case</span><strong>Computed</strong><strong>Reference</strong><strong>Status</strong></div>
        ${results.results.map((r) => `
          <div class="physics-row">
            <span title="${MM.esc(r.equation)}">${MM.esc(r.name)}</span>
            <strong>${MM.esc(r.computedDisplay)}</strong>
            <strong>${MM.esc(r.referenceDisplay)}</strong>
            <span class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span>
          </div>`).join('')}
        <p class="card-note">Computed ${new Date(results.ranAt).toLocaleString()}. Tolerance-checked against idealised reference values.</p>`;
      UI.toast(results.allPassed ? 'success' : 'warning', 'Physics validation complete', `${results.passed} of ${results.total} reference cases passed.`);
    }

    renderScenarioGrid() {
      const container = $('#scenario-grid');
      if (!container) return;
      container.innerHTML = this.app.events.list().map((scenario) => {
        const active = this.app.events.isActive(scenario.id);
        const agentNames = scenario.expectedAgents.map((id) => AGENT_NAMES[id] || id).join(' · ');
        return `
          <article class="scenario-card ${active ? 'active' : ''}" data-scenario-card="${scenario.id}">
            <div class="scenario-top">
              ${UI.scenarioIcon(scenario.icon, scenario.accent)}
              ${UI.severityPill(scenario.severity === 'critical' ? 'critical' : 'high')}
            </div>
            <div>
              <h4 class="scenario-title">${MM.esc(scenario.title)}</h4>
              <p class="scenario-desc">${MM.esc(scenario.description)}</p>
            </div>
            <div class="scenario-tags">${scenario.affected.map((a) => `<span class="scenario-tag">${MM.esc(a)}</span>`).join('')}</div>
            <div class="scenario-agents">Expected agents<br><strong>${MM.esc(agentNames)}</strong></div>
            <div class="scenario-action">
              <span class="scenario-timer idle" data-scenario-timer>Ready</span>
              <button class="btn btn-sm btn-primary" data-scenario="${scenario.id}" ${active ? 'disabled' : ''}>${active ? 'Active' : 'Trigger scenario'}</button>
            </div>
          </article>`;
      }).join('');
    }

    render() {
      try {
        const s = this.sm.state;
        const t = this.sm.thresholds;
        const alerts = s.alerts || [];
        const statusLabel = STATUS_LABEL[s.missionStatus] || s.missionStatus.toUpperCase();

        /* Top bar */
        const chip = $('#status-chip');
        if (chip) {
          chip.textContent = statusLabel;
          chip.className = `status-chip status-${s.missionStatus}`;
        }
        const clock = $('#mission-clock');
        if (clock) clock.textContent = U.missionTime(s.missionDay);
        this.renderLinkStatus(s);

        /* Mission controls */
        const start = $('#btn-start');
        const pause = $('#btn-pause');
        const pauseLabel = $('#btn-pause-label');
        if (start) start.disabled = s.missionStatus !== 'standby';
        if (pause) {
          pause.disabled = !['active', 'paused'].includes(s.missionStatus);
          pause.innerHTML = s.missionStatus === 'paused'
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.4v13.2a.8.8 0 0 0 1.2.7l10.4-6.6a.8.8 0 0 0 0-1.4L9.2 4.7A.8.8 0 0 0 8 5.4Z"/></svg><span id="btn-pause-label">Resume</span>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg><span id="btn-pause-label">Pause</span>';
          void pauseLabel;
        }

        /* Hero */
        const ring = $('#hero-ring');
        if (ring) ring.style.setProperty('--p', String(U.clamp(s.progress, 0, 100)));
        this.setText('ov-progress', `${U.fixed(s.progress, 1)}%`);
        UI.setBar('ov-progress-bar', s.progress);
        const statusBadge = $('#ov-status-badge');
        if (statusBadge) {
          statusBadge.textContent = statusLabel;
          statusBadge.className = `badge ${s.missionStatus === 'active' ? 'badge-green' : s.missionStatus === 'paused' ? 'badge-amber' : s.missionStatus === 'failed' ? 'badge-red' : 'badge-muted'}`;
        }
        const phase = this.sm.phaseInfo();
        this.setText('ov-phase', phase.name);
        this.setText('ov-phase-sub', phase.sub);
        this.setText('ov-mode-label', this.sm.modeLabel());
        this.setText('ov-day', `${U.fixed(s.missionDay, 1)} / ${s.missionDurationDays}`);
        this.setText('ov-eta', `${U.fixed(Math.max(0, ((100 - s.progress) / 100) * s.missionDurationDays), 1)} d`);
        this.setText('ov-velocity', `${U.fixed(s.spacecraft.velocityKms, 2)} km/s`);
        this.setText('ov-decisions', String(s.metrics.decisions));
        this.setText('map-foot-progress', `${U.fixed(s.progress, 1)}% complete`);

        /* KPI */
        this.renderKpis(s, t);

        /* Alerts */
        this.renderAlerts(alerts);
        const navEmergency = $('#nav-emergency-badge');
        const activeEvents = this.app.events.activeCount();
        if (navEmergency) {
          navEmergency.hidden = activeEvents === 0;
          navEmergency.textContent = String(activeEvents);
        }

        /* Agent snapshot */
        this.renderAgentSnapshot();
        this.renderActivity();
        this.updateScenarioUI();
        this.renderNavigationReadouts(s);

        const busCount = $('#about-bus');
        if (busCount) busCount.textContent = `${MM.bus.reportCount} messages`;
        const errors = $('#about-errors');
        if (errors) errors.textContent = String(this.sm.errorCount);
      } catch (err) {
        console.error('[MissionMind] Dashboard render failed', err);
      }
    }

    setText(id, text) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }

    renderLinkStatus(s) {
      const link = $('#link-status');
      const text = $('#link-status-text');
      if (!link || !text) return;
      const comm = s.systems.communication;
      link.classList.toggle('lost', comm === 'lost');
      link.classList.toggle('degraded', comm === 'degraded');
      const dot = link.querySelector('.dot');
      if (dot) dot.className = `dot ${comm === 'stable' ? 'dot-live' : comm === 'degraded' ? 'dot-warn' : 'dot-critical'}`;
      text.textContent = comm === 'stable' ? 'SIM LINK NOMINAL' : comm === 'degraded' ? 'SIM LINK DEGRADED' : 'SIM LINK LOST';
    }

    renderKpis(s, t) {
      const fuelLevel = UI.levelFor(s.resources.fuel, t.fuelWarn, t.fuelCritical);
      const powerLevel = UI.levelFor(s.resources.power, t.powerWarn, t.powerCritical);
      const oxygenLevel = UI.levelFor(s.resources.oxygen, t.oxygenWarn, t.oxygenCritical);
      const healthLevel = UI.levelFor(s.systems.equipmentHealth, 75, 50);

      this.setText('kpi-fuel', `${U.fixed(s.resources.fuel, 1)}%`);
      UI.setBar('kpi-fuel-bar', s.resources.fuel, fuelLevel === 'critical' ? 'bar-red' : fuelLevel === 'warning' ? 'bar-amber' : '');
      this.setText('kpi-fuel-note', fuelLevel === 'critical' ? 'Critical reserve' : fuelLevel === 'warning' ? 'Below warning limit' : 'Nominal reserves');
      this.setText('kpi-fuel-consumed', `${U.fixed(s.resources.fuelConsumed, 1)}% used`);

      this.setText('kpi-power', `${U.fixed(s.resources.power, 1)}%`);
      UI.setBar('kpi-power-bar', s.resources.power, powerLevel === 'critical' ? 'bar-red' : powerLevel === 'warning' ? 'bar-amber' : '');
      this.setText('kpi-power-note', powerLevel === 'critical' ? 'Essential loads only' : powerLevel === 'warning' ? 'Power margin low' : 'Bus voltage stable');
      this.setText('kpi-power-consumed', `${U.fixed(s.resources.powerConsumed, 1)}% used`);

      this.setText('kpi-oxygen', `${U.fixed(s.resources.oxygen, 1)}%`);
      UI.setBar('kpi-oxygen-bar', s.resources.oxygen, oxygenLevel === 'critical' ? 'bar-red' : oxygenLevel === 'warning' ? 'bar-amber' : 'bar-green');
      this.setText('kpi-oxygen-note', oxygenLevel === 'critical' ? 'Life-support priority' : oxygenLevel === 'warning' ? 'Below warning limit' : 'Cabin pressure stable');
      this.setText('kpi-oxygen-consumed', `${U.fixed(s.resources.oxygenConsumed, 1)}% used`);

      this.setText('kpi-distance', `${U.fixed(s.spacecraft.distanceToMarsKm / 1e6, 1)} M km`);
      UI.setBar('kpi-distance-bar', s.progress);
      this.setText('kpi-distance-pct', `${U.fixed(s.progress, 1)}% closed`);

      this.setText('kpi-health', `${U.fixed(s.systems.equipmentHealth, 1)}%`);
      UI.setBar('kpi-health-bar', s.systems.equipmentHealth, healthLevel === 'critical' ? 'bar-red' : healthLevel === 'warning' ? 'bar-amber' : 'bar-green');
      this.setText('kpi-health-note', healthLevel === 'critical' ? 'Structural attention' : healthLevel === 'warning' ? 'Degraded assemblies' : 'All assemblies nominal');
      this.setText('kpi-temp', `${U.fixed(s.systems.temperature, 1)} °C`);

      const comm = s.systems.communication;
      const commEl = $('#kpi-comm');
      if (commEl) {
        commEl.textContent = comm.toUpperCase();
        commEl.className = `kpi-value kpi-text ${comm === 'stable' ? 'ok' : comm === 'degraded' ? 'warn' : 'crit'}`;
      }
      const bars = $('#kpi-comm-bars');
      if (bars) bars.className = `signal-bars ${comm === 'lost' ? 'lost' : comm === 'degraded' ? 'degraded' : ''}`;
      this.setText('kpi-comm-note', s.events.communicationFailure ? 'Recovery attempt scheduled' : 'DSN link simulated');
      this.setText('kpi-autonomy', s.systems.autonomy === 'onboard-autonomous' ? 'Autonomous' : 'Ground linked');

      const fuelValue = $('#kpi-fuel');
      if (fuelValue) fuelValue.style.color = fuelLevel === 'critical' ? '#fca5a5' : fuelLevel === 'warning' ? '#fcd34d' : '';
      const powerValue = $('#kpi-power');
      if (powerValue) powerValue.style.color = powerLevel === 'critical' ? '#fca5a5' : powerLevel === 'warning' ? '#fcd34d' : '';
      const oxygenValue = $('#kpi-oxygen');
      if (oxygenValue) oxygenValue.style.color = oxygenLevel === 'critical' ? '#fca5a5' : oxygenLevel === 'warning' ? '#fcd34d' : '';
    }

    renderAlerts(alerts) {
      const list = $('#alerts-list');
      const count = $('#alert-count');
      if (!list || !count) return;
      const active = alerts.filter((a) => a.severity !== 'info');
      count.textContent = active.length ? `${active.length} active` : 'Nominal';
      count.className = `pill ${active.some((a) => a.severity === 'critical') ? 'pill-red' : active.length ? 'pill-amber' : 'pill-green'}`;
      if (!alerts.length) {
        list.innerHTML = '<div class="empty-state">All monitored systems nominal.</div>';
        return;
      }
      list.innerHTML = alerts.slice(0, 7).map((alert) => `
        <div class="alert-item ${alert.severity}">
          <span class="alert-dot"></span>
          <div class="alert-text">
            <strong>${MM.esc(alert.title)}</strong>
            <span>${MM.esc(alert.detail)} <span class="mono">· ${MM.esc(alert.source)}</span></span>
          </div>
        </div>`).join('');
    }

    renderAgentSnapshot() {
      const container = $('#ov-agent-list');
      if (!container) return;
      container.innerHTML = this.app.agents.agents.map((agent) => `
        <div class="agent-snapshot-row">
          <div class="agent-snapshot-main">
            ${UI.agentAvatarSmall(agent)}
            <div style="min-width:0">
              <div class="agent-snapshot-name">${MM.esc(agent.name)}</div>
              <div class="agent-snapshot-obs">${MM.esc(agent.observation)}</div>
            </div>
          </div>
          ${UI.agentPill(agent.status)}
        </div>`).join('');
    }

    renderActivity() {
      const container = $('#ov-activity');
      if (!container) return;
      const entries = this.sm.log.slice(-7).reverse();
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No activity yet. Start the mission.</div>';
        return;
      }
      container.innerHTML = entries.map((entry) => `
        <div class="mini-log-row ${entry.detail || entry.report ? 'clickable' : ''}" data-log-id="${entry.id}" style="cursor:${entry.detail || entry.report ? 'pointer' : 'default'}">
          <span class="mini-log-time">${MM.esc(entry.timestamp)}</span>
          <span class="mini-log-type" style="background:${UI.logDotColor(entry.type)}"></span>
          <div class="mini-log-body">
            <div class="mini-log-title">${MM.esc(entry.title)}</div>
            <div class="mini-log-msg">${MM.esc(entry.message)}</div>
          </div>
        </div>`).join('');
    }

    updateScenarioUI() {
      this.app.events.list().forEach((scenario) => {
        const active = this.app.events.isActive(scenario.id);
        const remaining = this.sm.state.eventTimers[scenario.eventKey] || 0;
        const card = document.querySelector(`[data-scenario-card="${scenario.id}"]`);
        if (card) {
          card.classList.toggle('active', active);
          const timer = card.querySelector('[data-scenario-timer]');
          if (timer) {
            timer.textContent = active ? `Resolves in ${U.fixed(remaining, 1)} d` : 'Ready';
            timer.className = `scenario-timer ${active ? '' : 'idle'}`;
          }
          const btn = card.querySelector('[data-scenario]');
          if (btn) {
            btn.disabled = active;
            btn.textContent = active ? 'Active' : 'Trigger scenario';
          }
        }
        const stateLabel = document.querySelector(`[data-scenario-state="${scenario.id}"]`);
        if (stateLabel) {
          stateLabel.textContent = active ? 'ACTIVE' : 'ARM';
          stateLabel.className = `qs-state ${active ? 'active' : ''}`;
        }
        const quick = document.querySelector(`.quick-scenario[data-scenario="${scenario.id}"]`);
        if (quick) quick.disabled = active;
      });

      this.renderActiveEffects();
      this.renderEmergencySummary();
      this.renderScenarioLog();
    }

    renderActiveEffects() {
      const container = $('#active-effects');
      if (!container) return;
      const s = this.sm.state;
      const items = [];
      this.app.events.list().forEach((scenario) => {
        if (!this.app.events.isActive(scenario.id)) return;
        items.push(`<div class="effect-item red"><span class="dot dot-critical"></span><div><strong>${MM.esc(scenario.title)}</strong><br>${MM.esc(scenario.changes.join(' · '))} <span class="mono">· ${U.fixed(s.eventTimers[scenario.eventKey] || 0, 1)} d remaining</span></div></div>`);
      });
      const modes = [
        ['protective', 'Protective mode active', 'Shielding raised; science suspended.'],
        ['powerSaving', 'Essential power mode', 'Nonessential electrical loads shed.'],
        ['fuelSaving', 'Fuel conservation active', 'Burn rate reduced; leak containment engaged.'],
        ['autonomous', 'Onboard autonomy', 'Ground command authority suspended.'],
        ['lifeSupportPriority', 'Life-support priority', 'Oxygen generation protected above all loads.']
      ];
      modes.forEach(([key, title, detail]) => {
        if (!s.modes[key]) return;
        items.push(`<div class="effect-item blue"><span class="dot" style="background:#38bdf8"></span><div><strong>${MM.esc(title)}</strong><br>${MM.esc(detail)}</div></div>`);
      });
      if (!items.length) {
        container.innerHTML = '<div class="empty-state small">No active modifiers.</div>';
        return;
      }
      container.innerHTML = items.join('');
      const restore = $('#btn-restore-systems');
      if (restore) restore.disabled = false;
    }

    renderEmergencySummary() {
      const s = this.sm.state;
      const risk = this.sm.computeRisk();
      const pill = $('#emergency-risk-pill');
      if (pill) {
        pill.textContent = `${risk.category.toUpperCase()} RISK`;
        pill.className = `pill pill-${risk.category === 'critical' ? 'red' : risk.category === 'high' ? 'amber' : risk.category === 'medium' ? 'blue' : 'green'}`;
      }
      UI.setBar('emergency-risk-bar', risk.score);
      this.setText('emergency-active-count', String(this.app.events.activeCount()));
      this.setText('emergency-responses', String(s.metrics.responsesCompleted));
      this.setText('emergency-detected', String(s.metrics.emergenciesDetected));
      this.setText('emergency-comm', s.systems.communication.toUpperCase());
    }

    renderScenarioLog() {
      const container = $('#scenario-log');
      if (!container) return;
      const entries = this.sm.log.filter((entry) => entry.type === 'event').slice(-6).reverse();
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state small">No emergency events this mission.</div>';
        return;
      }
      container.innerHTML = entries.map((entry) => `
        <div class="scenario-log-row ${entry.detail ? 'clickable' : ''}" data-log-id="${entry.id}" style="cursor:pointer">
          <strong>${MM.esc(entry.title)}</strong>
          <span>${MM.esc(entry.timestamp)} · ${MM.esc(entry.message)}</span>
        </div>`).join('');
    }

    renderNavigationReadouts(s) {
      const p = MM.physics;
      const distance = s.spacecraft.distanceToMarsKm;
      const uncertainty = s.spacecraft.navUncertaintyKm || 1200;
      const eta = Math.max(0, ((100 - s.progress) / 100) * s.missionDurationDays);
      this.setText('nav-distance', U.millions(distance));
      this.setText('nav-progress', `${U.fixed(s.progress, 1)}%`);
      this.setText('nav-velocity', `${U.fixed(s.spacecraft.velocityKms, 2)} km/s`);
      this.setText('nav-uncertainty', `± ${U.thousands(uncertainty)} km`);
      this.setText('nav-position', `± ${U.thousands(uncertainty * 0.4)} km`);
      this.setText('nav-eta', `${U.fixed(eta, 1)} d`);
      this.setText('nav-correction', s.missionFlags.midCourseCorrection ? 'Complete' : s.progress >= 35 ? 'Window open' : 'Scheduled');
      this.setText('nav-earth-v', `${U.fixed(p.circularOrbitalVelocity(p.CONST.M_SUN, p.CONST.R_EARTH_ORBIT) / 1000, 2)} km/s`);
      this.setText('nav-mars-v', `${U.fixed(p.circularOrbitalVelocity(p.CONST.M_SUN, p.CONST.R_MARS_ORBIT) / 1000, 2)} km/s`);
      this.setText('viz-range', U.millions(distance));
      this.setText('viz-progress-text', `${U.fixed(s.progress, 1)}% · ${U.missionTime(s.missionDay)}`);
      UI.setBar('viz-progress-bar', s.progress);
      const confidence = document.getElementById('viz-nav-confidence');
      if (confidence) confidence.textContent = `± ${U.thousands(uncertainty)} km`;

      const eventsContainer = $('#viz-events');
      if (eventsContainer) {
        const active = this.app.events.list().filter((sc) => this.app.events.isActive(sc.id));
        eventsContainer.innerHTML = active.length
          ? active.map((sc) => `<div class="event-marker-item"><span class="dot" style="background:${sc.accent}"></span>${MM.esc(sc.title)} · <span class="mono">${U.fixed(s.eventTimers[sc.eventKey] || 0, 1)} d</span></div>`).join('')
          : '<div class="empty-state small">No active events.</div>';
      }
    }
  }

  MM.Dashboard = Dashboard;
})();
