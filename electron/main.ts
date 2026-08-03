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

function inferCountry(locationStr: string, requestedCountry?: string): string {
  if (requestedCountry && requestedCountry.trim() && requestedCountry !== 'auto') {
    return requestedCountry.toLowerCase().trim();
  }
  const loc = (locationStr || '').toLowerCase();
  if (loc.includes('india') || loc.includes('delhi') || loc.includes('bangalore') || loc.includes('mumbai') || loc.includes('pune') || loc.includes('hyderabad') || loc.includes('chennai') || loc.includes('noida') || loc.includes('gurgaon') || loc.includes('ind')) return 'india';
  if (loc.includes('uk') || loc.includes('london') || loc.includes('united kingdom') || loc.includes('england')) return 'uk';
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver')) return 'canada';
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich')) return 'germany';
  if (loc.includes('australia') || loc.includes('sydney') || loc.includes('melbourne')) return 'australia';
  if (loc.includes('usa') || loc.includes('united states') || loc.includes('ny') || loc.includes('california') || loc.includes('sf')) return 'usa';
  return 'india';
}

async function fetchDescriptionFallback(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const html = await res.text();

    // Try meta description tag
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) ||
                      html.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
    if (metaMatch && metaMatch[1] && metaMatch[1].trim().length > 30) {
      return metaMatch[1].trim();
    }
    return '';
  } catch (err) {
    return '';
  }
}

ipcMain.handle('jobs:search', async (_, searchParams) => {
  console.log('[jobs:search] received params:', searchParams);

  const searchTerm = [searchParams.jobRole, searchParams.keyword, searchParams.experienceLevel]
    .map((p: string) => (p || '').trim())
    .filter(Boolean)
    .join(' ');

  const country = inferCountry(searchParams.location, searchParams.country);
  console.log('[jobs:search] built search term:', JSON.stringify(searchTerm), 'country:', country);

  // Selected sites or default wide search: Google Jobs, LinkedIn, Indeed, Naukri, ZipRecruiter, Glassdoor
  const targetSites = (searchParams.sites && Array.isArray(searchParams.sites) && searchParams.sites.length > 0)
    ? searchParams.sites
    : ['google', 'linkedin', 'indeed', 'naukri', 'zip_recruiter'];

  console.log('[jobs:search] scraping platforms:', targetSites);

  // Scrape each site independently with Promise.allSettled so rate limits or errors on one site don't crash others
  const scrapePromises = targetSites.map(async (site: string) => {
    try {
      const results = await scrapeJobs({
        siteName: [site],
        searchTerm,
        location: searchParams.location || '',
        resultsWanted: 10,
        hoursOld: searchParams.hoursOld || 168,
        countryIndeed: country,
        linkedinFetchDescription: true,
      });
      return results;
    } catch (err) {
      console.warn(`[jobs:search] scraper failed for platform "${site}":`, err);
      return [];
    }
  });

  const settled = await Promise.allSettled(scrapePromises);
  const rawJobs: any[] = [];

  for (const res of settled) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      rawJobs.push(...res.value);
    }
  }

  console.log(`[jobs:search] total scraped raw jobs across platforms: ${rawJobs.length}`);

  // Normalize field names and fetch description fallback if missing
  const jobs = await Promise.all(
    rawJobs.map(async (j) => {
      let desc = (j.description || '').trim();
      const jobUrl = j.jobUrl || j.jobUrlDirect || '';

      // If description is too short or missing, attempt fallback fetch
      if (desc.length < 50 && jobUrl) {
        const fallback = await fetchDescriptionFallback(jobUrl);
        if (fallback) {
          desc = fallback;
        }
      }

      return {
        title: j.title || 'Job Listing',
        company: j.company || 'Company',
        location: j.location || searchParams.location || 'Remote',
        description: desc || 'No description provided by platform. Click Apply Now to view details.',
        job_url: jobUrl,
        site: j.site ? j.site.charAt(0).toUpperCase() + j.site.slice(1) : 'Web',
        jobLevel: j.jobLevel || null,
        jobType: j.jobType || null,
      };
    })
  );

  // Remove duplicates by job_url or title+company
  const seen = new Set<string>();
  const uniqueJobs = jobs.filter((j) => {
    const key = (j.job_url || `${j.title}-${j.company}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { success: true, jobs: uniqueJobs };
});

ipcMain.handle('browser:open', (_, url) => {
  shell.openExternal(url);
});
