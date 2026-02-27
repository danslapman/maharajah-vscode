import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as net from 'net';

export type ServerState = 'stopped' | 'starting' | 'running' | 'error';

export interface ServerConfig {
  binaryPath: string;
  host: string;
  port: number;
  workspaceDir: string;
}

export class ServerManager implements vscode.Disposable {
  private process: cp.ChildProcess | undefined;
  private _state: ServerState = 'stopped';
  private readonly _onStateChange = new vscode.EventEmitter<ServerState>();

  readonly onStateChange = this._onStateChange.event;

  get state(): ServerState {
    return this._state;
  }

  async start(config: ServerConfig): Promise<void> {
    if (this._state === 'running' || this._state === 'starting') {
      return;
    }

    this.setState('starting');

    const args = [
      '-D', config.workspaceDir,
      'server',
      '--host', config.host,
      '--port', String(config.port),
    ];

    try {
      this.process = cp.spawn(config.binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
    } catch (err) {
      this.setState('error');
      throw new Error(
        `Failed to spawn maharajah binary "${config.binaryPath}": ${(err as Error).message}`
      );
    }

    const proc = this.process;

    proc.on('error', (err) => {
      vscode.window.showErrorMessage(
        `Maharajah server error: ${err.message}. ` +
        `Check that "${config.binaryPath}" is installed and on PATH ` +
        `or set maharajah.binaryPath in settings.`
      );
      this.setState('error');
      this.process = undefined;
    });

    proc.on('exit', (code) => {
      if (this._state !== 'stopped') {
        if (code !== 0 && code !== null) {
          vscode.window.showWarningMessage(
            `Maharajah server exited unexpectedly (code ${code}).`
          );
        }
        this.setState('stopped');
        this.process = undefined;
      }
    });

    // Collect early stderr to surface startup errors.
    const stderrLines: string[] = [];
    proc.stderr?.on('data', (data: Buffer) => {
      stderrLines.push(data.toString());
    });

    const ready = await this.waitForReady(config.host, config.port, 30_000);

    if (!ready) {
      const errOutput = stderrLines.join('').trim();
      if (this.process) {
        this.process.kill('SIGTERM');
        this.process = undefined;
      }
      this.setState('error');
      throw new Error(
        `Maharajah server did not become ready within 30s.` +
        (errOutput ? `\nServer output:\n${errOutput}` : '')
      );
    }

    this.setState('running');
  }

  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = undefined;
      this.setState('stopped');
    }
  }

  async restart(config: ServerConfig): Promise<void> {
    this.stop();
    await new Promise<void>((r) => setTimeout(r, 500));
    await this.start(config);
  }

  dispose(): void {
    this._onStateChange.dispose();
    this.stop();
  }

  private setState(state: ServerState): void {
    this._state = state;
    this._onStateChange.fire(state);
  }

  /**
   * Poll the TCP port until the server accepts connections or timeout elapses.
   */
  private waitForReady(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;

      const attempt = () => {
        if (Date.now() >= deadline) {
          resolve(false);
          return;
        }
        const socket = net.connect({ host, port }, () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          setTimeout(attempt, 200);
        });
      };

      attempt();
    });
  }
}
