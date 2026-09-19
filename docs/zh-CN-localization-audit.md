# Mailspring 简体中文覆盖检查

## 修复完成情况（2026-09-19）

已完成本次审计发现的中文化问题：新增 **514 条**简体中文翻译，修正 **19 条**已有译文，并将界面中的硬编码英文接入翻译。下面保留修复前的审计清单供追溯，不代表这些问题仍未处理。

- 主侧栏标准文件夹、账号切换、邮件操作、登录表单、通用与外观设置、签名、模板、联系人、活动统计、日历、MCP、语法检查和退订提示已补齐。
- CSS 中的滑动操作标签与“NOTE:”改为读取已翻译的显示文案；数据库维护进度窗口也支持翻译。
- 语言菜单按当前界面语言显示；联系人内置类型显示中文，但保存时仍使用原始标准值。
- 文件夹新增 `localizedDisplayName` 仅供界面使用，原始 `path` / `displayName` 保持不变；规则恢复仍保存原始文件夹名称。
- 统一“稍后处理”的译法，修正“Medium 用户名”等误译及两处丢失占位符的问题。
- 新增 `npm run localization:check`：已检查 **1,472 个源码词条、693 个文件**，缺失中文翻译和占位符错误均为 **0**。
- 相关回归测试 **23 项通过**，包含文件夹路径、联系人标准类型、规则名称回退、中文插值和语言显示。
- 已在运行中的主界面、通用设置、外观、签名、账号及联系人窗口检查效果。品牌、协议、地址和自定义名称保留原样；外部网页、邮件正文和远端返回的原始错误不属于应用语言包。

## 以下为修复前审计记录

检查日期：2026-09-19。检查方式：源码静态扫描、语言包比对、运行中主界面与偏好设置抽查。

## 结论

当前不是完全没有启用中文。运行中语言设置为“自动 (Chinese - Simplified)”，已有中文正常显示。主要问题是新词条没有同步翻译、部分文案写死英文，以及标准邮箱文件夹显示逻辑绕过中文映射。

- 扫描 app/src、app/internal_packages、app/menus 下 **692 个 JS/TS/JSX/TSX 文件**，排除 spec/specs、node_modules、quickpreview。
- 提取 **2061 次静态翻译调用，1349 个唯一词条**。按运行时 zh.json → zh-CN.json 的覆盖顺序比对，**393 个词条缺少有效翻译，会回退英文**。这个数字包含可见按钮、提示、错误信息和无障碍标签，也包含其他平台的文案，不等于 macOS 上有 393 个英文按钮。
- 当前源码中 **381 个静态词条不在 en.json**，英文基准词典也未与源码保持同步。只对比 en.json 和 zh-CN.json 会漏掉大量新增功能。
- 扫描得到 **255 个硬编码候选位置**，其中含品牌名、协议名、资源路径和开发信息，不能全算缺陷；下文仅将人工确认的界面问题列为重点。
- 另有 1 处动态拼接的 localized 调用，无法作为固定词条提取，见最后一节。

## 实际界面已观察到的问题

| 位置 | 英文文案 | 说明 |
|---|---|---|
| 主侧栏 | Inbox、Sent Messages、Junk、Deleted Messages | 标准文件夹显示名仍为英文 |
| 通用设置 | Disable swipe gestures on the thread list | 缺少中文词条 |
| 通用设置 | Email body appearance、Light email mode | 缺少中文词条；Dark email mode 同样缺失 |
| 通用设置 | Check messages for grammar | 缺少中文词条 |
| 通知设置 | Count unread messages in all accounts, not just the selected folder | 缺少中文词条 |
| 外观设置 | Use system accent color、Interface Scale | 缺少中文词条 |
| 外观设置 | No unread status indication 及括号说明 | 缺少中文词条 |
| 通用和外观设置 | NOTE: | CSS 写死英文 |
| 签名设置 | Picture | 写死英文 |
| 签名设置 | “中间处理程序” | Medium Handle 误译，应为“Medium 用户名”一类文案 |
| 设置标签 | MCP Server | 标题和该模块大量词条缺少中文；本次未进入账号访问/令牌页面 |

无障碍树还显示 Signature Name、Preferences tabs、Close window、Account switcher 等英文名称；其中 sr-only / aria-label 文案不一定肉眼可见，需要与可见按钮区别统计。

## 按使用频率整理的修复范围

1. **日常收发与主界面**：标准文件夹名、账号切换 All Accounts、滑动操作、全部标为已读、新建子文件夹、邮件导出、作为附件转发、正文截断“显示全部”、更多收件人。
2. **账号与偏好设置**：Server、Username、Custom Port、Custom Container Folder、View Log，通用/外观设置中的新选项，以及“稍后处理”相关措辞。
3. **签名、模板、联系人**：Picture、Photo URL、Subject (optional)、模板说明、联系人编辑表单及空状态、vCard 导入导出。Signature Name / Template Name 等也需补充无障碍翻译。
4. **新增功能**：活动 Feed / Engagement / Reports、日历事件与提醒、MCP 连接与访问级别、语法检查、退订结果等。
5. **翻译质量与边界**：纠正 Medium Handle 的误译；统一 Snooze 的译法；保留 Mailspring、GitHub、YouTube 等品牌名及 IMAP、SMTP、SSL/TLS 等技术缩写。搜索语法中的 in: / is: / has: 等机器关键字不宜直接改为中文。

## 已确认的硬编码和显示逻辑问题

