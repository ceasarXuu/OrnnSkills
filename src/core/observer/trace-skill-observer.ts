import { createChildLogger } from '../../utils/logger.js';
import { createTraceSkillMapper } from '../trace-skill-mapper/index.js';
import { createTraceManager } from './trace-manager.js';
import type { Trace, SkillTracesGroup } from '../../types/index.js';

// Timer 类型
type Timer = ReturnType<typeof setInterval>;

const logger = createChildLogger('trace-skill-observer');

/**
 * Trace-Skill Observer
 * 在 Observer 层集成 trace 到 skill 的映射功能
 *
 * 职责:
 * 1. 监听 trace 事件
 * 2. 实时映射 trace 到 skill
 * 3. 按 skill 聚合 traces
 * 4. 触发评估回调
 */
export class TraceSkillObserver {
  private mapper;
  private traceManager;
  private onSkillTracesReady: ((group: SkillTracesGroup) => void) | null = null;
  private buffer: Map<string, Trace[]> = new Map();
  private bufferSize: number = 10;
  private flushInterval: Timer | null = null;

  constructor(projectRoot: string) {
    this.mapper = createTraceSkillMapper(projectRoot);
    this.traceManager = createTraceManager(projectRoot);
  }

  /**
   * 初始化 observer
   */
  async init(): Promise<void> {
    await this.mapper.init();
    await this.traceManager.init();

    // 启动定时刷新
    this.flushInterval = setInterval(() => {
      void this.flushBuffers();
    }, 5000); // 每 5 秒刷新一次

    logger.info('TraceSkillObserver initialized');
  }

  /**
   * 设置回调函数
   */
  onReady(callback: (group: SkillTracesGroup) => void): void {
    this.onSkillTracesReady = callback;
  }

  /**
   * 处理新的 trace（带错误处理）
   */
  processTrace(trace: Trace): void {
    try {
      // 1. 存储 trace
      this.traceManager.recordTrace(trace);

      // 2. 映射 trace 到 skill
      const mapping = this.mapper.mapTrace(trace);

      if (mapping.skill_id && mapping.confidence >= 0.5) {
        // 3. 添加到 buffer
        const skillId = mapping.skill_id;
        if (!this.buffer.has(skillId)) {
          this.buffer.set(skillId, []);
        }
        const traces = this.buffer.get(skillId);
        if (traces) {
          traces.push(trace);
        }

        logger.debug('Trace buffered for skill', {
          trace_id: trace.trace_id,
          skill_id: skillId,
          confidence: mapping.confidence,
        });

        // 4. 检查是否需要刷新
        const buffer = this.buffer.get(skillId);
        if (buffer && buffer.length >= this.bufferSize) {
          this.flushSkillBuffer(skillId);
        }
      }
    } catch (error) {
      logger.error('Failed to process trace', {
        trace_id: trace.trace_id,
        error: error instanceof Error ? error.message : String(error),
      });
      // 不抛出异常，避免影响其他 trace 的处理
    }
  }

  /**
   * 批量处理 traces
   */
  processTraces(traces: Trace[]): void {
    for (const trace of traces) {
      this.processTrace(trace);
    }
  }

  /**
   * 刷新单个 skill 的 buffer（带错误处理）
   */
  private flushSkillBuffer(skillId: string): void {
    const traces = this.buffer.get(skillId);
    if (!traces || traces.length === 0) {
      return;
    }

    try {
      // 获取 shadow 信息
      const shadow = this.mapper.getShadowSkill(skillId);
      if (!shadow) {
        logger.warn('Shadow skill not found, skipping flush', { skill_id: skillId });
        this.buffer.delete(skillId);
        return;
      }

      // 计算最大置信度
      let maxConfidence = 0;
      for (const trace of traces) {
        const mapping = this.mapper.mapTrace(trace);
        if (mapping.confidence > maxConfidence) {
          maxConfidence = mapping.confidence;
        }
      }

      // 创建 group
      const group: SkillTracesGroup = {
        skill_id: skillId,
        shadow_id: shadow.shadow_id,
        traces: [...traces],
        confidence: maxConfidence,
      };

      logger.info('Skill traces ready for evaluation', {
        skill_id: skillId,
        trace_count: traces.length,
        confidence: group.confidence,
      });

      // 触发回调
      if (this.onSkillTracesReady) {
        this.onSkillTracesReady(group);
      }

      // 清空 buffer
      this.buffer.delete(skillId);
    } catch (error) {
      logger.error('Failed to flush skill buffer', {
        skill_id: skillId,
        trace_count: traces.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // 保留 buffer，稍后重试
    }
  }

  /**
   * 刷新所有 buffers
   */
  private flushBuffers(): void {
    for (const skillId of this.buffer.keys()) {
      this.flushSkillBuffer(skillId);
    }
  }

  /**
   * 获取当前 buffer 状态
   */
  getBufferStatus(): { skill_id: string; trace_count: number }[] {
    const status: { skill_id: string; trace_count: number }[] = [];
    for (const [skillId, traces] of this.buffer.entries()) {
      status.push({
        skill_id: skillId,
        trace_count: traces.length,
      });
    }
    return status;
  }

  /**
   * 获取映射统计
   */
  getMappingStats(): {
    total_mappings: number;
    by_skill: Record<string, number>;
    avg_confidence: number;
  } {
    return this.mapper.getMappingStats();
  }

  /**
   * 注册 skill
   */
  registerSkill(skillId: string, originPath: string): void {
    // 这里可以从 origin registry 获取完整的 skill 信息
    logger.debug('Registering skill', { skillId, originPath });
  }

  /**
   * 清理
   */
  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flushBuffers();
    this.buffer.clear();
    this.mapper.close();
    this.traceManager.close();
    logger.info('TraceSkillObserver closed');
  }
}

// 导出工厂函数
export function createTraceSkillObserver(projectRoot: string): TraceSkillObserver {
  return new TraceSkillObserver(projectRoot);
}
