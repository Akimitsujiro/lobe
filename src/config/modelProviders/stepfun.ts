import { ModelProviderCard } from '@/types/llm';

// ref https://platform.stepfun.com/docs/llm/text
const Stepfun: ModelProviderCard = {
  chatModels: [
    {
      enabled: true,
      id: 'step-1-256k',
      tokens: 32_768,
    },
    {
      enabled: true,
      id: 'step-1-128k',
      tokens: 32_768,
    },
    {
      enabled: true,
      id: 'step-1-32k',
      tokens: 32_768,
    },
    {
      enabled: true,
      id: 'step-1v-32k',
      tokens: 32_768,
      vision: true,
    },
    {
      id: 'step-1-8k',
      tokens: 8192,
    },
  ],
  checkModel: 'step-1-8k',
  id: 'stepfun',
  modelList: { showModelFetcher: true },
  name: '阶跃星辰',
};

export default Stepfun;
