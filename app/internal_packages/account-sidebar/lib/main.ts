import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import AccountSidebar from './components/account-sidebar';
import { activateMboxExportRunner, deactivateMboxExportRunner } from './mbox-export-runner';
import { exportSentRecipients } from './sent-recipient-export';

let exportCommands: { dispose: () => void };

export function activate(state) {
  ComponentRegistry.register(AccountSidebar, { location: WorkspaceStore.Location.RootSidebar });
  activateMboxExportRunner();
  exportCommands = AppEnv.commands.add(document.body, {
    'window:export-sent-recipients': exportSentRecipients,
  });
}

export function deactivate(state) {
  ComponentRegistry.unregister(AccountSidebar);
  deactivateMboxExportRunner();
  exportCommands?.dispose();
}
