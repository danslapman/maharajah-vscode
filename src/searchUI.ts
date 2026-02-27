import * as vscode from 'vscode';
import * as path from 'path';
import { MaharajahClient, MaharajahResult } from './maharajahClient';

interface SearchItem extends vscode.QuickPickItem {
  result: MaharajahResult;
}

/**
 * Opens the maharajah semantic search QuickPick.
 * Queries /query (RRF fusion) as the user types, with debouncing.
 */
export async function openSearchUI(
  client: MaharajahClient,
  workspaceRoot: string | undefined,
  limit: number,
  debounceMs: number
): Promise<void> {
  const pick = vscode.window.createQuickPick<SearchItem>();
  pick.placeholder = 'Type to search code semantically...';
  // Disable VS Code's client-side fuzzy filtering — maharajah does all ranking server-side.
  pick.matchOnDescription = false;
  pick.matchOnDetail = false;
  pick.keepScrollPosition = true;

  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let abortController: AbortController | undefined;

  const disposables: vscode.Disposable[] = [];

  const doSearch = async (query: string) => {
    if (!query.trim()) {
      pick.items = [];
      pick.busy = false;
      return;
    }

    abortController?.abort();
    abortController = new AbortController();
    const { signal } = abortController;

    pick.busy = true;

    try {
      const results = await client.query({ query, limit }, signal);

      if (signal.aborted) {
        return;
      }

      pick.items = results.map((r) => resultToItem(r, workspaceRoot));
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return;
      }
      pick.items = [
        {
          label: '$(error) Search failed',
          description: (err as Error).message,
          result: undefined as unknown as MaharajahResult,
          alwaysShow: true,
        },
      ];
    } finally {
      if (!signal.aborted) {
        pick.busy = false;
      }
    }
  };

  disposables.push(
    pick.onDidChangeValue((value) => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      pick.busy = !!value.trim();
      pick.items = [];
      debounceTimer = setTimeout(() => doSearch(value), debounceMs);
    })
  );

  disposables.push(
    pick.onDidAccept(async () => {
      const selected = pick.selectedItems[0];
      if (!selected?.result) {
        return;
      }
      pick.hide();
      await navigateToResult(selected.result, workspaceRoot);
    })
  );

  disposables.push(
    pick.onDidHide(() => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      abortController?.abort();
      for (const d of disposables) {
        d.dispose();
      }
      pick.dispose();
    })
  );

  pick.show();
}

function resultToItem(
  result: MaharajahResult,
  workspaceRoot: string | undefined
): SearchItem {
  const relativePath = workspaceRoot && path.isAbsolute(result.file_path)
    ? path.relative(workspaceRoot, result.file_path)
    : result.file_path;

  return {
    label: `$(symbol-misc) ${result.symbol}`,
    description: `${relativePath}:${result.start_line}`,
    detail: result.summary?.split('\n')[0] ?? result.content?.split('\n')[0],
    alwaysShow: true,
    result,
  };
}

async function navigateToResult(
  result: MaharajahResult,
  workspaceRoot: string | undefined
): Promise<void> {
  try {
    const filePath = path.isAbsolute(result.file_path)
      ? result.file_path
      : workspaceRoot
      ? path.join(workspaceRoot, result.file_path)
      : result.file_path;

    const uri = vscode.Uri.file(filePath);
    const doc = await vscode.workspace.openTextDocument(uri);

    // maharajah lines are 1-based; VS Code Position is 0-based.
    const line = Math.max(0, result.start_line - 1);
    const position = new vscode.Position(line, 0);
    const range = new vscode.Range(position, position);

    const editor = await vscode.window.showTextDocument(doc, {
      selection: range,
      preserveFocus: false,
    });

    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Maharajah: Failed to open "${result.file_path}": ${(err as Error).message}`
    );
  }
}
