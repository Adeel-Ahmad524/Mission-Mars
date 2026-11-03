/* MissionMind 2.0 — Orbital Mechanics & Trajectory Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  class OrbitalEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.physics = MM.physics;
      this.currentBodyId = 'earth';
      this.body = CFG.BODIES.earth;

      // Keplerian and State parameters
      this.radius = this.body.defaultOrbitRadius;
      this.velocity = this.physics.circularOrbitalVelocity(this.body.mass, this.radius);
      this.inclinationDeg = 28.5; // Typical Cape Canaveral inclination
      this.eccentricity = 0.001;   // Near-circular
      this.trueAnomalyRad = 0;
      this.argumentOfPeriapsisDeg = 0;

      // Trajectory cache
      this.analysis = this.physics.analyzeOrbit(this.body.mass, this.body.radius, this.radius, this.velocity);
    }

    /**
     * Switch central body (Earth, Moon, Mars, Sun)
     */
    setCentralBody(bodyId) {
      if (!CFG.BODIES[bodyId]) return false;
      this.currentBodyId = bodyId;
      this.body = CFG.BODIES[bodyId];

      // Reset to body's default nominal orbit
      this.radius = this.body.defaultOrbitRadius;
      this.velocity = this.physics.circularOrbitalVelocity(this.body.mass, this.radius);
      this.eccentricity = 0.001;
      this.trueAnomalyRad = 0;
      this.recompute();

      this.stateManager.update((s) => {
        s.centralBody = bodyId;
        s.spacecraft.distanceFromEarthKm = bodyId === 'earth' ? (this.radius - this.body.radius) / 1000 : 225e6;
      }, 'orbit:body-change');

      MM.bus.emit('orbit:changed', this.getTelemetry());
      return true;
    }

    /**
     * Adjust orbital velocity (m/s) via knob or control
     */
    setVelocity(newVelMs) {
      const v = Math.max(100, Math.min(60000, Number(newVelMs) || 100));
      this.velocity = v;
      this.recompute();
      MM.bus.emit('orbit:changed', this.getTelemetry());
      return this.analysis;
    }

    /**
     * Adjust orbital radius (m) via knob or slider
     */
    setRadius(newRadiusM) {
      const minR = this.body.radius + 100e3; // at least 100km above surface
      const maxR = this.body.radius * 12;
      this.radius = Math.max(minR, Math.min(maxR, Number(newRadiusM) || minR));
      this.recompute();
      MM.bus.emit('orbit:changed', this.getTelemetry());
      return this.analysis;
    }

    /**
     * Adjust orbital inclination (degrees)
     */
    setInclination(deg) {
      this.inclinationDeg = U.clamp(Number(deg) || 0, 0, 180);
      this.recompute();
      MM.bus.emit('orbit:changed', this.getTelemetry());
    }

    /**
     * Adjust orbital eccentricity (0.0 to 1.5)
     */
    setEccentricity(ecc) {
      this.eccentricity = U.clamp(Number(ecc) || 0, 0, 1.5);
      // Derive velocity at periapsis for this eccentricity: v = sqrt(mu * (1+e)/r)
      const mu = this.physics.G * this.body.mass;
      this.velocity = Math.sqrt((mu * (1 + this.eccentricity)) / this.radius);
      this.recompute();
      MM.bus.emit('orbit:changed', this.getTelemetry());
    }

    /**
     * Recompute all orbital parameters & update mission state
     */
    recompute() {
      this.analysis = this.physics.analyzeOrbit(this.body.mass, this.body.radius, this.radius, this.velocity);
      if (this.eccentricity > 0 && this.analysis.eccentricity === 0) {
        this.analysis.eccentricity = this.eccentricity;
      }

      this.stateManager.update((s) => {
        s.orbit = {
          bodyId: this.currentBodyId,
          bodyName: this.body.name,
          radius: this.radius,
          altitudeKm: (this.radius - this.body.radius) / 1000,
          velocityMs: this.velocity,
          velocityKms: this.velocity / 1000,
          vCircularMs: this.analysis.vCircular,
          vCircularKms: this.analysis.vCircular / 1000,
          vEscapeMs: this.analysis.vEscape,
          vEscapeKms: this.analysis.vEscape / 1000,
          deltaVToCircularMs: this.analysis.deltaVToCircular,
          deltaVToEscapeMs: this.analysis.deltaVToEscape,
          specificEnergy: this.analysis.specificEnergy,
          semiMajorAxisKm: this.analysis.semiMajorAxis !== Infinity ? this.analysis.semiMajorAxis / 1000 : null,
          eccentricity: this.analysis.eccentricity,
          inclinationDeg: this.inclinationDeg,
          periapsisKm: (this.analysis.periapsis - this.body.radius) / 1000,
          apoapsisKm: this.analysis.apoapsis !== Infinity ? (this.analysis.apoapsis - this.body.radius) / 1000 : Infinity,
          periodMinutes: this.analysis.periodSeconds !== Infinity ? this.analysis.periodSeconds / 60 : Infinity,
          orbitType: this.analysis.orbitType,
          isEscaped: this.analysis.isEscaped,
          trueAnomalyDeg: (this.trueAnomalyRad * 180) / Math.PI
        };

        // Sync with primary spacecraft state
        s.spacecraft.velocityKms = this.velocity / 1000;
        s.spacecraft.altitudeKm = (this.radius - this.body.radius) / 1000;
      }, 'orbit:recompute');
    }

    /**
     * Step simulation forward in time (dt in seconds)
     */
    step(dt) {
      if (dt <= 0) return;

      // Angular velocity omega = v / r (rad/s)
      const omega = this.velocity / this.radius;
      this.trueAnomalyRad = (this.trueAnomalyRad + omega * dt) % (2 * Math.PI);

      // In bound orbit, radius varies if eccentric
      if (this.analysis.eccentricity > 0.01 && this.analysis.semiMajorAxis > 0 && !this.analysis.isEscaped) {
        const a = this.analysis.semiMajorAxis;
        const e = this.analysis.eccentricity;
        const rCurrent = (a * (1 - e * e)) / (1 + e * Math.cos(this.trueAnomalyRad));
        // Vis-viva: v² = mu * (2/r - 1/a)
        const mu = this.physics.G * this.body.mass;
        const vCurrent = Math.sqrt(Math.max(10, mu * (2 / rCurrent - 1 / a)));

        this.radius = rCurrent;
        this.velocity = vCurrent;
      } else if (this.analysis.isEscaped) {
        // Spacecraft moves outward on escape trajectory
        this.radius += this.velocity * 0.08 * dt;
        // Gravity decelerates escape speed slightly
        const mu = this.physics.G * this.body.mass;
        const g = mu / (this.radius * this.radius);
        this.velocity = Math.max(100, this.velocity - g * dt);
      }

      this.recompute();
    }

    /**
     * Apply delta-V burn from thruster forces (deltaV in m/s, along trajectory)
     */
    applyDeltaV(deltaVMs) {
      this.velocity = Math.max(100, this.velocity + deltaVMs);
      this.recompute();
      MM.bus.emit('orbit:changed', this.getTelemetry());
    }

    /**
     * Generate trajectory sample coordinates for 2D/3D orbital plots
     */
    getTrajectoryPoints(pointCount = 120) {
      const points = [];
      const mu = this.physics.G * this.body.mass;
      const isEscaped = this.analysis.isEscaped;
      const e = Math.min(1.4, this.analysis.eccentricity);
      const a = this.analysis.semiMajorAxis;

      if (!isEscaped && a > 0) {
        // Closed elliptical orbit
        for (let i = 0; i <= pointCount; i++) {
          const theta = (i / pointCount) * 2 * Math.PI;
          const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
          const x = r * Math.cos(theta);
          const y = r * Math.sin(theta);
          points.push({ x, y, r, theta });
        }
      } else {
        // Unbound hyperbolic trajectory (-theta_max to +theta_max)
        const maxTheta = e > 1 ? Math.acos(-1 / e) * 0.88 : 1.3;
        for (let i = 0; i <= pointCount; i++) {
          const theta = -maxTheta + (i / pointCount) * (2 * maxTheta);
          const r = Math.abs(a * (e * e - 1)) / (1 + e * Math.cos(theta));
          const x = r * Math.cos(theta);
          const y = r * Math.sin(theta);
          points.push({ x, y, r, theta });
        }
      }

      return {
        bodyRadius: this.body.radius,
        currentPos: {
          x: this.radius * Math.cos(this.trueAnomalyRad),
          y: this.radius * Math.sin(this.trueAnomalyRad),
          r: this.radius,
          theta: this.trueAnomalyRad
        },
        orbitPoints: points,
        isEscaped
      };
    }

    getTelemetry() {
      return {
        body: this.body,
        radius: this.radius,
        velocity: this.velocity,
        altitudeKm: (this.radius - this.body.radius) / 1000,
        inclinationDeg: this.inclinationDeg,
        eccentricity: this.analysis.eccentricity,
        analysis: this.analysis
      };
    }
  }

  MM.OrbitalEngine = OrbitalEngine;
})();
