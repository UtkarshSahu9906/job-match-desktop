import { useState, useEffect, useRef } from 'react';
import {
  Upload, Search, Briefcase, MapPin, Building2, ExternalLink,
  Bookmark, BookmarkCheck, Star, ChevronDown, ChevronUp, Clock,
  CheckCircle2, XCircle, MessageCircle, Trophy, Filter, Loader2, Globe, SlidersHorizontal
} from 'lucide-react';
import './index.css';

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      storeGet: (key: string) => Promise<any>;
      storeSet: (key: string, val: any) => Promise<void>;
      uploadResume: () => Promise<any>;
      searchJobs: (params: any) => Promise<any>;
      openBrowser: (url: string) => Promise<void>;
    };
  }
}

interface Job {
  title: string;
  company: string;
  location: string;
  description: string;
  job_url: string;
  site: string;
  jobLevel?: string | null;
  jobType?: string | null;
}

type AppStatus = 'none' | 'applied' | 'interview' | 'offer' | 'rejected';

const STATUS_CONFIG: Record<AppStatus, { label: string; icon: React.ReactNode; color: string }> = {
  none:      { label: 'Track Status', icon: <Clock size={12} />,        color: 'status-none' },
  applied:   { label: 'Applied',      icon: <CheckCircle2 size={12} />, color: 'status-applied' },
  interview: { label: 'Interview',    icon: <MessageCircle size={12} />, color: 'status-interview' },
  offer:     { label: 'Offer 🎉',    icon: <Trophy size={12} />,       color: 'status-offer' },
  rejected:  { label: 'Rejected',     icon: <XCircle size={12} />,      color: 'status-rejected' },
};

const LOADING_STEPS = [
  'Querying Google Search & Career Pages…',
  'Connecting to LinkedIn & Indeed…',
  'Fetching Adzuna Global Job Index…',
  'Scanning Remote Tech Job Boards…',
  'Evaluating resume skill density & fit score…',
];

const COUNTRY_OPTIONS = [
  { label: 'India 🇮🇳',     value: 'india' },
  { label: 'USA 🇺🇸',       value: 'usa' },
  { label: 'UK 🇬🇧',        value: 'uk' },
  { label: 'Canada 🇨🇦',    value: 'canada' },
  { label: 'Germany 🇩🇪',   value: 'germany' },
  { label: 'Australia 🇦🇺', value: 'australia' },
];

const ALL_PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'indeed',   label: 'Indeed' },
  { id: 'google',   label: 'Google & Career Pages 🌐' },
  { id: 'adzuna',   label: 'Adzuna Jobs 🇮🇳🇺🇸' },
  { id: 'remote',   label: 'Remote Tech 💻' },
];

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function computeSkillAnalysis(job: Job, resumeSkills: string[]) {
  if (!resumeSkills || !resumeSkills.length) {
    return { score: 0, matched: [], missing: [] };
  }

  const text = `${job.title} ${job.description}`.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const s of resumeSkills) {
    const escaped = escapeRegExp(s.toLowerCase());
    const regex = /[+#\.]/.test(s)
      ? new RegExp(`(?:^|\\s|[^a-z0-9])${escaped}(?:$|\\s|[^a-z0-9])`, 'i')
      : new RegExp(`\\b${escaped}\\b`, 'i');

    if (regex.test(text)) {
      matched.push(s);
    } else {
      missing.push(s);
    }
  }

  const titleLower = job.title.toLowerCase();
  let titleBonus = 0;
  for (const m of matched) {
    if (titleLower.includes(m.toLowerCase())) {
      titleBonus += 15;
    }
  }

  const topSkillCap = Math.min(resumeSkills.length, 15);
  const coverage = (matched.length / topSkillCap) * 100;
  const score = Math.min(100, Math.round(coverage + titleBonus));

  return {
    score,
    matched,
    missing: missing.slice(0, 8),
  };
}

function scoreColor(score: number): string {
  if (score >= 70) return 'match-high';
  if (score >= 40) return 'match-mid';
  return 'match-low';
}

