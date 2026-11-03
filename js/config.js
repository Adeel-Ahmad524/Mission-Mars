/* MissionMind 2.0 — Central Configuration & Astrophysical Constants */
(function () {
  'use strict';
  const MM = (window.MM = window.MM || {});

  const CONFIG = {
    VERSION: '2.0.0',
    NAME: 'MissionMind 2.0',
    CODENAME: 'Ares Multi-Agent Autonomous Command',

    // Astrophysical & Fundamental Constants (SI Units)
    PHYSICS: {
      G: 6.6743e-11,            // Gravitational constant (N·m²/kg²)
      G0: 9.80665,              // Standard sea-level acceleration of gravity (m/s²)
      SOLAR_IRRADIANCE_1AU: 1361.0, // Solar constant at 1 AU (W/m²)
      AU: 1.495978707e11,       // Astronomical Unit (m)
      SPEED_OF_LIGHT: 299792458,// m/s
      DAY_SECONDS: 86400
    },

    // Central Celestial Bodies
    BODIES: {
      earth: {
        id: 'earth',
        name: 'Earth',
        mass: 5.9722e24,        // kg
        radius: 6.371e6,        // m
        color: '#38bdf8',
        atmosphereRadius: 6.471e6, // 100km Karman line
        defaultOrbitRadius: 6.771e6, // 400km LEO (ISS altitude)
        surfaceGravity: 9.807,  // m/s²
        description: 'Primary terrestrial reference body with dense atmosphere and strong magnetosphere.'
      },
      moon: {
        id: 'moon',
        name: 'Moon',
        mass: 7.342e22,         // kg
        radius: 1.7374e6,       // m
        color: '#cbd5e1',
        atmosphereRadius: 1.7374e6,
        defaultOrbitRadius: 1.8374e6, // 100km Low Lunar Orbit
        surfaceGravity: 1.62,   // m/s²
        description: 'Tidally locked lunar satellite with zero atmosphere and deep gravitational mass concentrations.'
      },
      mars: {
        id: 'mars',
        name: 'Mars',
        mass: 6.4171e23,        // kg
        radius: 3.3895e6,       // m
        color: '#f97316',
        atmosphereRadius: 3.4395e6,
        defaultOrbitRadius: 3.7895e6, // 400km Low Mars Orbit
        surfaceGravity: 3.72,   // m/s²
        description: 'Red planet destination with thin CO2 atmosphere and pronounced orbital eccentricity.'
      },
      sun: {
        id: 'sun',
        name: 'Sun',
        mass: 1.98847e30,       // kg
        radius: 6.9634e8,       // m
        color: '#fbbf24',
        atmosphereRadius: 7.000e8,
        defaultOrbitRadius: 1.495978707e11, // 1 AU heliocentric orbit
        surfaceGravity: 274.0,  // m/s²
        description: 'Heliocentric central star providing primary solar flux and system gravitational well.'
      }
    },

    // Spacecraft Architecture & Mass Specifications
    SPACECRAFT: {
      defaultDryMass: 8500,     // kg (hull, avionics, structural frames)
      defaultPayloadMass: 1500, // kg (scientific instruments, crew supplies)
      maxFuelCapacity: 15000,   // kg
      initialFuelMass: 12500,   // kg
      momentsOfInertia: { Ixx: 12000, Iyy: 15000, Izz: 18000 }, // kg·m²
      dimensions: { length: 12.5, width: 4.8, height: 4.2 }     // meters
    },

    // Thruster Subsystem (Chemical vs Solar-Electric)
    PROPULSION: {
      chemical: {
        name: 'Chemical Bi-Propellant (MMH/NTO)',
        maxThrustN: 5000,       // N per axis at 100%
        ispSeconds: 320,        // Specific Impulse (s)
        electricalDrawWatts: 0, // No high electrical draw
        minTempC: 15,
        maxTempC: 380,
        tempRiseRate: 0.28,     // °C per % thrust per sec
        coolingRate: 0.08       // °C per sec radiative cool
      },
      solarElectric: {
        name: 'Solar-Electric Hall Effect Thruster',
        maxThrustN: 250,        // N per axis at 100% (high efficiency, low thrust)
        ispSeconds: 3100,       // Specific Impulse (s)
        electricalDrawWatts: 1500, // Watts per 100% thrust axis (up to 4500W for 3 axes)
        minTempC: 20,
        maxTempC: 260,
        tempRiseRate: 0.14,
        coolingRate: 0.12
      }
    },

    // Solar Generation & Energy Storage
    ENERGY: {
      panelArea: 28.0,          // m² effective photovoltaic area
      panelEfficiency: 0.32,    // 32% high-efficiency multi-junction space cells
      deployDurationSec: 4.0,   // time to fully deploy or retract
      batteryCapacityWh: 60000, // 60 kWh space-rated Li-ion battery pack
      baseAvionicsLoadW: 1100,  // Standby flight computer, telemetry, sensor power
      lifeSupportLoadW: 800,    // Thermal loops, atmosphere regulation
      scienceLoadW: 650,        // Active science payload consumption
      maxChargeRateW: 8500      // Max battery charge absorption rate
    },

    // Radar System Specifications
    RADAR: {
      supportedRangesKm: [25, 50, 150, 500],
      defaultRangeKm: 50,
      sweepRpm: 24,             // Rotations per minute
      proximityThresholds: {
        redDistanceKm: 2.5,     // Collision warning boundary
        redTimeSec: 180,        // Within 3 minutes to closest approach
        yellowDistanceKm: 12.0, // Tracking warning boundary
        yellowTimeSec: 360      // Within 6 minutes
      }
    },

    // Default Keybindings
    KEYBINDINGS: {
      forward: 'KeyW',
      reverse: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      up: 'KeyR',
      down: 'KeyF',
      rotateLeft: 'KeyQ',
      rotateRight: 'KeyE',
      emergencyShutdown: 'Space'
    },

    // 9 Autonomous AI Agents Definition
    AGENTS: [
      { id: 'commander', name: 'Commander Agent', role: 'Mission Coordination & Final Decision Authority', code: 'CMD' },
      { id: 'navigation', name: 'Navigation Agent', role: 'Orbital Mechanics & Trajectory Calculations', code: 'NAV' },
      { id: 'fuel', name: 'Fuel Management Agent', role: 'Propellant Inventory, Flow & Mass Accounting', code: 'FUEL' },
      { id: 'risk', name: 'Risk Assessment Agent', role: 'Mission Safety Index & Cascading Failure Detection', code: 'RISK' },
      { id: 'systems', name: 'Systems & Life Support Agent', role: 'Cabin Environment, Power Grid & Hull Integrity', code: 'SYS' },
      { id: 'science', name: 'Science Agent', role: 'Scientific Payloads, Spectroscopy & Solar Observations', code: 'SCI' },
      { id: 'energy', name: 'Energy Transition Agent', role: 'Chemical vs Solar-Electric Propulsion Transition', code: 'ENGY' },
      { id: 'proximity', name: 'Proximity Detection Agent', role: 'Radar Track Analysis, Collision Avoidance & TCA', code: 'PROX' },
      { id: 'propulsion', name: 'Propulsion Control Agent', role: '3-Axis Thruster Balancing, Thermal Protection & F=ma', code: 'PROP' }
    ]
  };

  MM.CONFIG = Object.freeze(CONFIG);
})();
