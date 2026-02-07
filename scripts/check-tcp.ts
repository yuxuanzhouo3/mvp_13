
import net from 'net';
import { URL } from 'url';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not defined');
  process.exit(1);
}

try {
  // Parse the connection string manually or using URL
  // postgresql://user:pass@host:port/db?params
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '5432');

  console.log(`Testing TCP connection to ${host}:${port}...`);

  const socket = new net.Socket();
  socket.setTimeout(5000); // 5s timeout

  const start = Date.now();

  socket.connect(port, host, () => {
    console.log(`TCP Connection established in ${Date.now() - start}ms`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`TCP Connection error: ${err.message}`);
  });

  socket.on('timeout', () => {
    console.error('TCP Connection timed out (5s)');
    socket.destroy();
  });

} catch (e) {
  console.error('Failed to parse URL:', e);
}
