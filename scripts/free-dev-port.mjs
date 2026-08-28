import { execSync } from 'node:child_process';

const port = Number(process.argv[2] ?? 5173);

function pidsListeningOnPort(targetPort) {
  try {
    const output = execSync('netstat -ano', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) {
        continue;
      }
      // Examples: TCP    0.0.0.0:5173    0.0.0.0:0    LISTENING    1234
      //           TCP    [::1]:5173      [::]:0        LISTENING    1234
      const match = line.match(new RegExp(`:${targetPort}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i'));
      if (match?.[1] && match[1] !== '0') {
        pids.add(match[1]);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(Number(pid), 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

const pids = pidsListeningOnPort(port);
if (pids.length === 0) {
  console.log(`[dev] port ${port} is free`);
  process.exit(0);
}

console.log(`[dev] port ${port} busy — stopping PID(s): ${pids.join(', ')}`);
for (const pid of pids) {
  killPid(pid);
}

// Brief wait for OS to release the port
const started = Date.now();
while (Date.now() - started < 500) {
  /* spin */
}

const stillBusy = pidsListeningOnPort(port);
if (stillBusy.length > 0) {
  console.error(`[dev] could not free port ${port}. Still held by: ${stillBusy.join(', ')}`);
  process.exit(1);
}

console.log(`[dev] port ${port} freed`);
