# maharajah-vscode

A VS Code extension for [maharajah](https://github.com/danslapman/maharajah) — a local semantic code search engine.

Adds a **"Go to Symbol"-style search** backed by maharajah's vector embeddings. No external services, no API keys — everything runs locally.

## Prerequisites

- **maharajah (`mh`)** installed and on your `PATH`
  See the [maharajah README](https://github.com/danslapman/maharajah) for build/install instructions.
- A workspace folder that has been indexed at least once with `mh index`
  (The extension's server mode will keep the index up-to-date automatically after that.)

## Features

- Starts `mh` in server mode automatically when VS Code opens a workspace
- Semantic search QuickPick — type a natural language query, navigate to the result
- Status bar item showing server state with context-sensitive click actions
- Fully configurable: binary path, host, port, result limit, debounce delay

## Usage

Press `Cmd+Shift+M` (macOS) / `Ctrl+Shift+M` (Linux/Windows) to open the search.

Type any natural language query — results are ranked by semantic similarity and shown with the symbol name, file path, line number, and a summary from the doc comment (when available). Press `Enter` to jump to the file and line.

![Semantic search QuickPick](images/search-demo.png)

## Commands

| Command | Description |
|---|---|
| `Maharajah: Semantic Search` | Open the semantic search QuickPick (`Cmd+Shift+M`) |
| `Maharajah: Start Server` | Start the maharajah HTTP server for the current workspace |
| `Maharajah: Stop Server` | Stop the running server |
| `Maharajah: Restart Server` | Restart the server (useful after config changes) |

## Configuration

| Setting | Default | Description |
|---|---|---|
| `maharajah.binaryPath` | `"mh"` | Path to the `mh` binary. Set to an absolute path if `mh` is not on `PATH`. |
| `maharajah.host` | `"127.0.0.1"` | Host the maharajah server binds to. |
| `maharajah.port` | `8080` | Port the maharajah server listens on. |
| `maharajah.autoStart` | `true` | Start the server automatically when VS Code activates. |
| `maharajah.searchLimit` | `20` | Maximum number of results to fetch per query. |
| `maharajah.debounceMs` | `300` | Milliseconds to wait after the last keystroke before querying. |

### `mh` not on PATH

Set `maharajah.binaryPath` to the absolute path of the binary in your workspace or user settings:

```json
{
  "maharajah.binaryPath": "/home/you/.cargo/bin/mh"
}
```

## Status bar

The status bar item at the bottom-left reflects the server state:

| Icon | State | Click action |
|---|---|---|
| `⊘ Maharajah` | Stopped | Start server |
| `↻ Maharajah` | Starting | — |
| `⌕ Maharajah` | Running | Open search |
| `✕ Maharajah` | Error | Restart server |

## Development

```sh
git clone https://github.com/danslapman/maharajah-vscode
cd maharajah-vscode
npm install
```

Install the recommended extension when prompted (`connor4312.esbuild-problem-matchers`), then press `F5` to open the Extension Development Host.

To build the bundle manually:

```sh
npm run compile        # type-check + bundle
npm run watch          # watch mode for development
npm run package        # production (minified) bundle
```

## How it works

On activation the extension spawns `mh -D <workspaceFolder> server`. It polls the configured port until the server accepts connections, then marks itself as ready. File watching and incremental re-indexing are handled entirely by the maharajah server — the extension just sends HTTP requests.

Searches use `POST /query`, which merges content-vector and summary-vector results with Reciprocal Rank Fusion for the best ranking quality.
