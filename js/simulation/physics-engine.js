/* MissionMind 2.0 — SI Physics Engine & Astrophysical Formulations */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;
  const CONST = CFG.PHYSICS;

  class PhysicsEngine {
    constructor() {
      this.G = CONST.G;
      this.g0 = CONST.G0;
      this.AU = CONST.AU;
      this.S0 = CONST.SOLAR_IRRADIANCE_1AU;
      this.CONST = {
        G: CONST.G,
        M_SUN: CFG.BODIES.sun.mass,
        M_EARTH: CFG.BODIES.earth.mass,
        M_MARS: CFG.BODIES.mars.mass,
        R_EARTH: CFG.BODIES.earth.radius,
        R_MARS: CFG.BODIES.mars.radius,
        AU: CONST.AU,
        R_EARTH_ORBIT: CONST.AU,
        R_MARS_ORBIT: 1.523679 * CONST.AU
      };
    }

    surfaceGravity(M, R) {
      return (this.G * M) / (R * R);
    }

    hohmannTransfer(r1, r2, M) {
      const central = M || this.CONST.M_SUN;
      if (!(r1 > 0) || !(r2 > r1)) throw new Error('Hohmann transfer requires 0 < r1 < r2.');
      const a = (r1 + r2) / 2;
      const mu = this.G * central;
      const v1 = Math.sqrt(mu / r1);
      const v2 = Math.sqrt(mu / r2);
      const vPeri = Math.sqrt(mu * ((2 / r1) - (1 / a)));
      const vApo = Math.sqrt(mu * ((2 / r2) - (1 / a)));
      return {
        semiMajorAxis: a,
        timeSeconds: Math.PI * Math.sqrt(Math.pow(a, 3) / mu),
        timeDays: (Math.PI * Math.sqrt(Math.pow(a, 3) / mu)) / 86400,
        v1,
        v2,
        vPerihelion: vPeri,
        vaphelion: vApo,
        deltaV1: vPeri - v1,
        deltaV2: v2 - vApo,
        totalDeltaV: (vPeri - v1) + (v2 - vApo)
      };
    }

    /**
     * Newton's Law of Universal Gravitation: F = GMm / r² (N)
     */
    gravitationalForce(M, m, r) {
      if (!(r > 0)) throw new Error('Orbital distance r must be > 0');
      return (this.G * M * m) / (r * r);
    }

    /**
     * Gravitational acceleration at distance r: g = GM / r² (m/s²)
     */
    gravitationalAcceleration(M, r) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return (this.G * M) / (r * r);
    }

    /**
     * Gravitational potential energy: U = -GMm / r (Joules)
     */
    gravitationalPotentialEnergy(M, m, r) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return -(this.G * M * m) / r;
    }

    /**
     * Circular orbital velocity: v_c = √(GM / r) (m/s)
     */
    circularOrbitalVelocity(M, r) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return Math.sqrt((this.G * M) / r);
    }

    /**
     * Escape velocity from central body: v_esc = √(2GM / r) (m/s)
     */
    escapeVelocity(M, r) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return Math.sqrt((2 * this.G * M) / r);
    }

    /**
     * Keplerian orbital period: T = 2π√(r³ / GM) (seconds)
     */
    orbitalPeriod(M, r) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / (this.G * M));
    }

    /**
     * Specific orbital energy: ε = v²/2 - GM/r (J/kg or m²/s²)
     */
    specificOrbitalEnergy(M, r, v) {
      if (!(r > 0)) throw new Error('Distance r must be > 0');
      return (v * v) / 2 - (this.G * M) / r;
    }

    /**
     * Kinetic energy: E_k = 1/2 m v² (Joules)
     */
    kineticEnergy(m, v) {
      return 0.5 * m * v * v;
    }

    /**
     * Spacecraft linear momentum: p = m * v (kg·m/s)
     */
    momentum(m, v) {
      return m * v;
    }

    /**
     * Acceleration from applied thrust: a = F / m (m/s²)
     */
    accelerationFromThrust(F, m) {
      if (m <= 0) return 0;
      return F / m;
    }

    /**
     * Propellant mass flow rate: ṁ = F / (Isp * g0) (kg/s)
     */
    propellantFlowRate(F, isp) {
      if (isp <= 0 || F <= 0) return 0;
      return F / (isp * this.g0);
    }

    /**
     * Solar power generation: P = η * A * S * max(0, cos(θ)) (Watts)
     */
    solarPowerGeneration(efficiency, area, irradiance, angleRad) {
      const cosAngle = Math.cos(angleRad);
      if (cosAngle <= 0) return 0;
      return efficiency * area * irradiance * cosAngle;
    }

    /**
     * Net battery power balance: ΔP = P_gen - P_load (Watts)
     */
    batteryEnergyBalance(generatedW, loadW) {
      return generatedW - loadW;
    }

    /**
     * Relative velocity magnitude between two vectors
     */
    relativeVelocity(v1, v2) {
      const dx = (v1.x || 0) - (v2.x || 0);
      const dy = (v1.y || 0) - (v2.y || 0);
      const dz = (v1.z || 0) - (v2.z || 0);
      return Math.hypot(dx, dy, dz);
    }

    /**
     * Time of Closest Approach (TCA):
     * t_CA = -(r_rel · v_rel) / |v_rel|² (seconds)
     */
    timeOfClosestApproach(rRel, vRel) {
      const vSq = (vRel.x * vRel.x) + (vRel.y * vRel.y) + (vRel.z * vRel.z);
      if (vSq < 1e-6) return 0; // negligible relative velocity
      const rDotV = (rRel.x * vRel.x) + (rRel.y * vRel.y) + (rRel.z * vRel.z);
      return -rDotV / vSq;
    }

    /**
     * Distance at Closest Approach:
     * d_CA = |r_rel + v_rel * t_CA| (meters)
     */
    closestApproachDistance(rRel, vRel, tCA) {
      const t = Math.max(0, tCA);
      const rx = rRel.x + vRel.x * t;
      const ry = rRel.y + vRel.y * t;
      const rz = rRel.z + vRel.z * t;
      return Math.hypot(rx, ry, rz);
    }

    /**
     * Keplerian orbital elements analysis from state vectors (r, v)
     */
    analyzeOrbit(M, bodyRadius, r, v) {
      const mu = this.G * M;
      const vCirc = Math.sqrt(mu / r);
      const vEsc = Math.sqrt((2 * mu) / r);
      const energy = (v * v) / 2 - mu / r;

      // Semi-major axis: a = -mu / (2 * energy)
      let semiMajorAxis = Infinity;
      let eccentricity = 0;
      let periapsis = r;
      let apoapsis = r;
      let period = 0;
      let orbitType = 'circular';

      if (Math.abs(v - vCirc) < 1.0) {
        // Ideal circular
        semiMajorAxis = r;
        eccentricity = 0;
        periapsis = r;
        apoapsis = r;
        period = 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / mu);
        orbitType = 'circular';
      } else if (energy < -1e-4) {
        // Bound elliptical
        semiMajorAxis = -mu / (2 * energy);
        // Estimated eccentricity from vis-viva assuming current radius is near periapsis or apoapsis
        // e = |1 - r/a| or derived from specific angular momentum
        eccentricity = Math.max(0, Math.min(0.98, Math.abs(1 - (r / semiMajorAxis))));
        periapsis = semiMajorAxis * (1 - eccentricity);
        apoapsis = semiMajorAxis * (1 + eccentricity);
        period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
        orbitType = periapsis < bodyRadius ? 'suborbital' : 'bound_elliptical';
      } else if (Math.abs(energy) <= 1e-4) {
        // Parabolic boundary
        semiMajorAxis = Infinity;
        eccentricity = 1.0;
        periapsis = r;
        apoapsis = Infinity;
        period = Infinity;
        orbitType = 'parabolic_escape';
      } else {
        // Unbound hyperbolic
        semiMajorAxis = -mu / (2 * energy); // negative for hyperbola
        eccentricity = 1 + (v * v * r) / mu; // approx hyperbolic eccentricity
        periapsis = r;
        apoapsis = Infinity;
        period = Infinity;
        orbitType = 'hyperbolic_escape';
      }

      return {
        r,
        v,
        altitude: r - bodyRadius,
        vCircular: vCirc,
        vEscape: vEsc,
        deltaVToCircular: v - vCirc,
        deltaVToEscape: Math.max(0, vEsc - v),
        specificEnergy: energy,
        semiMajorAxis,
        eccentricity,
        periapsis,
        apoapsis,
        periodSeconds: period,
        orbitType,
        isEscaped: energy >= 0 || v >= vEsc
      };
    }

    /**
     * Self-test physics formulations against established aerospace benchmarks
     */
    selfTest() {
      const earth = CFG.BODIES.earth;
      const rLEO = 6.771e6; // 400 km LEO
      const vCircLEO = this.circularOrbitalVelocity(earth.mass, rLEO);
      const vEscLEO = this.escapeVelocity(earth.mass, rLEO);
      const periodLEO = this.orbitalPeriod(earth.mass, rLEO) / 60; // minutes
      const gLEO = this.gravitationalAcceleration(earth.mass, rLEO);

      const tests = [
        {
          name: '400km LEO Circular Velocity ~7670 m/s',
          computed: Math.round(vCircLEO),
          expected: 7670,
          pass: Math.abs(vCircLEO - 7670) < 30
        },
        {
          name: '400km LEO Escape Velocity ~10847 m/s',
          computed: Math.round(vEscLEO),
          expected: 10847,
          pass: Math.abs(vEscLEO - 10847) < 50
        },
        {
          name: '400km LEO Orbital Period ~92.5 minutes',
          computed: U.round(periodLEO, 1),
          expected: 92.5,
          pass: Math.abs(periodLEO - 92.5) < 1.0
        },
        {
          name: '400km LEO Gravity ~8.68 m/s²',
          computed: U.round(gLEO, 2),
          expected: 8.68,
          pass: Math.abs(gLEO - 8.68) < 0.1
        }
      ];

      return {
        allPassed: tests.every((t) => t.pass),
        results: tests
      };
    }
  }

  MM.physics = new PhysicsEngine();
  MM.PhysicsEngine = PhysicsEngine;
})();
