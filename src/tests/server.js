import express from 'express';
import { Liquid } from 'liquidjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { stores } from './config.js';
import { JSDOM } from 'jsdom';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3003;

const getLayout = async (store, newBodyContent) => {
  const homepageUrl = stores[store].homepage;
  const response = await fetch(homepageUrl);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const html = await response.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove the whole body content
  document.body.innerHTML = '';

  // Replace it with the new content
  document.body.innerHTML = newBodyContent;

  return dom.serialize();
};


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

const getSettingsData = async (store) => {
  const settingsDataResponse = await fetch(stores[store].settingsData);
  if (!settingsDataResponse.ok) {
    throw new Error('Network response was not ok');
  }

  const settingsDataRaw = await settingsDataResponse.text();
  const settingsData = JSON.parse(settingsDataRaw);
  return settingsData;
};

const engine = new Liquid({
  root: [path.join(__dirname, '../components'), path.join(__dirname, '../../snippets')],
  extname: '.liquid',
});

app.use('/static', express.static(path.join(__dirname, '../components')));

// Proxy route to fetch the remote script
app.get('/proxy/:store/:file', async (req, res) => {
    const { store, file } = req.params;
    const url = stores[store][file];
    if (!url) {
      console.error('Error getting remote URL from config');
      res.status(500).send('Error getting remote URL from config');    
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

app.get('/:store/cssSettings', async (req, res) => {
  const { store } = req.params;
  const settingsData = await getSettingsData(store);
  res.set('Content-Type', 'text/plain');
  res.send(settingsData);
});

app.get('/:store/cssVariables', async (req, res) => {
  const { store } = req.params;
  const settingsData = await getSettingsData(store);
  const cssVariables = await engine.renderFile('../../snippets/css-variables.liquid', settingsData);
  res.set('Content-Type', 'text/plain');
  res.send(cssVariables);
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
  const mockData = {
    title: "Recommended Products",
    items: [
      { name: "Product A", price: "$10.00" },
      { name: "Product B", price: "$20.00" },
      { name: "Product C" },
    ],
  };

  try {
    // const settingsData = getSettingsData(store);
    // const cssVariables = await engine.renderFile('../../snippets/css-variables.liquid', settingsData);
    const cssVariablesStyleBlock = await getCssVariablesStyleBlock(store);
    const renderedHTML = await engine.renderFile(`${component}/${component}`, mockData);

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${component} Test</title>
        ${cssVariablesStyleBlock}
        <script type="module" src="/proxy/${store}/jsThemeUrl"></script>
        <link href="/proxy/${store}/cssThemeUrl" rel="stylesheet" type="text/css" media="all">
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


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});