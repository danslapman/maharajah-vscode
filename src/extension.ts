import * as vscode from 'vscode';
import { ServerManager, ServerConfig } from './serverManager';
import type { ServerState } from './serverManager';
import { MaharajahClient } from './maharajahClient';
import { MaharajahStatusBar } from './statusBar';
import { openSearchUI } from './searchUI';

let serverManager: ServerManager | undefined;
let statusBar: MaharajahStatusBar | undefined;
let client: MaharajahClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  serverManager = new ServerManager();
  statusBar = new MaharajahStatusBar();

  context.subscriptions.push(serverManager, statusBar);

  context.subscriptions.push(
    serverManager.onStateChange((state) => {
      statusBar?.update(state);
    })
  );

  const buildClient = (): MaharajahClient => {
    const cfg = vscode.workspace.getConfiguration('maharajah');
    return new MaharajahClient(
      cfg.get<string>('host', '127.0.0.1'),
      cfg.get<number>('port', 8080)
    );
  };

  const buildServerConfig = (): ServerConfig => {
    const cfg = vscode.workspace.getConfiguration('maharajah');
    const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceDir) {
      throw new Error('Maharajah requires an open workspace folder.');
    }
    return {
      binaryPath: cfg.get<string>('binaryPath', 'mh'),
      host: cfg.get<string>('host', '127.0.0.1'),
      port: cfg.get<number>('port', 8080),
      workspaceDir,
    };
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('maharajah')) {
        client = buildClient();
      }
    })
  );

  client = buildClient();

  context.subscriptions.push(
    vscode.commands.registerCommand('maharajah.startServer', async () => {
      try {
        await serverManager!.start(buildServerConfig());
        client = buildClient();
      } catch (err) {
        vscode.window.showErrorMessage(`Maharajah: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('maharajah.stopServer', () => {
      serverManager!.stop();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('maharajah.restartServer', async () => {
      try {
        await serverManager!.restart(buildServerConfig());
        client = buildClient();
      } catch (err) {
        vscode.window.showErrorMessage(`Maharajah: ${(err as Error).message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('maharajah.search', async () => {
      if (serverManager!.state !== 'running') {
        const choice = await vscode.window.showWarningMessage(
          'Maharajah server is not running.',
          'Start Server'
        );
        if (choice !== 'Start Server') {
          return;
        }
        await vscode.commands.executeCommand('maharajah.startServer');
        // If startup failed, startServer will have shown an error — bail out.
        // Cast to break out of TypeScript's control-flow narrowing from the outer if.
        if ((serverManager!.state as ServerState) !== 'running') {
          return;
        }
      }

      const cfg = vscode.workspace.getConfiguration('maharajah');
      await openSearchUI(
        client!,
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        cfg.get<number>('searchLimit', 20),
        cfg.get<number>('debounceMs', 300)
      );
    })
  );

  // Auto-start if configured and a workspace is open.
  const cfg = vscode.workspace.getConfiguration('maharajah');
  if (cfg.get<boolean>('autoStart', true) && vscode.workspace.workspaceFolders?.length) {
    try {
      serverManager.start(buildServerConfig()).catch((err: Error) => {
        vscode.window.showErrorMessage(`Maharajah auto-start failed: ${err.message}`);
      });
    } catch {
      // No workspace folder — skip silently.
    }
  }
}

export function deactivate(): void {
  serverManager?.stop();
}
