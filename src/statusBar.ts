import * as vscode from 'vscode';
import { ServerState } from './serverManager';

export class MaharajahStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      10
    );
    this.item.name = 'Maharajah Server';
    this.update('stopped');
    this.item.show();
  }

  update(state: ServerState): void {
    switch (state) {
      case 'stopped':
        this.item.text = '$(circle-slash) Maharajah';
        this.item.tooltip = 'Maharajah server is stopped. Click to start.';
        this.item.command = 'maharajah.startServer';
        this.item.backgroundColor = undefined;
        break;
      case 'starting':
        this.item.text = '$(sync~spin) Maharajah';
        this.item.tooltip = 'Maharajah server is starting...';
        this.item.command = undefined;
        this.item.backgroundColor = undefined;
        break;
      case 'running':
        this.item.text = '$(search) Maharajah';
        this.item.tooltip = 'Maharajah server is running. Click to search.';
        this.item.command = 'maharajah.search';
        this.item.backgroundColor = undefined;
        break;
      case 'error':
        this.item.text = '$(error) Maharajah';
        this.item.tooltip = 'Maharajah server encountered an error. Click to restart.';
        this.item.command = 'maharajah.restartServer';
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