| 界面 | 文案 | 原因 / 修复注意 | 代码位置 |
|---|---|---|---|
| 侧栏文件夹 | Inbox / Sent Messages / Junk / Deleted Messages | 按原始文件夹路径显示；中文角色名映射已有，但 displayName 没有使用。只应翻译标准角色的显示名，不能改 IMAP 路径或用户自定义文件夹。 | [app/src/flux/models/category.ts:78](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/models/category.ts:78) |
| 账号切换菜单 | All Accounts | 条件表达式中的英文常量，没有调用 localized。 | [app/internal_packages/account-sidebar/lib/account-commands.ts:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/account-commands.ts:32) |
| 滑动邮件操作 | Trash / Archive / Snooze | LESS 伪元素 content 写死英文。 | [app/internal_packages/thread-list/styles/thread-list.less:79](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/styles/thread-list.less:79) |
| 设置提示前缀 | NOTE: | LESS 伪元素 content 写死英文。 | [app/internal_packages/preferences/styles/preferences.less:280](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/styles/preferences.less:280) |
| 登录错误 | View Log | JSX 文本写死英文。 | [app/internal_packages/onboarding/lib/form-error-message.tsx:29](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/form-error-message.tsx:29) |
| 首次设置 | Retry / Finish Setup | JSX 文本写死英文。 | [app/internal_packages/onboarding/lib/newsletter-signup.tsx:120](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/newsletter-signup.tsx:120) |
| 首次设置完成 | Finish Setup | JSX 文本写死英文。 | [app/internal_packages/onboarding/lib/page-initial-subscription.tsx:135](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-initial-subscription.tsx:135) |
| 邮件正文截断 | [Message Clipped - Show All] | JSX 文本写死英文。 | [app/internal_packages/message-list/lib/message-item-body.tsx:205](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-item-body.tsx:205) |
| 收件人折叠 | and N more | 缺少可带参数的本地化句式。 | [app/internal_packages/message-list/lib/message-participants.tsx:51](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-participants.tsx:51) |
| 联系人编辑 | First Name / Last Name / Nickname / Company / Phone / 地址字段 / Notes | 大量表单标签没有接入翻译。 | [app/internal_packages/contacts/lib/ContactDetailEdit.tsx:60](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactDetailEdit.tsx:60) |
| 联系人列表 | No contacts to display / No contact selected. | 空状态写死英文。 | [app/internal_packages/contacts/lib/ContactList.tsx:45](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactList.tsx:45) |
| 联系人生日 | Birthday / Year / Month / Day | 标题及无障碍标签没有接入翻译。 | [app/internal_packages/contacts/lib/YYMMDDInput.tsx:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/YYMMDDInput.tsx:30) |
| 联系人操作 | Send email... / Call... / Visit website... | 提示文案写死英文。 | [app/internal_packages/contacts/lib/ContactDetailRead.tsx:101](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactDetailRead.tsx:101) |
| 签名头像 | Picture | 标题写死英文。 | [app/internal_packages/composer-signature/lib/signature-photo-picker.tsx:172](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-signature/lib/signature-photo-picker.tsx:172) |
| 同步进度 | Gathering folders... | 进度说明写死英文。 | [app/internal_packages/notifications/lib/sidebar/sync-activity.tsx:53](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/sidebar/sync-activity.tsx:53) |
| 日历视图 | Today / All Day | 视图标题写死英文。 | [app/internal_packages/main-calendar/lib/core/day-view.tsx:267](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/day-view.tsx:267) |
| 日历编辑 | Edit Item / Modified / Remove / Title: / Start: / End: | 标题、状态和操作文案有硬编码英文。 | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:708](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:708) |
| 稍后处理 | Snooze | 按钮未调用 localized，同时中文语言包中的 Snooze 值仍是英文。 | [app/internal_packages/thread-snooze/lib/snooze-buttons.tsx:48](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-snooze/lib/snooze-buttons.tsx:48) |

## 缺少有效中文翻译的静态词条清单

共 393 个唯一词条。共享词条按首次出现模块归类；位置链接为其首次调用。含 tooltip、aria-label 和错误信息；模块有词条不代表当前账号一定可见或可用。

| 模块 | 唯一词条数 |
|---|---:|
| activity | 97 |
| main-calendar | 75 |
| core | 67 |
| mcp-server | 34 |
| contacts | 16 |
| preferences | 16 |
| message-list | 15 |
| onboarding | 13 |
| thread-list | 11 |
| account-sidebar | 8 |
| composer | 7 |
| composer-grammar-check | 7 |
| events | 5 |
| notifications | 5 |
| composer-signature | 4 |
| list-unsubscribe | 4 |
| composer-templates | 3 |
| print | 2 |
| theme-picker | 2 |
| category-picker | 1 |
| unread-notifications | 1 |

