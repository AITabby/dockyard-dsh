function normalizedMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function cleanIds(value) {
  return value
    .map((m) => (typeof m === "string" ? m.trim() : ""))
    .filter(Boolean);
}

function cleanState(value) {
  const providers = {};
  for (const [providerId, record] of Object.entries(normalizedMap(value?.providers))) {
    const id = typeof providerId === "string" ? providerId.trim() : null;
    if (!id) continue;
    const accounts = {};
    for (const [accountId, accountRecord] of Object.entries(normalizedMap(record?.accounts))) {
      const scoped = typeof accountId === "string" ? accountId.trim() : "";
      if (!scoped || !Array.isArray(accountRecord?.enabled)) continue;
      accounts[scoped] = {
        enabled: cleanIds(accountRecord.enabled),
        updatedAt: accountRecord.updatedAt ?? new Date().toISOString(),
      };
    }
    const hasAccounts = Object.keys(accounts).length > 0;
    if (!Array.isArray(record?.enabled) && !hasAccounts) continue;
    providers[id] = {
      ...(Array.isArray(record?.enabled) ? { enabled: cleanIds(record.enabled) } : {}),
      ...(hasAccounts ? { accounts } : {}),
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    };
  }
  return { schema: 1, providers };
}

/**
 * Reconcile a saved selection against the catalog the provider currently
 * serves. A saved id can disappear when the account's picker changes or a
 * model is retired; filtering the directory by such an id would leave the
 * provider with no selectable models at all. Survivors are kept, an explicit
 * empty selection stays empty, and a selection whose ids are all gone falls
 * back to "everything" so the provider keeps working.
 */
export function reconcileModelSelection(enabledModelIds, models) {
  if (!Array.isArray(enabledModelIds)) return null;
  if (enabledModelIds.length === 0) return [];
  const available = new Set(
    (Array.isArray(models) ? models : [])
      .map((model) => (typeof model?.id === "string" ? model.id : null))
      .filter(Boolean),
  );
  // An empty catalog means discovery failed, not that every model vanished.
  if (available.size === 0) return enabledModelIds;
  const kept = enabledModelIds.filter((id) => available.has(id));
  return kept.length > 0 ? kept : null;
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

  /**
   * A provider can serve a different model list per account, so a selection can
   * be stored per account. Without an account (or before one was ever saved for
   * that account) the provider-wide selection is the fallback, which keeps the
   * pre-existing single-list behaviour working.
   */
  get(providerId, accountId = null) {
    if (!providerId) return null;
    const record = this.state.providers?.[providerId];
    if (!record) return null;
    if (accountId && Array.isArray(record.accounts?.[accountId]?.enabled)) {
      return [...record.accounts[accountId].enabled];
    }
    if (!Array.isArray(record.enabled)) return null;
    return [...record.enabled];
  }

  async set(providerId, enabledModelIds, accountId = null) {
    if (!providerId) throw new Error("providerId is required");
    await this.ready();

    const cleaned = Array.isArray(enabledModelIds) ? cleanIds(enabledModelIds) : null;

    if (!this.state.providers) this.state.providers = {};

    if (accountId) {
      const record = this.state.providers[providerId] ?? {};
      const accounts = { ...(record.accounts ?? {}) };
      if (cleaned === null) {
        delete accounts[accountId];
      } else {
        accounts[accountId] = { enabled: cleaned, updatedAt: new Date().toISOString() };
      }
      const next = {
        ...record,
        ...(Object.keys(accounts).length > 0 ? { accounts } : {}),
        updatedAt: new Date().toISOString(),
      };
      if (!Array.isArray(next.enabled) && !next.accounts) delete this.state.providers[providerId];
      else this.state.providers[providerId] = next;
    } else if (cleaned === null) {
      const record = this.state.providers[providerId];
      if (record?.accounts) {
        // Keep per-account selections; only the provider-wide default is reset.
        delete record.enabled;
        record.updatedAt = new Date().toISOString();
      } else {
        delete this.state.providers[providerId];
      }
    } else {
      const record = this.state.providers[providerId] ?? {};
      this.state.providers[providerId] = {
        ...record,
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
