/* MissionMind 2.0 — Mars terminal-descent trainer (real-time, shared propellant) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  const START_ALTITUDE_M = 2500;
  const CHUTE_TERMINAL_MS = 25;
  const RETRO_START_ALTITUDE_M = 420;
  const MAX_RETRO_THRUST_N = 110000;
  const MAX_SAFE_TOUCHDOWN_MS = 3.0;
  const STEP_SECONDS = 0.1;

  class DescentEngine {
    constructor(stateManager, spacecraftEngine) {
      this.stateManager = stateManager;
      this.spacecraftEngine = spacecraftEngine;

      this.bodyId = 'mars';
      this.body = CFG.BODIES.mars;
      this.gravity = this.body.surfaceGravity;
      this.ispSeconds = CFG.PROPULSION.chemical.ispSeconds;
      this.g0 = CFG.PHYSICS.G0;
      this.maxRetroThrustN = MAX_RETRO_THRUST_N;

      this.active = false;
      this.status = 'idle';
      this.altitudeM = START_ALTITUDE_M;
      this.verticalSpeedMs = -CHUTE_TERMINAL_MS;
      this.targetDescentMs = 1.5;
      this.mode = 'auto';
      this.manualThrottlePercent = 0;
      this.throttlePercent = 0;
      this.fuelUsedKg = 0;
      this.pendingFuelKg = 0;
      this.touchdownSpeedMs = null;
      this.ticks = 0;
      this.timer = null;

      this.timer = setInterval(() => this.tick(STEP_SECONDS), STEP_SECONDS * 1000);
      MM.bus.on('mission:reset', () => this.reset());
      this.syncState();
    }

    get descentRateMs() {
      return Math.max(0, -this.verticalSpeedMs);
    }

    get telemetry() {
      const m = this.spacecraftEngine ? this.spacecraftEngine.totalMass : 22500;
      const weightN = m * this.gravity;
      return {
        active: this.active,
        status: this.status,
        altitudeM: Math.max(0, this.altitudeM),
        verticalSpeedMs: this.verticalSpeedMs,
        descentRateMs: this.descentRateMs,
        targetDescentMs: this.targetDescentMs,
        mode: this.mode,
        throttlePercent: this.throttlePercent,
        manualThrottlePercent: this.manualThrottlePercent,
        localGravity: this.gravity,
        bodyName: this.body.name,
        massKg: m,
        weightN: U.round(weightN, 0),
        hoverThrottlePercent: U.clamp(Math.round((weightN / this.maxRetroThrustN) * 100), 0, 100),
        fuelUsedKg: U.round(this.fuelUsedKg, 1),
        fuelRemainingKg: this.spacecraftEngine ? U.round(this.spacecraftEngine.fuelMass, 1) : 0,
        touchdownSpeedMs: this.touchdownSpeedMs,
        safeTouchdownMs: MAX_SAFE_TOUCHDOWN_MS,
        chuteAltitudeM: RETRO_START_ALTITUDE_M,
        startAltitudeM: START_ALTITUDE_M
      };
    }

    start() {
      this.active = true;
      this.status = 'chute';
      this.altitudeM = START_ALTITUDE_M;
      this.verticalSpeedMs = -CHUTE_TERMINAL_MS;
      this.throttlePercent = 0;
      this.fuelUsedKg = 0;
      this.pendingFuelKg = 0;
      this.touchdownSpeedMs = null;
      this.ticks = 0;

      this.stateManager.addLog('mission', 'Terminal descent trainer started', `Mars descent module released at ${U.thousands(START_ALTITUDE_M)} m. Parachute phase active until ${RETRO_START_ALTITUDE_M} m.`, { severity: 'info' });
      MM.bus.emit('toast', { type: 'info', title: 'Descent started', message: `Parachute descent to ${RETRO_START_ALTITUDE_M} m, then retro-thrust terminal guidance.` });
      this.publish();
      return true;
    }

    abort() {
      const wasActive = this.active;
      this.active = false;
      this.status = 'idle';
      this.altitudeM = START_ALTITUDE_M;
      this.verticalSpeedMs = -CHUTE_TERMINAL_MS;
      this.throttlePercent = 0;
      this.manualThrottlePercent = 0;
      if (wasActive) {
        this.stateManager.addLog('warning', 'Descent trainer aborted', 'Descent module reset to the 2,500 m release point. No propellant is consumed while idle.', { severity: 'warning' });
      }
      this.publish();
      return true;
    }

    hold() {
      if (!this.active) return false;
      this.mode = 'auto';
      this.targetDescentMs = 0;
      this.status = 'retro';
      this.stateManager.addLog('systems', 'Descent hold commanded', 'Autopilot target set to 0 m/s to arrest vertical motion.', { severity: 'info' });
      this.publish();
      return true;
    }

    setTargetDescent(mps) {
      this.targetDescentMs = U.clamp(Number(mps) || 0.1, 0.1, 15);
      this.publish();
      return this.targetDescentMs;
    }

    setMode(mode) {
      if (!['auto', 'manual'].includes(mode)) return false;
      this.mode = mode;
      if (mode === 'manual') {
        this.manualThrottlePercent = this.throttlePercent;
      }
      this.publish();
      return true;
    }

    setManualThrottle(percent) {
      this.manualThrottlePercent = U.clamp(Number(percent) || 0, 0, 100);
      this.publish();
      return this.manualThrottlePercent;
    }

    tick(dt) {
      if (!this.active) return;
      const step = U.clamp(Number(dt) || STEP_SECONDS, 0.02, 0.25);

      if (this.altitudeM > RETRO_START_ALTITUDE_M) {
        // Parachute phase: constant terminal velocity, no propellant use.
        this.verticalSpeedMs = -CHUTE_TERMINAL_MS;
        this.altitudeM = Math.max(0, this.altitudeM - CHUTE_TERMINAL_MS * step);
        this.throttlePercent = 0;
        this.status = 'chute';
        this.afterStep();
        return;
      }

      if (this.status === 'chute') {
        this.status = 'retro';
        this.stateManager.addLog('navigation', 'Retro-thrust terminal phase', `Parachute released at ${Math.round(this.altitudeM)} m. Retro-thrust terminal guidance engaged.`, { severity: 'info' });
      }

      const fuelKg = this.spacecraftEngine ? this.spacecraftEngine.fuelMass : 0;
      const massKg = this.spacecraftEngine ? this.spacecraftEngine.totalMass : 22500;

      let throttle;
      if (this.mode === 'manual') {
        throttle = this.manualThrottlePercent / 100;
      } else {
        const error = this.targetDescentMs - this.descentRateMs;
        const requiredThrust = massKg * (this.gravity - 1.15 * error);
        throttle = U.clamp(requiredThrust / this.maxRetroThrustN, 0, 1);
      }

      const available = fuelKg > 0 ? 1 : 0;
      const thrustN = throttle * this.maxRetroThrustN * available;
      const accelUp = thrustN / massKg - this.gravity;
      this.verticalSpeedMs += accelUp * step;

      // Atmospheric drag / structural limits keep the module below terminal velocity.
      this.verticalSpeedMs = U.clamp(this.verticalSpeedMs, -CHUTE_TERMINAL_MS, 35);
      this.altitudeM += this.verticalSpeedMs * step;
      this.throttlePercent = Math.round(throttle * 100);

      const massFlowKgS = thrustN / (this.ispSeconds * this.g0);
      const burnKg = massFlowKgS * step;
      if (burnKg > 0) {
        this.fuelUsedKg += burnKg;
        this.pendingFuelKg += burnKg;
      }

      if (this.altitudeM <= 0) {
        this.altitudeM = 0;
        this.touchdownSpeedMs = this.descentRateMs;
        this.active = false;
        this.throttlePercent = 0;
        const safe = this.touchdownSpeedMs <= MAX_SAFE_TOUCHDOWN_MS;
        this.status = safe ? 'landed' : 'crashed';
        this.stateManager.addLog('mission', safe ? 'Mars touchdown confirmed' : 'Descent impact anomaly',
          safe
            ? `Touchdown at ${U.fixed(this.touchdownSpeedMs, 2)} m/s (limit ${MAX_SAFE_TOUCHDOWN_MS} m/s). ${U.fixed(this.fuelUsedKg, 1)} kg of propellant consumed.`
            : `Impact at ${U.fixed(this.touchdownSpeedMs, 2)} m/s exceeded the ${MAX_SAFE_TOUCHDOWN_MS} m/s landing limit. Descent trainer failure.`,
          { severity: safe ? 'info' : 'critical' });
        MM.bus.emit('toast', {
          type: safe ? 'success' : 'critical',
          title: safe ? 'Touchdown confirmed' : 'Hard landing',
          message: safe ? `Landed at ${U.fixed(this.touchdownSpeedMs, 2)} m/s.` : `Impact ${U.fixed(this.touchdownSpeedMs, 2)} m/s exceeded limits.`
        });
        this.flushFuel();
        this.publish();
        return;
      }

      this.afterStep();
    }

    afterStep() {
      this.ticks += 1;
      if (this.ticks % 10 === 0) {
        this.flushFuel();
        this.syncState();
      }
      MM.bus.emit('landing:update', this.telemetry);
    }

    flushFuel() {
      if (this.pendingFuelKg <= 0) return;
      if (this.spacecraftEngine) this.spacecraftEngine.consumeFuel(this.pendingFuelKg);
      this.pendingFuelKg = 0;
    }

    syncState() {
      this.stateManager.update((s) => {
        s.descent = { ...this.telemetry };
      }, 'descent:update');
    }

    publish() {
      this.syncState();
      MM.bus.emit('landing:update', this.telemetry);
    }

    reset() {
      this.active = false;
      this.status = 'idle';
      this.altitudeM = START_ALTITUDE_M;
      this.verticalSpeedMs = -CHUTE_TERMINAL_MS;
      this.targetDescentMs = 1.5;
      this.mode = 'auto';
      this.manualThrottlePercent = 0;
      this.throttlePercent = 0;
      this.fuelUsedKg = 0;
      this.pendingFuelKg = 0;
      this.touchdownSpeedMs = null;
      this.ticks = 0;
      this.publish();
    }
  }

  MM.DescentEngine = DescentEngine;
})();