### core（67 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Reset Theme and Restart | [app/src/browser/application.ts:654](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/application.ts:654) |
| Reset Theme and Restart restores the bundled automatic, light, and dark themes, clears cached theme styles, and restarts Mailspring. Your accounts, mail, plugins, and other settings are not changed. | [app/src/browser/application.ts:657](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/application.ts:657) |
| Open a new email composer window | [app/src/browser/windows-taskbar-manager.ts:38](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/windows-taskbar-manager.ts:38) |
| Open your inbox | [app/src/browser/windows-taskbar-manager.ts:47](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/windows-taskbar-manager.ts:47) |
| Open Mailspring preferences | [app/src/browser/windows-taskbar-manager.ts:59](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/windows-taskbar-manager.ts:59) |
| 1 unread message | [app/src/browser/windows-taskbar-manager.ts:101](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/windows-taskbar-manager.ts:101) |
| %1$@ unread messages | [app/src/browser/windows-taskbar-manager.ts:102](/Users/to/Documents/logyxiao/Mailspring/app/src/browser/windows-taskbar-manager.ts:102) |
| More options | [app/src/components/button-dropdown.tsx:74](/Users/to/Documents/logyxiao/Mailspring/app/src/components/button-dropdown.tsx:74) |
| Grammar issue | [app/src/components/composer-editor/grammar-check-plugins.tsx:354](/Users/to/Documents/logyxiao/Mailspring/app/src/components/composer-editor/grammar-check-plugins.tsx:354) |
| Ignore rule | [app/src/components/composer-editor/grammar-check-plugins.tsx:372](/Users/to/Documents/logyxiao/Mailspring/app/src/components/composer-editor/grammar-check-plugins.tsx:372) |
| Grammar | [app/src/components/composer-editor/grammar-check-plugins.tsx:480](/Users/to/Documents/logyxiao/Mailspring/app/src/components/composer-editor/grammar-check-plugins.tsx:480) |
| Copy to clipboard | [app/src/components/copy-button.tsx:58](/Users/to/Documents/logyxiao/Mailspring/app/src/components/copy-button.tsx:58) |
| Mark All as Read | [app/src/components/outline-view-item.tsx:281](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:281) |
| New Sublabel... | [app/src/components/outline-view-item.tsx:287](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:287) |
| New Subfolder... | [app/src/components/outline-view-item.tsx:287](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:287) |
| Export folder as .eml files... | [app/src/components/outline-view-item.tsx:301](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:301) |
| Export folder as .mbox file... | [app/src/components/outline-view-item.tsx:305](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:305) |
| Sublabel name | [app/src/components/outline-view-item.tsx:408](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:408) |
| Subfolder name | [app/src/components/outline-view-item.tsx:408](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view-item.tsx:408) |
| Add item to %@ | [app/src/components/outline-view.tsx:168](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view.tsx:168) |
| Expand %@ | [app/src/components/outline-view.tsx:223](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view.tsx:223) |
| Collapse %@ | [app/src/components/outline-view.tsx:224](/Users/to/Documents/logyxiao/Mailspring/app/src/components/outline-view.tsx:224) |
| Use system accent color | [app/src/config-schema.ts:33](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:33) |
| Disable swipe gestures on the thread list | [app/src/config-schema.ts:175](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:175) |
| Light email mode | [app/src/config-schema.ts:186](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:186) |
| Dark email mode | [app/src/config-schema.ts:186](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:186) |
| Email body appearance | [app/src/config-schema.ts:187](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:187) |
| Check messages for grammar | [app/src/config-schema.ts:211](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:211) |
| Count unread messages in all accounts, not just the selected folder | [app/src/config-schema.ts:389](/Users/to/Documents/logyxiao/Mailspring/app/src/config-schema.ts:389) |
| Failed to Open Settings | [app/src/default-client-helper.ts:51](/Users/to/Documents/logyxiao/Mailspring/app/src/default-client-helper.ts:51) |
| Mailspring was unable to open Windows Settings.<br><br>%@ | [app/src/default-client-helper.ts:52](/Users/to/Documents/logyxiao/Mailspring/app/src/default-client-helper.ts:52) |
| Open Settings | [app/src/default-client-helper.ts:79](/Users/to/Documents/logyxiao/Mailspring/app/src/default-client-helper.ts:79) |
| Click 'Open Settings' to open Windows Settings where you can set Mailspring as your default email app. | [app/src/default-client-helper.ts:84](/Users/to/Documents/logyxiao/Mailspring/app/src/default-client-helper.ts:84) |
| Deleting event... | [app/src/flux/tasks/destroy-event-task.ts:32](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/tasks/destroy-event-task.ts:32) |
| Deleting %@ events... | [app/src/flux/tasks/destroy-event-task.ts:34](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/tasks/destroy-event-task.ts:34) |
| Undo %@ | [app/src/flux/tasks/syncback-event-task.ts:129](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/tasks/syncback-event-task.ts:129) |
| event change | [app/src/flux/tasks/syncback-event-task.ts:129](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/tasks/syncback-event-task.ts:129) |
| Saving event... | [app/src/flux/tasks/syncback-event-task.ts:161](/Users/to/Documents/logyxiao/Mailspring/app/src/flux/tasks/syncback-event-task.ts:161) |
| Mailspring could not read your saved passwords and cannot continue. | [app/src/key-manager.ts:140](/Users/to/Documents/logyxiao/Mailspring/app/src/key-manager.ts:140) |
|  On Linux, Mailspring stores passwords in your desktop keyring (KWallet, GNOME Keyring, or another Secret Service provider). Please make sure it is installed, running, and unlocked, then restart Mailspring. | [app/src/key-manager.ts:173](/Users/to/Documents/logyxiao/Mailspring/app/src/key-manager.ts:173) |
| Mailspring could not store your password securely because encryption is not available on this system. | [app/src/key-manager.ts:182](/Users/to/Documents/logyxiao/Mailspring/app/src/key-manager.ts:182) |
| Has attachment | [app/src/mail-rules-templates.ts:68](/Users/to/Documents/logyxiao/Mailspring/app/src/mail-rules-templates.ts:68) |
| Failed to activate plugin %@: %@ | [app/src/package-manager.ts:158](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:158) |
| Only install plugins from sources you trust | [app/src/package-manager.ts:201](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:201) |
| Mailspring plugins run in the application and have access to your email data. Only install plugins from developers you trust. | [app/src/package-manager.ts:202](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:202) |
| The plugin or theme you selected has an invalid or missing "name" field in its package.json. Names must match /^[a-zA-Z0-9._-]+$/. | [app/src/package-manager.ts:267](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:267) |
| The plugin or theme you selected has an unsafe "name" field in its package.json. | [app/src/package-manager.ts:285](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:285) |
| Failed to install the plugin or theme: %@ | [app/src/package-manager.ts:303](/Users/to/Documents/logyxiao/Mailspring/app/src/package-manager.ts:303) |
| Application toolbar | [app/src/sheet-container.tsx:131](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-container.tsx:131) |
| Email workspace | [app/src/sheet-container.tsx:182](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-container.tsx:182) |
| Window Controls | [app/src/sheet-toolbar.tsx:152](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:152) |
| Close window | [app/src/sheet-toolbar.tsx:158](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:158) |
| Minimize window | [app/src/sheet-toolbar.tsx:164](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:164) |
| Maximize window | [app/src/sheet-toolbar.tsx:170](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:170) |
| Application menu | [app/src/sheet-toolbar.tsx:204](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:204) |
| Sidebar toolbar | [app/src/sheet-toolbar.tsx:245](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:245) |
| Thread list toolbar | [app/src/sheet-toolbar.tsx:246](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:246) |
| Message toolbar | [app/src/sheet-toolbar.tsx:247](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:247) |
| Contact panel toolbar | [app/src/sheet-toolbar.tsx:248](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:248) |
| Toolbar | [app/src/sheet-toolbar.tsx:409](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet-toolbar.tsx:409) |
| Account sidebar | [app/src/sheet.tsx:13](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet.tsx:13) |
| Thread list | [app/src/sheet.tsx:14](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet.tsx:14) |
| Messages | [app/src/sheet.tsx:15](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet.tsx:15) |
| Contact panel | [app/src/sheet.tsx:16](/Users/to/Documents/logyxiao/Mailspring/app/src/sheet.tsx:16) |
| Mailspring needs to run in the background to check for new mail and show notifications. | [app/src/system-start-service.ts:184](/Users/to/Documents/logyxiao/Mailspring/app/src/system-start-service.ts:184) |
| Failed to Open Link | [app/src/window-event-handler.ts:374](/Users/to/Documents/logyxiao/Mailspring/app/src/window-event-handler.ts:374) |
| Mailspring was unable to open the link in your browser.<br><br>%@ | [app/src/window-event-handler.ts:375](/Users/to/Documents/logyxiao/Mailspring/app/src/window-event-handler.ts:375) |

### account-sidebar（8 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Mailboxes | [app/internal_packages/account-sidebar/lib/components/account-sidebar.tsx:72](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/components/account-sidebar.tsx:72) |
| Account switcher | [app/internal_packages/account-sidebar/lib/components/account-switcher.tsx:54](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/components/account-switcher.tsx:54) |
| The mbox export did not complete, so the existing file at the destination was left unchanged. The messages exported so far are in %@. | [app/internal_packages/account-sidebar/lib/mbox-export-runner.ts:139](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/mbox-export-runner.ts:139) |
| Could not write the mbox file. The export will finish the next time Mailspring launches; the messages fetched so far remain in %@. | [app/internal_packages/account-sidebar/lib/mbox-export-runner.ts:164](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/mbox-export-runner.ts:164) |
| Export folder as .eml files | [app/internal_packages/account-sidebar/lib/sidebar-item.ts:95](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/sidebar-item.ts:95) |
| Export | [app/internal_packages/account-sidebar/lib/sidebar-item.ts:96](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/sidebar-item.ts:96) |
| Export folder as .mbox file | [app/internal_packages/account-sidebar/lib/sidebar-item.ts:126](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/sidebar-item.ts:126) |
| An mbox export to this file is already in progress. | [app/internal_packages/account-sidebar/lib/sidebar-item.ts:142](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/account-sidebar/lib/sidebar-item.ts:142) |

