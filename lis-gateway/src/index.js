const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const net = require('net');

dotenv.config();

const app = express();
app.use(express.json());

// Simple CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// State
let lisSocket = null;
let lisConnection = { status: 'disconnected', host: null, port: null, lastError: null, mode: 'AUTO' };
let lastRawBuffer = Buffer.alloc(0);
let lastMessages = [];

const CTRL = {
  STX: 0x02, // ASTM start of text
  ETX: 0x03, // ASTM end of text
  EOT: 0x04, // end of transmission
  ENQ: 0x05, // enquiry
  ACK: 0x06, // acknowledge
  VT: 0x0b,  // HL7 MLLP start
  FS: 0x1c,  // HL7 MLLP end
  CR: 0x0d,
};

function broadcast(event) {
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function resetLisState() {
  if (lisSocket) {
    lisSocket.destroy();
    lisSocket = null;
  }
  lisConnection = { status: 'disconnected', host: null, port: null, lastError: null, mode: 'AUTO' };
  lastRawBuffer = Buffer.alloc(0);
}

function parseFrames(buffer, mode = 'AUTO') {
  // Supports ASTM (STX..ETX..CR, EOT) and HL7 MLLP (VT..FS CR)
  const frames = [];
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];

    // MLLP detection (either forced or auto)
    if ((mode === 'MLLP' || mode === 'AUTO') && byte === CTRL.VT) {
      const fsIndex = buffer.indexOf(CTRL.FS, i + 1);
      if (fsIndex === -1) break;
      const crIndex = buffer.indexOf(CTRL.CR, fsIndex + 1);
      if (crIndex === -1) break;
      const payload = buffer.slice(i + 1, fsIndex);
      frames.push({ type: 'hl7', transport: 'MLLP', raw: payload.toString('utf8') });
      i = crIndex + 1;
      continue;
    }

    // ASTM detection (either forced or auto)
    if ((mode === 'ASTM' || mode === 'AUTO') && byte === CTRL.STX) {
      const etxIndex = buffer.indexOf(CTRL.ETX, i + 1);
      if (etxIndex === -1) break;
      // ASTM typically: <STX>text<ETX><CHK1><CHK2><CR>
      const afterEtx = etxIndex + 1;
      const crIndex = buffer.indexOf(CTRL.CR, afterEtx);
      if (crIndex === -1) break;
      const payload = buffer.slice(i + 1, etxIndex);
      frames.push({ type: 'astm', transport: 'ASTM', raw: payload.toString('utf8') });
      i = crIndex + 1;
      continue;
    }

    if (byte === CTRL.EOT) {
      frames.push({ type: 'eot' });
      i += 1;
      continue;
    }

    // Fallback: CR delimited line
    const cr = buffer.indexOf(CTRL.CR, i);
    if (cr === -1) break;
    const line = buffer.slice(i, cr).toString('utf8');
    if (line.trim().length > 0) frames.push({ type: 'line', transport: 'RAW', raw: line });
    i = cr + 1;
  }
  return { frames, consumed: i };
}

