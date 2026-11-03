/* MissionMind — physics engine (SI units) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;

  const CONST = {
    G: 6.6743e-11,                 // N·m²/kg²
    M_SUN: 1.98847e30,             // kg
    M_EARTH: 5.9722e24,            // kg
    M_MARS: 6.4171e23,             // kg
    R_EARTH: 6.371e6,              // m
    R_MARS: 3.3895e6,              // m
    AU: 1.495978707e11,            // m
    R_EARTH_ORBIT: 1.495978707e11, // m (1 AU, idealised circular)
    R_MARS_ORBIT: 1.523679 * 1.495978707e11 // m (idealised circular)
  };

  const DAY = 86400;

  /** Newton's law of universal gravitation: F = GMm / r² (N). */
  function gravitationalForce(M, m, r) {
    if (!(r > 0)) throw new Error('Distance r must be greater than zero.');
    return (CONST.G * M * m) / (r * r);
  }

  /** Circular orbital velocity: v = √(GM/r) (m/s). */
  function circularOrbitalVelocity(M, r) {
    if (!(r > 0)) throw new Error('Orbital radius r must be greater than zero.');
    return Math.sqrt((CONST.G * M) / r);
  }

  /** Orbital period: T = 2π√(r³/GM) (seconds). */
  function orbitalPeriod(M, r) {
    if (!(r > 0)) throw new Error('Orbital radius r must be greater than zero.');
    return 2 * Math.PI * Math.sqrt(Math.pow(r, 3) / (CONST.G * M));
  }

  /** Escape velocity: v_esc = √(2GM/r) (m/s). */
  function escapeVelocity(M, r) {
    return Math.sqrt((2 * CONST.G * M) / r);
  }

  /** Surface gravity: g = GM/R² (m/s²). */
  function surfaceGravity(M, R) {
    return (CONST.G * M) / (R * R);
  }

  /** Euclidean distance for 2D visual positions. */
  function distance2D(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /**
   * Idealised Hohmann transfer between circular coplanar orbits.
   * Returns semi-major axis (m), transfer time (s), and both burns (m/s).
   */
  function hohmannTransfer(r1, r2, M) {
    const central = M || CONST.M_SUN;
    if (!(r1 > 0) || !(r2 > r1)) throw new Error('Hohmann transfer requires 0 < r1 < r2.');
    const a = (r1 + r2) / 2;
    const mu = CONST.G * central;
    const v1 = Math.sqrt(mu / r1);
    const v2 = Math.sqrt(mu / r2);
    const vPeri = Math.sqrt(mu * ((2 / r1) - (1 / a)));
    const vApo = Math.sqrt(mu * ((2 / r2) - (1 / a)));
    return {
      semiMajorAxis: a,
      timeSeconds: Math.PI * Math.sqrt(Math.pow(a, 3) / mu),
      timeDays: (Math.PI * Math.sqrt(Math.pow(a, 3) / mu)) / DAY,
      v1,
      v2,
      vPerihelion: vPeri,
      vaphelion: vApo,
      deltaV1: vPeri - v1,
      deltaV2: v2 - vApo,
      totalDeltaV: (vPeri - v1) + (v2 - vApo)
    };
  }

  function round(value, digits) {
    return U.round(value, digits === undefined ? 2 : digits);
  }

  /**
   * Physics validation against published reference values.
   * Each result exposes computed value, reference, tolerance and pass/fail.
   */
  function selfTest() {
    const earthV = circularOrbitalVelocity(CONST.M_SUN, CONST.AU) / 1000;
    const earthPeriod = orbitalPeriod(CONST.M_SUN, CONST.AU) / DAY;
    const marsPeriod = orbitalPeriod(CONST.M_SUN, CONST.R_MARS_ORBIT) / DAY;
    const earthG = surfaceGravity(CONST.M_EARTH, CONST.R_EARTH);
    const earthEsc = escapeVelocity(CONST.M_EARTH, CONST.R_EARTH) / 1000;
    const marsG = surfaceGravity(CONST.M_MARS, CONST.R_MARS);
    const transfer = hohmannTransfer(CONST.R_EARTH_ORBIT, CONST.R_MARS_ORBIT, CONST.M_SUN);

    const results = [
      {
        name: 'Earth heliocentric circular velocity',
        computed: earthV,
        reference: 29.78,
        tolerance: 0.05,
        unit: 'km/s',
        equation: 'v = √(GM☉/r)',
        pass: Math.abs(earthV - 29.78) <= 0.05
      },
      {
        name: 'Earth orbital period',
        computed: earthPeriod,
        reference: 365.26,
        tolerance: 0.15,
        unit: 'days',
        equation: 'T = 2π√(r³/GM☉)',
        pass: Math.abs(earthPeriod - 365.26) <= 0.15
      },
      {
        name: 'Mars orbital period',
        computed: marsPeriod,
        reference: 687.0,
        tolerance: 1.5,
        unit: 'days',
        equation: 'T = 2π√(r³/GM☉)',
        pass: Math.abs(marsPeriod - 687.0) <= 1.5
      },
      {
        name: 'Earth surface gravity',
        computed: earthG,
        reference: 9.82,
        tolerance: 0.03,
        unit: 'm/s²',
        equation: 'g = GM⊕/R⊕²',
        pass: Math.abs(earthG - 9.82) <= 0.03
      },
      {
        name: 'Earth escape velocity',
        computed: earthEsc,
        reference: 11.19,
        tolerance: 0.03,
        unit: 'km/s',
        equation: 'v_esc = √(2GM⊕/R⊕)',
        pass: Math.abs(earthEsc - 11.19) <= 0.03
      },
      {
        name: 'Mars surface gravity',
        computed: marsG,
        reference: 3.73,
        tolerance: 0.03,
        unit: 'm/s²',
        equation: 'g = GM♂/R♂²',
        pass: Math.abs(marsG - 3.73) <= 0.03
      },
      {
        name: 'Earth→Mars Hohmann transfer time',
        computed: transfer.timeDays,
        reference: 258.8,
        tolerance: 2.0,
        unit: 'days',
        equation: 't = π√(a³/GM☉)',
        pass: Math.abs(transfer.timeDays - 258.8) <= 2.0
      },
      {
        name: 'Earth→Mars Hohmann total Δv',
        computed: transfer.totalDeltaV / 1000,
        reference: 5.6,
        tolerance: 0.12,
        unit: 'km/s',
        equation: 'Δv = |Δv₁| + |Δv₂|',
        pass: Math.abs(transfer.totalDeltaV / 1000 - 5.6) <= 0.12
      }
    ];

    results.forEach((r) => {
      r.computedDisplay = `${round(r.computed, 2)} ${r.unit}`;
      r.referenceDisplay = `${round(r.reference, 2)} ${r.unit}`;
      r.deltaDisplay = `${round(r.computed - r.reference, 3)}`;
    });

    return {
      results,
      passed: results.filter((r) => r.pass).length,
      total: results.length,
      allPassed: results.every((r) => r.pass),
      ranAt: U.nowISO()
    };
  }

  MM.physics = {
    CONST,
    DAY,
    gravitationalForce,
    circularOrbitalVelocity,
    orbitalPeriod,
    escapeVelocity,
    surfaceGravity,
    distance2D,
    hohmannTransfer,
    selfTest
  };
})();