### activity（97 条）

| 英文原文 | 首次调用位置 |
|---|---|
| 1 event | [app/internal_packages/activity/lib/activity-events.ts:35](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/activity-events.ts:35) |
| %@ events | [app/internal_packages/activity/lib/activity-events.ts:35](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/activity-events.ts:35) |
| Link | [app/internal_packages/activity/lib/dashboard/metrics-components.tsx:228](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/metrics-components.tsx:228) |
| Total Clicks | [app/internal_packages/activity/lib/dashboard/metrics-components.tsx:231](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/metrics-components.tsx:231) |
| < 5m | [app/internal_packages/activity/lib/dashboard/root.tsx:38](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:38) |
| < 30m | [app/internal_packages/activity/lib/dashboard/root.tsx:39](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:39) |
| < 1h | [app/internal_packages/activity/lib/dashboard/root.tsx:40](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:40) |
| < 4h | [app/internal_packages/activity/lib/dashboard/root.tsx:41](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:41) |
| < 1d | [app/internal_packages/activity/lib/dashboard/root.tsx:42](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:42) |
| < 3d | [app/internal_packages/activity/lib/dashboard/root.tsx:43](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:43) |
| 3d+ | [app/internal_packages/activity/lib/dashboard/root.tsx:44](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:44) |
| < 1m | [app/internal_packages/activity/lib/dashboard/root.tsx:75](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:75) |
| %@d %@h | [app/internal_packages/activity/lib/dashboard/root.tsx:81](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:81) |
| %@d | [app/internal_packages/activity/lib/dashboard/root.tsx:81](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:81) |
| %@h %@m | [app/internal_packages/activity/lib/dashboard/root.tsx:84](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:84) |
| %@h | [app/internal_packages/activity/lib/dashboard/root.tsx:84](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:84) |
| %@m | [app/internal_packages/activity/lib/dashboard/root.tsx:86](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:86) |
| %@ of %@ opened | [app/internal_packages/activity/lib/dashboard/root.tsx:112](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:112) |
| %@ replies | [app/internal_packages/activity/lib/dashboard/root.tsx:510](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:510) |
| %@ first opens | [app/internal_packages/activity/lib/dashboard/root.tsx:516](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:516) |
| %@ messages | [app/internal_packages/activity/lib/dashboard/root.tsx:522](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:522) |
| not enabled on any | [app/internal_packages/activity/lib/dashboard/root.tsx:624](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:624) |
| only enabled on %@% | [app/internal_packages/activity/lib/dashboard/root.tsx:625](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:625) |
| Received by Time of Day | [app/internal_packages/activity/lib/dashboard/root.tsx:652](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:652) |
| Replies and Response Time | [app/internal_packages/activity/lib/dashboard/root.tsx:657](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:657) |
| Your Response Time | [app/internal_packages/activity/lib/dashboard/root.tsx:660](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:660) |
| Median. You replied to %@ of %@ threads that emailed you (%@%). | [app/internal_packages/activity/lib/dashboard/root.tsx:662](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:662) |
| Recipient Response Time | [app/internal_packages/activity/lib/dashboard/root.tsx:672](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:672) |
| Median. %@ of %@ threads you started got a reply (%@%). | [app/internal_packages/activity/lib/dashboard/root.tsx:674](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:674) |
| These features were %@ of the messages you sent<br>            in this time period, so these numbers do not reflect all of your activity. To enable<br>            read receipts and link tracking on emails you send, click the %@ or link tracking %@ icons in the composer. | [app/internal_packages/activity/lib/dashboard/root.tsx:688](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:688) |
| %@ of %@ tracked messages were opened | [app/internal_packages/activity/lib/dashboard/root.tsx:710](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:710) |
| %@ of %@ tracked messages had a link clicked | [app/internal_packages/activity/lib/dashboard/root.tsx:726](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:726) |
| %@ of %@ threads you started got a reply | [app/internal_packages/activity/lib/dashboard/root.tsx:742](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:742) |
| Time to First Open | [app/internal_packages/activity/lib/dashboard/root.tsx:757](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:757) |
| Open Rate by Hour Sent | [app/internal_packages/activity/lib/dashboard/root.tsx:760](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:760) |
| Open Rate by Day Sent | [app/internal_packages/activity/lib/dashboard/root.tsx:763](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:763) |
| Subject Lines with the Highest Reply Rate | [app/internal_packages/activity/lib/dashboard/root.tsx:770](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:770) |
| Best Links | [app/internal_packages/activity/lib/dashboard/root.tsx:784](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:784) |
| Links with the Highest Click Rate | [app/internal_packages/activity/lib/dashboard/root.tsx:786](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:786) |
| Send messages with link tracking enabled to see which links recipients click most. | [app/internal_packages/activity/lib/dashboard/root.tsx:789](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/dashboard/root.tsx:789) |
| Search by name, email, or domain… | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:246](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:246) |
| Recipients | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:254](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:254) |
| Domains | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:255](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:255) |
| Recent | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:262](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:262) |
| Score | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:263](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:263) |
| Hide colleagues | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:272](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:272) |
| 1 recipient | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:277](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:277) |
| %@ recipients | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:278](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:278) |
| Export CSV | [app/internal_packages/activity/lib/engagement/engagement-board.tsx:284](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-board.tsx:284) |
| Replied | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:14](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:14) |
| 1 sent | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:45](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:45) |
| %@ sent | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:45](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:45) |
| %@ tracked | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:46](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:46) |
| 1 open | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:47](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:47) |
| %@ opens | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:47](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:47) |
| 1 click | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:48](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:48) |
| %@ clicks | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:48](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:48) |
| 1 reply | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:49](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:49) |
| avg. %@ to open | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:53](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:53) |
| Sent %@ · no activity | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:115](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:115) |
| 1 contact | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:130](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:130) |
| %@ contacts | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:131](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:131) |
| Compose Email | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:153](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:153) |
| View Events | [app/internal_packages/activity/lib/engagement/engagement-card.tsx:158](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-card.tsx:158) |
| Highly engaged | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:28](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:28) |
| Engaged | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:30) |
| Not engaged | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:32) |
| Replied, clicked a link, or opened a tracked message three or more times | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:39](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:39) |
| Opened at least one tracked message | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:41](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:41) |
| No opens or clicks on tracked messages, and no replies | [app/internal_packages/activity/lib/engagement/engagement-tiers.ts:43](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/engagement/engagement-tiers.ts:43) |
| No opens or clicks yet | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:17](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:17) |
| See who opens your email and clicks your links | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:18](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:18) |
| Your tracked messages will show up here as soon as a recipient opens one or clicks a link. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:22](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:22) |
| Read receipts and link tracking are on by default for the messages you compose. Every open, click, and reply on a tracked message shows up here. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:25](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:25) |
| Compose a new message or reply. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:31](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:31) |
| Check that the read receipts icon | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:34](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:34) |
| and the link tracking icon | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:38](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:38) |
| in the composer toolbar are blue. Click either one to turn it on or off. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:43](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:43) |
| Send it. Opens and clicks appear here, in the message itself, and as notifications. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:48](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:48) |
| Mailspring remembers the last setting you chose for new messages. Plain-text messages cannot be tracked, and free accounts include a limited number of tracked messages. | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:55](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:55) |
| Compose a message | [app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:60](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-empty-state.tsx:60) |
| Compose a message to %@ | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:67](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:67) |
| Open this message | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:81](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:81) |
| %@ after sending | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:128](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:128) |
| %@ times in total; this is the first | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:146](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:146) |
| sent %@ | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:185](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:185) |
| avg. %@ after sending | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:191](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:191) |
| When | [app/internal_packages/activity/lib/feed/activity-feed-table.tsx:208](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-table.tsx:208) |
| Search by recipient, subject, or link… | [app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:42](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:42) |
| Clicks | [app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:52](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:52) |
| Group by | [app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:56](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:56) |
| Collapse repeated events | [app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:74](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed-toolbar.tsx:74) |
| No activity matches your filters. | [app/internal_packages/activity/lib/feed/activity-feed.tsx:156](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/feed/activity-feed.tsx:156) |
| View activity (%@) | [app/internal_packages/activity/lib/list/activity-list-button.tsx:52](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/list/activity-list-button.tsx:52) |
| Feed | [app/internal_packages/activity/lib/root.tsx:16](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/root.tsx:16) |
| Engagement | [app/internal_packages/activity/lib/root.tsx:17](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/root.tsx:17) |
| Reports | [app/internal_packages/activity/lib/root.tsx:18](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/activity/lib/root.tsx:18) |