function JobCard({
  job,
  index,
  resumeSkills,
  isSaved,
  status,
  onToggleSave,
  onStatusChange,
  onApply,
}: {
  job: Job;
  index: number;
  resumeSkills: string[];
  isSaved: boolean;
  status: AppStatus;
  onToggleSave: () => void;
  onStatusChange: (s: AppStatus) => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { score, matched, missing } = computeSkillAnalysis(job, resumeSkills);
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className="job-card glass-panel"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="job-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="job-title">{job.title}</div>
          <div className="job-company">{job.company}</div>
        </div>
        <div className="job-header-actions">
          {resumeSkills.length > 0 && (
            <div className={`match-badge ${scoreColor(score)}`}>
              <span className="match-pct">{score}%</span>
              <span className="match-label">match</span>
            </div>
          )}
          <button
            className={`bookmark-btn ${isSaved ? 'saved' : ''}`}
            onClick={onToggleSave}
            title={isSaved ? 'Remove from saved' : 'Save job'}
          >
            {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
          </button>
        </div>
      </div>

      <div className="job-meta">
        {job.location && (
          <div className="job-meta-item">
            <MapPin size={13} />
            {job.location}
          </div>
        )}
        <div className="job-meta-item">
          <Building2 size={13} />
          <span className="source-badge">{job.site}</span>
        </div>
        {job.jobLevel && (
          <div className="job-meta-item">
            <span className="source-badge">{job.jobLevel}</span>
          </div>
        )}
        {job.jobType && (
          <div className="job-meta-item">
            <span className="source-badge">{job.jobType}</span>
          </div>
        )}
      </div>

      {resumeSkills.length > 0 && (matched.length > 0 || missing.length > 0) && (
        <div className="card-skills-breakdown">
          {matched.slice(0, 6).map(m => (
            <span key={m} className="skill-chip matched" title="Matched skill in job posting">
              ✓ {m}
            </span>
          ))}
          {missing.slice(0, 4).map(m => (
            <span key={m} className="skill-chip missing" title="Missing skill">
              + {m}
            </span>
          ))}
        </div>
      )}

      <div className={`job-description ${expanded ? 'expanded' : ''}`}>
        {job.description || 'No detailed description provided.'}
      </div>
      {job.description && job.description.length > 200 && (
        <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show more</>}
        </button>
      )}

      <div className="job-footer">
        <button className="btn secondary" onClick={onApply}>
          <ExternalLink size={15} />
          Apply Now
        </button>
        <div className="status-wrapper">
          <div className={`status-indicator ${cfg.color}`}>{cfg.icon}</div>
          <select
            className={`status-select ${cfg.color}`}
            value={status}
            onChange={e => onStatusChange(e.target.value as AppStatus)}
          >
            {(Object.entries(STATUS_CONFIG) as [AppStatus, typeof STATUS_CONFIG[AppStatus]][]).map(
              ([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              )
            )}
          </select>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasResume }: { hasResume: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Star size={40} />
      </div>
      <h3>No jobs found</h3>
      <p>
        {!hasResume
          ? 'Upload your resume first, then search — we\'ll aggregate across Google, LinkedIn, Indeed, Adzuna, and Remote Tech boards.'
          : 'Try searching with a role (e.g., "Full Stack Developer") or broadening your location/filters.'}
      </p>
    </div>
  );
}

function LoadingView() {
  const [step, setStep] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ref.current = setInterval(() => {
      setStep(s => (s + 1) % LOADING_STEPS.length);
    }, 1400);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, []);

  return (
    <div className="loader-container">
      <div className="spinner-ring">
        <Loader2 size={36} className="spin-icon" />
      </div>
      <div className="loading-steps">
        {LOADING_STEPS.map((s, i) => (
          <div
            key={i}
            className={`loading-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
          >
            <span className="step-dot" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [jobRole, setJobRole]             = useState('');
  const [keyword, setKeyword]             = useState('');
  const [location, setLocation]           = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [hoursOld, setHoursOld]           = useState(168);
  const [country, setCountry]             = useState('india');
  const [isRemote, setIsRemote]           = useState(false);
  const [resultsWanted, setResultsWanted] = useState(15);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['linkedin', 'indeed', 'google', 'adzuna', 'remote']);

  const [resumeSkills, setResumeSkills]   = useState<string[]>([]);
  const [resumeLoaded, setResumeLoaded]   = useState(false);

  const [jobs, setJobs]                   = useState<Job[]>([]);
  const [platformStats, setPlatformStats] = useState<Record<string, number>>({});
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const [savedJobs, setSavedJobs]         = useState<Job[]>([]);
  const [statuses, setStatuses]           = useState<Record<string, AppStatus>>({});

  const [activeTab, setActiveTab]         = useState<'search' | 'saved'>('search');
  const [filterSource, setFilterSource]   = useState('');
  const [searchFilterText, setSearchFilterText] = useState('');
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);
  const [sortBy, setSortBy]               = useState<'score' | 'title' | 'company' | 'site'>('score');

  useEffect(() => {
    const load = async () => {
      try {
        const [savedJobRole, savedKeyword, savedLocation, savedExpLevel,
               savedHours, savedCountry, storedPlatforms, storedSaved, storedStatuses, storedSkills, storedRemote] = await Promise.all([
          window.electronAPI.storeGet('searchJobRole'),
          window.electronAPI.storeGet('searchKeyword'),
          window.electronAPI.storeGet('searchLocation'),
          window.electronAPI.storeGet('searchExperienceLevel'),
          window.electronAPI.storeGet('searchHoursOld'),
          window.electronAPI.storeGet('searchCountry'),
          window.electronAPI.storeGet('selectedPlatforms'),
          window.electronAPI.storeGet('savedJobs'),
          window.electronAPI.storeGet('applicationStatuses'),
          window.electronAPI.storeGet('resumeSkills'),
          window.electronAPI.storeGet('searchIsRemote'),
        ]);
        if (savedJobRole)  setJobRole(savedJobRole);
        if (savedKeyword)  setKeyword(savedKeyword);
        if (savedLocation) setLocation(savedLocation);
        if (savedExpLevel) setExperienceLevel(savedExpLevel);
        if (savedHours)    setHoursOld(savedHours);
        if (savedCountry)  setCountry(savedCountry);
        if (typeof storedRemote === 'boolean') setIsRemote(storedRemote);
        if (storedPlatforms && Array.isArray(storedPlatforms) && storedPlatforms.length > 0) {
          setSelectedPlatforms(storedPlatforms);
        }
        if (storedSaved && Array.isArray(storedSaved)) setSavedJobs(storedSaved);
        if (storedStatuses && typeof storedStatuses === 'object') setStatuses(storedStatuses);
        if (storedSkills && Array.isArray(storedSkills)) {
          setResumeSkills(storedSkills);
          setResumeLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load store', err);
      }
    };
    load();
  }, []);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      if (next.length === 0) return prev;
      window.electronAPI.storeSet('selectedPlatforms', next);
      return next;
    });
  };

  const handleUpload = async () => {
    try {
      const result = await window.electronAPI.uploadResume();
      if (!result) return;
      if (result.error) { setError(result.error); return; }

      const skills: string[] = result.extractedSkills || [];
      setResumeSkills(skills);
      setResumeLoaded(true);
      window.electronAPI.storeSet('resumeSkills', skills);

      if (skills.length > 0 && !keyword) {
        const topSkills = skills.slice(0, 3).join(' ');
        setKeyword(topSkills);
        window.electronAPI.storeSet('searchKeyword', topSkills);
      }
    } catch (err) {
      setError(`Failed to parse resume: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSearch = async () => {
    if (!jobRole && !keyword && !location) {
      setError('Please enter a Job Role, Keyword, or Location');
      return;
    }
    setError('');
    setLoading(true);
    setJobs([]);
    setPlatformStats({});
    setFilterSource('');

    try {
      await Promise.all([
        window.electronAPI.storeSet('searchJobRole', jobRole),
        window.electronAPI.storeSet('searchKeyword', keyword),
        window.electronAPI.storeSet('searchLocation', location),
        window.electronAPI.storeSet('searchExperienceLevel', experienceLevel),
        window.electronAPI.storeSet('searchHoursOld', hoursOld),
        window.electronAPI.storeSet('searchCountry', country),
        window.electronAPI.storeSet('searchIsRemote', isRemote),
        window.electronAPI.storeSet('selectedPlatforms', selectedPlatforms),
      ]);

      const response = await window.electronAPI.searchJobs({
        jobRole,
        keyword,
        location,
        experienceLevel,
        hoursOld,
        country,
        isRemote,
        resultsWanted,
        sites: selectedPlatforms,
      });

      if (response.success && response.jobs) {
        setJobs(response.jobs as Job[]);
        if (response.stats) {
          setPlatformStats(response.stats);
        }
        setActiveTab('search');
      } else {
        setError(response.error || 'No jobs found or search encountered an issue');
      }
    } catch (err) {
      setError(`Search error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = (job: Job) => {
    setSavedJobs(prev => {
      const exists = prev.some(j => j.job_url === job.job_url);
      const next = exists
        ? prev.filter(j => j.job_url !== job.job_url)
        : [...prev, job];
      window.electronAPI.storeSet('savedJobs', next);
      return next;
    });
  };

  const updateStatus = (job: Job, s: AppStatus) => {
    setStatuses(prev => {
      const next = { ...prev, [job.job_url]: s };
      window.electronAPI.storeSet('applicationStatuses', next);
      return next;
    });
  };

  const handleApply = (job: Job) => {
    if (!job.job_url) { setError('This listing has no application link.'); return; }
    window.electronAPI.openBrowser(job.job_url);
  };

  const sourceJobs = activeTab === 'saved' ? savedJobs : jobs;

  const filteredJobs = sourceJobs.filter(job => {
    if (filterSource && job.site?.toLowerCase() !== filterSource.toLowerCase()) return false;
    if (searchFilterText) {
      const q = searchFilterText.toLowerCase();
      const match = `${job.title} ${job.company} ${job.description}`.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (minScoreFilter > 0 && resumeSkills.length > 0) {
      const { score } = computeSkillAnalysis(job, resumeSkills);
      if (score < minScoreFilter) return false;
    }
    return true;
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === 'score' && resumeSkills.length > 0) {
      return computeSkillAnalysis(b, resumeSkills).score - computeSkillAnalysis(a, resumeSkills).score;
    }
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'company') return a.company.localeCompare(b.company);
    if (sortBy === 'site') return a.site.localeCompare(b.site);
    return 0;
  });

  const sources = [...new Set(jobs.map(j => j.site).filter(Boolean))];

  const goodMatches = resumeSkills.length > 0
    ? jobs.filter(j => computeSkillAnalysis(j, resumeSkills).score >= 70).length
    : 0;

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar glass-panel">
        <div className="brand">
          <Briefcase size={24} />
          <span>Job Match</span>
        </div>

        {/* Resume Upload */}
        <div className="upload-section">
          <button className={`btn secondary ${resumeLoaded ? 'resume-loaded' : ''}`} onClick={handleUpload}>
            <Upload size={17} />
            {resumeLoaded ? '✓ Resume Loaded' : 'Upload Resume'}
          </button>
          {resumeLoaded && (
            <div className="skills-preview">
              {resumeSkills.slice(0, 6).map(s => (
                <span key={s} className="skill-chip">{s}</span>
              ))}
              {resumeSkills.length > 6 && (
                <span className="skill-chip muted">+{resumeSkills.length - 6}</span>
              )}
            </div>
          )}
        </div>

        {/* Search fields */}
        <div className="form-group">
          <label>Job Role / Title</label>
          <input
            type="text"
            placeholder="e.g. Frontend Developer"
            value={jobRole}
            onChange={e => setJobRole(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div className="form-group">
          <label>Keywords / Skills</label>
          <input
            type="text"
            placeholder="e.g. React Node TypeScript"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div className="form-group">
          <label>Experience Level</label>
          <select value={experienceLevel} onChange={e => setExperienceLevel(e.target.value)}>
            <option value="">Any Experience</option>
            <option value="internship">Internship</option>
            <option value="entry level">Entry Level</option>
            <option value="mid level">Mid Level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead / Manager</option>
          </select>
        </div>

        <div className="form-group">
          <label>Target Country</label>
          <select value={country} onChange={e => setCountry(e.target.value)}>
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Location / City</label>
          <input
            type="text"
            placeholder="e.g. Remote, Bangalore, London"
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        {/* Remote Only Toggle */}
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isRemote}
              onChange={e => setIsRemote(e.target.checked)}
            />
            <Globe size={14} />
            <span>Remote Jobs Only</span>
          </label>
        </div>

        {/* Platform Selection */}
        <div className="form-group">
          <label>Search Platforms</label>
          <div className="platform-grid">
            {ALL_PLATFORMS.map(p => {
              const active = selectedPlatforms.includes(p.id);
              return (
                <label key={p.id} className={`platform-pill ${active ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => togglePlatform(p.id)}
                  />
                  <span>{active ? '✓' : '+'} {p.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group">
          <label>Results Limit per Platform</label>
          <select value={resultsWanted} onChange={e => setResultsWanted(Number(e.target.value))}>
            <option value={10}>10 results</option>
            <option value={15}>15 results (recommended)</option>
            <option value={25}>25 results</option>
            <option value={50}>50 results</option>
          </select>
        </div>

        <button className="btn search-btn" onClick={handleSearch} disabled={loading}>
          <Search size={17} />
          {loading ? 'Searching…' : 'Find Jobs'}
        </button>

        {error && <div className="error-msg">{error}</div>}

        <div className="sidebar-footer">Job Match Finder • Multi-Platform Search</div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content glass-panel">
        {/* Header */}
        <div className="header">
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={14} />
              Results
              {jobs.length > 0 && <span className="tab-count">{jobs.length}</span>}
            </button>
            <button
              className={`tab ${activeTab === 'saved' ? 'active' : ''}`}
              onClick={() => setActiveTab('saved')}
            >
              <Bookmark size={14} />
              Saved
              {savedJobs.length > 0 && <span className="tab-count">{savedJobs.length}</span>}
            </button>
          </div>

          {/* Stats & Platform breakdown */}
          <div className="header-stats">
            {activeTab === 'search' && jobs.length > 0 && (
              <>
                <span className="stat-text">{jobs.length} jobs retrieved</span>
                {goodMatches > 0 && (
                  <span className="stat-highlight">· {goodMatches} match your resume well</span>
                )}
              </>
            )}
            {activeTab === 'saved' && savedJobs.length > 0 && (
              <span className="stat-text">{savedJobs.length} saved</span>
            )}
          </div>
        </div>

        {/* Platform stats breakdown chips */}
        {activeTab === 'search' && Object.keys(platformStats).length > 0 && (
          <div className="platform-stats-bar">
            <span className="stats-label">Sources:</span>
            {Object.entries(platformStats).map(([site, cnt]) => (
              <span key={site} className={`diag-chip ${cnt > 0 ? 'success' : 'empty'}`}>
                {site}: {cnt}
              </span>
            ))}
          </div>
        )}

        {/* Control Bar: Search text, Min score, Sort, Sources */}
        {activeTab === 'search' && jobs.length > 0 && (
          <div className="control-bar">
            <div className="search-filter-input">
              <Search size={14} />
              <input
                type="text"
                placeholder="Filter loaded jobs by title or company…"
                value={searchFilterText}
                onChange={e => setSearchFilterText(e.target.value)}
              />
            </div>

            {resumeSkills.length > 0 && (
              <div className="min-score-chips">
                <button
                  className={`chip ${minScoreFilter === 0 ? 'active' : ''}`}
                  onClick={() => setMinScoreFilter(0)}
                >All</button>
                <button
                  className={`chip ${minScoreFilter === 40 ? 'active' : ''}`}
                  onClick={() => setMinScoreFilter(40)}
                >40%+ Match</button>
                <button
                  className={`chip ${minScoreFilter === 70 ? 'active' : ''}`}
                  onClick={() => setMinScoreFilter(70)}
                >70%+ High Match</button>
              </div>
            )}

            <div className="sort-selector">
              <SlidersHorizontal size={13} />
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                {resumeSkills.length > 0 && <option value="score">Sort by Match Score</option>}
                <option value="title">Sort by Title</option>
                <option value="company">Sort by Company</option>
                <option value="site">Sort by Platform</option>
              </select>
            </div>
          </div>
        )}

        {/* Source chips */}
        {sources.length > 0 && activeTab === 'search' && (
          <div className="filter-bar">
            <Filter size={13} className="filter-icon" />
            <button
              className={`chip ${!filterSource ? 'active' : ''}`}
              onClick={() => setFilterSource('')}
            >All Sources ({jobs.length})</button>
            {sources.map(s => {
              const count = jobs.filter(j => j.site === s).length;
              return (
                <button
                  key={s}
                  className={`chip ${filterSource === s ? 'active' : ''}`}
                  onClick={() => setFilterSource(filterSource === s ? '' : s)}
                >{s} ({count})</button>
              );
            })}
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <LoadingView />
        ) : (
          <div className="jobs-container">
            {sortedJobs.length === 0 ? (
              <EmptyState hasResume={resumeLoaded} />
            ) : (
              sortedJobs.map((job, index) => (
                <JobCard
                  key={`${job.job_url}-${index}`}
                  job={job}
                  index={index}
                  resumeSkills={resumeSkills}
                  isSaved={savedJobs.some(j => j.job_url === job.job_url)}
                  status={statuses[job.job_url] || 'none'}
                  onToggleSave={() => toggleSave(job)}
                  onStatusChange={s => updateStatus(job, s)}
                  onApply={() => handleApply(job)}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
