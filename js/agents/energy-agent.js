/* MissionMind 2.0 — Energy Transition Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class EnergyTransitionAgent extends MM.BaseAgent {
    constructor() {
      super({
        id: 'energy',
        name: 'Energy Transition Agent',
        role: 'Chemical vs Solar-Electric Power & Battery Management',
        short: 'ENERGY',
        accent: '#eab308',
        bg: 'rgba(234, 179, 8, 0.09)',
        border: 'rgba(234, 179, 8, 0.35)'
      });
    }

    evaluate(state) {
      const solar = state.solar || {};
      const battery = state.battery || {};
      const fuelPct = state.resources ? state.resources.fuel : 80;
      const powerPct = state.resources ? state.resources.power : 80;
      const mode = state.propulsionMode || 'chemical';
      const isStorm = state.events && state.events.solarStorm;

      // 1. Solar Storm Emergency
      if (isStorm) {
        return this.makeReport(state, {
          status: 'critical',
          observation: `High-flux solar particle event detected (${solar.irradiance || 1361} W/m²). Photovoltaic surge risk.`,
          recommendation: 'Retract or feather solar panels and shift to chemical reserve power to protect delicate solar arrays.',
          confidence: 0.95,
          relatedEvent: 'solarStorm',
          suggestedAction: 'retract-solar-panels',
          severity: 'critical',
          details: { irradiance: solar.irradiance, batteryPercent: powerPct }
        });
      }

      // 2. Battery Critical
      if (powerPct < 20) {
        return this.makeReport(state, {
          status: 'critical',
          observation: `Battery reserves dangerously depleted at ${U.pct(powerPct)}. Available energy: ${U.thousands(battery.storedEnergyWh || 0)} Wh.`,
          recommendation: 'Deploy solar arrays immediately, align to optimal sun angle (0°), and isolate non-essential electrical loads.',
          confidence: 0.96,
          relatedEvent: 'powerFailure',
          suggestedAction: 'deploy-solar-panels',
          severity: 'critical',
          details: { batteryPercent: powerPct, storedWh: battery.storedEnergyWh }
        });
      }

      // 3. Evaluate Solar-Electric Transition Opportunity
      // When solar panels are generating strong surplus power and fuel is decreasing
      const hasSurplusPower = solar.generatedPowerW > 2500 && powerPct > 65;
      const fuelSavingNeeded = fuelPct < 45 || state.modes.fuelSaving;

      if (mode === 'chemical' && hasSurplusPower && fuelSavingNeeded && solar.deployed) {
        return this.makeReport(state, {
          status: 'analysing',
          observation: `Surplus solar generation confirmed (${U.thousands(solar.generatedPowerW)} W) with ${U.pct(powerPct)} battery margin. Chemical propellant is limited (${U.pct(fuelPct)}).`,
          recommendation: 'Transition to Solar-Electric Propulsion. Conserves propellant with 3100s Isp Hall thrusters utilizing solar electricity.',
          confidence: 0.92,
          suggestedAction: 'switch-solar-electric',
          severity: 'medium',
          details: { genWatts: solar.generatedPowerW, batteryPct: powerPct, fuelPct }
        });
      }

      // 4. Panel Retracted Alert
      if (!solar.deployed && powerPct < 70) {
        return this.makeReport(state, {
          status: 'warning',
          observation: 'Solar arrays are currently retracted into stowage locks. Spacecraft is operating exclusively on battery discharge.',
          recommendation: 'Deploy solar panels to maintain orbital power equilibrium and recharge flight batteries.',
          confidence: 0.88,
          suggestedAction: 'deploy-solar-panels',
          severity: 'high',
          details: { netPowerW: battery.netPowerW }
        });
      }

      // 5. Panel Misalignment (Cosine loss)
      if (solar.deployed && solar.angleDeg > 45) {
        return this.makeReport(state, {
          status: 'analysing',
          observation: `Solar panel angle to sun vector is ${solar.angleDeg}°, causing a ${U.pct((1 - Math.cos(solar.angleDeg * Math.PI / 180)) * 100)} cosine efficiency loss.`,
          recommendation: 'Gimbal solar arrays toward Sun normal vector to maximize photovoltaic conversion.',
          confidence: 0.85,
          suggestedAction: 'align-solar-panels',
          severity: 'medium',
          details: { angleDeg: solar.angleDeg, genW: solar.generatedPowerW }
        });
      }

      // 6. Nominal Energy State
      return this.makeReport(state, {
        status: 'monitoring',
        observation: `Energy grid balanced in ${mode.toUpperCase()} mode. Generation: ${U.thousands(solar.generatedPowerW || 0)} W, Battery: ${U.pct(powerPct)}, Net: ${U.round(battery.netPowerW || 0, 1)} W.`,
        recommendation: 'Maintain current energy distribution profile. Continuous photovoltaic tracking active.',
        confidence: 0.94,
        suggestedAction: 'continue-nominal',
        severity: 'low',
        details: { mode, batteryPct: powerPct, genW: solar.generatedPowerW }
      });
    }
  }

  MM.EnergyTransitionAgent = EnergyTransitionAgent;
})();
