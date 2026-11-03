/* MissionMind — application bootstrap */
(function () {
  'use strict';
  const MM = window.MM;
  const UI = MM.ui;
  const $ = MM.$;

  function boot() {
    if (MM.app) return;

    const stateManager = new MM.MissionStateManager();
    const decisionEngine = new MM.DecisionEngine(stateManager);
    const agentManager = new MM.AgentManager(stateManager, decisionEngine);
    const eventManager = new MM.EventManager(stateManager, agentManager);
    const simulation = new MM.SimulationEngine(stateManager, agentManager, eventManager);
    eventManager.attachSimulation(simulation);

    const orbitalEngine = new MM.OrbitalEngine(stateManager);
    const spacecraftEngine = new MM.SpacecraftEngine(stateManager);
    const energyEngine = new MM.EnergyEngine(stateManager);
    const radarEngine = new MM.RadarEngine(stateManager);
    const sensorEngine = new MM.SensorEngine(stateManager);
    const controlManager = new MM.ControlManager(stateManager);

    const charts = new MM.ChartManager(stateManager);

    MM.app = {
      stateManager,
      decisionEngine,
      agentManager,
      agents: agentManager,
      events: eventManager,
      simulation,
      orbitalEngine,
      spacecraftEngine,
      energyEngine,
      radarEngine,
      sensorEngine,
      controlManager,
      charts,
      dashboard: null,
      spacecraftView: null,
      orbitalControls: null,
      thrusterControls: null,
      solarPanelControls: null,
      radarDisplay: null,
      sensorDisplay: null,
      physicsLab: null,
      agentCards: null,
      telemetry: null,
      decisionLog: null
    };

    stateManager.update(() => {}, 'initialise');
    stateManager.addLog('system', 'MissionMind 2.0 online', 'Nine specialised autonomous agents registered. Orbital, propulsion, energy, and radar engines online.', { severity: 'info' });

    bindModal();
    bindGlobalErrors(stateManager);
    bindLifecycle(stateManager, simulation);

    if (MM.physics) {
      const validation = MM.physics.selfTest();
      if (!validation.allPassed) console.warn('[MissionMind] Physics self-test failures:', validation.results.filter((r) => !r.pass));
    }

    try {
      const dashboard = new MM.Dashboard(MM.app);
      MM.app.dashboard = dashboard;
      dashboard.init();

      const spacecraftView = new MM.SpacecraftView('spacecraft-canvas-container', stateManager);
      MM.app.spacecraftView = spacecraftView;

      const orbitalControls = new MM.OrbitalControlsView(MM.app);
      MM.app.orbitalControls = orbitalControls;
      orbitalControls.init();

      const thrusterControls = new MM.ThrusterControlsView(MM.app);
      MM.app.thrusterControls = thrusterControls;
      thrusterControls.init();

      const solarPanelControls = new MM.SolarPanelControlsView(MM.app);
      MM.app.solarPanelControls = solarPanelControls;
      solarPanelControls.init();

      const radarDisplay = new MM.RadarDisplayView(MM.app);
      MM.app.radarDisplay = radarDisplay;
      radarDisplay.init();

      const sensorDisplay = new MM.SensorDisplayView(MM.app);
      MM.app.sensorDisplay = sensorDisplay;
      sensorDisplay.init();

      const physicsLab = new MM.PhysicsLabView(MM.app);
      MM.app.physicsLab = physicsLab;
      physicsLab.init();

      const agentCards = new MM.AgentCards(MM.app);
      MM.app.agentCards = agentCards;
      agentCards.init();

      const telemetry = new MM.TelemetryView(MM.app);
      MM.app.telemetry = telemetry;
      telemetry.init();

      const decisionLog = new MM.DecisionLog(MM.app);
      MM.app.decisionLog = decisionLog;
      decisionLog.init();

      charts.attach();
      charts.render();

      const speed = $('#set-default-speed');
      if (speed) speed.value = String(stateManager.settings.defaultSpeed);

      setTimeout(() => {
        UI.toast('info', 'MissionMind 2.0 Command Ready', 'Nine autonomous agents active. Spacecraft simulator, 3-axis thrusters, radar & orbital engines ready.');
      }, 500);
    } catch (err) {
      console.error('[MissionMind] UI bootstrap failed', err);
      stateManager.errorCount += 1;
      stateManager.addLog('error', 'Interface bootstrap failure', err.message, { severity: 'error' });
      UI.toast('critical', 'Interface error', err.message);
    }

    document.body.dataset.missionmind = 'ready';
    console.info('%cMissionMind 2.0 Autonomous Aerospace Simulator', 'color:#38bdf8;font-weight:bold', 'SI physics active. Nine agents online. State at MM.app.');
  }

  function bindModal() {
    const modal = $('#modal');
    $('#modal-close')?.addEventListener('click', () => UI.closeModal());
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) UI.closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && !modal.hidden) UI.closeModal();
    });
  }

  function bindGlobalErrors(stateManager) {
    let lastError = '';
    let lastAt = 0;
    const report = (message) => {
      const now = Date.now();
      if (message === lastError && now - lastAt < 3000) return;
      lastError = message;
      lastAt = now;
      stateManager.errorCount += 1;
      try {
        stateManager.addLog('error', 'Runtime error', message, { severity: 'error' });
      } catch (err) { /* logging must never cascade */ }
      if (UI && typeof UI.toast === 'function') UI.toast('critical', 'Runtime error', message);
    };

    window.addEventListener('error', (event) => {
      report(event.message || 'Unknown script error');
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      report(reason && reason.message ? reason.message : String(reason || 'Unhandled promise rejection'));
    });
  }

  function bindLifecycle(stateManager, simulation) {
    MM.bus.on('mission:complete', () => {
      const simulationEl = $('#btn-pause');
      if (simulationEl) simulationEl.disabled = true;
    });
    MM.bus.on('mission:failed', () => {
      const simulationEl = $('#btn-pause');
      if (simulationEl) simulationEl.disabled = true;
    });
    window.addEventListener('beforeunload', () => {
      if (simulation.running) simulation.pause(true);
    });
    void stateManager;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
