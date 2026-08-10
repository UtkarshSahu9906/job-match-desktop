# 🎯 Job Match Desktop

<div align="center">

### AI-Powered Multi-Platform Job Search — with Resume Matching

Search jobs across **LinkedIn, Indeed, Naukri.com, Instahyre, Glassdoor, Internshala, Wellfound, Adzuna & Remote Tech** from one desktop app.  
Upload your resume and get **smart match scores** on every result — completely free & local.

<p align="center">
  <img src="https://img.shields.io/github/license/UtkarshSahu9906/job-match-desktop?style=for-the-badge" />
  <img src="https://img.shields.io/github/stars/UtkarshSahu9906/job-match-desktop?style=for-the-badge" />
  <img src="https://img.shields.io/github/forks/UtkarshSahu9906/job-match-desktop?style=for-the-badge" />
  <img src="https://img.shields.io/github/issues/UtkarshSahu9906/job-match-desktop?style=for-the-badge" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/100%25_Local-Free-10b981?style=flat-square" />
</p>

</div>

---

## 📌 What Is This?

**Job Match Desktop** is a free, local Electron desktop app for job seekers. It scrapes live job listings from multiple platforms and ranks them against your uploaded resume — no subscriptions, no API keys, no data sent to any server.

### Supported Job Boards
| Platform | Status |
|----------|--------|
| 🔗 LinkedIn | ✅ Active |
| 💼 Indeed | ✅ Active |
| 🇮🇳 Naukri.com | ✅ Active |
| 🎯 Instahyre | ✅ Active |
| 🎓 Internshala | ✅ Active |
| 🚀 Wellfound (AngelList) | ✅ Active |
| 🇮🇳🇺🇸 Adzuna Jobs | ✅ Active |
| 💻 Remote Tech | ✅ Active |
| 🏢 Glassdoor | ✅ Active |

---

## 🤝 How to Use All 3 Projects Together for Maximum Efficiency

This desktop app is part of a 3-part AI Job Search & Application Ecosystem:

