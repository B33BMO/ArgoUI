import { ipcBridge } from '@/common';
import useSWR from 'swr';

export type { GeminiModeOption } from '@/common/utils/geminiModes';
export { getGeminiModeList } from '@/common/utils/geminiModes';
import { getGeminiModeList } from '@/common/utils/geminiModes';

export const geminiModeList = getGeminiModeList();

const sortGeminiModels = (models: { label: string; value: string }[]) => {
  return models.toSorted((a, b) => {
    const aPro = a.value.toLowerCase().includes('pro');
    const bPro = b.value.toLowerCase().includes('pro');

    if (aPro && !bPro) return -1;
    if (!aPro && bPro) return 1;

    const extractVersion = (name: string) => {
      const match = name.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 0;
    };

    const aVersion = extractVersion(a.value);
    const bVersion = extractVersion(b.value);

    if (aVersion !== bVersion) {
      return bVersion - aVersion;
    }

    return a.value.localeCompare(b.value);
  });
};

const useModeModeList = (
  platform: string,
  base_url?: string,
  api_key?: string,
  try_fix?: boolean,
  bedrockConfig?: {
    authMethod: 'accessKey' | 'profile';
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    profile?: string;
  }
) => {
  return useSWR(
    [platform + '/models', { platform, base_url, api_key, try_fix, bedrockConfig }],
    async ([_url, { platform, base_url, api_key, try_fix, bedrockConfig }]): Promise<{
      models: { label: string; value: string }[];
      fix_base_url?: string;
    }> => {
      if (api_key || base_url || bedrockConfig) {
        const res = await ipcBridge.mode.fetchModelList.invoke({ base_url, api_key, try_fix, platform, bedrockConfig });
        if (res.success) {
          let modelList =
            res.data?.mode.map((v) => {
              // Handle both string and object formats (Bedrock returns objects with id and name)
              if (typeof v === 'string') {
                return { label: v, value: v };
              } else {
                return { label: v.name, value: v.id };
              }
            }) || [];

          if (platform?.includes('gemini')) {
            modelList = sortGeminiModels(modelList);
          }

          if (res.data?.fix_base_url) {
            return {
              models: modelList,
              fix_base_url: res.data.fix_base_url,
            };
          }

          return { models: modelList };
        }
        return Promise.reject(res.msg);
      }

      return { models: [] };
    }
  );
};

export default useModeModeList;
