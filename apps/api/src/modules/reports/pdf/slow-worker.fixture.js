'use strict';

// Test double for the PDF worker: waits, then answers, fails or crashes as asked.
const { parentPort, workerData } = require('node:worker_threads');

setTimeout(() => {
  if (workerData.mode === 'crash') {
    throw new Error('boom');
  }
  if (workerData.mode === 'fail') {
    parentPort.postMessage({ ok: false, message: 'layout failed' });
    return;
  }
  parentPort.postMessage({ ok: true, pdf: new Uint8Array([0x25, 0x50, 0x44, 0x46]) });
}, workerData.delayMs || 0);
