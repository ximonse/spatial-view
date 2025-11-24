// Simple proxy server for Anthropic API to bypass CORS restrictions
// Run this alongside your Vite dev server: node proxy-server.js

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3100;

// Enable CORS for localhost
app.use(cors({
  origin: ['http://localhost:3003', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Proxy endpoint for Anthropic API
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'No API key provided' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔄 Claude API Proxy running on http://localhost:${PORT}`);
  console.log(`✅ Ready to proxy requests to Anthropic API`);
});
