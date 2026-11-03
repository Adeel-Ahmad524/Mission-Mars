/* MissionMind 2.0 — Solar Energy & Battery Management Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  class EnergyEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.physics = MM.physics;

      // Solar Panel state
      this.deployed = true;
      this.deploymentProgress = 1.0; // 0.0 (fully retracted) to 1.0 (fully deployed)
      this.isDeploying = false;
      this.isRetracting = false;
      this.panelAngleDeg = 15; // angle to Sun normal
      this.panelHealth = 100;  // %
      this.panelArea = CFG.ENERGY.panelArea;
      this.efficiency = CFG.ENERGY.panelEfficiency;

      // Battery state
      this.capacityWh = CFG.ENERGY.batteryCapacityWh;
      this.storedEnergyWh = this.capacityWh * 0.85; // start at 85%

      // Power metrics cache
      this.irradiance = CFG.PHYSICS.SOLAR_IRRADIANCE_1AU;
      this.generatedPowerW = 0;
      this.electricalLoadW = 0;
      this.netPowerW = 0;
      this.chargeRateW = 0;
      this.dischargeRateW = 0;
    }

    get batteryPercentage() {
      return (this.storedEnergyWh / this.capacityWh) * 100;
    }

    /**
     * Deploy solar arrays with smooth transition
     */
    deployPanels() {
      if (this.deployed && this.deploymentProgress >= 1.0) return;
      this.isDeploying = true;
      this.isRetracting = false;
      this.stateManager.addLog('systems', 'Deploying Solar Panels', 'Actuator motors engaged. Deploying dual photovoltaic wings.', { severity: 'info' });
      MM.bus.emit('toast', { type: 'info', title: 'Solar Panels', message: 'Deployment sequence initiated.' });
    }

    /**
     * Retract solar arrays (e.g. for high-G burns or micrometeorite protection)
     */
    retractPanels() {
      if (!this.deployed && this.deploymentProgress <= 0.0) return;
      this.isRetracting = true;
      this.isDeploying = false;
      this.stateManager.addLog('systems', 'Retracting Solar Panels', 'Actuators folding solar panels into protective launch locks.', { severity: 'warning' });
      MM.bus.emit('toast', { type: 'info', title: 'Solar Panels', message: 'Retraction sequence initiated.' });
    }

    togglePanels() {
      if (this.deployed) this.retractPanels();
      else this.deployPanels();
    }

    /**
     * Set panel orientation angle relative to Sun vector (0 to 180 degrees)
     */
    setPanelAngle(deg) {
      this.panelAngleDeg = U.clamp(Number(deg) || 0, 0, 180);
      this.calculatePower();
      MM.bus.emit('energy:updated', this.getTelemetry());
    }

    /**
     * Compute solar generation: P = η * A * S * cos(θ) * deploymentFactor
     */
    calculatePower() {
      const angleRad = (this.panelAngleDeg * Math.PI) / 180;
      const effectiveArea = this.panelArea * this.deploymentProgress * (this.panelHealth / 100);

      this.generatedPowerW = this.physics.solarPowerGeneration(
        this.efficiency,
        effectiveArea,
        this.irradiance,
        angleRad
      );

      // Calculate total electrical load
      const s = this.stateManager.state;
      let load = CFG.ENERGY.baseAvionicsLoadW;

      // Life support
      load += CFG.ENERGY.lifeSupportLoadW;

      // Active science
      if (s.systems && s.systems.science === 'active') {
        load += CFG.ENERGY.scienceLoadW;
      }

      // Solar-electric propulsion load (if active and firing)
      if (s.thrusters && s.thrusters.electricalDrawWatts) {
        load += s.thrusters.electricalDrawWatts;
      }

      this.electricalLoadW = load;
      this.netPowerW = this.physics.batteryEnergyBalance(this.generatedPowerW, this.electricalLoadW);

      if (this.netPowerW >= 0) {
        this.chargeRateW = Math.min(CFG.ENERGY.maxChargeRateW, this.netPowerW);
        this.dischargeRateW = 0;
      } else {
        this.chargeRateW = 0;
        this.dischargeRateW = Math.abs(this.netPowerW);
      }

      // Sync with mission state
      this.stateManager.update((st) => {
        st.solar = {
          deployed: this.deployed,
          deploymentProgress: this.deploymentProgress,
          angleDeg: this.panelAngleDeg,
          irradiance: this.irradiance,
          efficiency: this.efficiency,
          area: this.panelArea,
          generatedPowerW: this.generatedPowerW,
          panelHealth: this.panelHealth
        };
        st.battery = {
          capacityWh: this.capacityWh,
          storedEnergyWh: this.storedEnergyWh,
          chargePercent: U.round(this.batteryPercentage, 1),
          netPowerW: this.netPowerW,
          chargeRateW: this.chargeRateW,
          dischargeRateW: this.dischargeRateW,
          electricalLoadW: this.electricalLoadW
        };
        st.resources.power = U.round(this.batteryPercentage, 1);
      }, 'energy:update');
    }

    /**
     * Physical step (dt in seconds)
     */
    step(dt) {
      if (dt <= 0) return;

      // Animate panel deployment / retraction
      const deploySpeed = dt / CFG.ENERGY.deployDurationSec;
      if (this.isDeploying) {
        this.deploymentProgress = Math.min(1.0, this.deploymentProgress + deploySpeed);
        if (this.deploymentProgress >= 1.0) {
          this.isDeploying = false;
          this.deployed = true;
          this.stateManager.addLog('systems', 'Solar Panels Fully Deployed', 'Arrays locked in nominal solar tracking orientation.', { severity: 'info' });
        }
      } else if (this.isRetracting) {
        this.deploymentProgress = Math.max(0.0, this.deploymentProgress - deploySpeed);
        if (this.deploymentProgress <= 0.0) {
          this.isRetracting = false;
          this.deployed = false;
          this.stateManager.addLog('systems', 'Solar Panels Fully Retracted', 'Panels secured in hull stowage bay.', { severity: 'info' });
        }
      }

      this.calculatePower();

      // Energy integral: E = P * (dt / 3600) Wh
      const hours = dt / 3600;
      const energyDeltaWh = this.netPowerW * hours;
      this.storedEnergyWh = U.clamp(this.storedEnergyWh + energyDeltaWh, 0, this.capacityWh);

      if (this.storedEnergyWh <= 0) {
        this.stateManager.addLog('safety', 'Total Battery Depletion', 'Electrical reserves exhausted. Emergency life-support fallback engaged.', { severity: 'critical' });
      }
    }

    getTelemetry() {
      return {
        deployed: this.deployed,
        deploymentProgress: this.deploymentProgress,
        panelAngleDeg: this.panelAngleDeg,
        generatedPowerW: this.generatedPowerW,
        electricalLoadW: this.electricalLoadW,
        netPowerW: this.netPowerW,
        batteryPercent: this.batteryPercentage,
        storedEnergyWh: this.storedEnergyWh
      };
    }
  }

  MM.EnergyEngine = EnergyEngine;
})();