### category-picker（1 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Category Actions | [app/internal_packages/category-picker/lib/toolbar-category-picker.tsx:57](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/category-picker/lib/toolbar-category-picker.tsx:57) |

### composer（7 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Attaching… | [app/internal_packages/composer/lib/attachments-area.tsx:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/attachments-area.tsx:32) |
| Reply-To | [app/internal_packages/composer/lib/composer-header-actions.tsx:68](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-header-actions.tsx:68) |
| Composer header actions | [app/internal_packages/composer/lib/composer-header-actions.tsx:112](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-header-actions.tsx:112) |
| Message addressing | [app/internal_packages/composer/lib/composer-header.tsx:271](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-header.tsx:271) |
| One or more of the conversations have no message that can be attached. | [app/internal_packages/composer/lib/composer-view.tsx:381](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-view.tsx:381) |
| One or more of the original messages could not be downloaded. Please try again. | [app/internal_packages/composer/lib/composer-view.tsx:386](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-view.tsx:386) |
| Composer Actions | [app/internal_packages/composer/lib/composer-view.tsx:557](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer/lib/composer-view.tsx:557) |

### composer-grammar-check（7 条）

| 英文原文 | 首次调用位置 |
|---|---|
| You can grammar check %1$@ drafts each %2$@ with Mailspring Basic. Upgrade to Pro for unlimited grammar checking. | [app/internal_packages/composer-grammar-check/lib/grammar-check-store.ts:9](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/grammar-check-store.ts:9) |
| Grammar check: usage limit reached | [app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:81](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:81) |
| Grammar check: %@ issue(s) | [app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:85](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:85) |
| Grammar check: no issues | [app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:86](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:86) |
| Enable grammar check | [app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:88](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/grammar-check-toggle.tsx:88) |
| Check your grammar | [app/internal_packages/composer-grammar-check/lib/main.ts:10](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/main.ts:10) |
| Enable grammar checking to find writing issues as you compose. Text is sent to Mailspring's LanguageTool service and is not stored. | [app/internal_packages/composer-grammar-check/lib/main.ts:11](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-grammar-check/lib/main.ts:11) |

### composer-signature（4 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Signature Name | [app/internal_packages/composer-signature/lib/preferences-signatures.tsx:150](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-signature/lib/preferences-signatures.tsx:150) |
| Signature HTML | [app/internal_packages/composer-signature/lib/preferences-signatures.tsx:182](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-signature/lib/preferences-signatures.tsx:182) |
| Moving from another mail app? Select your existing signature in an email and copy-paste it into the box above. | [app/internal_packages/composer-signature/lib/preferences-signatures.tsx:194](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-signature/lib/preferences-signatures.tsx:194) |
| Photo URL | [app/internal_packages/composer-signature/lib/signature-photo-picker.tsx:223](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-signature/lib/signature-photo-picker.tsx:223) |

### composer-templates（3 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Template Name | [app/internal_packages/composer-templates/lib/preferences-templates.tsx:73](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-templates/lib/preferences-templates.tsx:73) |
| Subject (optional) | [app/internal_packages/composer-templates/lib/preferences-templates.tsx:91](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-templates/lib/preferences-templates.tsx:91) |
| The subject is filled into your draft when you use the template. Leave it blank to keep the subject you already have. | [app/internal_packages/composer-templates/lib/preferences-templates.tsx:110](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/composer-templates/lib/preferences-templates.tsx:110) |

