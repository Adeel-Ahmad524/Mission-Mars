/* MissionMind — shared message bus and structured agent messaging */
(function () {
  'use strict';
  const MM = window.MM;

  const STATUSES = ['idle', 'monitoring', 'analysing', 'warning', 'critical', 'completed'];

  class MessageBus {
    constructor() {
      this.topics = new Map();
      this.messages = [];
      this.reportCount = 0;
    }

    on(topic, handler) {
      if (typeof handler !== 'function') return () => {};
      if (!this.topics.has(topic)) this.topics.set(topic, new Set());
      this.topics.get(topic).add(handler);
      return () => this.off(topic, handler);
    }

    off(topic, handler) {
      const set = this.topics.get(topic);
      if (set) set.delete(handler);
    }

    emit(topic, payload) {
      const handlers = this.topics.get(topic);
      if (handlers) {
        handlers.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error(`[MissionMind] Listener failed for "${topic}"`, err);
            this.emit('system:error', { message: err.message, topic });
          }
        });
      }
      if (topic === 'agent:report') this.reportCount += 1;
      this.messages.push({ topic, payload, at: Date.now() });
      if (this.messages.length > 400) this.messages.splice(0, this.messages.length - 400);
    }

    /**
     * Publish an agent report in the standard protocol format.
     * Validates required fields and normalises status / confidence.
     */
    publishReport(report) {
      const required = ['agentId', 'agentName', 'status', 'observation', 'recommendation', 'confidence'];
      const missing = required.filter((key) => report[key] === undefined || report[key] === null || report[key] === '');
      if (missing.length) {
        throw new Error(`Invalid agent report from ${report.agentId || 'unknown'}: missing ${missing.join(', ')}`);
      }
      if (!STATUSES.includes(report.status)) {
        throw new Error(`Invalid agent status "${report.status}"`);
      }
      const normalised = {
        ...report,
        confidence: MM.U.clamp(Number(report.confidence), 0, 1),
        timestamp: report.timestamp || MM.U.missionTime(report.missionDay || 0),
        relatedEvent: report.relatedEvent || null
      };
      this.emit('agent:report', normalised);
      return normalised;
    }

    recentReports(limit = 20) {
      return this.messages
        .filter((m) => m.topic === 'agent:report')
        .slice(-limit)
        .map((m) => m.payload)
        .reverse();
    }

    clear() {
      this.messages = [];
      this.reportCount = 0;
    }
  }

  MM.MessageBus = MessageBus;
  MM.AGENT_STATUSES = STATUSES;
  MM.bus = new MessageBus();
})();
