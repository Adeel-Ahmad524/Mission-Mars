/* MissionMind 2.0 — Control Authority & Keyboard Input Manager */
(function () {
  'use strict';
  const MM = window.MM;
  const U = MM.U;
  const CFG = MM.CONFIG;

  class ControlManager {
    constructor(stateManager) {
      this.stateManager = stateManager;
      this.mode = 'manual'; // 'manual' | 'autonomous' | 'hybrid'

      // Subsystem authorities in hybrid mode (true = user authority, false = agent authority)
      this.hybridAuthority = {
        thrusters: true,
        orientation: true,
        solar: false,
        navigation: false
      };

      // Keybindings mapping
      this.bindings = { ...CFG.KEYBINDINGS };
      this.activeKeys = new Set();
      this.isBound = false;

      this.init();
    }

    init() {
      if (this.isBound) return;
      this.isBound = true;

      window.addEventListener('keydown', (e) => this.handleKeyDown(e));
      window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    setMode(newMode) {
      if (!['manual', 'autonomous', 'hybrid'].includes(newMode)) return false;
      this.mode = newMode;

      this.stateManager.update((s) => {
        s.controlMode = newMode;
        s.hybridAuthority = { ...this.hybridAuthority };
      }, 'control:mode-change');

      const label = newMode.toUpperCase();
      this.stateManager.addLog('systems', `Control Mode: ${label}`, `Flight authority mode set to ${label}.`, { severity: 'info' });
      MM.bus.emit('control:mode-changed', { mode: newMode, authority: this.hybridAuthority });
      MM.bus.emit('toast', { type: 'info', title: 'Flight Control', message: `Control mode set to ${label}` });
      return true;
    }

    setHybridAuthority(subsystem, isUserControlled) {
      if (this.hybridAuthority[subsystem] === undefined) return;
      this.hybridAuthority[subsystem] = Boolean(isUserControlled);

      this.stateManager.update((s) => {
        s.hybridAuthority = { ...this.hybridAuthority };
      }, 'control:hybrid-authority');

      MM.bus.emit('control:hybrid-updated', this.hybridAuthority);
    }

    canUserControl(subsystem) {
      if (this.mode === 'manual') return true;
      if (this.mode === 'autonomous') return false;
      if (this.mode === 'hybrid') return Boolean(this.hybridAuthority[subsystem]);
      return false;
    }

    canAgentControl(subsystem) {
      if (this.mode === 'autonomous') return true;
      if (this.mode === 'manual') return false;
      if (this.mode === 'hybrid') return !this.hybridAuthority[subsystem];
      return false;
    }

    handleKeyDown(e) {
      // Ignore if focus is in an input or select
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const code = e.code;
      this.activeKeys.add(code);

      // Emergency cutoff is always enabled in any mode!
      if (code === this.bindings.emergencyShutdown) {
        e.preventDefault();
        if (MM.app && MM.app.spacecraftEngine) {
          MM.app.spacecraftEngine.emergencyShutdown();
        }
        return;
      }

      // If user has authority over thrusters:
      if (this.canUserControl('thrusters') && MM.app && MM.app.spacecraftEngine) {
        const sc = MM.app.spacecraftEngine;
        if (code === this.bindings.forward) {
          e.preventDefault();
          sc.setThrusterCommand('x', 60);
        } else if (code === this.bindings.reverse) {
          e.preventDefault();
          sc.setThrusterCommand('x', -60);
        } else if (code === this.bindings.left) {
          e.preventDefault();
          sc.setThrusterCommand('y', 60);
        } else if (code === this.bindings.right) {
          e.preventDefault();
          sc.setThrusterCommand('y', -60);
        } else if (code === this.bindings.up) {
          e.preventDefault();
          sc.setThrusterCommand('z', 60);
        } else if (code === this.bindings.down) {
          e.preventDefault();
          sc.setThrusterCommand('z', -60);
        }
      }

      // If user has authority over orientation:
      if (this.canUserControl('orientation') && MM.app && MM.app.spacecraftEngine) {
        const sc = MM.app.spacecraftEngine;
        if (code === this.bindings.rotateLeft) {
          e.preventDefault();
          sc.adjustOrientation(0, -3, -3);
        } else if (code === this.bindings.rotateRight) {
          e.preventDefault();
          sc.adjustOrientation(0, 3, 3);
        }
      }
    }

    handleKeyUp(e) {
      const code = e.code;
      this.activeKeys.delete(code);

      // Releasing translation key resets corresponding thruster to 0
      if (this.canUserControl('thrusters') && MM.app && MM.app.spacecraftEngine) {
        const sc = MM.app.spacecraftEngine;
        if (code === this.bindings.forward || code === this.bindings.reverse) {
          sc.setThrusterCommand('x', 0);
        } else if (code === this.bindings.left || code === this.bindings.right) {
          sc.setThrusterCommand('y', 0);
        } else if (code === this.bindings.up || code === this.bindings.down) {
          sc.setThrusterCommand('z', 0);
        }
      }
    }

    updateBinding(actionKey, newKeyCode) {
      if (this.bindings[actionKey] !== undefined) {
        this.bindings[actionKey] = newKeyCode;
        MM.bus.emit('control:bindings-updated', this.bindings);
        return true;
      }
      return false;
    }
  }

  MM.ControlManager = ControlManager;
})();
