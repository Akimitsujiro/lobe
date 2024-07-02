import { omit } from 'lodash-es';
import OpenAI, { ClientOptions } from 'openai';

import Qwen from '@/config/modelProviders/qwen';

import { LobeOpenAICompatibleRuntime, LobeRuntimeAI } from '../BaseAI';
import { AgentRuntimeErrorType } from '../error';
import { ChatCompetitionOptions, ChatStreamPayload, ModelProvider } from '../types';
import { AgentRuntimeError } from '../utils/createError';
import { debugStream } from '../utils/debugStream';
import { handleOpenAIError } from '../utils/handleOpenAIError';
import { StreamingResponse } from '../utils/response';
import { QwenAIStream } from '../utils/streams';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

/**
 * Use DashScope OpenAI compatible mode for now.
 * DashScope OpenAI [compatible mode](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-vl-plus-api) currently supports base64 image input for vision models e.g. qwen-vl-plus.
 * You can use images input either:
 * 1. Use qwen-vl-* out of box with base64 image_url input;
 * or
 * 2. Set S3-* enviroment variables properly to store all uploaded files.
 */
export class LobeQwenAI extends LobeOpenAICompatibleRuntime implements LobeRuntimeAI {
  client: OpenAI;
  baseURL: string;

  constructor({ apiKey, baseURL = DEFAULT_BASE_URL, ...res }: ClientOptions) {
    super();
    if (!apiKey) throw AgentRuntimeError.createError(AgentRuntimeErrorType.InvalidProviderAPIKey);
    this.client = new OpenAI({ apiKey, baseURL, ...res });
    this.baseURL = this.client.baseURL;
  }

  async models() {
    return Qwen.chatModels;
  }

  async chat(payload: ChatStreamPayload, options?: ChatCompetitionOptions) {
    try {
      const params = this.buildCompletionParamsByModel(payload);

      const response = await this.client.chat.completions.create(
        params as OpenAI.ChatCompletionCreateParamsStreaming,
        {
          headers: { Accept: '*/*' },
          signal: options?.signal,
        },
      );

      if (params.stream) {
        const [prod, debug] = response.tee();

        if (process.env.DEBUG_QWEN_CHAT_COMPLETION === '1') {
          debugStream(debug.toReadableStream()).catch(console.error);
        }

        return StreamingResponse(QwenAIStream(prod, options?.callback), {
          headers: options?.headers,
        });
      }

      const stream = this.transformResponseToStream(response as unknown as OpenAI.ChatCompletion);

      return StreamingResponse(QwenAIStream(stream, options?.callback), {
        headers: options?.headers,
      });
    } catch (error) {
      if ('status' in (error as any)) {
        switch ((error as Response).status) {
          case 401: {
            throw AgentRuntimeError.chat({
              endpoint: this.baseURL,
              error: error as any,
              errorType: AgentRuntimeErrorType.InvalidProviderAPIKey,
              provider: ModelProvider.Qwen,
            });
          }

          default: {
            break;
          }
        }
      }
      const { errorResult, RuntimeError } = handleOpenAIError(error);
      const errorType = RuntimeError || AgentRuntimeErrorType.ProviderBizError;

      throw AgentRuntimeError.chat({
        endpoint: this.baseURL,
        error: errorResult,
        errorType,
        provider: ModelProvider.Qwen,
      });
    }
  }

  private buildCompletionParamsByModel(payload: ChatStreamPayload) {
    const { model, top_p, stream, messages, tools } = payload;
    const isVisionModel = model.startsWith('qwen-vl');

    const params = {
      ...payload,
      messages,
      result_format: 'message',
      stream: !!tools?.length ? false : stream ?? true,
      top_p: top_p && top_p >= 1 ? 0.999 : top_p,
    };

    /* Qwen-vl models temporarily do not support parameters below. */
    /* Notice: `top_p` imposes significant impact on the result，the default 1 or 0.999 is not a proper choice. */
    return isVisionModel
      ? omit(
          params,
          'presence_penalty',
          'frequency_penalty',
          'temperature',
          'result_format',
          'top_p',
        )
      : params;
  }

  /* Identical transform method to the same-name method in LobeOpenAICompatibleAI */
  private transformResponseToStream(data: OpenAI.ChatCompletion) {
    return new ReadableStream({
      start(controller) {
        const chunk: OpenAI.ChatCompletionChunk = {
          choices: data.choices.map((choice: OpenAI.ChatCompletion.Choice) => {
            return {
              delta: {
                content: choice.message.content,
                role: choice.message.role,
                tool_calls: choice.message.tool_calls?.map(
                  (tool, index): OpenAI.ChatCompletionChunk.Choice.Delta.ToolCall => ({
                    function: tool.function,
                    id: tool.id,
                    index,
                    type: tool.type,
                  }),
                ),
              },
              finish_reason: null,
              index: choice.index,
              logprobs: choice.logprobs,
            };
          }),
          created: data.created,
          id: data.id,
          model: data.model,
          object: 'chat.completion.chunk',
        };

        controller.enqueue(chunk);

        controller.enqueue({
          choices: data.choices.map((choice: OpenAI.ChatCompletion.Choice) => ({
            delta: {
              content: choice.message.content,
              role: choice.message.role,
            },
            finish_reason: choice.finish_reason,
            index: choice.index,
            logprobs: choice.logprobs,
          })),
          created: data.created,
          id: data.id,
          model: data.model,
          object: 'chat.completion.chunk',
          system_fingerprint: data.system_fingerprint,
        } as OpenAI.ChatCompletionChunk);
        controller.close();
      },
    });
  }
}
