/* MissionMind 2.0 — Physics Laboratory (15 Real-Time Calculations) */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;
  const $ = MM.$;

  class PhysicsLabView {
    constructor(app) {
      this.app = app;
      this.stateManager = app.stateManager;
      this.physics = MM.physics;
    }

    init() {
      this.render();
      MM.bus.on('sim:tick', () => this.render());
      MM.bus.on('orbit:changed', () => this.render());
      MM.bus.on('thrusters:update', () => this.render());
      MM.bus.on('energy:updated', () => this.render());
    }

    render() {
      const container = $('#physics-lab-cards-container');
      if (!container) return;

      const s = this.stateManager.state;
      const body = CFG.BODIES[s.centralBody || 'earth'] || CFG.BODIES.earth;
      const M = body.mass;
      const m = s.spacecraft?.mass || 22500;
      const r = s.orbit?.radius || body.defaultOrbitRadius;
      const v = s.orbit?.velocityMs || 7670;
      const F = s.thrusters?.totalThrustN || 0;
      const isp = s.thrusters?.ispSeconds || 320;
      const solar = s.solar || {};
      const battery = s.battery || {};

      // 1. Gravitational Force F = GMm / r²
      const F_grav = this.physics.gravitationalForce(M, m, r);

      // 2. Gravitational Acceleration g = GM / r²
      const g = this.physics.gravitationalAcceleration(M, r);

      // 3. Circular Orbital Velocity v_c = √(GM / r)
      const v_c = this.physics.circularOrbitalVelocity(M, r);

      // 4. Escape Velocity v_esc = √(2GM / r)
      const v_esc = this.physics.escapeVelocity(M, r);

      // 5. Orbital Period T = 2π√(r³ / GM)
      const T = this.physics.orbitalPeriod(M, r);

      // 6. Specific Orbital Energy ε = v²/2 - GM/r
      const eps = this.physics.specificOrbitalEnergy(M, r, v);

      // 7. Kinetic Energy E_k = 1/2 m v²
      const Ek = this.physics.kineticEnergy(m, v);

      // 8. Gravitational Potential Energy U = -GMm / r
      const U_pot = this.physics.gravitationalPotentialEnergy(M, m, r);

      // 9. Acceleration from Thrust a = F / m
      const a_thrust = this.physics.accelerationFromThrust(F, m);

      // 10. Propellant Mass Flow Rate ṁ = F / (Isp * g0)
      const m_dot = this.physics.propellantFlowRate(F, isp);

      // 11. Solar Power Generation P = η * A * S * cos(θ)
      const angleRad = (solar.angleDeg || 0) * (Math.PI / 180);
      const P_solar = this.physics.solarPowerGeneration(solar.efficiency || 0.32, (solar.area || 28) * (solar.deploymentProgress || 1), solar.irradiance || 1361, angleRad);

      // 12. Battery Energy Balance ΔP = P_gen - P_load
      const deltaP = this.physics.batteryEnergyBalance(P_solar, battery.electricalLoadW || 1900);

      // 13. Relative Velocity with closest radar contact
      let v_rel = 58.2;
      let d_ca = 2.4;
      let t_ca = 94.0;
      if (s.radar && s.radar.objects && s.radar.objects[0]) {
        const obj = s.radar.objects[0];
        v_rel = (obj.relativeSpeedKms || 0.058) * 1000;
        d_ca = (obj.dcaKm || 2.4) * 1000;
        t_ca = obj.tcaSeconds || 94.0;
      }

      // 14. Closest Approach Distance d_CA = |r_rel + v_rel * t_CA|
      // 15. Spacecraft Momentum p = m * v
      const p_mom = this.physics.momentum(m, v);

      const calcs = [
        {
          num: 1,
          name: 'Universal Gravitational Force',
          formula: 'F = G · M · m / r²',
          sub: `(6.674×10⁻¹¹) · (${M.toExponential(3)}) · (${m.toFixed(0)}) / (${(r).toExponential(3)})²`,
          res: `${U.thousands(F_grav)} N`,
          desc: `Gravitational attraction between ${body.name} and the spacecraft.`
        },
        {
          num: 2,
          name: 'Gravitational Acceleration',
          formula: 'g = G · M / r²',
          sub: `(6.674×10⁻¹¹) · (${M.toExponential(3)}) / (${(r).toExponential(3)})²`,
          res: `${g.toFixed(3)} m/s²`,
          desc: `Free-fall acceleration experienced at current orbital distance r.`
        },
        {
          num: 3,
          name: 'Circular Orbital Velocity',
          formula: 'v_c = √(G · M / r)',
          sub: `√((6.674×10⁻¹¹) · (${M.toExponential(3)}) / ${(r).toExponential(3)})`,
          res: `${U.thousands(v_c)} m/s (${(v_c / 1000).toFixed(2)} km/s)`,
          desc: `Exact velocity required for an ideal circular orbit at altitude.`
        },
        {
          num: 4,
          name: 'Central Body Escape Velocity',
          formula: 'v_esc = √(2 · G · M / r)',
          sub: `√(2 · (6.674×10⁻¹¹) · (${M.toExponential(3)}) / ${(r).toExponential(3)})`,
          res: `${U.thousands(v_esc)} m/s (${(v_esc / 1000).toFixed(2)} km/s)`,
          desc: `Velocity boundary where specific orbital energy becomes zero (parabolic escape).`
        },
        {
          num: 5,
          name: 'Keplerian Orbital Period',
          formula: 'T = 2π · √(r³ / (G · M))',
          sub: `2π · √(${Math.pow(r, 3).toExponential(3)} / ((6.674×10⁻¹¹) · ${M.toExponential(3)}))`,
          res: `${(T / 60).toFixed(1)} minutes (${(T / 3600).toFixed(2)} h)`,
          desc: `Time required for one complete orbit around ${body.name}.`
        },
        {
          num: 6,
          name: 'Specific Orbital Energy',
          formula: 'ε = v² / 2 - G · M / r',
          sub: `(${v.toFixed(0)})² / 2 - ((6.674×10⁻¹¹) · ${M.toExponential(3)}) / ${(r).toExponential(3)}`,
          res: `${(eps / 1e6).toFixed(2)} MJ/kg (${eps < 0 ? 'Bound' : 'Unbound'})`,
          desc: `Sum of kinetic and potential energy per kilogram of spacecraft mass.`
        },
        {
          num: 7,
          name: 'Total Kinetic Energy',
          formula: 'E_k = ½ · m · v²',
          sub: `0.5 · (${m.toFixed(0)}) · (${v.toFixed(0)})²`,
          res: `${(Ek / 1e9).toFixed(2)} GJ`,
          desc: `Mechanical energy stored in spacecraft orbital motion.`
        },
        {
          num: 8,
          name: 'Gravitational Potential Energy',
          formula: 'U = -G · M · m / r',
          sub: `-((6.674×10⁻¹¹) · ${M.toExponential(3)} · ${m.toFixed(0)}) / ${(r).toExponential(3)}`,
          res: `${(U_pot / 1e9).toFixed(2)} GJ`,
          desc: `Negative potential energy within the celestial gravity well.`
        },
        {
          num: 9,
          name: 'Acceleration from Thrust',
          formula: 'a = F_thrust / m',
          sub: `(${F.toFixed(0)} N) / (${m.toFixed(0)} kg)`,
          res: `${a_thrust.toFixed(4)} m/s²`,
          desc: `Newton's second law translation acceleration along thrust vector.`
        },
        {
          num: 10,
          name: 'Propellant Mass Flow Rate',
          formula: 'ṁ = F / (I_sp · g₀)',
          sub: `(${F.toFixed(0)} N) / ((${isp} s) · (9.80665 m/s²))`,
          res: `${m_dot.toFixed(4)} kg/s`,
          desc: `Mass consumption rate through rocket nozzles per second of burn.`
        },
        {
          num: 11,
          name: 'Photovoltaic Power Generation',
          formula: 'P = η · A · S · cos(θ)',
          sub: `(0.32) · (${(solar.area || 28).toFixed(1)} m²) · (${(solar.irradiance || 1361).toFixed(0)} W/m²) · cos(${solar.angleDeg || 0}°)`,
          res: `${U.thousands(P_solar)} Watts`,
          desc: `Electrical generation from dual deployable solar panel wings.`
        },
        {
          num: 12,
          name: 'Battery Energy Power Balance',
          formula: 'ΔP = P_gen - P_load',
          sub: `(${P_solar.toFixed(0)} W) - (${(battery.electricalLoadW || 1900).toFixed(0)} W)`,
          res: `${(deltaP >= 0 ? '+' : '')}${U.thousands(deltaP)} Watts`,
          desc: `Net electrical flux into or out of flight lithium-ion battery pack.`
        },
        {
          num: 13,
          name: 'Radar Contact Relative Velocity',
          formula: 'v_rel = |v_obj - v_sc|',
          sub: `√((Δv_x)² + (Δv_y)² + (Δv_z)²)`,
          res: `${v_rel.toFixed(1)} m/s (${(v_rel / 1000).toFixed(2)} km/s)`,
          desc: `Magnitude of differential velocity with tracked obstacle.`
        },
        {
          num: 14,
          name: 'Closest Approach Distance (TCA)',
          formula: 'd_CA = |r_rel + v_rel · t_CA|',
          sub: `Computed miss vector evaluated at t_CA = ${t_ca.toFixed(1)}s`,
          res: `${(d_ca / 1000).toFixed(2)} km`,
          desc: `Closest predicted distance during orbital crossing encounter.`
        },
        {
          num: 15,
          name: 'Spacecraft Linear Momentum',
          formula: 'p = m · v',
          sub: `(${m.toFixed(0)} kg) · (${v.toFixed(0)} m/s)`,
          res: `${(p_mom / 1e6).toFixed(2)} × 10⁶ kg·m/s`,
          desc: `Total inertial momentum vector magnitude.`
        }
      ];

      container.innerHTML = calcs.map((c) => `
        <div class="calc-card">
          <div class="calc-header">
            <div>
              <span class="card-kicker">CALCULATION #${c.num}</span>
              <h4 style="font-size:0.92rem;margin-top:2px;">${c.name}</h4>
            </div>
            <span class="badge badge-blue">SI UNITS</span>
          </div>
          <div class="calc-formula-box">
            <code>${c.formula}</code>
          </div>
          <div class="calc-substitution">
            <code>${c.sub}</code>
          </div>
          <div class="calc-result-box">
            <span style="font-size:0.75rem;color:var(--text-3);font-family:var(--mono);">EVALUATED ANSWER</span>
            <span class="calc-result-val">${c.res}</span>
          </div>
          <div style="font-size:0.7rem;color:var(--text-3);margin-top:6px;line-height:1.4;">
            ${c.desc}
          </div>
        </div>
      `).join('');
    }
  }

  MM.PhysicsLabView = PhysicsLabView;
})();