function connectLis({ host, port, mode = 'AUTO', sendEnq = false }) {
  return new Promise((resolve, reject) => {
    if (lisSocket) {
      try { lisSocket.destroy(); } catch (_) {}
      lisSocket = null;
    }

    const socket = new net.Socket();
    lisSocket = socket;
    lisConnection = { status: 'connecting', host, port, lastError: null, mode };
    broadcast({ type: 'lis:status', data: lisConnection });

    socket.setKeepAlive(true, 10_000);

    socket.on('connect', () => {
      lisConnection.status = 'connected';
      broadcast({ type: 'lis:status', data: lisConnection });
      if (sendEnq) {
        try { socket.write(Buffer.from([CTRL.ENQ])); } catch (_) {}
      }
      resolve();
    });

    socket.on('error', (err) => {
      lisConnection.lastError = String(err && err.message ? err.message : err);
      broadcast({ type: 'lis:error', data: lisConnection.lastError });
    });

    socket.on('close', () => {
      lisConnection.status = 'disconnected';
      broadcast({ type: 'lis:status', data: lisConnection });
    });

    socket.on('data', (chunk) => {
      lastRawBuffer = Buffer.concat([lastRawBuffer, chunk]);
      const { frames, consumed } = parseFrames(lastRawBuffer, lisConnection.mode || 'AUTO');
      if (consumed > 0) {
        lastRawBuffer = lastRawBuffer.slice(consumed);
      }
      for (const frame of frames) {
        lastMessages.push({ ...frame, at: Date.now() });
        broadcast({ type: 'lis:frame', data: frame });
        // ASTM expects ACK per frame
        if (lisConnection.mode !== 'MLLP' && (frame.type === 'astm' || frame.type === 'line')) {
          try { socket.write(Buffer.from([CTRL.ACK])); } catch (_) {}
        }
      }
    });

    socket.connect({ host, port: Number(port) });
  });
}

function disconnectLis() {
  if (lisSocket) {
    try { lisSocket.end(); } catch (_) {}
    try { lisSocket.destroy(); } catch (_) {}
  }
  lisSocket = null;
  lisConnection.status = 'disconnected';
  broadcast({ type: 'lis:status', data: lisConnection });
}

function writeToLis(bufferLike) {
  if (!lisSocket) throw new Error('LIS socket not connected');
  lisSocket.write(bufferLike);
}

// Printer: simple ESC/POS over TCP:9100
async function printText({ printerHost, printerPort = 9100, text }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const ESC = 0x1b;
    const GS = 0x1d;
    const cmds = [];
    cmds.push(Buffer.from([ESC, 0x40])); // initialize
    cmds.push(Buffer.from(text.replace(/\n/g, '\r\n'), 'utf8'));
    cmds.push(Buffer.from([0x0a, 0x0a])); // feed lines
    cmds.push(Buffer.from([GS, 0x56, 0x41, 0x10])); // partial cut if supported

    socket.on('error', (err) => reject(err));
    socket.on('connect', () => {
      socket.write(Buffer.concat(cmds), (err) => {
        if (err) return reject(err);
        setTimeout(() => {
          socket.end();
          resolve();
        }, 300);
      });
    });
    socket.connect({ host: printerHost, port: Number(printerPort) });
  });
}

// Routes
app.get('/status', (req, res) => {
  res.json({
    lis: lisConnection,
    bufferedFrames: lastMessages.length,
  });
});

app.post('/connect-device', async (req, res) => {
  const { host, port, mode, sendEnq } = req.body || {};
  if (!host || !port) return res.status(400).json({ error: 'host and port required' });
  try {
    await connectLis({ host, port: Number(port), mode: (mode || 'AUTO').toUpperCase(), sendEnq: Boolean(sendEnq) });
    res.json({ ok: true, status: lisConnection });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

app.post('/disconnect-device', (req, res) => {
  disconnectLis();
  res.json({ ok: true });
});

app.get('/frames', (req, res) => {
  res.json({ frames: lastMessages.slice(-200) });
});

app.post('/send-enq', (req, res) => {
  try {
    writeToLis(Buffer.from([CTRL.ENQ]));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

app.post('/send-raw', (req, res) => {
  const { hex } = req.body || {};
  if (!hex) return res.status(400).json({ error: 'hex required' });
  try {
    const clean = String(hex).replace(/\s+/g, '');
    const buf = Buffer.from(clean, 'hex');
    writeToLis(buf);
    res.json({ ok: true, bytes: buf.length });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

app.post('/print', async (req, res) => {
  const { printerHost, printerPort, text } = req.body || {};
  if (!printerHost || !text) return res.status(400).json({ error: 'printerHost and text required' });
  try {
    await printText({ printerHost, printerPort: printerPort ? Number(printerPort) : 9100, text: String(text) });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', data: { lis: lisConnection } }));
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`lis-gateway listening on http://0.0.0.0:${PORT}`);
});