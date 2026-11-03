/* MissionMind 2.0 — Propulsion Control Agent */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  class PropulsionControlAgent extends MM.BaseAgent {
    constructor() {
      super({
        id: 'propulsion',
        name: 'Propulsion Control Agent',
        role: '3-Axis Thruster Balancing, Thermal Protection & Flow Validation',
        short: 'PROPULSION',
        accent: '#06b6d4',
        bg: 'rgba(6, 182, 212, 0.09)',
        border: 'rgba(6, 182, 212, 0.35)'
      });
    }

    evaluate(state) {
      const thrusters = state.thrusters || {};
      const tx = thrusters.x || { cmd: 0, tempC: 22, percent: 0 };
      const ty = thrusters.y || { cmd: 0, tempC: 22, percent: 0 };
      const tz = thrusters.z || { cmd: 0, tempC: 22, percent: 0 };
      const fuelKg = state.spacecraft ? state.spacecraft.fuelMass : 12500;
      const isFiring = Math.abs(tx.percent) > 1 || Math.abs(ty.percent) > 1 || Math.abs(tz.percent) > 1;

      // 1. Critical Thruster Overheating
      const maxTemp = Math.max(tx.tempC || 22, ty.tempC || 22, tz.tempC || 22);
      if (maxTemp > 320) {
        return this.makeReport(state, {
          status: 'critical',
          observation: `CRITICAL THERMAL EXCURSION: Thruster core temperature reached ${Math.round(maxTemp)}°C (limit 350°C). Structural chamber ablation imminent.`,
          recommendation: 'Command immediate thruster shutdown and initiate radiative thermal bleed cycle.',
          confidence: 0.99,
          suggestedAction: 'emergency-thruster-cutoff',
          severity: 'critical',
          details: { maxTempC: maxTemp, txTemp: tx.tempC, tyTemp: ty.tempC, tzTemp: tz.tempC }
        });
      }

      // 2. Thruster Warning Temperature
      if (maxTemp > 240) {
        return this.makeReport(state, {
          status: 'warning',
          observation: `Elevated thruster operating temperatures detected (${Math.round(maxTemp)}°C). Extended burns risk thermal stress.`,
          recommendation: 'Derate continuous thrust commands by 30% and monitor chamber thermistors.',
          confidence: 0.90,
          suggestedAction: 'thruster-cooldown',
          severity: 'high',
          details: { maxTempC: maxTemp }
        });
      }

      // 3. Firing with Low/Zero Propellant
      if (isFiring && fuelKg < 50) {
        return this.makeReport(state, {
          status: 'critical',
          observation: `Thrusters commanded ON with propellant tank nearly empty (${Math.round(fuelKg)} kg remaining). Risk of cavitation and turbopump runaway.`,
          recommendation: 'Engage emergency engine cutoff and isolate propellant manifold valves.',
          confidence: 0.97,
          suggestedAction: 'emergency-thruster-cutoff',
          severity: 'critical',
          details: { fuelKg, totalThrustN: thrusters.totalThrustN }
        });
      }

      // 4. Active Firing Status
      if (isFiring) {
        const totalThrust = Math.round(thrusters.totalThrustN || 0);
        const flowRate = U.fixed(thrusters.propellantFlowRateKgS || 0, 3);
        return this.makeReport(state, {
          status: 'analysing',
          observation: `Active 3-axis propulsion firing: Total Thrust ${U.thousands(totalThrust)} N (X: ${Math.round(tx.percent)}%, Y: ${Math.round(ty.percent)}%, Z: ${Math.round(tz.percent)}%). Mass flow rate: ${flowRate} kg/s.`,
          recommendation: 'Verify attitude hold trim and observe mass depletion rates against flight envelope.',
          confidence: 0.94,
          suggestedAction: 'continue-nominal',
          severity: 'medium',
          details: { totalThrustN: totalThrust, flowRateKgS: flowRate, mode: thrusters.mode }
        });
      }

      // 5. Nominal Thruster Standby
      return this.makeReport(state, {
        status: 'monitoring',
        observation: `All 3 thruster axes nominal in standby (X, Y, Z idle at 0%). Core temperatures: ${Math.round(tx.tempC)}°C / ${Math.round(ty.tempC)}°C / ${Math.round(tz.tempC)}°C. Feed pressure nominal.`,
        recommendation: 'Maintain attitude thrusters in ready standby for orbital stationkeeping.',
        confidence: 0.96,
        suggestedAction: 'continue-nominal',
        severity: 'low',
        details: { txTemp: tx.tempC, tyTemp: ty.tempC, tzTemp: tz.tempC }
      });
    }
  }

  MM.PropulsionControlAgent = PropulsionControlAgent;
})();
