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
  "team", "role", "company", "various", "strong", "good", "skills", "skill", "building",
  "created", "knowledge", "ability", "system", "systems", "engineer", "engineering",
  "developer", "solutions", "environment", "implementation", "support", "user", "data",
  "including", "etc", "across", "within", "new", "all", "one", "two", "key", "able"
]);

const KNOWN_PHRASES = [
  "spring boot", "spring mvc", "rest api", "restful api", "machine learning",
  "deep learning", "android development", "android studio", "java streams",
  "multi threading", "multithreading", "data structures", "unit testing",
  "ci cd", "ci/cd", "node js", "nodejs", "react js", "reactjs", "next js",
  "nextjs", "vue js", "vuejs", "express js", "expressjs", "react native",
  "material design", "google play", "play store", "firebase firestore",
  "sql server", "object oriented", "microservices architecture", "microservices",
  "system design", "tailwind css", "docker container", "kubernetes", "aws",
  "google cloud", "azure", "postgresql", "mongodb", "graphql", "redux toolkit",
  "typescript", "javascript", "c++", "c#", ".net core"
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

// --- Custom Multi-Engine Scrapers ---

async function fetchGoogleCareerJobs(role: string, location: string): Promise<any[]> {
  if (!role && !location) return [];
  const query = `"${role || 'developer'}" ${location || ''} site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:jobs.ashbyhq.com OR site:naukri.com OR site:glassdoor.com`;
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const html = await res.text();

    const jobs: any[] = [];
    const blocks = html.split('<div class="result results_links');
    for (const block of blocks.slice(1)) {
      const linkMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
      if (linkMatch) {
        let rawUrl = linkMatch[1];
        if (rawUrl.includes('uddg=')) {
          try {
            const u = new URL('https://duckduckgo.com' + rawUrl);
            const actualUrl = u.searchParams.get('uddg');
            if (actualUrl) rawUrl = actualUrl;
          } catch (_) {}
        }
        let rawTitle = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        let snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        let company = 'Company Career Page';
        if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          company = parts[parts.length - 1].trim();
        } else if (rawTitle.includes(' | ')) {
          const parts = rawTitle.split(' | ');
          company = parts[parts.length - 1].trim();
        } else if (rawUrl.includes('greenhouse.io') || rawUrl.includes('lever.co') || rawUrl.includes('ashbyhq.com')) {
          try {
            const host = new URL(rawUrl).hostname;
            company = host.split('.')[0].toUpperCase();
          } catch (_) {}
        }

        let site = 'Google / Career Page';
        if (rawUrl.includes('naukri.com')) site = 'Naukri';
        else if (rawUrl.includes('glassdoor.com')) site = 'Glassdoor';
        else if (rawUrl.includes('greenhouse.io') || rawUrl.includes('lever.co') || rawUrl.includes('ashbyhq.com') || rawUrl.includes('workday')) site = 'Direct Career Page';

        if (rawUrl.startsWith('http')) {
          jobs.push({
            title: rawTitle.replace(/^(hiring|job|career|apply for)\s+/i, ''),
            company,
            location: location || 'Remote / Various',
            description: snippet || 'Direct career posting retrieved via Google Web Search.',
            job_url: rawUrl,
            site,
            jobType: 'Full-Time',
          });
        }
      }
    }
    return jobs.slice(0, 15);
  } catch (err) {
    console.warn('[fetchGoogleCareerJobs] error:', err);
    return [];
  }
}

