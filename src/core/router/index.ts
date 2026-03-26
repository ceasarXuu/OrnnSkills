/**
 * Trace Router
 *
 * 负责接收来自 Observer 的 Trace，并根据 skill_refs 将 Trace 路由到对应的处理逻辑。
 * 这是 Observer 和 Evaluator 之间的中间层。
 */

export {
  TraceRouter,
  createTraceRouter,
  type RouterOptions,
  type RouteResult,
} from './router.js';

export {
  LLMRouterAgent,
  createLLMRouterAgent,
  type LLMRouterAgentOptions,
  type SkillRecognitionResult,
} from './llm-router-agent.js';
