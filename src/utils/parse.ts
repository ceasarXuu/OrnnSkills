/**
 * 安全字符串解析工具
 *
 * 消除散落在各模块中的脆弱 split / regex 解析（无边界检查版本）
 */

/**
 * Shadow ID 的格式："{skillId}@{projectRoot}"
 */
export interface ShadowIdParts {
  skillId: string;
  projectRoot: string;
}

/**
 * 解析 shadow ID，格式无效时返回 null。
 *
 * 合法格式示例：`code-review@/home/user/my-project`
 */
export function parseShadowId(shadowId: string): ShadowIdParts | null {
  const atIndex = shadowId.indexOf('@');
  // skillId 不能为空，projectRoot 不能为空
  if (atIndex <= 0 || atIndex === shadowId.length - 1) return null;
  return {
    skillId: shadowId.slice(0, atIndex),
    projectRoot: shadowId.slice(atIndex + 1),
  };
}

/**
 * 从 shadow ID 中提取 skill ID。格式无效时返回 null。
 */
export function skillIdFromShadowId(shadowId: string): string | null {
  return parseShadowId(shadowId)?.skillId ?? null;
}

/**
 * 构建 shadow ID。
 */
export function buildShadowId(skillId: string, projectRoot: string): string {
  return `${skillId}@${projectRoot}`;
}