async function fetchRemoteTechJobs(role: string, keyword: string): Promise<any[]> {
  const queryTerm = (role || keyword || 'developer').toLowerCase().trim();
  const jobs: any[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=20', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.jobs)) {
        for (const item of data.jobs) {
          const title = item.jobTitle || '';
          const desc = item.jobDescription || item.jobExcerpt || '';
          const matchTarget = `${title} ${desc} ${item.jobGeo || ''}`.toLowerCase();
          if (!queryTerm || queryTerm.split(' ').some(w => w.length > 2 && matchTarget.includes(w))) {
            jobs.push({
              title: item.jobTitle,
              company: item.companyName || 'Remote Co',
              location: item.jobGeo || 'Remote Worldwide',
              description: desc.replace(/<[^>]+>/g, '').slice(0, 600),
              job_url: item.url || item.jobSlug,
              site: 'Remote Tech',
              jobType: item.jobType || 'Remote',
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('[fetchRemoteTechJobs] error:', err);
  }
  return jobs;
}

async function fetchAdzunaJobs(role: string, location: string, country: string): Promise<any[]> {
  const countryCodeMap: Record<string, string> = {
    india: 'in', usa: 'us', uk: 'gb', canada: 'ca', germany: 'de', australia: 'au'
  };
  const cCode = countryCodeMap[country.toLowerCase()] || 'in';
  const query = encodeURIComponent([role, location].filter(Boolean).join(' '));
  if (!query) return [];

  try {
    const appId = '53247071';
    const appKey = '04495ceef40dbdd3080ff0c2b260655d';
    const url = `https://api.adzuna.com/v1/api/jobs/${cCode}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=15&what=${query}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    if (data && Array.isArray(data.results)) {
      return data.results.map((r: any) => ({
        title: r.title ? r.title.replace(/<\/?[^>]+(>|$)/g, "") : 'Job Listing',
        company: r.company?.display_name || 'Company',
        location: r.location?.display_name || location || 'Various',
        description: r.description ? r.description.replace(/<\/?[^>]+(>|$)/g, "") : '',
        job_url: r.redirect_url || r.url || '',
        site: 'Adzuna Jobs',
        jobType: r.contract_type || null
      }));
    }
  } catch (err) {
    console.warn('[fetchAdzunaJobs] error:', err);
  }
  return [];
}

ipcMain.handle('jobs:search', async (_, searchParams) => {
  console.log('[jobs:search] received params:', searchParams);

  // Focus scraper search term on title/role for maximum relevance
  const roleTerm = (searchParams.jobRole || '').trim();
  const keyTerm = (searchParams.keyword || '').trim();
  const searchRoleOnly = roleTerm || keyTerm || 'Software Engineer';

  const country = inferCountry(searchParams.location, searchParams.country);
  console.log('[jobs:search] primary search term:', JSON.stringify(searchRoleOnly), 'country:', country);

  const selectedSites: string[] = (searchParams.sites && Array.isArray(searchParams.sites) && searchParams.sites.length > 0)
    ? searchParams.sites
    : ['linkedin', 'indeed', 'google', 'adzuna', 'remote'];

  console.log('[jobs:search] requested platforms:', selectedSites);

  const rawJobs: any[] = [];
  const stats: Record<string, number> = {};

  // 1. Run ts-jobspy for LinkedIn & Indeed
  const jobspySites = selectedSites.filter(s => s === 'linkedin' || s === 'indeed');
  if (jobspySites.length > 0) {
    const jobspyPromises = jobspySites.map(async (site) => {
      try {
        const opts: any = {
          siteName: [site],
          searchTerm: searchRoleOnly,
          location: searchParams.location || '',
          resultsWanted: searchParams.resultsWanted || 15,
          countryIndeed: country,
        };
        if (site === 'linkedin') {
          opts.linkedinFetchDescription = true;
          opts.hoursOld = searchParams.hoursOld || 168;
        }
        if (searchParams.isRemote) {
          opts.isRemote = true;
        }
        const res = await scrapeJobs(opts);
        return { site, results: Array.isArray(res) ? res : [] };
      } catch (err) {
        console.warn(`[jobs:search] ts-jobspy error for ${site}:`, err);
        return { site, results: [] };
      }
    });

    const settledJobspy = await Promise.allSettled(jobspyPromises);
    for (const res of settledJobspy) {
      if (res.status === 'fulfilled' && res.value) {
        const { site, results } = res.value;
        stats[site] = results.length;
        rawJobs.push(...results);
      }
    }
  }

  // 2. Run Google & Career Pages Web Scraper if selected
  if (selectedSites.includes('google') || selectedSites.includes('naukri') || selectedSites.includes('glassdoor')) {
    try {
      const googleJobs = await fetchGoogleCareerJobs(searchRoleOnly, searchParams.location || '');
      stats['google'] = googleJobs.length;
      rawJobs.push(...googleJobs);
    } catch (err) {
      console.warn('[jobs:search] google career scraper error:', err);
    }
  }

  // 3. Run Remote Tech API if selected
  if (selectedSites.includes('remote') || searchParams.isRemote) {
    try {
      const remoteJobs = await fetchRemoteTechJobs(searchRoleOnly, keyTerm);
      stats['remote'] = remoteJobs.length;
      rawJobs.push(...remoteJobs);
    } catch (err) {
      console.warn('[jobs:search] remote tech API error:', err);
    }
  }

  // 4. Run Adzuna API if selected
  if (selectedSites.includes('adzuna') || selectedSites.includes('zip_recruiter')) {
    try {
      const adzunaJobs = await fetchAdzunaJobs(searchRoleOnly, searchParams.location || '', country);
      stats['adzuna'] = adzunaJobs.length;
      rawJobs.push(...adzunaJobs);
    } catch (err) {
      console.warn('[jobs:search] adzuna API error:', err);
    }
  }

  console.log(`[jobs:search] total raw jobs gathered: ${rawJobs.length}`, stats);

  // Normalize field names & fallback descriptions
  const jobs = await Promise.all(
    rawJobs.map(async (j) => {
      let desc = (j.description || '').trim();
      const jobUrl = j.jobUrl || j.jobUrlDirect || j.job_url || '';

      if (desc.length < 50 && jobUrl) {
        const fallback = await fetchDescriptionFallback(jobUrl);
        if (fallback) {
          desc = fallback;
        }
      }

      return {
        title: j.title || 'Job Listing',
        company: j.company || 'Company',
        location: j.location || searchParams.location || 'Remote / Various',
        description: desc || 'No detailed description available. Click Apply Now to view full job posting.',
        job_url: jobUrl,
        site: j.site ? (typeof j.site === 'string' ? j.site.charAt(0).toUpperCase() + j.site.slice(1) : 'Web') : 'Web',
        jobLevel: j.jobLevel || null,
        jobType: j.jobType || null,
      };
    })
  );

  // Deduplicate by URL or title+company
  const seen = new Set<string>();
  const uniqueJobs = jobs.filter((j) => {
    const key = (j.job_url || `${j.title}-${j.company}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { success: true, jobs: uniqueJobs, stats };
});

ipcMain.handle('browser:open', (_, url) => {
  shell.openExternal(url);
});
