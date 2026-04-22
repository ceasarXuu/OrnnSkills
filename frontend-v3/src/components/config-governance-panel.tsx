import type { ReactNode } from 'react'
import { AiBrain03Icon, KnightShieldIcon, Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  DASHBOARD_LOG_LEVEL_OPTIONS,
  DASHBOARD_PROMPT_KEYS,
  getPromptFieldMeta,
} from '@/lib/dashboard-config'
import type { DashboardConfig, DashboardPromptKey, DashboardPromptSource } from '@/types/config'

interface ConfigGovernancePanelProps {
  config: DashboardConfig
  onSetBooleanFlag: (field: 'autoOptimize' | 'userConfirm' | 'runtimeSync', value: boolean) => void
  onSetLogLevel: (value: string) => void
  onSetPromptOverride: (key: DashboardPromptKey, value: string) => void
  onSetPromptSource: (key: DashboardPromptKey, value: DashboardPromptSource) => void
  onSetSafetyField: (field: keyof DashboardConfig['llmSafety'], value: boolean | number) => void
}

export function ConfigGovernancePanel({
  config,
  onSetBooleanFlag,
  onSetLogLevel,
  onSetPromptOverride,
  onSetPromptSource,
  onSetSafetyField,
}: ConfigGovernancePanelProps) {
  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Settings02Icon} size={18} strokeWidth={1.8} />
            <CardTitle>Runtime Policy</CardTitle>
          </div>
          <CardDescription>把运行策略、安全阈值和日志级别放在统一治理面板里。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <SwitchRow
              checked={config.autoOptimize}
              description="允许系统自动推进优化动作。"
              label="Auto Optimize"
              onCheckedChange={(value) => onSetBooleanFlag('autoOptimize', value)}
            />
            <SwitchRow
              checked={config.runtimeSync}
              description="保持多宿主 runtime 状态同步。"
              label="Runtime Sync"
              onCheckedChange={(value) => onSetBooleanFlag('runtimeSync', value)}
            />
            <SwitchRow
              checked={config.userConfirm}
              description="高风险动作需要人工确认。"
              label="User Confirm"
              onCheckedChange={(value) => onSetBooleanFlag('userConfirm', value)}
            />
          </div>

          <Field label="Log Level">
            <Select onValueChange={onSetLogLevel} value={config.logLevel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择日志级别" />
              </SelectTrigger>
              <SelectContent>
                {DASHBOARD_LOG_LEVEL_OPTIONS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={KnightShieldIcon} size={18} strokeWidth={1.8} />
              <div>
                <p className="font-medium">LLM Safety</p>
                <p className="text-sm text-muted-foreground">
                  限制请求窗口、并发和估算 token，避免演进链路失控。
                </p>
              </div>
            </div>

            <SwitchRow
              checked={config.llmSafety.enabled}
              description="关闭后只保留 provider 侧限流。"
              label="Enable Safety Guard"
              onCheckedChange={(value) => onSetSafetyField('enabled', value)}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Window (ms)">
                <Input
                  min={1000}
                  onChange={(event) =>
                    onSetSafetyField('windowMs', Number(event.target.value) || 1000)
                  }
                  type="number"
                  value={config.llmSafety.windowMs}
                />
              </Field>
              <Field label="Max Requests">
                <Input
                  min={1}
                  onChange={(event) =>
                    onSetSafetyField('maxRequestsPerWindow', Number(event.target.value) || 1)
                  }
                  type="number"
                  value={config.llmSafety.maxRequestsPerWindow}
                />
              </Field>
              <Field label="Max Concurrent">
                <Input
                  min={1}
                  onChange={(event) =>
                    onSetSafetyField('maxConcurrentRequests', Number(event.target.value) || 1)
                  }
                  type="number"
                  value={config.llmSafety.maxConcurrentRequests}
                />
              </Field>
              <Field label="Max Estimated Tokens">
                <Input
                  min={1000}
                  onChange={(event) =>
                    onSetSafetyField(
                      'maxEstimatedTokensPerWindow',
                      Number(event.target.value) || 1000,
                    )
                  }
                  step={1000}
                  type="number"
                  value={config.llmSafety.maxEstimatedTokensPerWindow}
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={AiBrain03Icon} size={18} strokeWidth={1.8} />
            <CardTitle>Evolution Prompt Strategy</CardTitle>
          </div>
          <CardDescription>
            内置 prompt 仍然是默认路径，只有在确实需要时才切到 custom。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={DASHBOARD_PROMPT_KEYS[0]} className="gap-4">
            <TabsList variant="line">
              {DASHBOARD_PROMPT_KEYS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {getPromptFieldMeta(key).label}
                </TabsTrigger>
              ))}
            </TabsList>

            {DASHBOARD_PROMPT_KEYS.map((key) => {
              const meta = getPromptFieldMeta(key)
              const source = config.promptSources[key]

              return (
                <TabsContent className="space-y-4" key={key} value={key}>
                  <div className="space-y-1">
                    <p className="font-medium">{meta.label}</p>
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                  </div>

                  <Field label="Prompt Source">
                    <Select
                      onValueChange={(value) =>
                        onSetPromptSource(key, value as DashboardPromptSource)
                      }
                      value={source}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择 prompt source" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="built_in">Built-in</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Prompt Override">
                    <Textarea
                      className="min-h-40"
                      disabled={source !== 'custom'}
                      onChange={(event) => onSetPromptOverride(key, event.target.value)}
                      placeholder={meta.placeholder}
                      value={config.promptOverrides[key]}
                    />
                  </Field>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SwitchRow({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean
  description: string
  label: string
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="space-y-1">
        <Label className="text-sm">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function Field({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <label className="space-y-2">
      <Label>{label}</Label>
      {children}
    </label>
  )
}
