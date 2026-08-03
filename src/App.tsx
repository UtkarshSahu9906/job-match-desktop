import { useState, useEffect, useRef } from 'react';
import {
  Upload, Search, Briefcase, MapPin, Building2, ExternalLink,
  Bookmark, BookmarkCheck, Star, ChevronDown, ChevronUp, Clock,
  CheckCircle2, XCircle, MessageCircle, Trophy, Filter, Loader2
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
  'Connecting to LinkedIn…',
  'Scanning Indeed…',
  'Checking Glassdoor…',
  'Collecting results…',
  'Ranking by relevance…',
];

const FRESHNESS_OPTIONS = [
  { label: '24 hours', value: 24 },
  { label: '3 days',   value: 72 },
  { label: '7 days',   value: 168 },
  { label: '30 days',  value: 720 },
];

// ── Match Score ────────────────────────────────────────────────────────────────
function computeMatchScore(job: Job, skills: string[]): number {
  if (!skills.length) return 0;
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const hits = skills.filter(s => haystack.includes(s.toLowerCase()));
  return Math.round((hits.length / skills.length) * 100);
}

function scoreColor(score: number): string {
  if (score >= 70) return 'match-high';
  if (score >= 40) return 'match-mid';
  return 'match-low';
}

// ── Job Card ───────────────────────────────────────────────────────────────────
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
  const score = computeMatchScore(job, resumeSkills);
  const cfg = STATUS_CONFIG[status];

  return (
    <div
      className="job-card glass-panel"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Top row */}
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

      {/* Meta */}
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

      {/* Description */}
      <div className={`job-description ${expanded ? 'expanded' : ''}`}>
        {job.description || 'No description provided.'}
      </div>
      {job.description && job.description.length > 200 && (
        <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show more</>}
        </button>
      )}

      {/* Footer */}
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

// ── Empty State ────────────────────────────────────────────────────────────────
function EmptyState({ hasResume }: { hasResume: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Star size={40} />
      </div>
      <h3>No jobs found yet</h3>
      <p>
        {!hasResume
          ? 'Upload your resume first, then search — we\'ll rank jobs by how well they match your skills.'
          : 'Fill in a job role or keywords above and hit "Find Jobs" to start.'}
      </p>
    </div>
  );
}

// ── Loading Steps ──────────────────────────────────────────────────────────────
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

