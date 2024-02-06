import os from 'os';
import cluster from 'cluster';

// Obrigado Erick Wendel
const runPrimaryProcess = () => {
  const processCount = os.cpus().length * 2;
  for (let i = 0; i < processCount; i++) {
    cluster.fork();
  }
}

const runWorkerProcess = async () => {
  await import('./server.mjs');
}

cluster.isPrimary ? runPrimaryProcess() :runWorkerProcess();
