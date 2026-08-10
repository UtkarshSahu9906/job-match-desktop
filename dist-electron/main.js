import { BrowserWindow as e, app as t, dialog as n, ipcMain as r, shell as i } from "electron";
import a from "node:path";
import o from "node:fs";
import s from "electron-store";
import { fileURLToPath as c } from "node:url";
import { PDFParse as l } from "pdf-parse";
import { scrapeJobs as u } from "ts-jobspy";
//#region electron/main.ts
var d = a.dirname(c(import.meta.url)), f = new s();
process.env.DIST = a.join(d, "../dist"), process.env.VITE_PUBLIC = t.isPackaged ? process.env.DIST : a.join(process.env.DIST, "../public");
var p, m = process.env.VITE_DEV_SERVER_URL;
function h() {
	p = new e({
		width: 1200,
		height: 800,
		icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
		webPreferences: {
			preload: a.join(d, "preload.js"),
			nodeIntegration: !1,
			contextIsolation: !0
		},
		autoHideMenuBar: !0
	}), p.webContents.on("preload-error", (e, t, n) => {
		console.error(`[preload-error] Failed to load preload script at ${t}:`, n);
	}), p.webContents.setWindowOpenHandler((e) => (i.openExternal(e.url), { action: "deny" })), m ? p.loadURL(m) : p.loadFile(a.join(process.env.DIST, "index.html"));
}
t.on("window-all-closed", () => {
	process.platform !== "darwin" && (t.quit(), p = null);
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && h();
}), t.whenReady().then(h), r.handle("store:get", (e, t) => f.get(t)), r.handle("store:set", (e, t, n) => {
	f.set(t, n);
});
var g = /* @__PURE__ */ new Set(/* @__PURE__ */ "a.an.the.and.or.but.of.to.in.on.at.for.with.by.from.is.are.was.were.be.been.being.i.my.me.we.our.you.your.as.it.this.that.these.those.have.has.had.will.would.can.not.no.if.so.also.than.then.into.about.over.under.more.years.year.experience.experienced.worked.working.work.responsible.responsibilities.project.projects.developed.development.using.used.team.role.company.various.strong.good.skills.skill.building.created.knowledge.ability.system.systems.engineer.engineering.developer.solutions.environment.implementation.support.user.data.including.etc.across.within.new.all.one.two.key.able".split(".")), _ = /* @__PURE__ */ "spring boot,spring mvc,rest api,restful api,machine learning,deep learning,android development,android studio,java streams,multi threading,multithreading,data structures,unit testing,ci cd,ci/cd,node js,nodejs,react js,reactjs,next js,nextjs,vue js,vuejs,express js,expressjs,react native,material design,google play,play store,firebase firestore,sql server,object oriented,microservices architecture,microservices,system design,tailwind css,docker container,kubernetes,aws,google cloud,azure,postgresql,mongodb,graphql,redux toolkit,typescript,javascript,c++,c#,.net core".split(","), v = /[\w.+-]+@[\w-]+\.[a-z]{2,}|https?:\/\/\S+|www\.\S+|\b(?:github|linkedin|gitlab|bitbucket|twitter|medium|stackoverflow|behance|dribbble)\.com\/\S+/gi, y = /[^a-z0-9 ]/gi, b = /[^a-z0-9+#\- ]/gi, x = /^-+|-+$/g;
function S(e) {
	let t = e.toLowerCase().replace(v, " "), n = /* @__PURE__ */ new Map(), r = t.replace(y, " ");
	for (let e of _) {
		let t = 0, i = r.indexOf(e);
		for (; i !== -1;) t++, i = r.indexOf(e, i + e.length);
		t > 0 && n.set(e, (n.get(e) || 0) + t);
	}
	let i = t.replace(b, " ").split(/\s+/);
	for (let e of i) {
		let t = e.replace(x, "");
		t.length < 3 || g.has(t) || /[a-z]/i.test(t) && n.set(t, (n.get(t) || 0) + 1);
	}
	return Array.from(n.entries()).sort((e, t) => t[1] - e[1]).map((e) => e[0]).slice(0, 35);
}
r.handle("resume:upload", async () => {
	if (console.log("[resume:upload] handler invoked"), !p) return console.error("[resume:upload] no BrowserWindow available, aborting"), { error: "No application window is available." };
	let e = [];
	try {
		console.log("[resume:upload] opening file picker dialog...");
		let t = await n.showOpenDialog(p, {
			properties: ["openFile"],
			filters: [{
				name: "Resumes",
				extensions: ["pdf", "txt"]
			}]
		});
		if (console.log("[resume:upload] dialog result:", JSON.stringify(t)), t.canceled || t.filePaths.length === 0) return console.log("[resume:upload] user canceled the dialog, no file selected"), null;
		e = t.filePaths;
	} catch (e) {
		return console.error("[resume:upload] showOpenDialog threw an error:", e), { error: `Could not open file picker: ${String(e)}` };
	}
	let t = e[0], r = t.toLowerCase().endsWith(".pdf");
	console.log(`[resume:upload] selected file: ${t} (isPdf=${r})`);
	let i = "";
	try {
		if (r) {
			console.log("[resume:upload] reading PDF bytes from disk...");
			let e = o.readFileSync(t);
			console.log(`[resume:upload] read ${e.length} bytes, handing off to pdf-parse...`);
			let n = new l({ data: e });
			try {
				i = (await n.getText()).text, console.log(`[resume:upload] pdf-parse succeeded, extracted ${i.length} chars`);
			} finally {
				await n.destroy();
			}
		} else console.log("[resume:upload] reading plain text file..."), i = o.readFileSync(t, "utf-8"), console.log(`[resume:upload] read ${i.length} chars from text file`);
	} catch (e) {
		return console.error("[resume:upload] failed to read/parse the resume file:", e), { error: `Failed to read "${t}": ${String(e)}` };
	}
	let a = S(i);
	return console.log("[resume:upload] extracted skills:", a), console.log("[resume:upload] done, returning result to renderer"), {
		filePath: t,
		extractedSkills: a,
		rawText: i
	};
});
function C(e, t) {
	if (t && t.trim() && t !== "auto") return t.toLowerCase().trim();
	let n = (e || "").toLowerCase();
	return n.includes("india") || n.includes("bengaluru") || n.includes("delhi") || n.includes("mumbai") ? "india" : n.includes("usa") || n.includes("america") || n.includes("new york") || n.includes("california") ? "usa" : n.includes("uk") || n.includes("london") || n.includes("manchester") ? "uk" : n.includes("canada") || n.includes("toronto") ? "canada" : n.includes("germany") || n.includes("berlin") ? "germany" : n.includes("australia") || n.includes("sydney") ? "australia" : "usa";
}
async function w(e) {
	if (!e || !e.startsWith("http")) return "";
	try {
		let t = new AbortController(), n = setTimeout(() => t.abort(), 3e3), r = await fetch(e, {
			headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
			signal: t.signal
		});
		if (clearTimeout(n), !r.ok) return "";
		let i = (await r.text()).match(/<p[^>]*>([^<]{50,300})<\/p>/i);
		return i ? i[1].replace(/<[^>]+>/g, "").trim().slice(0, 300) : "";
	} catch {
		return "";
	}
}
async function T(e, t, n, r) {
	let i = "";
	r && r <= 1 ? i = "&age=1h" : r && r <= 2 ? i = "&age=2h" : r && r <= 24 ? i = "&age=1d" : r && r <= 72 ? i = "&age=3d" : r && r <= 168 && (i = "&age=1w");
	let a = `https://search.yahoo.com/search?p=${encodeURIComponent(e)}${i}`, o = [];
	try {
		let e = new AbortController(), r = setTimeout(() => e.abort(), 7e3), i = await fetch(a, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9"
			},
			signal: e.signal
		});
		if (clearTimeout(r), !i.ok) return [];
		let s = (await i.text()).split(/<div[^>]*class="[^"]*algo[^"]*"[^>]*>/i);
		for (let e of s.slice(1)) {
			if (o.length >= 15) break;
			let r = e.match(/RU=([^"'\s]+?)\/(?:RK|RS)=/i);
			if (!r) continue;
			let i = "";
			try {
				i = decodeURIComponent(r[1]);
			} catch {
				continue;
			}
			if (!i.startsWith("http") || i.includes("yahoo.com") || i.includes("yimg.com")) continue;
			let a = e.match(/aria-label="([^"]+)"/i), s = a ? a[1].trim() : "";
			if (!s) {
				let t = e.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
				t && (s = t[1].replace(/<[^>]+>/g, "").trim());
			}
			if (!s || s.length < 3 || /^[0-9a-f\-]+$/i.test(s)) try {
				let e = new URL(i).pathname.split("/").filter(Boolean), t = e[e.length - 1] || "";
				t = t.replace(/^\d+-/, "").replace(/[-_]/g, " "), t && (s = t.split(" ").map((e) => e.charAt(0).toUpperCase() + e.slice(1)).join(" "));
			} catch {
				s = "Job Listing";
			}
			let c = e.match(/<p[^>]*class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || e.match(/<div[^>]*class="[^"]*compText[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || e.match(/<p[^>]*>([\s\S]*?)<\/p>/i), l = c ? c[1].replace(/<[^>]+>/g, "").trim() : "", u = "Company", d = s;
			if (s.includes(" - ")) {
				let e = s.split(" - ");
				u = e[e.length - 1].trim(), d = e.slice(0, e.length - 1).join(" - ").trim();
			} else if (s.includes(" | ")) {
				let e = s.split(" | ");
				u = e[e.length - 1].trim(), d = e.slice(0, e.length - 1).join(" | ").trim();
			} else try {
				let e = new URL(i);
				if (i.includes("lever.co")) {
					let t = e.pathname.split("/")[1];
					t && (u = t.charAt(0).toUpperCase() + t.slice(1));
				} else if (i.includes("greenhouse.io")) {
					let t = e.pathname.split("/")[1];
					t && (u = t.charAt(0).toUpperCase() + t.slice(1));
				} else if (i.includes("ashbyhq.com")) {
					let t = e.pathname.split("/")[1];
					t && (u = t.charAt(0).toUpperCase() + t.slice(1));
				} else {
					let t = e.hostname;
					u = t.split(".")[0].charAt(0).toUpperCase() + t.split(".")[0].slice(1);
				}
			} catch {}
			let f = n;
			i.includes("google.com/about/careers") || i.includes("careers.google.com") ? (f = "Google Careers", u = "Google") : i.includes("wellfound.com") ? f = "Wellfound" : i.includes("greenhouse.io") ? f = "Greenhouse" : i.includes("lever.co") ? f = "Lever" : i.includes("ashbyhq.com") ? f = "Ashby ATS" : i.includes("myworkdayjobs.com") ? f = "Workday" : i.includes("naukri.com") ? f = "Naukri" : i.includes("instahyre.com") ? f = "Instahyre" : i.includes("glassdoor.com") && (f = "Glassdoor"), o.push({
				title: d.replace(/\s*[-|]\s*(Jobs|Careers|Career Page|Hiring|Google Careers).*$/i, "").trim() || "Job Listing",
				company: u || "Company",
				location: t || "Remote / Various",
				description: l || "Direct career listing retrieved via search. Click \"Apply Now\" to view full details.",
				job_url: i,
				site: f,
				jobType: "Full-Time"
			});
		}
		return o;
	} catch (e) {
		return console.warn("[fetchYahooWebSearchJobs] error:", e), [];
	}
}
async function E(e, t, n) {
	if (!e && !t) return [];
	let r = [];
	try {
		let i = await T(`${e || "developer"} ${t || ""} site:careers.google.com OR site:google.com/about/careers`, t, "Google Careers", n);
		r.push(...i);
		let a = await T(`${e || "developer"} ${t || ""} site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:jobs.ashbyhq.com OR site:naukri.com OR site:glassdoor.com`, t, "Google / Career Page", n);
		return r.push(...a), r;
	} catch (e) {
		return console.warn("[fetchGoogleCareerJobs] error:", e), [];
	}
}
async function D(e, t, n) {
	let r = `${e || "developer"} ${t || ""} site:naukri.com/job-listings OR site:naukri.com`, i = [];
	try {
		let e = await T(r, t, "Naukri", n);
		for (let t of e) i.push({
			...t,
			site: "Naukri"
		});
	} catch (e) {
		console.warn("[fetchNaukriJobs] error:", e);
	}
	return i;
}
async function O(e, t, n) {
	let r = `${e || "developer"} ${t || ""} site:instahyre.com/jobs OR site:instahyre.com/job- OR site:instahyre.com`, i = [];
	try {
		let e = await T(r, t, "Instahyre", n);
		for (let t of e) i.push({
			...t,
			site: "Instahyre"
		});
	} catch (e) {
		console.warn("[fetchInstahyreJobs] error:", e);
	}
	return i;
}
async function k(e, t, n) {
	let r = `${e || "developer"} ${t || ""} site:wellfound.com/jobs OR site:wellfound.com/company`, i = [];
	try {
		let a = await T(r, t, "Wellfound", n);
		if (i.push(...a), i.length < 10) {
			let t = (await j(e, "startup")).map((e) => ({
				...e,
				site: "Wellfound / Startup"
			}));
			i.push(...t);
		}
	} catch (e) {
		console.warn("[fetchWellfoundJobs] error:", e);
	}
	return i;
}
async function A(e, t, n = "both") {
	let r = "https://internshala.com", i = (e || "developer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, ""), a = [], o = [];
	(n === "internship" || n === "both") && o.push({
		url: `${r}/internships/${i}-internship`,
		listingType: "Internship"
	}), (n === "job" || n === "both") && o.push({
		url: `${r}/jobs/${i}-jobs`,
		listingType: "Fresher Job"
	});
	for (let e of o) try {
		let n = new AbortController(), i = setTimeout(() => n.abort(), 8e3), o = await fetch(e.url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
			},
			signal: n.signal
		});
		if (clearTimeout(i), !o.ok) continue;
		let s = (await o.text()).split(/class="job-internship-name"/);
		for (let n of s.slice(1)) {
			if (a.length >= 20) break;
			let i = n.match(/href="(\/(?:internship|job)\/detail\/[^"]+)"/);
			if (!i) continue;
			let o = r + i[1], s = n.match(/>[\s]*([\w &().,'\-\/+#]+)[\s]*<\/a>/i), c = s ? s[1].trim() : e.listingType;
			if (!c || c.length < 3) continue;
			let l = n.match(/class="company-name"[^>]*>[\s]*((?:[\s\S](?!class=))+?)[\s]*<\//), u = l ? l[1].replace(/<[^>]+>/g, "").trim() : "Company", d = n.match(/Work from Home/i), f = n.match(/class="location_link[^"]*"[^>]*>([^<]+)<\/a>/i), p = d ? "Remote / Work from Home" : f ? f[1].trim() : t || "India", m = n.match(/class="stipend"[^>]*>([^<]+)</), h = m ? m[1].trim() : "", g = n.match(/class="other-det"[^>]*>[\s\S]*?<span[^>]*>([\d]+ (?:Month|Week|Year)[s]?)<\/span>/i), _ = g ? g[1].trim() : "", v = [
				h ? `Stipend/Salary: ${h}` : "",
				_ ? `Duration: ${_}` : "",
				`Type: ${e.listingType} on Internshala`
			].filter(Boolean).join(" | ");
			a.push({
				title: c,
				company: u,
				location: p,
				description: v || `${e.listingType} opportunity on Internshala`,
				job_url: o,
				site: "Internshala",
				jobType: e.listingType
			});
		}
		console.log(`[fetchInternshalaJobs] ${e.listingType}: found ${s.length - 1} raw blocks`);
	} catch (t) {
		console.warn(`[fetchInternshalaJobs] error for ${e.listingType}:`, t);
	}
	return a;
}
async function j(e, t) {
	let n = (e || t || "developer").toLowerCase().trim(), r = [];
	try {
		let e = new AbortController(), t = setTimeout(() => e.abort(), 5e3), i = await fetch("https://jobicy.com/api/v2/remote-jobs?count=20", { signal: e.signal });
		if (clearTimeout(t), i.ok) {
			let e = await i.json();
			if (e && Array.isArray(e.jobs)) for (let t of e.jobs) {
				let e = t.jobTitle || "", i = t.jobDescription || t.jobExcerpt || "", a = `${e} ${i} ${t.jobGeo || ""}`.toLowerCase();
				(!n || n.split(" ").some((e) => e.length > 2 && a.includes(e))) && r.push({
					title: t.jobTitle,
					company: t.companyName || "Remote Co",
					location: t.jobGeo || "Remote Worldwide",
					description: i.replace(/<[^>]+>/g, "").slice(0, 600),
					job_url: t.url || t.jobSlug,
					site: "Remote Tech",
					jobType: t.jobType || "Remote"
				});
			}
		}
	} catch (e) {
		console.warn("[fetchRemoteTechJobs] error:", e);
	}
	return r;
}
async function M(e, t, n) {
	let r = {
		india: "in",
		usa: "us",
		uk: "gb",
		canada: "ca",
		germany: "de",
		australia: "au"
	}[n.toLowerCase()] || "in", i = encodeURIComponent([e, t].filter(Boolean).join(" "));
	if (!i) return [];
	try {
		let e = `https://api.adzuna.com/v1/api/jobs/${r}/search/1?app_id=53247071&app_key=04495ceef40dbdd3080ff0c2b260655d&results_per_page=15&what=${i}`, n = new AbortController(), a = setTimeout(() => n.abort(), 5e3), o = await fetch(e, { signal: n.signal });
		if (clearTimeout(a), !o.ok) return [];
		let s = await o.json();
		if (s && Array.isArray(s.results)) return s.results.map((e) => ({
			title: e.title ? e.title.replace(/<\/?[^>]+(>|$)/g, "") : "Job Listing",
			company: e.company?.display_name || "Company",
			location: e.location?.display_name || t || "Various",
			description: e.description ? e.description.replace(/<\/?[^>]+(>|$)/g, "") : "",
			job_url: e.redirect_url || e.url || "",
			site: "Adzuna Jobs",
			jobType: e.contract_type || null
		}));
	} catch (e) {
		console.warn("[fetchAdzunaJobs] error:", e);
	}
	return [];
}
r.handle("jobs:search", async (e, t) => {
	console.log("[jobs:search] received params:", t);
	let n = (t.jobRole || "").trim(), r = (t.keyword || "").trim(), i = [n, r].filter(Boolean).join(" ") || "Software Engineer", a = C(t.location, t.country);
	console.log("[jobs:search] primary search term:", JSON.stringify(i), "country:", a);
	let o = t.sites && Array.isArray(t.sites) && t.sites.length > 0 ? t.sites : [
		"linkedin",
		"indeed",
		"naukri",
		"instahyre",
		"google",
		"wellfound",
		"internshala",
		"adzuna",
		"remote"
	];
	console.log("[jobs:search] requested platforms:", o);
	let s = [], c = {}, l = o.filter((e) => e === "linkedin" || e === "indeed");
	if (l.length > 0) {
		let e = l.map(async (e) => {
			try {
				let n = {
					siteName: [e],
					searchTerm: i,
					location: t.location || "",
					resultsWanted: t.resultsWanted || 15,
					countryIndeed: a
				};
				e === "linkedin" && (n.linkedinFetchDescription = !0, n.hoursOld = t.hoursOld || 168), t.isRemote && (n.isRemote = !0);
				let r = await u(n);
				return {
					site: e,
					results: Array.isArray(r) ? r : []
				};
			} catch (t) {
				return console.warn(`[jobs:search] ts-jobspy error for ${e}:`, t), {
					site: e,
					results: []
				};
			}
		}), n = await Promise.allSettled(e);
		for (let e of n) if (e.status === "fulfilled" && e.value) {
			let { site: t, results: n } = e.value;
			c[t] = n.length, s.push(...n);
		}
	}
	if (o.includes("naukri")) try {
		let e = await D(i, t.location || "", t.hoursOld);
		c.naukri = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] naukri scraper error:", e);
	}
	if (o.includes("instahyre")) try {
		let e = await O(i, t.location || "", t.hoursOld);
		c.instahyre = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] instahyre scraper error:", e);
	}
	if (o.includes("google") || o.includes("glassdoor")) try {
		let e = await E(i, t.location || "", t.hoursOld);
		c.google = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] google career scraper error:", e);
	}
	if (o.includes("wellfound")) try {
		let e = await k(i, t.location || "", t.hoursOld);
		c.wellfound = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] wellfound scraper error:", e);
	}
	if (o.includes("internshala")) try {
		let e = (t.experienceLevel || "").toLowerCase(), n = e === "internship" ? "internship" : e === "" || e === "0" || e === "0-1" ? "both" : "job", r = await A(i, t.location || "", n);
		c.internshala = r.length, s.push(...r);
	} catch (e) {
		console.warn("[jobs:search] internshala error:", e);
	}
	if (o.includes("remote") || t.isRemote) try {
		let e = await j(i, r);
		c.remote = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] remote tech API error:", e);
	}
	if (o.includes("adzuna") || o.includes("zip_recruiter")) try {
		let e = await M(i, t.location || "", a);
		c.adzuna = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] adzuna API error:", e);
	}
	console.log(`[jobs:search] total raw jobs gathered: ${s.length}`, c);
	let d = await Promise.all(s.map(async (e) => {
		let n = (e.description || "").trim(), r = e.jobUrl || e.jobUrlDirect || e.job_url || "";
		if (n.length < 50 && r) {
			let e = await w(r);
			e && (n = e);
		}
		return {
			title: e.title || "Job Listing",
			company: e.company || "Company",
			location: e.location || t.location || "Remote / Various",
			description: n || "No detailed description available. Click Apply Now to view full job posting.",
			job_url: r,
			site: e.site && typeof e.site == "string" ? e.site.charAt(0).toUpperCase() + e.site.slice(1) : "Web",
			jobLevel: e.jobLevel || null,
			jobType: e.jobType || null
		};
	})), f = /* @__PURE__ */ new Set(), p = d.filter((e) => {
		let t = (e.job_url || `${e.title}-${e.company}`).toLowerCase();
		return f.has(t) ? !1 : (f.add(t), !0);
	}), m = t.strictMode !== !1, h = p;
	if (m) {
		let e = (t.jobRole || "").toLowerCase().split(/\s+/).filter((e) => e.length > 2), n = (t.location || "").toLowerCase().split(/\s+/).filter((e) => e.length > 2), r = (t.keyword || "").toLowerCase().split(/\s+/).filter((e) => e.length > 2);
		h = p.filter((i) => {
			let a = `${i.title} ${i.company} ${i.location} ${i.description}`.toLowerCase();
			return !(e.length > 0 && !e.some((e) => a.includes(e)) || n.length > 0 && !t.isRemote && !n.includes("remote") && !n.some((e) => a.includes(e)) || r.length > 0 && !r.some((e) => a.includes(e)));
		}), console.log(`[jobs:search] strict input enforcement: ${p.length} raw -> ${h.length} strictly matched`);
	}
	return {
		success: !0,
		jobs: h,
		stats: c
	};
}), r.handle("browser:open", (e, t) => {
	i.openExternal(t);
});
//#endregion
export {};
