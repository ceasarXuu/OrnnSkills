/**
 * LiteLLM Catalog Loader
 *
 * Load provider/model catalog from LiteLLM official model registry.
 * Source of truth:
 * https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json
 */

import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("litellm-catalog");

const LITELLM_MODEL_REGISTRY_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface LiteLLMModelMeta {
  litellm_provider?: string;
}

interface CatalogEntry {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  apiKeyEnvVar: string;
}

let cachedAt = 0;
let cachedCatalog: CatalogEntry[] = [];

function providerToEnvVar(providerId: string): string {
  return `${providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
}

function buildCatalogFromRegistry(
  registry: Record<string, LiteLLMModelMeta>
): CatalogEntry[] {
  const map = new Map<string, Set<string>>();

  for (const [modelName, meta] of Object.entries(registry)) {
    if (!modelName || modelName.startsWith("sample_spec")) continue;
    const provider =
      (meta.litellm_provider && String(meta.litellm_provider).trim()) ||
      (modelName.includes("/") ? modelName.split("/")[0] : "");
    if (!provider) continue;
    if (!map.has(provider)) map.set(provider, new Set<string>());
    map.get(provider)?.add(modelName);
  }

  return [...map.entries()]
    .map(([provider, modelsSet]) => {
      const models = [...modelsSet].sort();
      return {
        id: provider,
        name: provider,
        models,
        defaultModel: models[0] || "",
        apiKeyEnvVar: providerToEnvVar(provider),
      };
    })
    .filter((entry) => entry.models.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function getLiteLLMCatalog(forceRefresh = false): Promise<CatalogEntry[]> {
  const now = Date.now();
  if (!forceRefresh && cachedCatalog.length > 0 && now - cachedAt < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  const response = await fetch(LITELLM_MODEL_REGISTRY_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`LiteLLM catalog fetch failed: HTTP ${response.status}`);
  }

  const body = (await response.json()) as Record<string, LiteLLMModelMeta>;
  const catalog = buildCatalogFromRegistry(body);
  if (catalog.length === 0) {
    throw new Error("LiteLLM catalog parse failed: empty provider list");
  }

  cachedCatalog = catalog;
  cachedAt = now;
  logger.info("LiteLLM catalog refreshed", {
    providerCount: catalog.length,
    modelCount: catalog.reduce((acc, item) => acc + item.models.length, 0),
  });
  return catalog;
}

