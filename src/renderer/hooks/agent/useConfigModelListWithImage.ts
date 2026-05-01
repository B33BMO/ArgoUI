import { useMemo } from 'react';
import useSWR from 'swr';
import { ipcBridge } from '@/common';

const useConfigModelListWithImage = () => {
  const { data } = useSWR('configModelListWithImage', () => {
    return ipcBridge.mode.getModelConfig.invoke();
  });

  const modelListWithImage = useMemo(() => {
    return (data || []).map((platform) => {
      const platformLower = platform.platform?.toLowerCase() || '';
      const hasImageModel = platform.model.some((m) => {
        const name = m.toLowerCase();
        return name.includes('image') || name.includes('imagine');
      });

      if (platform.platform === 'gemini' && (!platform.baseUrl || platform.baseUrl.trim() === '')) {
        // Google Gemini gemini-2.5-flash-image-preview
        const hasGeminiImage = platform.model.some(
          (m) => m.includes('gemini') && (m.includes('image') || m.includes('imagine'))
        );
        if (!hasGeminiImage) {
          platform.model = platform.model.concat(['gemini-2.5-flash-image-preview']);
        }
      } else if (platform.platform === 'OpenRouter' && platform.baseUrl && platform.baseUrl.includes('openrouter.ai')) {
        const hasOpenRouterImage = platform.model.some((m) => m.includes('image') || m.includes('imagine'));
        if (!hasOpenRouterImage) {
          platform.model = platform.model.concat(['google/gemini-2.5-flash-image-preview']);
        }
      } else if (platformLower.includes('antigravity') && !hasImageModel) {
        // AntigravityTools platform: add common image models
        platform.model = platform.model.concat(['gemini-3-pro-image-1x1']);
      }

      return platform;
    });
  }, [data]);

  return {
    modelListWithImage,
  };
};

export default useConfigModelListWithImage;
