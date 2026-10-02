import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const electronBinary = createRequire(import.meta.url)('electron') as string;

const server = await createServer();
await server.listen();
server.printUrls();
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('Vite did not report a local URL.');

const app = spawn(electronBinary, ['.', `--dev-server=${url}`], { stdio: 'inherit' });
app.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
