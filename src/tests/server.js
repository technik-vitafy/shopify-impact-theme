import express from 'express';
import { Liquid } from 'liquidjs';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { stores } from './config.js';
import { JSDOM } from 'jsdom';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3003;

const engine = new Liquid({
  root: [path.join(__dirname, '../components'), path.join(__dirname, '../../snippets')],
  extname: '.liquid',
});

const wss = new WebSocketServer({ noServer: true });
const WebSocketClientScript = `
<script>
  const ws = new WebSocket('ws://' + window.location.host);
  ws.onmessage = (event) => {
    if (event.data === 'update') {
      window.location.reload();
    }
  };
  ws.onopen = () => {
    console.log('WebSocket connection established');
  };
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  ws.onclose = () => {
    console.log('WebSocket connection closed');
  };
</script>
`;

const getFontFaceStyleBlock = (store) => {
  const fonts = stores[store].fonts;
  if (!fonts) {
    return '';
  }

  const fontFaceStyleBlocks = Object.entries(fonts).map(([fontFamily, fontWeights]) => {
    const fontWeightsStyleBlocks = fontWeights.map(({ url, format, weight, style }) => `
      @font-face {
        font-family: '${fontFamily}';
        src: url('${url}') format('${format}');
        font-weight: ${weight};
        font-style: ${style};
      }
    `).join('');

    return `<style>${fontWeightsStyleBlocks}</style>`;
  });

  return fontFaceStyleBlocks.join('');
}

const getCssVariablesStyleBlock = async (store) => {
  const homepageUrl = stores[store].homepage;
  const response = await fetch(homepageUrl);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const cssVariablesStyleBlock = document.querySelector('head style');

  return cssVariablesStyleBlock ? cssVariablesStyleBlock.outerHTML : '';
};


app.use('/static', express.static(path.join(__dirname, '../components')));

const cache = {};

// Proxy route to fetch the remote script
app.get('/proxy/:store/:file', async (req, res) => {
    const { store, file } = req.params;
    const url = stores[store][file];
    if (!url) {
      console.error('Error getting remote URL from config (store, file):', store, file);
      res.status(404)
      return res.send('Error getting remote URL from config');  
    }

    const cacheKey = `${store}-${file}`;

    if (cache[cacheKey]) {
      console.log('Serving from cache:', cacheKey);
      res.set('Content-Type', cache[cacheKey].contentType);
      return res.send(cache[cacheKey].data);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error('response not ok');
        throw new Error('Network response was not ok');
      }
      const contentType = url.endsWith('.css') ? 'text/css' : 'application/javascript';
      res.set('Content-Type', contentType);
      const data = await response.text();
      res.send(data);
    } catch (err) {
      console.error(err)
      res.status(500).send('Error fetching remote script');
    }
  });

app.get('/', (req, res) => {
  const componentsDir = path.join(__dirname, '../components');
  fs.readdir(componentsDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error reading components directory');
    }

    const components = files.filter(file => fs.statSync(path.join(componentsDir, file)).isDirectory());
    const links = components.map(component => `<li>${component} <a href="/vitafy/components/${component}">vitafy</a></li>`).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Components List</title>
        ${WebSocketClientScript}
      </head>
      <body>
        <h1>Available Components</h1>
        <ul>
          ${links}
        </ul>
      </body>
      </html>
    `);
  });
});

app.get('/:store/components/:component', async (req, res) => {
  const {component, store } = req.params;  
  const mockDataPath = path.join(__dirname, `../components/${component}/mockData.json`);
  const mockDataContent = await fsPromises.readFile(mockDataPath, 'utf-8');
  const mockData = JSON.parse(mockDataContent);

  try {
    const cssVariablesStyleBlock = await getCssVariablesStyleBlock(store);
    const renderedHTML = await engine.renderFile(`${component}/${component}`, mockData);

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${component} Test</title>
        ${getFontFaceStyleBlock(store)}
        ${cssVariablesStyleBlock}
        <script type="module" src="/proxy/${store}/jsThemeUrl"></script>
        <link href="/proxy/${store}/cssThemeUrl" rel="stylesheet" type="text/css" media="all">
        ${WebSocketClientScript}
      </head>
      <body>
        ${renderedHTML}
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Error rendering component');
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

const notifyClients = () => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send('update');
    }
  });
};

const watcher = chokidar.watch(path.join(__dirname, '../components'), {
  persistent: true,
  ignoreInitial: true,
  depth: 99 // Adjust depth as needed
});

watcher.on('all', (event, path) => {
  console.log(`File ${event}: ${path}`);
  notifyClients();
});