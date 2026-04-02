module.exports = {
  types: [
    { value: 'feat', name: 'feat:     新功能' },
    { value: 'fix', name: 'fix:      修复bug' },
    { value: 'docs', name: 'docs:     文档更新' },
    { value: 'style', name: 'style:    代码格式' },
    { value: 'refactor', name: 'refactor: 重构' },
    { value: 'perf', name: 'perf:     性能优化' },
    { value: 'test', name: 'test:     增加测试' },
    { value: 'chore', name: 'chore:    构建过程或辅助工具的变动' },
    { value: 'revert', name: 'revert:   回退' },
    { value: 'build', name: 'build:    打包' }
  ],
  messages: {
    type: '选择你要提交的类型:',
    subject: '输入简短描述:\n',
    body: '输入详细描述 (可选)。使用 "|" 换行:\n',
    breaking: '列出任何 BREAKING CHANGES (可选):\n',
    footer: '列出关闭的issues (可选)。 例如: #31, #34:\n',
    confirmCommit: '确定提交吗?'
  },
  allowCustomScopes: false,
  allowBreakingChanges: ['feat', 'fix'],
  skipQuestions: ['body', 'breaking', 'footer'],
  subjectLimit: 100
};
