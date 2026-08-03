import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Store from 'electron-store';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { PDFParse } from 'pdf-parse';
import { scrapeJobs } from 'ts-jobspy';

const store = new Store();

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[preload-error] Failed to load preload script at ${preloadPath}:`, error);
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// --- IPC Handlers ---

ipcMain.handle('store:get', (_, key) => {
  return store.get(key);
});

ipcMain.handle('store:set', (_, key, val) => {
  store.set(key, val);
});

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "by", "from",
  "is", "are", "was", "were", "be", "been", "being", "i", "my", "me", "we", "our", "you", "your",
  "as", "it", "this", "that", "these", "those", "have", "has", "had", "will", "would", "can",
  "not", "no", "if", "so", "also", "than", "then", "into", "about", "over", "under", "more",
  "years", "year", "experience", "experienced", "worked", "working", "work", "responsible",
  "responsibilities", "project", "projects", "developed", "development", "using", "used",
  "team", "role", "company", "various", "strong", "good", "skills", "skill",
  "including", "etc", "across", "within", "new", "all", "one", "two", "key", "able"
]);

const KNOWN_PHRASES = [
  "spring boot", "spring mvc", "rest api", "restful api", "machine learning",
  "android development", "android studio", "java streams", "multi threading",
  "multithreading", "data structures", "unit testing", "ci cd", "node js",
  "react native", "material design", "google play", "play store", "firebase firestore",
  "sql server", "object oriented"
];

const CONTACT_INFO = /[\w.+-]+@[\w-]+\.[a-z]{2,}|https?:\/\/\S+|www\.\S+|\b(?:github|linkedin|gitlab|bitbucket|twitter|medium|stackoverflow|behance|dribbble)\.com\/\S+/gi;
const PHRASE_NORMALIZE = /[^a-z0-9 ]/gi;
const TOKEN_NORMALIZE = /[^a-z0-9+#\- ]/gi;
const STRAY_HYPHENS = /^-+|-+$/g;

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const cleaned = lower.replace(CONTACT_INFO, ' ');
  const freq: Map<string, number> = new Map();

  const phraseNormalized = cleaned.replace(PHRASE_NORMALIZE, ' ');
  for (const phrase of KNOWN_PHRASES) {
    let count = 0;
    let idx = phraseNormalized.indexOf(phrase);
    while (idx !== -1) {
      count++;
      idx = phraseNormalized.indexOf(phrase, idx + phrase.length);
    }
    if (count > 0) {
      freq.set(phrase, (freq.get(phrase) || 0) + count);
    }
  }

  const tokenNormalized = cleaned.replace(TOKEN_NORMALIZE, ' ');
  const rawTokens = tokenNormalized.split(/\s+/);
  for (const raw of rawTokens) {
    const token = raw.replace(STRAY_HYPHENS, '');
    if (token.length < 3 || STOPWORDS.has(token)) continue;
    if (!/[a-z]/i.test(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0])
    .slice(0, 35);
}

ipcMain.handle('resume:upload', async () => {
  console.log('[resume:upload] handler invoked');

  if (!win) {
    console.error('[resume:upload] no BrowserWindow available, aborting');
    return { error: 'No application window is available.' };
  }

  let filePaths: string[] = [];
  try {
    console.log('[resume:upload] opening file picker dialog...');
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Resumes', extensions: ['pdf', 'txt'] }]
    });
    console.log('[resume:upload] dialog result:', JSON.stringify(result));

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[resume:upload] user canceled the dialog, no file selected');
      return null;
    }
    filePaths = result.filePaths;
  } catch (err) {
    console.error('[resume:upload] showOpenDialog threw an error:', err);
    return { error: `Could not open file picker: ${String(err)}` };
  }

  const filePath = filePaths[0];
  const isPdf = filePath.toLowerCase().endsWith('.pdf');
  console.log(`[resume:upload] selected file: ${filePath} (isPdf=${isPdf})`);

  let text = '';
  try {
    if (isPdf) {
      console.log('[resume:upload] reading PDF bytes from disk...');
      const dataBuffer = fs.readFileSync(filePath);
      console.log(`[resume:upload] read ${dataBuffer.length} bytes, handing off to pdf-parse...`);

      const parser = new PDFParse({ data: dataBuffer });
      try {
        const result = await parser.getText();
        text = result.text;
        console.log(`[resume:upload] pdf-parse succeeded, extracted ${text.length} chars`);
      } finally {
        await parser.destroy();
      }
    } else {
      console.log('[resume:upload] reading plain text file...');
      text = fs.readFileSync(filePath, 'utf-8');
      console.log(`[resume:upload] read ${text.length} chars from text file`);
    }
  } catch (err) {
    console.error('[resume:upload] failed to read/parse the resume file:', err);
    return { error: `Failed to read "${filePath}": ${String(err)}` };
  }

  const extractedSkills = extractKeywords(text);
  console.log('[resume:upload] extracted skills:', extractedSkills);
  console.log('[resume:upload] done, returning result to renderer');

  return {
    filePath,
    extractedSkills,
    rawText: text
  };
});

ipcMain.handle('jobs:search', async (_, searchParams) => {
  console.log('[jobs:search] received params:', searchParams);

  // ts-jobspy has no dedicated "experience level" filter option, so we fold
  // job role + experience level into the free-text search term itself --
  // the same way you'd type "senior react developer" into LinkedIn/Indeed's
  // own search box.
  const searchTerm = [searchParams.jobRole, searchParams.keyword, searchParams.experienceLevel]
    .map((p: string) => (p || '').trim())
    .filter(Boolean)
    .join(' ');

  console.log('[jobs:search] built search term:', JSON.stringify(searchTerm));

  try {
    // IMPORTANT: scrapeJobs expects camelCase keys (searchTerm, siteName,
    // resultsWanted, hoursOld, countryIndeed). The previous snake_case keys
    // (search_term, site_name, etc.) were silently ignored by the library,
    // meaning the keyword/job role the user typed was never actually sent
    // to the scraper -- every search ran with an empty search term.
    const rawJobs = await scrapeJobs({
      siteName: ["linkedin", "indeed", "glassdoor"],
      searchTerm,
      location: searchParams.location || "",
      resultsWanted: 15,
      hoursOld: searchParams.hoursOld || 72,
      countryIndeed: 'usa',
    });

    console.log(`[jobs:search] scraper returned ${rawJobs.length} raw result(s)`);

    // Normalize field names for the renderer. ts-jobspy returns `jobUrl`
    // (camelCase), not `job_url` -- that mismatch is why "Apply Now" wasn't
    // opening anything.
    const jobs = rawJobs.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location,
      description: j.description,
      job_url: j.jobUrl || j.jobUrlDirect || '',
      site: j.site,
      jobLevel: j.jobLevel || null,
      jobType: j.jobType || null,
    }));

    return { success: true, jobs };
  } catch (error) {
    console.error("[jobs:search] scraping error:", error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('browser:open', (_, url) => {
  shell.openExternal(url);
});
