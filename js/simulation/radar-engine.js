/* MissionMind 2.0 — Radar & Obstacle Proximity Detection Engine */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  class RadarEngine {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.physics = MM.physics;

      this.currentRangeKm = CFG.RADAR.defaultRangeKm;
      this.sweepAngleDeg = 0;
      this.sweepActive = true;
      this.selectedObjectId = null;

      // Simulated space obstacles relative to spacecraft
      this.objects = [
        {
          id: 'deb-01',
          name: 'DEB-1998-067A',
          type: 'debris',
          label: 'Spent Rocket Upper Stage',
          pos: { x: 18200, y: 14500, z: -850 },     // meters relative to SC
          vel: { x: -45, y: -38, z: 2 },            // m/s relative
          sizeM: 8.4,
          rcsM2: 12.0
        },
        {
          id: 'ast-02',
          name: 'AST-2026-XP4',
          type: 'asteroid',
          label: 'Carbonaceous Asteroid Fragment',
          pos: { x: -28400, y: 31200, z: 1200 },
          vel: { x: 62, y: -74, z: -5 },
          sizeM: 14.2,
          rcsM2: 25.0
        },
        {
          id: 'sat-03',
          name: 'SAT-NAV-09X',
          type: 'spacecraft',
          label: 'Deep Space Relay Probe',
          pos: { x: 38500, y: -24100, z: 400 },
          vel: { x: -12, y: 15, z: 0 },
          sizeM: 3.5,
          rcsM2: 5.2
        },
        {
          id: 'unk-04',
          name: 'UNK-VECTOR-88',
          type: 'unknown',
          label: 'High-Eccentricity Interceptor',
          pos: { x: 12400, y: 9800, z: -150 },
          vel: { x: -75, y: -62, z: 1 },
          sizeM: 5.0,
          rcsM2: 7.8
        }
      ];

      this.overallThreatLevel = 'green';
    }

    setRange(rangeKm) {
      if (CFG.RADAR.supportedRangesKm.includes(Number(rangeKm))) {
        this.currentRangeKm = Number(rangeKm);
        MM.bus.emit('radar:range-changed', this.currentRangeKm);
      }
    }

    toggleSweep() {
      this.sweepActive = !this.sweepActive;
      return this.sweepActive;
    }

    selectObject(id) {
      this.selectedObjectId = this.selectedObjectId === id ? null : id;
      MM.bus.emit('radar:selection-changed', this.getSelectedObject());
    }

    getSelectedObject() {
      return this.objects.find((o) => o.id === this.selectedObjectId) || null;
    }

    /**
     * Propagate radar simulation and calculate closest approach metrics
     */
    step(dt) {
      if (dt <= 0) return;

      // Rotate sweep beam (24 RPM = 144 deg/sec)
      if (this.sweepActive) {
        this.sweepAngleDeg = (this.sweepAngleDeg + 144 * dt) % 360;
      }

      const thresh = CFG.RADAR.proximityThresholds;
      let worstThreat = 'green';

      this.objects.forEach((obj) => {
        // Propagate relative position: r = r + v * dt
        obj.pos.x += obj.vel.x * dt;
        obj.pos.y += obj.vel.y * dt;
        obj.pos.z += obj.vel.z * dt;

        // Current distance
        const distM = Math.hypot(obj.pos.x, obj.pos.y, obj.pos.z);
        obj.distanceM = distM;
        obj.distanceKm = distM / 1000;

        // Bearing angle in degrees (-180 to +180)
        obj.bearingDeg = (Math.atan2(obj.pos.y, obj.pos.x) * 180) / Math.PI;

        // Relative speed
        obj.relativeSpeedMs = Math.hypot(obj.vel.x, obj.vel.y, obj.vel.z);

        // Time of Closest Approach (TCA) and Miss Distance
        const tCA = this.physics.timeOfClosestApproach(obj.pos, obj.vel);
        obj.tcaSeconds = tCA;

        if (tCA > 0) {
          const dCA = this.physics.closestApproachDistance(obj.pos, obj.vel, tCA);
          obj.dcaKm = dCA / 1000;

          // Threat classification
          if (obj.dcaKm <= thresh.redDistanceKm && tCA <= thresh.redTimeSec) {
            obj.threat = 'red';
            worstThreat = 'critical';
          } else if (obj.dcaKm <= thresh.yellowDistanceKm && tCA <= thresh.yellowTimeSec) {
            obj.threat = 'yellow';
            if (worstThreat !== 'critical') worstThreat = 'warning';
          } else {
            obj.threat = 'green';
          }
        } else {
          // Object is opening range (diverging)
          obj.dcaKm = obj.distanceKm;
          obj.threat = 'green';
        }
      });

      this.overallThreatLevel = worstThreat === 'critical' ? 'red' : worstThreat === 'warning' ? 'yellow' : 'green';

      // Sync into mission state
      this.stateManager.update((s) => {
        s.radar = {
          rangeKm: this.currentRangeKm,
          sweepAngleDeg: this.sweepAngleDeg,
          sweepActive: this.sweepActive,
          threatLevel: this.overallThreatLevel,
          objects: this.objects.map((o) => ({
            id: o.id,
            name: o.name,
            type: o.type,
            label: o.label,
            pos: { ...o.pos },
            vel: { ...o.vel },
            distanceKm: U.round(o.distanceKm, 2),
            bearingDeg: U.round(o.bearingDeg, 1),
            relativeSpeedKms: U.round(o.relativeSpeedMs / 1000, 2),
            tcaSeconds: U.round(o.tcaSeconds, 1),
            dcaKm: U.round(o.dcaKm, 2),
            threat: o.threat
          })),
          selectedId: this.selectedObjectId
        };
      }, 'radar:update');
    }
  }

  MM.RadarEngine = RadarEngine;
})();
