import { describe, expect, it } from 'vitest';

describe('dashboard app shell', () => {
  it('renders the localized shell with the injected script payload', async () => {
    const { renderDashboardAppShell } = await import('../../src/dashboard/web/app-shell.js');

    const html = renderDashboardAppShell({
      lang: 'zh',
      shortBuildId: 'abcd1234',
      styleCss: 'body { background: #000; }',
      labels: {
        headerVersion: '版本',
        headerConnecting: '连接中…',
        sidebarProjects: '项目',
        sidebarAddProject: '添加项目',
        sidebarAddPlaceholder: '/path/to/project',
        sidebarAddHint: '选择一个项目目录',
        mainSelectProject: '请选择项目',
        modalClose: '关闭',
        modalHostLabel: '宿主',
        modalLoading: '加载中',
        modalApplyAllButton: '应用到全部',
        modalSave: '保存',
        modalVersionHistory: '版本历史',
        modalApplyAllTitle: '确认应用',
        modalApplyAllCancel: '取消',
        modalApplyAllConfirm: '确认',
        activityDetailTitle: '活动明细',
        activityDetailEmpty: '暂无明细',
      },
      scriptSource: 'console.log("dashboard test")',
    });

    expect(html).toContain('<html lang="zh">');
    expect(html).toContain('build #abcd1234');
    expect(html).toContain('body { background: #000; }');
    expect(html).toContain('连接中…');
    expect(html).toContain('id="projectList"');
    expect(html).toContain('id="workspaceTabs"');
    expect(html).toContain('id="skillModal"');
    expect(html).toContain('id="modalRuntimeSelect"');
    expect(html.indexOf('id="modalRuntimeSelect"')).toBeLessThan(html.indexOf('onclick="closeModal()"'));
    expect(html).toContain('console.log("dashboard test")');
  });
});