### contacts（16 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Export vCard | [app/internal_packages/contacts/lib/ContactDetailToolbar.tsx:130](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactDetailToolbar.tsx:130) |
| Select an Account | [app/internal_packages/contacts/lib/ContactList.tsx:150](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactList.tsx:150) |
| Please select a specific account from the sidebar before importing contacts. | [app/internal_packages/contacts/lib/ContactList.tsx:151](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactList.tsx:151) |
| Drop to Import VCards | [app/internal_packages/contacts/lib/ContactList.tsx:178](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactList.tsx:178) |
| Export vCard... | [app/internal_packages/contacts/lib/ContactListContextMenu.ts:33](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactListContextMenu.ts:33) |
| Export %@ vCards... | [app/internal_packages/contacts/lib/ContactListContextMenu.ts:34](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/ContactListContextMenu.ts:34) |
| Import Not Supported | [app/internal_packages/contacts/lib/VCFImportExport.ts:196](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/VCFImportExport.ts:196) |
| Importing VCards is not supported for Google accounts. Please use contacts.google.com to import contacts into this account. | [app/internal_packages/contacts/lib/VCFImportExport.ts:197](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/VCFImportExport.ts:197) |
| No Contacts Found | [app/internal_packages/contacts/lib/VCFImportExport.ts:218](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/VCFImportExport.ts:218) |
| No valid contacts were found in the selected file(s). | [app/internal_packages/contacts/lib/VCFImportExport.ts:219](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/VCFImportExport.ts:219) |
| Import VCards | [app/internal_packages/contacts/lib/VCFImportExport.ts:251](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/VCFImportExport.ts:251) |
| Import vCards... | [app/internal_packages/contacts/lib/main.tsx:28](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/main.tsx:28) |
| Export All vCards... | [app/internal_packages/contacts/lib/main.tsx:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/main.tsx:32) |
| Export Selected... | [app/internal_packages/contacts/lib/main.tsx:36](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/main.tsx:36) |
| No Compatible Account | [app/internal_packages/contacts/lib/main.tsx:96](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/main.tsx:96) |
| VCard import requires at least one CardDAV account. Google accounts must be managed via contacts.google.com. | [app/internal_packages/contacts/lib/main.tsx:97](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/contacts/lib/main.tsx:97) |

### events（5 条）

| 英文原文 | 首次调用位置 |
|---|---|
| %1$@ has %2$@ this event | [app/internal_packages/events/lib/event-header.tsx:244](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/events/lib/event-header.tsx:244) |
| This event has been cancelled by %@ | [app/internal_packages/events/lib/event-header.tsx:256](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/events/lib/event-header.tsx:256) |
| This event has been cancelled | [app/internal_packages/events/lib/event-header.tsx:257](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/events/lib/event-header.tsx:257) |
| Sorry, this event does not have an organizer or the organizer's address is not a valid email address: %@ | [app/internal_packages/events/lib/event-header.tsx:314](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/events/lib/event-header.tsx:314) |
| Sorry, we couldn't find your email address in this event's attendee list, so an RSVP reply could not be sent. | [app/internal_packages/events/lib/event-header.tsx:339](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/events/lib/event-header.tsx:339) |

### list-unsubscribe（4 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Unsubscribing... | [app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:139](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:139) |
| Unsubscribed | [app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:145](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:145) |
| Unsubscribe failed | [app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:151](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:151) |
| Try again | [app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:153](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/list-unsubscribe/lib/unsubscribe-header.tsx:153) |

### main-calendar（75 条）

| 英文原文 | 首次调用位置 |
|---|---|
| All day | [app/internal_packages/main-calendar/lib/core/agenda-view.tsx:136](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/agenda-view.tsx:136) |
| (No title) | [app/internal_packages/main-calendar/lib/core/agenda-view.tsx:206](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/agenda-view.tsx:206) |
| No events | [app/internal_packages/main-calendar/lib/core/agenda-view.tsx:231](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/agenda-view.tsx:231) |
| 5 minutes before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:24](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:24) |
| 10 minutes before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:25](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:25) |
| 15 minutes before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:26](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:26) |
| 30 minutes before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:27](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:27) |
| 1 hour before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:28](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:28) |
| 2 hours before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:29](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:29) |
| 1 day before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:30) |
| 2 days before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:31](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:31) |
| 1 week before | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:32) |
| alert: | [app/internal_packages/main-calendar/lib/core/alert-selector.tsx:37](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/alert-selector.tsx:37) |
| all-day: | [app/internal_packages/main-calendar/lib/core/all-day-toggle.tsx:13](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/all-day-toggle.tsx:13) |
| No Calendars | [app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:13](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:13) |
| None of your connected accounts provide calendars. Mailspring supports calendars from Gmail and other providers with CalDAV support. | [app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:15](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:15) |
| Add a Calendar Account | [app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:20](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-empty-state.tsx:20) |
| New Event | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:222](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:222) |
| Update Failed | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:276](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:276) |
| Failed to update the event. Please try again. | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:277](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:277) |
| Edit event | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:351](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:351) |
| Edit occurrence | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:403](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:403) |
| Event title | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:492](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:492) |
| starts: | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:531](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:531) |
| ends: | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:538](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:538) |
| Add Invitees | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:598](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:598) |
| Add notes or URL... | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:618](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:618) |
| Add Notes or URL | [app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:624](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-event-popover.tsx:624) |
| This calendar is read-only, so its events can't be changed or deleted. | [app/internal_packages/main-calendar/lib/core/calendar-helpers.tsx:388](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/calendar-helpers.tsx:388) |
| Search events | [app/internal_packages/main-calendar/lib/core/event-search-bar.tsx:267](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/event-search-bar.tsx:267) |
| Previous | [app/internal_packages/main-calendar/lib/core/header-controls.tsx:47](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/header-controls.tsx:47) |
| Location or Video Call | [app/internal_packages/main-calendar/lib/core/location-video-input.tsx:31](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/location-video-input.tsx:31) |
| Add Location or Video Call | [app/internal_packages/main-calendar/lib/core/location-video-input.tsx:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/location-video-input.tsx:32) |
| Add Video Call | [app/internal_packages/main-calendar/lib/core/location-video-input.tsx:40](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/location-video-input.tsx:40) |
| %1$@ of the %2$@ selected events will be deleted. The rest are on read-only calendars and can't be changed. | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:421](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:421) |
| Are you sure you want to delete or decline invitations for the selected event(s)? | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:426](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:426) |
| Delete Failed | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:495](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:495) |
| Failed to delete the event. Please try again. | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:496](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:496) |
| Delete occurrence | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:524](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:524) |
| This occurrence could not be found in its series. Refresh the calendar and try again. | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:546](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:546) |
| Resize event | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:787](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:787) |
| Move event | [app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:787](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/mailspring-calendar.tsx:787) |
| +%@ more | [app/internal_packages/main-calendar/lib/core/month-view-day-cell.tsx:120](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/month-view-day-cell.tsx:120) |
| Edit recurring event | [app/internal_packages/main-calendar/lib/core/recurring-event-actions.ts:184](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-actions.ts:184) |
| Move | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:23](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:23) |
| Resize | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:24](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:24) |
| move | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:30) |
| resize | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:31](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:31) |
| delete | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:32](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:32) |
| edit | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:33](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:33) |
| This occurrence only | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:39](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:39) |
| All occurrences | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:40](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:40) |
| Recurring Event | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:45](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:45) |
| %1$@ recurring event "%2$@"? | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:46](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:46) |
| This is a recurring event. Do you want to %1$@ only this occurrence, or all occurrences in the series? | [app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:47](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/recurring-event-dialog.ts:47) |
| Every Day | [app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:14](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:14) |
| Every Week | [app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:15](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:15) |
| Every Month | [app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:16](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:16) |
| Every Year | [app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:17](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:17) |
| repeat: | [app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:22](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/repeat-selector.tsx:22) |
| Busy | [app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:8](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:8) |
| Free | [app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:9](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:9) |
| Tentative | [app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:10](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:10) |
| show as: | [app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:20](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/show-as-selector.tsx:20) |
| time zone: | [app/internal_packages/main-calendar/lib/core/timezone-selector.tsx:58](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/core/timezone-selector.tsx:58) |
| Calendar | [app/internal_packages/main-calendar/lib/main.tsx:22](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:22) |
| Delete Event | [app/internal_packages/main-calendar/lib/main.tsx:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:30) |
| By Day | [app/internal_packages/main-calendar/lib/main.tsx:35](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:35) |
| By Week | [app/internal_packages/main-calendar/lib/main.tsx:39](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:39) |
| By Month | [app/internal_packages/main-calendar/lib/main.tsx:43](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:43) |
| Agenda | [app/internal_packages/main-calendar/lib/main.tsx:47](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:47) |
| Go to Today | [app/internal_packages/main-calendar/lib/main.tsx:52](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:52) |
| Find Events | [app/internal_packages/main-calendar/lib/main.tsx:65](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:65) |
| Refresh Calendars | [app/internal_packages/main-calendar/lib/main.tsx:70](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/main.tsx:70) |
| Create new event | [app/internal_packages/main-calendar/lib/quick-event-button.tsx:29](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/main-calendar/lib/quick-event-button.tsx:29) |