// ── Main App ───────────────────────────────────────────────────────────────────
function App() {
  // Search form state
  const [jobRole, setJobRole]             = useState('');
  const [keyword, setKeyword]             = useState('');
  const [location, setLocation]           = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [hoursOld, setHoursOld]           = useState(72);

  // Resume state
  const [resumeSkills, setResumeSkills]   = useState<string[]>([]);
  const [resumeLoaded, setResumeLoaded]   = useState(false);

  // Jobs state
  const [jobs, setJobs]                   = useState<Job[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  // Saved + Statuses (persisted)
  const [savedJobs, setSavedJobs]         = useState<Job[]>([]);
  const [statuses, setStatuses]           = useState<Record<string, AppStatus>>({});

  // UI state
  const [activeTab, setActiveTab]         = useState<'search' | 'saved'>('search');
  const [filterSource, setFilterSource]   = useState('');
  const [filterType, setFilterType]       = useState('');

  // ── Load persisted data ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [savedJobRole, savedKeyword, savedLocation, savedExpLevel,
               savedHours, storedSaved, storedStatuses, storedSkills] = await Promise.all([
          window.electronAPI.storeGet('searchJobRole'),
          window.electronAPI.storeGet('searchKeyword'),
          window.electronAPI.storeGet('searchLocation'),
          window.electronAPI.storeGet('searchExperienceLevel'),
          window.electronAPI.storeGet('searchHoursOld'),
          window.electronAPI.storeGet('savedJobs'),
          window.electronAPI.storeGet('applicationStatuses'),
          window.electronAPI.storeGet('resumeSkills'),
        ]);
        if (savedJobRole)  setJobRole(savedJobRole);
        if (savedKeyword)  setKeyword(savedKeyword);
        if (savedLocation) setLocation(savedLocation);
        if (savedExpLevel) setExperienceLevel(savedExpLevel);
        if (savedHours)    setHoursOld(savedHours);
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

  // ── Resume Upload ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    try {
      const result = await window.electronAPI.uploadResume();
      if (!result) return; // cancelled
      if (result.error) { setError(result.error); return; }

      const skills: string[] = result.extractedSkills || [];
      setResumeSkills(skills);
      setResumeLoaded(true);
      window.electronAPI.storeSet('resumeSkills', skills);

      if (skills.length > 0) {
        const topSkills = skills.slice(0, 3).join(' ');
        setKeyword(topSkills);
        window.electronAPI.storeSet('searchKeyword', topSkills);
      }
    } catch (err) {
      setError(`Failed to parse resume: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // ── Job Search ─────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!jobRole && !keyword && !location) {
      setError('Please enter a job role, keyword, or location');
      return;
    }
    setError('');
    setLoading(true);
    setJobs([]);
    setFilterSource('');
    setFilterType('');

    try {
      await Promise.all([
        window.electronAPI.storeSet('searchJobRole', jobRole),
        window.electronAPI.storeSet('searchKeyword', keyword),
        window.electronAPI.storeSet('searchLocation', location),
        window.electronAPI.storeSet('searchExperienceLevel', experienceLevel),
        window.electronAPI.storeSet('searchHoursOld', hoursOld),
      ]);

      const response = await window.electronAPI.searchJobs({
        jobRole, keyword, location, experienceLevel, hoursOld,
      });

      if (response.success && response.jobs) {
        // Sort by match score if resume is loaded
        let sorted = response.jobs as Job[];
        if (resumeSkills.length > 0) {
          sorted = [...sorted].sort(
            (a, b) => computeMatchScore(b, resumeSkills) - computeMatchScore(a, resumeSkills)
          );
        }
        setJobs(sorted);
        setActiveTab('search');
      } else {
        setError(response.error || 'No jobs found or search failed');
      }
    } catch (err) {
      setError(`Search error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Save Toggle ────────────────────────────────────────────────────────────
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

  // ── Status Change ──────────────────────────────────────────────────────────
  const updateStatus = (job: Job, s: AppStatus) => {
    setStatuses(prev => {
      const next = { ...prev, [job.job_url]: s };
      window.electronAPI.storeSet('applicationStatuses', next);
      return next;
    });
  };

  // ── Apply ──────────────────────────────────────────────────────────────────
  const handleApply = (job: Job) => {
    if (!job.job_url) { setError('This listing has no application link.'); return; }
    window.electronAPI.openBrowser(job.job_url);
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const visibleJobs = (activeTab === 'saved' ? savedJobs : jobs).filter(job => {
    if (filterSource && job.site?.toLowerCase() !== filterSource.toLowerCase()) return false;
    if (filterType   && !job.jobType?.toLowerCase().includes(filterType.toLowerCase())) return false;
    return true;
  });

  const sources = [...new Set(jobs.map(j => j.site).filter(Boolean))];
  const types   = [...new Set(jobs.map(j => j.jobType).filter(Boolean))] as string[];

  const goodMatches = resumeSkills.length > 0
    ? jobs.filter(j => computeMatchScore(j, resumeSkills) >= 70).length
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
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
            <option value="">Any</option>
            <option value="internship">Internship</option>
            <option value="entry level">Entry Level</option>
            <option value="mid level">Mid Level</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead / Manager</option>
          </select>
        </div>

        <div className="form-group">
          <label>Location</label>
          <input
            type="text"
            placeholder="e.g. Remote, San Francisco"
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div className="form-group">
          <label>Freshness</label>
          <select value={hoursOld} onChange={e => setHoursOld(Number(e.target.value))}>
            {FRESHNESS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <button className="btn search-btn" onClick={handleSearch} disabled={loading}>
          <Search size={17} />
          {loading ? 'Searching…' : 'Find Jobs'}
        </button>

        {error && <div className="error-msg">{error}</div>}

        <div className="sidebar-footer">Job Match Finder • All local</div>
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

          {/* Stats */}
          <div className="header-stats">
            {activeTab === 'search' && jobs.length > 0 && (
              <>
                <span className="stat-text">{jobs.length} jobs</span>
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

        {/* Filter chips */}
        {(sources.length > 0 || types.length > 0) && activeTab === 'search' && (
          <div className="filter-bar">
            <Filter size={13} className="filter-icon" />
            <button
              className={`chip ${!filterSource ? 'active' : ''}`}
              onClick={() => setFilterSource('')}
            >All Sources</button>
            {sources.map(s => (
              <button
                key={s}
                className={`chip ${filterSource === s ? 'active' : ''}`}
                onClick={() => setFilterSource(filterSource === s ? '' : s)}
              >{s}</button>
            ))}
            {types.length > 0 && <div className="chip-divider" />}
            {types.map(t => (
              <button
                key={t}
                className={`chip ${filterType === t ? 'active' : ''}`}
                onClick={() => setFilterType(filterType === t ? '' : t)}
              >{t}</button>
            ))}
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <LoadingView />
        ) : (
          <div className="jobs-container">
            {visibleJobs.length === 0 ? (
              <EmptyState hasResume={resumeLoaded} />
            ) : (
              visibleJobs.map((job, index) => (
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
