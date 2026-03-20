import { createChildLogger } from '../../utils/logger.js';
import type { Trace, TraceStatus, RuntimeType } from '../../types/index.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createChildLogger('observer');

/**
 * Observer 基类
 * 负责从主 Agent 采集执行 trace
 */
export abstract class BaseObserver {
  protected runtime: RuntimeType;
  protected isRunning: boolean = false;
  protected onTraceCallback?: (trace: Trace) => void;

  constructor(runtime: RuntimeType) {
    this.runtime = runtime;
  }

  /**
   * 启动 observer
   */
  abstract start(): void | Promise<void>;

  /**
   * 停止 observer
   */
  abstract stop(): Promise<void>;

  /**
   * 注册 trace 回调
   */
  onTrace(callback: (trace: Trace) => void): void {
    this.onTraceCallback = callback;
  }

  /**
   * 发送 trace
   */
  protected emitTrace(trace: Omit<Trace, 'trace_id' | 'runtime'>): void {
    const fullTrace: Trace = {
      ...trace,
      trace_id: uuidv4(),
      runtime: this.runtime,
    };

    logger.debug('Trace emitted', {
      trace_id: fullTrace.trace_id,
      event_type: fullTrace.event_type,
    });

    this.onTraceCallback?.(fullTrace);
  }

  /**
   * 创建用户输入 trace
   */
  protected createUserInputTrace(
    sessionId: string,
    turnId: string,
    input: string
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'user_input',
      timestamp: new Date().toISOString(),
      user_input: input,
      status: 'success',
    };
  }

  /**
   * 创建助手输出 trace
   */
  protected createAssistantOutputTrace(
    sessionId: string,
    turnId: string,
    output: string
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'assistant_output',
      timestamp: new Date().toISOString(),
      assistant_output: output,
      status: 'success',
    };
  }

  /**
   * 创建工具调用 trace
   */
  protected createToolCallTrace(
    sessionId: string,
    turnId: string,
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'tool_call',
      timestamp: new Date().toISOString(),
      tool_name: toolName,
      tool_args: toolArgs,
      status: 'success',
    };
  }

  /**
   * 创建工具结果 trace
   */
  protected createToolResultTrace(
    sessionId: string,
    turnId: string,
    toolName: string,
    toolResult: Record<string, unknown>,
    status: TraceStatus = 'success'
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'tool_result',
      timestamp: new Date().toISOString(),
      tool_name: toolName,
      tool_result: toolResult,
      status,
    };
  }

  /**
   * 创建文件变化 trace
   */
  protected createFileChangeTrace(
    sessionId: string,
    turnId: string,
    filesChanged: string[]
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'file_change',
      timestamp: new Date().toISOString(),
      files_changed: filesChanged,
      status: 'success',
    };
  }

  /**
   * 创建重试 trace
   */
  protected createRetryTrace(
    sessionId: string,
    turnId: string,
    reason?: string
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'retry',
      timestamp: new Date().toISOString(),
      status: 'retry',
      metadata: reason ? { reason } : undefined,
    };
  }

  /**
   * 创建状态 trace
   */
  protected createStatusTrace(
    sessionId: string,
    turnId: string,
    status: TraceStatus,
    metadata?: Record<string, unknown>
  ): Omit<Trace, 'trace_id' | 'runtime'> {
    return {
      session_id: sessionId,
      turn_id: turnId,
      event_type: 'status',
      timestamp: new Date().toISOString(),
      status,
      metadata,
    };
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 获取 runtime 类型
   */
  getRuntime(): RuntimeType {
    return this.runtime;
  }
}