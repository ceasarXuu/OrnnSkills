import { createChildLogger } from '../../utils/logger.js';
import { createSQLiteStorage } from '../../storage/sqlite.js';
import { join } from '../../utils/path.js';
import type { Trace, ProjectSkillShadow, OriginSkill } from '../../types/index.js';

const logger = createChildLogger('trace-skill-mapper');

/**
 * Trace 到 Skill 映射结果
 */
export interface TraceSkillMapping {
  trace_id: string;
  skill_id: string | null;
  shadow_id: string | null;
  confidence: number;
  reason: string;
}

/**
 * Skill 分组的 Traces
 */
export interface SkillTracesGroup {
  skill_id: string;
  shadow_id: string;
  traces: Trace[];
  confidence: number;
}

/**
 * TraceSkillMapper
 * 负责将 traces 映射到对应的 skills
 */
export class TraceSkillMapper {
  private db: Awaited<ReturnType<typeof createSQLiteStorage>> | null = null;
  private projectRoot: string;
  private knownSkills: Map<string, OriginSkill> = new Map();
  private shadowSkills: Map<string, ProjectSkillShadow> = new Map();
  private dbPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.dbPath = join(projectRoot, '.ornn', 'state', 'sessions.db');
  }

  /**
   * 初始化
   */
  async init(): Promise<void> {
    this.db = await createSQLiteStorage(this.dbPath);
    await this.db.init();
    this.loadKnownSkills();
    logger.debug('TraceSkillMapper initialized');
  }

  /**
   * 加载已知的 skills
   */
  private loadKnownSkills(): void {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');
    // 从数据库加载 origin skills
    const origins = this.db.listOriginSkills();
    for (const origin of origins) {
      this.knownSkills.set(origin.skill_id, origin);
    }

    // 从数据库加载 shadow skills
    const shadows = this.db.listShadowSkills(this.projectRoot);
    for (const shadow of shadows) {
      this.shadowSkills.set(shadow.skill_id, shadow);
    }

    logger.debug('Known skills loaded', {
      origins: this.knownSkills.size,
      shadows: this.shadowSkills.size,
    });
  }

  /**
   * 映射单个 trace 到 skill
   */
  mapTrace(trace: Trace): TraceSkillMapping {
    // 策略 1: 检测 tool_call 中读取 skill 文件
    if (trace.event_type === 'tool_call' && trace.tool_name === 'read_file') {
      const filePath = trace.tool_args?.path as string;
      if (filePath) {
        const skillId = this.extractSkillIdFromPath(filePath);
        if (skillId && this.knownSkills.has(skillId)) {
          return {
            trace_id: trace.trace_id,
            skill_id: skillId,
            shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
            confidence: 0.95,
            reason: `read_file on skill file: ${filePath}`,
          };
        }
      }
    }

    // 策略 2: 检测 tool_call 中执行 skill 相关操作
    if (trace.event_type === 'tool_call') {
      const skillId = this.inferSkillFromToolCall(trace);
      if (skillId) {
        return {
          trace_id: trace.trace_id,
          skill_id: skillId,
          shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
          confidence: 0.85,
          reason: `tool_call "${trace.tool_name}" inferred skill: ${skillId}`,
        };
      }
    }

    // 策略 3: 检测 file_change 中修改 skill 文件
    if (trace.event_type === 'file_change' && trace.files_changed) {
      for (const filePath of trace.files_changed) {
        const skillId = this.extractSkillIdFromPath(filePath);
        if (skillId && this.knownSkills.has(skillId)) {
          return {
            trace_id: trace.trace_id,
            skill_id: skillId,
            shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
            confidence: 0.9,
            reason: `file_change on skill file: ${filePath}`,
          };
        }
      }
    }

    // 策略 4: 检测 metadata 中的 skill 信息
    if (trace.metadata?.skill_id) {
      const skillId = trace.metadata.skill_id as string;
      if (this.knownSkills.has(skillId)) {
        return {
          trace_id: trace.trace_id,
          skill_id: skillId,
          shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
          confidence: 0.98,
          reason: 'skill_id from trace metadata',
        };
      }
    }

    // 策略 5: 从 assistant_output 推断 skill 引用
    if (trace.event_type === 'assistant_output' && trace.assistant_output) {
      const skillId = this.inferSkillFromOutput(trace.assistant_output);
      if (skillId) {
        return {
          trace_id: trace.trace_id,
          skill_id: skillId,
          shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
          confidence: 0.6,
          reason: `skill reference in assistant output`,
        };
      }
    }

    // 策略 6: 从 user_input 推断 skill 请求
    if (trace.event_type === 'user_input' && trace.user_input) {
      const skillId = this.inferSkillFromInput(trace.user_input);
      if (skillId) {
        return {
          trace_id: trace.trace_id,
          skill_id: skillId,
          shadow_id: this.shadowSkills.get(skillId)?.shadow_id ?? null,
          confidence: 0.5,
          reason: `skill request in user input`,
        };
      }
    }

    // 无法映射
    return {
      trace_id: trace.trace_id,
      skill_id: null,
      shadow_id: null,
      confidence: 0,
      reason: 'no skill mapping found',
    };
  }

  /**
   * 批量映射 traces 并按 skill 分组
   */
  mapAndGroupTraces(traces: Trace[]): SkillTracesGroup[] {
    const groups: Map<string, { shadow_id: string; traces: Trace[]; confidence: number }> = new Map();
    const unmappedTraces: Trace[] = [];

    for (const trace of traces) {
      const mapping = this.mapTrace(trace);

      if (mapping.skill_id && mapping.shadow_id && mapping.confidence >= 0.5) {
        const existing = groups.get(mapping.skill_id);
        if (existing) {
          existing.traces.push(trace);
          existing.confidence = Math.max(existing.confidence, mapping.confidence);
        } else {
          groups.set(mapping.skill_id, {
            shadow_id: mapping.shadow_id,
            traces: [trace],
            confidence: mapping.confidence,
          });
        }

        // 保存映射关系到数据库
        this.saveMapping(mapping);
      } else {
        unmappedTraces.push(trace);
      }
    }

    // 转换为数组
    const result: SkillTracesGroup[] = [];
    for (const [skillId, group] of groups.entries()) {
      result.push({
        skill_id: skillId,
        shadow_id: group.shadow_id,
        traces: group.traces,
        confidence: group.confidence,
      });
    }

    logger.info('Traces mapped and grouped', {
      total: traces.length,
      mapped: traces.length - unmappedTraces.length,
      unmapped: unmappedTraces.length,
      groups: result.length,
    });

    return result;
  }

  /**
   * 获取某个 skill 相关的 traces
   *
   * NOTE: TraceManager 尚未注入到此类中，trace 内容无法在此层读取。
   * 调用方应通过 TraceManager.getTracesBySkill() 获取完整 trace 数据。
   * 此方法目前仅返回 trace ID 列表。
   */
  getSkillTraces(skillId: string, _limit?: number): Trace[] {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');

    const mappings = this.db.getTraceSkillMappings(skillId);
    const traceIds = mappings.map((m: { trace_id: string }) => m.trace_id);

    if (traceIds.length === 0) {
      return [];
    }

    // TraceManager 未注入：无法加载完整 trace 内容。
    // 返回轻量占位对象（仅含 trace_id），而不是静默空数组。
    logger.warn(
      'getSkillTraces: TraceManager not injected — returning trace ID stubs only. ' +
      'Use TraceManager.getTracesBySkill() for full trace data.',
      { skillId, traceIdCount: traceIds.length }
    );

    return traceIds.map((id: string) => ({ trace_id: id } as unknown as Trace));
  }

  /**
   * 从文件路径提取 skill ID
   */
  private extractSkillIdFromPath(filePath: string): string | null {
    // 匹配 patterns:
    // ~/.skills/A/current.md -> A
    // ~/.claude/skills/B/skill.md -> B
    // .ornn/skills/C/current.md -> C
    const patterns = [
      /\.skills\/([^/]+)\//,
      /\.claude\/skills\/([^/]+)\//,
      /\.opencode\/skills\/([^/]+)\//,
      /\.ornn\/skills\/([^/]+)\//,
    ];

    for (const pattern of patterns) {
      const match = filePath.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * 从 tool_call 推断 skill
   */
  private inferSkillFromToolCall(trace: Trace): string | null {
    let normalizedArgs: Record<string, unknown> = {};
    if (trace.tool_args && typeof trace.tool_args === 'string') {
      try {
        normalizedArgs = JSON.parse(trace.tool_args) as Record<string, unknown>;
      } catch {
        normalizedArgs = {};
      }
    } else if (trace.tool_args && typeof trace.tool_args === 'object') {
      normalizedArgs = trace.tool_args;
    }

    // 检查 tool_args 中是否包含 skill 相关信息
    if (normalizedArgs.skill_id) {
      return normalizedArgs.skill_id as string;
    }

    // 检查特定工具的使用模式
    if (
      trace.tool_name === 'execute_command' ||
      trace.tool_name === 'exec_command' ||
      trace.tool_name === 'functions.exec_command'
    ) {
      const command = (normalizedArgs.command as string) ?? (normalizedArgs.cmd as string);
      if (command) {
        // 检测 skill 相关命令
        const skillId = this.extractSkillFromCommand(command);
        if (skillId) return skillId;
      }
    }

    return null;
  }

  /**
   * 从命令中提取 skill
   */
  private extractSkillFromCommand(command: string): string | null {
    // 检测常见 skill 命令模式
    for (const [skillId] of this.knownSkills) {
      if (command.toLowerCase().includes(skillId.toLowerCase())) {
        return skillId;
      }
    }
    return null;
  }

  /**
   * 从 assistant output 推断 skill 引用（优化性能）
   */
  private inferSkillFromOutput(output: string): string | null {
    // 限制输入长度，防止 ReDoS 攻击
    const MAX_OUTPUT_LENGTH = 5000;
    if (output.length > MAX_OUTPUT_LENGTH) {
      return null;
    }

    // 预处理：转换为小写
    const lowerOutput = output.toLowerCase();

    // 检测 output 中是否引用了已知 skill
    for (const [skillId] of this.knownSkills) {
      const lowerSkillId = skillId.toLowerCase();
      
      // 使用 indexOf 替代 includes，性能更好
      if (lowerOutput.indexOf(lowerSkillId) !== -1) {
        return skillId;
      }
      
      // 检查常见的 skill 引用模式（使用 indexOf）
      const skillPatterns = [
        `skill: ${lowerSkillId}`,
        `skill:${lowerSkillId}`,
        `according to ${lowerSkillId}`,
        `using ${lowerSkillId}`,
      ];
      
      for (const pattern of skillPatterns) {
        if (lowerOutput.indexOf(pattern) !== -1) {
          return skillId;
        }
      }
    }
    return null;
  }

  /**
   * 从 user input 推断 skill 请求（优化性能）
   */
  private inferSkillFromInput(input: string): string | null {
    // 限制输入长度，防止 ReDoS 攻击
    const MAX_INPUT_LENGTH = 5000;
    if (input.length > MAX_INPUT_LENGTH) {
      return null;
    }

    // 预处理：转换为小写
    const lowerInput = input.toLowerCase();

    // 检测用户是否明确请求某个 skill
    for (const [skillId] of this.knownSkills) {
      const lowerSkillId = skillId.toLowerCase();
      
      // 检查常见的 skill 请求模式（使用 indexOf）
      const requestPatterns = [
        `use ${lowerSkillId}`,
        `run ${lowerSkillId}`,
        `apply ${lowerSkillId}`,
        `execute ${lowerSkillId}`,
        `with ${lowerSkillId}`,
        `using ${lowerSkillId}`,
      ];
      
      for (const pattern of requestPatterns) {
        if (lowerInput.indexOf(pattern) !== -1) {
          return skillId;
        }
      }
    }
    return null;
  }

  /**
   * 保存映射关系到数据库
   */
  private saveMapping(mapping: TraceSkillMapping): void {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');
    if (mapping.skill_id && mapping.confidence >= 0.5) {
      this.db.upsertTraceSkillMapping({
        trace_id: mapping.trace_id,
        skill_id: mapping.skill_id,
        shadow_id: mapping.shadow_id,
        confidence: mapping.confidence,
        reason: mapping.reason,
        mapped_at: new Date().toISOString(),
      });
    }
  }

  /**
   * 获取映射统计
   */
  getMappingStats(): {
    total_mappings: number;
    by_skill: Record<string, number>;
    avg_confidence: number;
  } {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');
    return this.db.getTraceSkillMappingStats();
  }

  /**
   * 注册 skill（用于映射参考）
   */
  registerSkill(origin: OriginSkill, shadow?: ProjectSkillShadow): void {
    this.knownSkills.set(origin.skill_id, origin);
    if (shadow) {
      this.shadowSkills.set(shadow.skill_id, shadow);
    }
  }

  /**
   * 清理旧的映射
   */
  cleanupOldMappings(retentionDays: number): number {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');
    return this.db.cleanupTraceSkillMappings(retentionDays);
  }

  /**
   * 获取指定 skillId 对应的 shadow skill（供外部模块安全访问）
   */
  getShadowSkill(skillId: string): ProjectSkillShadow | undefined {
    return this.shadowSkills.get(skillId);
  }

  /**
   * 关闭
   */
  close(): void {
    if (!this.db) throw new Error('TraceSkillMapper not initialized');
    this.db.close();
  }
}

// 导出工厂函数
export function createTraceSkillMapper(projectRoot: string): TraceSkillMapper {
  return new TraceSkillMapper(projectRoot);
}
