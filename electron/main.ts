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
  if (loc.includes('india') || loc.includes('bengaluru') || loc.includes('delhi') || loc.includes('mumbai')) return 'india';
  if (loc.includes('usa') || loc.includes('america') || loc.includes('new york') || loc.includes('california')) return 'usa';
  if (loc.includes('uk') || loc.includes('london') || loc.includes('manchester')) return 'uk';
  if (loc.includes('canada') || loc.includes('toronto')) return 'canada';
  if (loc.includes('germany') || loc.includes('berlin')) return 'germany';
  if (loc.includes('australia') || loc.includes('sydney')) return 'australia';
  return 'usa';
}

async function fetchDescriptionFallback(jobUrl: string): Promise<string> {
  if (!jobUrl || !jobUrl.startsWith('http')) return '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(jobUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const html = await res.text();
    const match = html.match(/<p[^>]*>([^<]{50,300})<\/p>/i);
    return match ? match[1].replace(/<[^>]+>/g, '').trim().slice(0, 300) : '';
  } catch (err) {
    return '';
  }
}

// --- Custom Multi-Engine Scrapers (FIXED VERSION) ---

async function fetchYahooWebSearchJobs(query: string, location: string, defaultSite: string, hoursOld?: number): Promise<any[]> {
  let timeParam = '';
  if (hoursOld && hoursOld <= 1) timeParam = '&age=1h';
  else if (hoursOld && hoursOld <= 2) timeParam = '&age=2h';
  else if (hoursOld && hoursOld <= 24) timeParam = '&age=1d';
  else if (hoursOld && hoursOld <= 72) timeParam = '&age=3d';
  else if (hoursOld && hoursOld <= 168) timeParam = '&age=1w';

  const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}${timeParam}`;
  const jobs: any[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const html = await res.text();
    const resultBlocks = html.split(/<div[^>]*class="[^"]*algo[^"]*"[^>]*>/i);

    for (const block of resultBlocks.slice(1)) {
      if (jobs.length >= 15) break;

      const ruMatch = block.match(/RU=([^"'\s]+?)\/(?:RK|RS)=/i);
      if (!ruMatch) continue;

      let targetUrl = '';
      try {
        targetUrl = decodeURIComponent(ruMatch[1]);
      } catch (_) {
        continue;
      }

      if (!targetUrl.startsWith('http')) continue;
      if (targetUrl.includes('yahoo.com') || targetUrl.includes('yimg.com')) continue;

      // Extract raw title from aria-label or link HTML
      const ariaMatch = block.match(/aria-label="([^"]+)"/i);
      let rawTitle = ariaMatch ? ariaMatch[1].trim() : '';

      if (!rawTitle) {
        const linkMatch = block.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        if (linkMatch) rawTitle = linkMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Title cleaning & slug extraction
      if (!rawTitle || rawTitle.length < 3 || /^[0-9a-f\-]+$/i.test(rawTitle)) {
        try {
          const u = new URL(targetUrl);
          const parts = u.pathname.split('/').filter(Boolean);
          let slug = parts[parts.length - 1] || '';
          slug = slug.replace(/^\d+-/, '').replace(/[-_]/g, ' ');
          if (slug) {
            rawTitle = slug.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          }
        } catch (_) {
          rawTitle = 'Job Listing';
        }
      }

      // Extract snippet description
      const snippetMatch = block.match(/<p[^>]*class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
                           block.match(/<div[^>]*class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                           block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Determine Company Name
      let company = 'Company';
      let cleanTitle = rawTitle;

      if (rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        company = parts[parts.length - 1].trim();
        cleanTitle = parts.slice(0, parts.length - 1).join(' - ').trim();
      } else if (rawTitle.includes(' | ')) {
        const parts = rawTitle.split(' | ');
        company = parts[parts.length - 1].trim();
        cleanTitle = parts.slice(0, parts.length - 1).join(' | ').trim();
      } else {
        try {
          const u = new URL(targetUrl);
          if (targetUrl.includes('lever.co')) {
            const companySlug = u.pathname.split('/')[1];
            if (companySlug) company = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
          } else if (targetUrl.includes('greenhouse.io')) {
            const companySlug = u.pathname.split('/')[1];
            if (companySlug) company = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
          } else if (targetUrl.includes('ashbyhq.com')) {
            const companySlug = u.pathname.split('/')[1];
            if (companySlug) company = companySlug.charAt(0).toUpperCase() + companySlug.slice(1);
          } else {
            const hostname = u.hostname;
            company = hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
          }
        } catch (_) {}
      }

      let site = defaultSite;
      if (targetUrl.includes('google.com/about/careers') || targetUrl.includes('careers.google.com')) {
        site = 'Google Careers';
        company = 'Google';
      } else if (targetUrl.includes('wellfound.com')) site = 'Wellfound';
      else if (targetUrl.includes('greenhouse.io')) site = 'Greenhouse';
      else if (targetUrl.includes('lever.co')) site = 'Lever';
      else if (targetUrl.includes('ashbyhq.com')) site = 'Ashby ATS';
      else if (targetUrl.includes('myworkdayjobs.com')) site = 'Workday';
      else if (targetUrl.includes('naukri.com')) site = 'Naukri';
      else if (targetUrl.includes('instahyre.com')) site = 'Instahyre';
      else if (targetUrl.includes('glassdoor.com')) site = 'Glassdoor';

      jobs.push({
        title: cleanTitle.replace(/\s*[-|]\s*(Jobs|Careers|Career Page|Hiring|Google Careers).*$/i, '').trim() || 'Job Listing',
        company: company || 'Company',
        location: location || 'Remote / Various',
        description: snippet || 'Direct career listing retrieved via search. Click "Apply Now" to view full details.',
        job_url: targetUrl,
        site,
        jobType: 'Full-Time',
      });
    }

    return jobs;
  } catch (err) {
    console.warn('[fetchYahooWebSearchJobs] error:', err);
    return [];
  }
}

async function fetchGoogleCareerJobs(role: string, location: string, hoursOld?: number): Promise<any[]> {
  if (!role && !location) return [];
  const jobs: any[] = [];

  try {
    // 1. Fetch official Google Careers company openings
    const googleCompanyQuery = `${role || 'developer'} ${location || ''} site:careers.google.com OR site:google.com/about/careers`;
    const googleCompanyJobs = await fetchYahooWebSearchJobs(googleCompanyQuery, location, 'Google Careers', hoursOld);
    jobs.push(...googleCompanyJobs);

    // 2. Fetch general tech career portal postings indexed by search
    const webQuery = `${role || 'developer'} ${location || ''} site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:jobs.ashbyhq.com OR site:naukri.com OR site:glassdoor.com`;
    const webJobs = await fetchYahooWebSearchJobs(webQuery, location, 'Google / Career Page', hoursOld);
    jobs.push(...webJobs);

    return jobs;
  } catch (err) {
    console.warn('[fetchGoogleCareerJobs] error:', err);
    return [];
  }
}

async function fetchNaukriJobs(role: string, location: string, hoursOld?: number): Promise<any[]> {
  const query = `${role || 'developer'} ${location || ''} site:naukri.com/job-listings OR site:naukri.com`;
  const jobs: any[] = [];
  try {
    const webJobs = await fetchYahooWebSearchJobs(query, location, 'Naukri', hoursOld);
    for (const j of webJobs) {
      jobs.push({ ...j, site: 'Naukri' });
    }
  } catch (err) {
    console.warn('[fetchNaukriJobs] error:', err);
  }
  return jobs;
}

async function fetchInstahyreJobs(role: string, location: string, hoursOld?: number): Promise<any[]> {
  const query = `${role || 'developer'} ${location || ''} site:instahyre.com/jobs OR site:instahyre.com/job- OR site:instahyre.com`;
  const jobs: any[] = [];
  try {
    const webJobs = await fetchYahooWebSearchJobs(query, location, 'Instahyre', hoursOld);
    for (const j of webJobs) {
      jobs.push({ ...j, site: 'Instahyre' });
    }
  } catch (err) {
    console.warn('[fetchInstahyreJobs] error:', err);
  }
  return jobs;
}

async function fetchWellfoundJobs(role: string, location: string, hoursOld?: number): Promise<any[]> {
  const query = `${role || 'developer'} ${location || ''} site:wellfound.com/jobs OR site:wellfound.com/company`;
  const jobs: any[] = [];

  try {
    const webJobs = await fetchYahooWebSearchJobs(query, location, 'Wellfound', hoursOld);
    jobs.push(...webJobs);

    if (jobs.length < 10) {
      const remotiveJobs = await fetchRemoteTechJobs(role, 'startup');
      const taggedRemotive = remotiveJobs.map(j => ({ ...j, site: 'Wellfound / Startup' }));
      jobs.push(...taggedRemotive);
    }
  } catch (err) {
    console.warn('[fetchWellfoundJobs] error:', err);
  }

  return jobs;
}

async function fetchInternshalaJobs(role: string, location: string, type: 'internship' | 'job' | 'both' = 'both'): Promise<any[]> {
  const BASE = 'https://internshala.com';
  const slug = (role || 'developer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const jobs: any[] = [];

  const endpoints: Array<{ url: string; listingType: string }> = [];
  if (type === 'internship' || type === 'both') {
    endpoints.push({ url: `${BASE}/internships/${slug}-internship`, listingType: 'Internship' });
  }
  if (type === 'job' || type === 'both') {
    endpoints.push({ url: `${BASE}/jobs/${slug}-jobs`, listingType: 'Fresher Job' });
  }

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(ep.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const html = await res.text();

      // Split on each listing block by the title container class
      const blocks = html.split(/class="job-internship-name"/);
      for (const block of blocks.slice(1)) {
        if (jobs.length >= 20) break;

        // href to listing detail
        const hrefM = block.match(/href="(\/(?:internship|job)\/detail\/[^"]+)"/);
        if (!hrefM) continue;
        const listingUrl = BASE + hrefM[1];

        // title: text content of the <a> tag
        const titleM = block.match(/>[\s]*([\w &().,'\-\/+#]+)[\s]*<\/a>/i);
        const title = titleM ? titleM[1].trim() : ep.listingType;
        if (!title || title.length < 3) continue;

        // company
        const compM = block.match(/class="company-name"[^>]*>[\s]*((?:[\s\S](?!class=))+?)[\s]*<\//);
        const company = compM ? compM[1].replace(/<[^>]+>/g, '').trim() : 'Company';

        // location: look for Work from Home or city link
        const wfhM = block.match(/Work from Home/i);
        const locM = block.match(/class="location_link[^"]*"[^>]*>([^<]+)<\/a>/i);
        const loc = wfhM ? 'Remote / Work from Home' : (locM ? locM[1].trim() : (location || 'India'));

        // stipend / salary
        const stipM = block.match(/class="stipend"[^>]*>([^<]+)</);
        const stipend = stipM ? stipM[1].trim() : '';

        // duration (internships)
        const durM = block.match(/class="other-det"[^>]*>[\s\S]*?<span[^>]*>([\d]+ (?:Month|Week|Year)[s]?)<\/span>/i);
        const duration = durM ? durM[1].trim() : '';

        const description = [
          stipend ? `Stipend/Salary: ${stipend}` : '',
          duration ? `Duration: ${duration}` : '',
          `Type: ${ep.listingType} on Internshala`,
        ].filter(Boolean).join(' | ');

        jobs.push({
          title,
          company,
          location: loc,
          description: description || `${ep.listingType} opportunity on Internshala`,
          job_url: listingUrl,
          site: 'Internshala',
          jobType: ep.listingType,
        });
      }
      console.log(`[fetchInternshalaJobs] ${ep.listingType}: found ${blocks.length - 1} raw blocks`);
    } catch (err) {
      console.warn(`[fetchInternshalaJobs] error for ${ep.listingType}:`, err);
    }
  }

  return jobs;
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
    : ['linkedin', 'indeed', 'naukri', 'instahyre', 'google', 'wellfound', 'internshala', 'adzuna', 'remote'];

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

  // 2. Run Naukri Scraper if selected
  if (selectedSites.includes('naukri')) {
    try {
      const naukriJobs = await fetchNaukriJobs(searchRoleOnly, searchParams.location || '', searchParams.hoursOld);
      stats['naukri'] = naukriJobs.length;
      rawJobs.push(...naukriJobs);
    } catch (err) {
      console.warn('[jobs:search] naukri scraper error:', err);
    }
  }

  // 3. Run Instahyre Scraper if selected
  if (selectedSites.includes('instahyre')) {
    try {
      const instahyreJobs = await fetchInstahyreJobs(searchRoleOnly, searchParams.location || '', searchParams.hoursOld);
      stats['instahyre'] = instahyreJobs.length;
      rawJobs.push(...instahyreJobs);
    } catch (err) {
      console.warn('[jobs:search] instahyre scraper error:', err);
    }
  }

  // 4. Run Google & Career Pages Web Scraper if selected
  if (selectedSites.includes('google') || selectedSites.includes('glassdoor')) {
    try {
      const googleJobs = await fetchGoogleCareerJobs(searchRoleOnly, searchParams.location || '', searchParams.hoursOld);
      stats['google'] = googleJobs.length;
      rawJobs.push(...googleJobs);
    } catch (err) {
      console.warn('[jobs:search] google career scraper error:', err);
    }
  }

  // 5. Run Wellfound Scraper if selected
  if (selectedSites.includes('wellfound')) {
    try {
      const wellfoundJobs = await fetchWellfoundJobs(searchRoleOnly, searchParams.location || '', searchParams.hoursOld);
      stats['wellfound'] = wellfoundJobs.length;
      rawJobs.push(...wellfoundJobs);
    } catch (err) {
      console.warn('[jobs:search] wellfound scraper error:', err);
    }
  }

  // 6. Internshala — internships + fresher jobs
  if (selectedSites.includes('internshala')) {
    try {
      // Determine listing type based on experience level
      const expLevel = (searchParams.experienceLevel || '').toLowerCase();
      const listingType = expLevel === 'internship' ? 'internship' : expLevel === '' || expLevel === '0' || expLevel === '0-1' ? 'both' : 'job';
      const internshalaJobs = await fetchInternshalaJobs(searchRoleOnly, searchParams.location || '', listingType as any);
      stats['internshala'] = internshalaJobs.length;
      rawJobs.push(...internshalaJobs);
    } catch (err) {
      console.warn('[jobs:search] internshala error:', err);
    }
  }

  // 7. Run Remote Tech API if selected
  if (selectedSites.includes('remote') || searchParams.isRemote) {
    try {
      const remoteJobs = await fetchRemoteTechJobs(searchRoleOnly, keyTerm);
      stats['remote'] = remoteJobs.length;
      rawJobs.push(...remoteJobs);
    } catch (err) {
      console.warn('[jobs:search] remote tech API error:', err);
    }
  }

  // 8. Run Adzuna API if selected
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

  // Strict Input Enforcement Filter (takes user inputs seriously)
  const isStrict = searchParams.strictMode !== false;
  let finalJobs = uniqueJobs;

  if (isStrict) {
    const roleWords = (searchParams.jobRole || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const locWords = (searchParams.location || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const keyWords = (searchParams.keyword || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

    finalJobs = uniqueJobs.filter((job) => {
      const fullText = `${job.title} ${job.company} ${job.location} ${job.description}`.toLowerCase();

      // 1. Strict Role Check: Must match role words if user entered a job role
      if (roleWords.length > 0) {
        const matchesRole = roleWords.some(w => fullText.includes(w));
        if (!matchesRole) return false;
      }

      // 2. Strict Location Check: Must match location if user entered a location (and not remote only)
      if (locWords.length > 0 && !searchParams.isRemote && !locWords.includes('remote')) {
        const matchesLoc = locWords.some(w => fullText.includes(w));
        if (!matchesLoc) return false;
      }

      // 3. Strict Keyword Check: Must match keywords if user entered keywords
      if (keyWords.length > 0) {
        const matchesKey = keyWords.some(w => fullText.includes(w));
        if (!matchesKey) return false;
      }

      return true;
    });

    console.log(`[jobs:search] strict input enforcement: ${uniqueJobs.length} raw -> ${finalJobs.length} strictly matched`);
  }

  return { success: true, jobs: finalJobs, stats };
});

ipcMain.handle('browser:open', (_, url) => {
  shell.openExternal(url);
});