### mcp-server（34 条）

| 英文原文 | 首次调用位置 |
|---|---|
| MCP Server | [app/internal_packages/mcp-server/lib/main.ts:19](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/main.ts:19) |
| No folders found | [app/internal_packages/mcp-server/lib/preferences-mcp-accounts.tsx:135](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-accounts.tsx:135) |
| Activity Log | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:37](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:37) |
| Clear Log | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:39](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:39) |
| No tool calls recorded yet. | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:43](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:43) |
| Time | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:49](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:49) |
| Tool | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:50](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:50) |
| Parameters | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:51](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:51) |
| Result | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:52](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:52) |
| Duration | [app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:53](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp-audit.tsx:53) |
| Read the threads in my inbox using Mailspring - what should I prioritize? Draft a reply to the most important message. | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:77](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:77) |
| Added! | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:136](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:136) |
| Adding… | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:216](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:216) |
| The MCP server lets AI assistants (like Claude Desktop) read and interact with your email. | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:288](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:288) |
| Enable MCP Server | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:296](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:296) |
| Running | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:301](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:301) |
| Stopped | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:301](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:301) |
| Quick Setup | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:313](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:313) |
| Add Mailspring to your AI tools with one click. This writes the connection details to each tool's config file. | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:315](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:315) |
| Add to Claude Desktop | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:321](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:321) |
| Add to ChatGPT Desktop | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:326](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:326) |
| Add to Claude Code | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:331](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:331) |
| Try It! | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:339](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:339) |
| Note: Restart Claude / ChatGPT and start a new chat, existing chats may not see the new connector. | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:341](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:341) |
| Connection | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:357](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:357) |
| Access Level | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:370](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:370) |
| Read Only | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:372](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:372) |
| Read & Write | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:373](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:373) |
| Read, Write & Send | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:374](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:374) |
| Endpoint | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:378](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:378) |
| Bearer Token | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:382](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:382) |
| Regenerate token | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:389](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:389) |
| Account Access | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:400](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:400) |
| Choose which accounts and folders the MCP server can access. All accounts are enabled by default. | [app/internal_packages/mcp-server/lib/preferences-mcp.tsx:402](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/mcp-server/lib/preferences-mcp.tsx:402) |

### message-list（15 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Email message | [app/internal_packages/message-list/lib/email-frame.tsx:224](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/email-frame.tsx:224) |
| Previous result | [app/internal_packages/message-list/lib/find-in-thread.tsx:134](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/find-in-thread.tsx:134) |
| Next result | [app/internal_packages/message-list/lib/find-in-thread.tsx:147](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/find-in-thread.tsx:147) |
| Save Email | [app/internal_packages/message-list/lib/message-controls.tsx:104](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-controls.tsx:104) |
| Download as .eml | [app/internal_packages/message-list/lib/message-controls.tsx:137](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-controls.tsx:137) |
| Could not retrieve the original message. Please try again. | [app/internal_packages/message-list/lib/message-controls.tsx:175](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-controls.tsx:175) |
| Unknown | [app/internal_packages/message-list/lib/message-item.tsx:337](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-item.tsx:337) |
| Message from %@ | [app/internal_packages/message-list/lib/message-item.tsx:341](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-item.tsx:341) |
| Could not download the original message. Please try again. | [app/internal_packages/message-list/lib/message-list.tsx:160](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-list.tsx:160) |
| %@ on %@: %@ | [app/internal_packages/message-list/lib/message-list.tsx:350](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-list.tsx:350) |
| Message from %@ on %@ | [app/internal_packages/message-list/lib/message-list.tsx:351](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-list.tsx:351) |
| %@ older messages | [app/internal_packages/message-list/lib/message-list.tsx:557](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/message-list.tsx:557) |
| Contact information | [app/internal_packages/message-list/lib/sidebar-plugin-container.tsx:45](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/sidebar-plugin-container.tsx:45) |
| Switch email view to light mode | [app/internal_packages/message-list/lib/subject-line-icons.tsx:49](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/subject-line-icons.tsx:49) |
| Switch email view to dark mode | [app/internal_packages/message-list/lib/subject-line-icons.tsx:50](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/message-list/lib/subject-line-icons.tsx:50) |

### notifications（5 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Could not set as default mail client | [app/internal_packages/notifications/lib/items/default-client-notif.tsx:58](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/items/default-client-notif.tsx:58) |
| Mailspring could not find the xdg-mime utility. Please install the xdg-utils package using your system package manager (e.g. apt install xdg-utils) and try again from Preferences > General. | [app/internal_packages/notifications/lib/items/default-client-notif.tsx:59](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/items/default-client-notif.tsx:59) |
| Preparing export... | [app/internal_packages/notifications/lib/sidebar/export-activity.tsx:28](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/sidebar/export-activity.tsx:28) |
| Exporting... %1$@ / %2$@ (%3$@ failed) | [app/internal_packages/notifications/lib/sidebar/export-activity.tsx:30](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/sidebar/export-activity.tsx:30) |
| Exporting... %1$@ / %2$@ | [app/internal_packages/notifications/lib/sidebar/export-activity.tsx:37](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/notifications/lib/sidebar/export-activity.tsx:37) |

