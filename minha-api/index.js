const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const URL = require('url').URL;

const app = express();
const PORT = process.env.PORT || 3000;

// Função para baixar um arquivo
const downloadFile = async (url, folder) => {
  const parsedUrl = new URL(url);
  const fileName = path.basename(parsedUrl.pathname);
  const filePath = path.resolve(folder, fileName);
  const writer = fs.createWriteStream(filePath);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Arquivo salvo: ${filePath}`);
        resolve();
      });
      writer.on('error', (error) => {
        console.error(`Erro ao salvar o arquivo ${filePath}: ${error}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`Erro ao baixar o arquivo ${url}: ${error}`);
    throw error;
  }
};

// Função para extrair URLs de mídia usando Puppeteer
const extractMediaUrls = async (profileUrl) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(profileUrl, { waitUntil: 'networkidle2' });

  const mediaUrls = await page.evaluate(() => {
    const urls = [];
    document.querySelectorAll('img[srcset], video[src]').forEach(el => {
      if (el.tagName === 'IMG') {
        urls.push(el.src);
      } else if (el.tagName === 'VIDEO') {
        urls.push(el.src);
      }
    });
    return urls;
  });

  await browser.close();
  return mediaUrls;
};

// Rota para pegar fotos e vídeos de um perfil do Instagram
app.get('/download-media', async (req, res) => {
  const profileUrl = req.query.url; // URL do perfil da loja passada como query parameter
  
  if (!profileUrl) {
    return res.status(400).send('URL do perfil é necessária');
  }

  try {
    // Extraia as URLs das fotos e vídeos
    const mediaUrls = await extractMediaUrls(profileUrl);

    // Diretório onde os arquivos serão salvos
    const folder = path.resolve(__dirname, 'media');
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    // Baixar todos os arquivos de mídia
    await Promise.all(mediaUrls.map(url => downloadFile(url, folder)));

    res.send('Mídias baixadas com sucesso!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao baixar mídias');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
