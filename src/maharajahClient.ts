import * as http from 'http';

export interface MaharajahResult {
  id: string;
  file_path: string;
  start_line: number;
  end_line: number;
  symbol: string;
  score: number;
  summary: string;
  content: string;
}

export interface QueryRequest {
  query: string;
  limit: number;
}

export class MaharajahClient {
  constructor(
    private readonly host: string,
    private readonly port: number
  ) {}

  /**
   * Query using RRF fusion of content + summary embeddings.
   * Preferred endpoint for best semantic search quality.
   */
  async query(request: QueryRequest, signal?: AbortSignal): Promise<MaharajahResult[]> {
    return this.post('/query', request, signal);
  }

  private post(
    path: string,
    body: QueryRequest,
    signal?: AbortSignal
  ): Promise<MaharajahResult[]> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const payload = JSON.stringify(body);
      const options: http.RequestOptions = {
        hostname: this.host,
        port: this.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            if (res.statusCode !== 200) {
              reject(new Error(`Maharajah returned HTTP ${res.statusCode}: ${raw}`));
              return;
            }
            const results = JSON.parse(raw) as MaharajahResult[];
            resolve(results);
          } catch (err) {
            reject(err);
          }
        });
      });

      req.on('error', reject);

      if (signal) {
        signal.addEventListener('abort', () => {
          req.destroy();
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }

      req.write(payload);
      req.end();
    });
  }
}
