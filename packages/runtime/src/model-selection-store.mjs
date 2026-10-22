function normalizedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function cleanState(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap(value?.providers))) {
    const id = typeof providerId === "string" ? providerId.trim() : null;
    if (!id) continue;
    if (Array.isArray(record?.enabled)) {
      const enabled = record.enabled
        .map((m) => (typeof m === "string" ? m.trim() : ""))
        .filter(Boolean);
      providers[id] = { enabled, updatedAt: record.updatedAt ?? new Date().toISOString() };
    }
  }
  return { schema: 1, providers };
}

export class ModelSelectionStore {
  stateStore;
  state = { schema: 1, providers: {} };
  readyPromise;

  constructor({ stateStore } = {}) {
    if (!stateStore || typeof stateStore.load !== "function"
      || (typeof stateStore.update !== "function" && typeof stateStore.save !== "function")) {
      throw new TypeError("ModelSelectionStore requires a state store");
    }
    this.stateStore = stateStore;
    this.readyPromise = this.load();
  }

  async load() {
    const snapshot = await this.stateStore.load();
    const raw = snapshot?.modelSelection;
    if (raw && typeof raw === "object") {
      this.state = cleanState(raw);
    }
    return this.state;
  }

  async ready() {
    return this.readyPromise;
  }

  get(providerId) {
    if (!providerId) return null;
    const record = this.state.providers?.[providerId];
    if (!record || !Array.isArray(record.enabled)) return null;
    return [...record.enabled];
  }

  async set(providerId, enabledModelIds) {
    if (!providerId) throw new Error("providerId is required");
    await this.ready();

    const cleaned = Array.isArray(enabledModelIds)
      ? enabledModelIds.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean)
      : null;

    if (!this.state.providers) this.state.providers = {};

    if (cleaned === null) {
      delete this.state.providers[providerId];
    } else {
      this.state.providers[providerId] = {
        enabled: cleaned,
        updatedAt: new Date().toISOString(),
      };
    }

    const saved = structuredClone(this.state);
    if (typeof this.stateStore.update === "function") {
      await this.stateStore.update((latest) => ({
        ...latest,
        modelSelection: saved,
      }));
    } else {
      const latest = await this.stateStore.load();
      await this.stateStore.save({
        ...latest,
        modelSelection: saved,
      });
    }

    return cleaned;
  }

  isModelEnabled(providerId, modelId) {
    const enabled = this.get(providerId);
    if (enabled === null) return true;
    return enabled.includes(modelId);
  }

  filterModels(providerId, models = []) {
    const enabled = this.get(providerId);
    if (enabled === null) return models;
    const set = new Set(enabled);
    return models.filter((model) => set.has(model.id));
  }
}