### onboarding（13 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Note | [app/internal_packages/onboarding/lib/account-providers.tsx:16](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/account-providers.tsx:16) |
| Office 365 accounts require IMAP and Authenticated SMTP to be enabled. Your organization's admin may need to enable these in the Microsoft 365 Admin Center. %@ | [app/internal_packages/onboarding/lib/account-providers.tsx:17](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/account-providers.tsx:17) |
| If you have trouble connecting, you may need to enable IMAP and SMTP access in your Microsoft account settings. %@ | [app/internal_packages/onboarding/lib/account-providers.tsx:60](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/account-providers.tsx:60) |
| A network error occurred. Please check your internet connection and try again. | [app/internal_packages/onboarding/lib/oauth-signin-page.tsx:112](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/oauth-signin-page.tsx:112) |
| Custom Port | [app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:133](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:133) |
| Server | [app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:209](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:209) |
| Username | [app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:216](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:216) |
| Custom Container Folder | [app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:228](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-imap.tsx:228) |
| Connect a shared mailbox | [app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:72](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:72) |
| Enter the address of the shared mailbox, then sign in with your own Office 365 account. Your account needs "Full Access" permission on the shared mailbox to read mail, and "Send As" permission to send from its address. Without "Send As", the mailbox connects read-only and sending will fail. | [app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:74](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:74) |
| Shared mailbox address | [app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:87](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:87) |
| Shared mailbox: %@ | [app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:138](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:138) |
| Change | [app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:143](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/page-account-settings-o365.tsx:143) |

### preferences（16 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Preferences tabs | [app/internal_packages/preferences/lib/preferences-tabs-bar.tsx:122](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/preferences-tabs-bar.tsx:122) |
| Contributed: | [app/internal_packages/preferences/lib/tabs/language-section.tsx:36](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/language-section.tsx:36) |
| Automatically CC or BCC recipients | [app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:29](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:29) |
| Comma-separated email addresses to automatically CC or BCC | [app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:42](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:42) |
| Add Shared Mailbox... | [app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:378](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-account-details.tsx:378) |
| Interface Scale | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:41](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:41) |
| (Native menu bar may not appear on Wayland. A menu button will be shown as a fallback.) | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:71](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:71) |
| No unread status indication | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:214](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:214) |
| (The tray icon always shows the default appearance regardless of unread messages.) | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:215](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:215) |
| (Detect from system theme. On GNOME/Unity, assumes a dark tray background.) | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:265](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:265) |
| Light tray background | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:269](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:269) |
| (Use dark icons for a light tray.) | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:270](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:270) |
| Dark tray background | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:272](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:272) |
| (Use light icons for a dark tray.) | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:272](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:272) |
| Tray icon theme | [app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:277](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-appearance.tsx:277) |
| All of the mail rules for this account are disabled. Re-enable at least one rule before processing your inbox. | [app/internal_packages/preferences/lib/tabs/preferences-mail-rules.tsx:120](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/preferences/lib/tabs/preferences-mail-rules.tsx:120) |

### print（2 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Save as PDF Failed | [app/internal_packages/print/lib/print-window.ts:113](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/print/lib/print-window.ts:113) |
| Mailspring could not generate the PDF. Please try again. If the problem persists, try printing to a PDF printer instead.<br><br>Error: %@ | [app/internal_packages/print/lib/print-window.ts:114](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/print/lib/print-window.ts:114) |

### theme-picker（2 条）

| 英文原文 | 首次调用位置 |
|---|---|
| When light | [app/internal_packages/theme-picker/lib/theme-picker.tsx:119](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/theme-picker/lib/theme-picker.tsx:119) |
| When dark | [app/internal_packages/theme-picker/lib/theme-picker.tsx:135](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/theme-picker/lib/theme-picker.tsx:135) |

### thread-list（11 条）

| 英文原文 | 首次调用位置 |
|---|---|
| No Subject | [app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:16](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:16) |
| %1$@ messages | [app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:24](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:24) |
| has attachment | [app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:26](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:26) |
| starred | [app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:27](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-aria-utils.ts:27) |
| Forward as Attachment | [app/internal_packages/thread-list/lib/thread-list-context-menu.ts:168](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-context-menu.ts:168) |
| Save %1$@ threads as .eml... | [app/internal_packages/thread-list/lib/thread-list-context-menu.ts:321](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-context-menu.ts:321) |
| Save as .eml... | [app/internal_packages/thread-list/lib/thread-list-context-menu.ts:322](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-context-menu.ts:322) |
| Save .eml files to... | [app/internal_packages/thread-list/lib/thread-list-context-menu.ts:347](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-context-menu.ts:347) |
| Save All | [app/internal_packages/thread-list/lib/thread-list-context-menu.ts:348](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-list-context-menu.ts:348) |
| Flag Actions | [app/internal_packages/thread-list/lib/thread-toolbar-buttons.tsx:450](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-toolbar-buttons.tsx:450) |
| Move Actions | [app/internal_packages/thread-list/lib/thread-toolbar-buttons.tsx:464](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/thread-list/lib/thread-toolbar-buttons.tsx:464) |

### unread-notifications（1 条）

| 英文原文 | 首次调用位置 |
|---|---|
| Reply to %@... | [app/internal_packages/unread-notifications/lib/main.ts:164](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/unread-notifications/lib/main.ts:164) |

## 其他检查结果与范围限制

- zh-CN.json 中“Snooze”原样保留为英文；日期格式代码、Mailspring Pro 和 YouTube 不能仅凭与英文相同就认定缺少翻译。
- Medium Handle 当前译为“中间处理程序”：[app/lang/zh-CN.json:419](/Users/to/Documents/logyxiao/Mailspring/app/lang/zh-CN.json:419)。
- OAuth 端口提示使用含变量的模板字符串作为翻译 key：[app/internal_packages/onboarding/lib/oauth-signin-page.tsx:91](/Users/to/Documents/logyxiao/Mailspring/app/internal_packages/onboarding/lib/oauth-signin-page.tsx:91)。应使用固定词条与占位符，避免不同端口生成不同 key。
- 本次没有改变语言包、功能代码、账号配置或邮件数据；新增的这份文档仅记录审计结果。
- 运行界面抽查范围为主侧栏、通用、外观、签名与设置标签。其余条目根据源码和运行时回退逻辑确认，未逐一打开所有对话框。
- 外部登录网页、邮件正文、用户自定义名称、第三方 PDF 查看器等不计入这次源码词条统计。条件表达式、数组、动态字符串等仍可能存在未被静态提取捕获的文案，数字是本次扫描口径下的结果。
