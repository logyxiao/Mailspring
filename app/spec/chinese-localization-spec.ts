import fs from 'fs';
import os from 'os';
import path from 'path';
import proxyquire from 'proxyquire';
import React from 'react';
import TestRenderer from 'react-test-renderer';
import { TypeaheadFreeInput } from '../internal_packages/contacts/lib/TypeaheadFreeInput';
import ScenarioEditorRow from '../src/components/scenario-editor-row';
import { Template } from '../src/components/scenario-editor-models';

describe('Simplified Chinese localization', () => {
  let configDir: string;
  let intl: typeof import('../src/intl');

  beforeEach(() => {
    configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mailspring-zh-test-'));
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ '*': { core: { intl: { language: 'zh-CN' } } } })
    );
    intl = proxyquire('../src/intl', {});
    intl.initializeLocalization({ configDirPath: configDir });
  });

  afterEach(() => fs.rmSync(configDir, { recursive: true, force: true }));

  it('translates common controls and preserves reordered substitutions', () => {
    expect(intl.localized('Server')).toBe('服务器');
    expect(intl.localized('Username')).toBe('用户名');
    expect(intl.localized('Snooze')).toBe('稍后处理');
    expect(intl.localized('Medium Handle')).toBe('Medium 用户名');
    expect(
      intl.localized(
        "%1$@ of the %2$@ selected events will be deleted. The rest are on read-only calendars and can't be changed.",
        2,
        5
      )
    ).toContain('所选 5 个日程中的 2 个');
  });

  it('shows language names in Chinese without changing locale codes', () => {
    const languages = intl.getAvailableLanguages();
    expect(languages.current.key).toBe('zh-CN');
    expect(languages.current.name).toContain('中文');
    expect(intl.getLanguageDisplayName('en', 'English')).toContain('英语');
    expect(intl.getLanguageDisplayName('invalid_tag!', 'Fallback')).toBe('Fallback');
  });

  it('localizes standard folder labels while preserving IMAP paths and custom names', () => {
    const { Category } = proxyquire('../src/flux/models/category', {
      '../../intl': { localized: intl.localized },
    });
    for (const [role, rawPath, expected] of [
      ['inbox', 'INBOX', '收件箱'],
      ['sent', 'Sent Messages', '已发送邮件'],
      ['spam', 'Junk', '垃圾邮件'],
      ['trash', 'Deleted Messages', '回收站'],
    ]) {
      const folder = new Category({ id: role, role, path: rawPath });
      expect(folder.localizedDisplayName).toBe(expected);
      expect(folder.path).toBe(rawPath);
      expect(folder.toJSON().path).toBe(rawPath);
      expect(folder.displayName).toBe(rawPath === 'INBOX' ? 'Inbox' : rawPath);
    }
    const custom = new Category({ id: 'custom', path: 'My Projects', role: null });
    expect(custom.localizedDisplayName).toBe('My Projects');
  });

  it('shows translated contact types but saves canonical or custom values', () => {
    const { contactTypeLabel } = proxyquire(
      '../internal_packages/contacts/lib/contact-type-labels',
      { '../../../src/intl': { localized: intl.localized } }
    );
    const onChange = jasmine.createSpy('onChange');
    const input = new TypeaheadFreeInput({
      value: 'Home',
      suggestions: ['Home', 'Work'],
      formatSuggestion: contactTypeLabel,
      onChange,
    });
    const element = input.render();
    const editor = element.props.headerComponents[0];
    expect(editor.props.value).toBe('家庭');
    expect(element.props.itemContent('Work')).toBe('工作');
    editor.props.onChange({ currentTarget: { value: '工作' } });
    expect(onChange.mostRecentCall.args[0].target.value).toBe('Work');
    editor.props.onChange({ currentTarget: { value: '自定义联系方式' } });
    expect(onChange.mostRecentCall.args[0].target.value).toBe('自定义联系方式');
    expect(contactTypeLabel('Personal label')).toBe('Personal label');
  });

  it('keeps the raw folder name for mail-rule recovery when the option label is translated', () => {
    const onChange = jasmine.createSpy('onChange');
    const renderer = TestRenderer.create(
      React.createElement(ScenarioEditorRow, {
        instance: { templateKey: 'changeFolder', comparatorKey: null, value: 'folder-id' },
        removable: false,
        templates: [
          new Template('changeFolder', Template.Type.Enum, {
            name: '移动到文件夹',
            values: [{ value: 'folder-id', name: '收件箱', valueName: 'INBOX' }],
          }),
        ],
        onChange,
        onInsert: () => {},
        onRemove: () => {},
      })
    );
    try {
      const select = renderer.root
        .findAllByType('select')
        .find((s) => s.props.value === 'folder-id');
      expect(select.findAllByType('option')[1].props.children).toBe('收件箱');
      select.props.onChange({ target: { value: 'folder-id' } });
      expect(onChange.mostRecentCall.args[0].valueName).toBe('INBOX');
    } finally {
      renderer.unmount();
    }
  });
});
