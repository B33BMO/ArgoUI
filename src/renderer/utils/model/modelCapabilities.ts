/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider, ModelType } from '@/common/config/storage';
import { CAPABILITY_PATTERNS, CAPABILITY_EXCLUSIONS, getBaseModelName } from '@/common/utils/modelCapabilities';

export { hasSpecificModelCapability } from '@/common/utils/modelCapabilities';

const modelCapabilitiesCache = new Map<string, boolean | undefined>();

/**
 * provider
 */
const PROVIDER_CAPABILITY_RULES: Record<string, Record<ModelType, boolean | null>> = {
  anthropic: {
    text: true,
    vision: true,
    function_calling: true,
    image_generation: false,
    web_search: false,
    reasoning: false,
    embedding: false,
    rerank: false,
    excludeFromPrimary: false,
  },
  deepseek: {
    text: true,
    vision: null,
    function_calling: true,
    image_generation: false,
    web_search: false,
    reasoning: null,
    embedding: false,
    rerank: false,
    excludeFromPrimary: false,
  },
};

/**
 * @param model
 * @param type
 * @returns true/false undefined
 */
const getUserSelectedCapability = (model: IProvider, type: ModelType): boolean | undefined => {
  const capability = model.capabilities?.find((cap) => cap.type === type);
  return capability?.isUserSelected;
};

/**
 * provider
 * @param provider
 * @param type
 * @returns true/false/null
 */
const getProviderCapabilityRule = (provider: string, type: ModelType): boolean | null => {
  const rules = PROVIDER_CAPABILITY_RULES[provider?.toLowerCase()];
  return rules?.[type] ?? null;
};

/**
 * @param model
 * @param type
 * @returns true=, false=, undefined=
 */
export const hasModelCapability = (model: IProvider, type: ModelType): boolean | undefined => {
  const capabilitiesHash = model.capabilities ? JSON.stringify(model.capabilities) : '';
  const cacheKey = `${model.id}-${model.platform}-${type}-${capabilitiesHash}`;

  if (modelCapabilitiesCache.has(cacheKey)) {
    return modelCapabilitiesCache.get(cacheKey);
  }

  let result: boolean | undefined;

  const userSelected = getUserSelectedCapability(model, type);
  if (userSelected !== undefined) {
    result = userSelected;
  } else {
    // 2. 2 provider
    const providerRule = getProviderCapabilityRule(model.platform, type);
    if (providerRule !== null) {
      result = providerRule;
    } else {
      const modelNames = model.model || [];

      const exclusions = CAPABILITY_EXCLUSIONS[type];
      const pattern = CAPABILITY_PATTERNS[type];

      const hasSupport = modelNames.some((modelName) => {
        const baseModelName = getBaseModelName(modelName);

        const isExcluded = exclusions.some((excludePattern) => excludePattern.test(baseModelName));
        if (isExcluded) return false;

        return pattern.test(baseModelName);
      });

      result = hasSupport ? true : undefined;
    }
  }

  modelCapabilitiesCache.set(cacheKey, result);
  return result;
};

/**
 */
export const clearModelCapabilitiesCache = (): void => {
  modelCapabilitiesCache.clear();
};