1. **[job-match-desktop](https://github.com/UtkarshSahu9906/job-match-desktop)** (This Repo): Discover, search, and rank live job postings across LinkedIn, Indeed, Naukri, Instahyre & Glassdoor based on your resume fit score.
2. **[resume-autofill-extension](https://github.com/UtkarshSahu9906/resume-autofill-extension)**: Automatically fill out application forms on company job portals (Workday, Softgarden, Greenhouse, Lever, etc.).
3. **[resume-autofill-backend](https://github.com/UtkarshSahu9906/resume-autofill-backend)**: Powers the extension's AI generation using Ollama (local/free), Gemini, or Claude to answer complex open-ended application questions.

### 🔄 End-to-End Recommended Workflow

```
[ 1. Search Jobs ] ──> Open job-match-desktop → Upload resume → Find & rank best matching jobs
                             │
                             ▼ Click job link to open company application portal
[ 2. Autofill Form] ──> Extension detects form fields → Instantly fills standard info (Name, Email, etc.)
                             │
                             ▼ Open-ended / custom application question?
[ 3. AI Generation] ──> Extension calls resume-autofill-backend → Generates customized, human-like answers
```


---

## ✨ Features

### ⚡ Strict Input Enforcement ("Take Given Inputs Seriously")
A dedicated toggle switch that enforces strict filtering on search results. It ensures every listing returned strictly contains your exact **Job Role**, **Location**, and **Keywords**, eliminating unrelated listings.

### 🕐 Time of Posting / Freshness Controls
Filter jobs by exact posting age using quick-tap buttons:
> `⚡ < 1 Hour` · `⏱️ < 2 Hours` · `🕐 < 24 Hours` · `📅 < 3 Days` · `🗓️ < 7 Days` · `♾️ Anytime`

### 🎯 Resume-Based Match Score
Upload a PDF or TXT resume. The app extracts your top skills using keyword analysis and shows a **match % badge** on every job card:
- 🟢 **Green** ≥ 70% — strong match
- 🟡 **Amber** 40–69% — partial match  
- ⚪ **Gray** < 40% — low match

Results are **auto-sorted** by match score when a resume is loaded.

### ⭐ Save / Favourite Jobs
Bookmark any job with one click. A **"Saved" tab** keeps your list across app restarts (stored locally via `electron-store`).

### 📋 Application Status Tracker
Track your progress on each job listing:
> `Track Status → Applied → Interview → Offer 🎉 → Rejected`

Each status is color-coded and persists between sessions.

### 🔍 Client-Side Filter Chips
After a search, instantly filter results by:
- **Job board** (LinkedIn / Indeed / Naukri / Instahyre / Glassdoor)
- **Job type** (Full-time / Remote / Contract / etc.)

No re-search needed — filtering is instant.

### 📄 PDF Resume Parsing
Uses `pdf-parse` in the Electron main process to extract text from your resume file — **no upload, no cloud, runs entirely on your machine**.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop shell | **Electron v43** | Native window, IPC, file dialogs |
| Frontend | **React 19 + TypeScript** | UI components |
| Build | **Vite 8** | Fast HMR dev server + bundling |
| Job scraping | **ts-jobspy** | Scrapes LinkedIn, Indeed, Glassdoor |
| PDF parsing | **pdf-parse** | Extracts text from uploaded resumes |
| Persistence | **electron-store** | Saves preferences, saved jobs, statuses |
| Icons | **lucide-react** | Icon set |

---

## ⚙️ Prerequisites

- **Node.js v18+** → https://nodejs.org/
- **Git** → https://git-scm.com/
- **Windows / macOS / Linux** (Electron is cross-platform)

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/UtkarshSahu9906/job-match-desktop.git
cd job-match-desktop

# 2. Install dependencies
npm install

# 3. Start in development mode (opens Electron window automatically)
npm run dev
```

That's it. The Electron window opens automatically.

---

## 📂 Project Structure

```
job-match-desktop/
│
├── electron/
│   ├── main.ts          ← Electron main process: IPC handlers, PDF parse, job scraper
│   └── preload.ts       ← Context bridge: exposes safe APIs to renderer
│
├── src/
│   ├── App.tsx          ← Main React component (all UI + state)
│   ├── index.css        ← All styles (glassmorphism dark theme)
│   └── main.tsx         ← React entry point
│
├── public/              ← Static assets
├── package.json
├── vite.config.ts       ← Vite + Electron plugin config
└── tsconfig.json
```

### Key IPC Channels (electron ↔ renderer)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `resume:upload` | renderer → main | Opens file dialog, parses PDF, returns extracted skills |
| `jobs:search` | renderer → main | Runs `ts-jobspy` scraper, returns job array |
| `browser:open` | renderer → main | Opens a URL in the system browser |
| `store:get` | renderer → main | Read from persistent key-value store |
| `store:set` | renderer → main | Write to persistent key-value store |

---

## 🧠 How It Works

```
1. User uploads resume (PDF/TXT)
         ↓
2. Main process reads file, runs keyword extraction
   - Strips stopwords, scores known tech phrases (Spring Boot, React Native, etc.)
   - Returns top 35 keywords
         ↓
3. User fills search form (role, keywords, location, experience, freshness)
         ↓
4. Main process calls ts-jobspy → scrapes LinkedIn + Indeed + Glassdoor
   - Combines: jobRole + keyword + experienceLevel into one search term
         ↓
5. Results come back to renderer
   - Sorted by resume match score (if resume loaded)
   - Each card shows match %, bookmark, status tracker, "Show more"
         ↓
6. User can filter chips, save jobs, update application status
   - All data stored locally via electron-store
```

---

## 🗺️ Roadmap / Ideas for Contributors

The following are great areas to improve — PRs welcome!

### 🔧 Improvements
- [ ] **Drag-and-drop** resume upload
- [ ] **Export to CSV/Excel** — save job results with statuses
- [ ] **Cover letter generator** using local LLM (Ollama)
- [ ] **Auto-apply** with browser automation (Playwright/Puppeteer)
- [ ] **Salary range display** (ts-jobspy returns this for some listings)
- [ ] **Duplicate detection** — merge same job from multiple boards
- [ ] **Notification** when new matching jobs appear (background polling)
- [ ] **Multi-resume support** — switch profiles per role (Full Stack / Android / Backend)

### 🌍 More Job Sources
- [x] Naukri (India)
- [x] Instahyre (India)
- [x] Wellfound / AngelList
- [x] Internshala (India)
- [x] Adzuna & Remote Tech
- [ ] RemoteOK
- [ ] Dice

### 🎨 UI
- [ ] Dark / light mode toggle
- [ ] Compact card view vs expanded view
- [ ] Kanban board view for application tracker (Applied → Interview → Offer columns)

---

## 🤝 Contributing

All contributions are welcome — bug fixes, new features, docs, tests.

```bash
# 1. Fork the repo on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/job-match-desktop.git
cd job-match-desktop

# 3. Create a feature branch
git checkout -b feature/your-feature-name

# 4. Make your changes and test with
npm run dev

# 5. Commit with a clear message
git commit -m "feat: add salary range display on job cards"

# 6. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Commit Message Convention
Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change with no feature/fix
- `docs:` — documentation only
- `style:` — CSS/formatting

---

## 🐞 Reporting Issues

Found a bug? Have a feature idea?

👉 **Open an issue:** https://github.com/UtkarshSahu9906/job-match-desktop/issues

Please include:
- Your OS and Node.js version
- Steps to reproduce
- Expected vs actual behaviour
- Console output if available (open DevTools with `Ctrl+Shift+I` inside the app)

---

## 👨‍💻 Author

**Utkarsh Sahu**  
🎓 MCA Student | Full Stack & Android Developer

- **GitHub:** https://github.com/UtkarshSahu9906
- **LinkedIn:** https://www.linkedin.com/in/utkarshsahu9906/

---

## ⭐ Support

If this project saved you time during your job search — give it a **star ⭐**!  
It helps other developers and job seekers find it.

---

## 📄 License

MIT License — free to use, modify, and distribute.  
See [`LICENSE`](LICENSE) for details.

---

<div align="center">

**Built with ❤️ by Utkarsh Sahu**

*Electron · React · TypeScript · Vite · ts-jobspy*

</div>
