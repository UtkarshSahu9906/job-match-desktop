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
	return n.includes("india") || n.includes("delhi") || n.includes("bangalore") || n.includes("mumbai") || n.includes("pune") || n.includes("hyderabad") || n.includes("chennai") || n.includes("noida") || n.includes("gurgaon") || n.includes("ind") ? "india" : n.includes("uk") || n.includes("london") || n.includes("united kingdom") || n.includes("england") ? "uk" : n.includes("canada") || n.includes("toronto") || n.includes("vancouver") ? "canada" : n.includes("germany") || n.includes("berlin") || n.includes("munich") ? "germany" : n.includes("australia") || n.includes("sydney") || n.includes("melbourne") ? "australia" : n.includes("usa") || n.includes("united states") || n.includes("ny") || n.includes("california") || n.includes("sf") ? "usa" : "india";
}
async function w(e) {
	if (!e || !e.startsWith("http")) return "";
	try {
		let t = new AbortController(), n = setTimeout(() => t.abort(), 4e3), r = await fetch(e, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9"
			},
			signal: t.signal
		});
		if (clearTimeout(n), !r.ok) return "";
		let i = await r.text(), a = i.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i) || i.match(/<meta\s+property=["']og:description["']\s+content=["'](.*?)["']/i);
		return a && a[1] && a[1].trim().length > 30 ? a[1].trim() : "";
	} catch {
		return "";
	}
}
async function T(e, t) {
	if (!e && !t) return [];
	let n = `"${e || "developer"}" ${t || ""} site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:jobs.ashbyhq.com OR site:naukri.com OR site:glassdoor.com`;
	try {
		let e = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(n)}`, r = new AbortController(), i = setTimeout(() => r.abort(), 6e3), a = await fetch(e, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
				"Accept-Language": "en-US,en;q=0.9"
			},
			signal: r.signal
		});
		if (clearTimeout(i), !a.ok) return [];
		let o = await a.text(), s = [], c = o.split("<div class=\"result results_links");
		for (let e of c.slice(1)) {
			let n = e.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i), r = e.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
			if (n) {
				let e = n[1];
				if (e.includes("uddg=")) try {
					let t = new URL("https://duckduckgo.com" + e).searchParams.get("uddg");
					t && (e = t);
				} catch {}
				let i = n[2].replace(/<[^>]+>/g, "").trim(), a = r ? r[1].replace(/<[^>]+>/g, "").trim() : "", o = "Company Career Page";
				if (i.includes(" - ")) {
					let e = i.split(" - ");
					o = e[e.length - 1].trim();
				} else if (i.includes(" | ")) {
					let e = i.split(" | ");
					o = e[e.length - 1].trim();
				} else if (e.includes("greenhouse.io") || e.includes("lever.co") || e.includes("ashbyhq.com")) try {
					o = new URL(e).hostname.split(".")[0].toUpperCase();
				} catch {}
				let c = "Google / Career Page";
				e.includes("naukri.com") ? c = "Naukri" : e.includes("glassdoor.com") ? c = "Glassdoor" : (e.includes("greenhouse.io") || e.includes("lever.co") || e.includes("ashbyhq.com") || e.includes("workday")) && (c = "Direct Career Page"), e.startsWith("http") && s.push({
					title: i.replace(/^(hiring|job|career|apply for)\s+/i, ""),
					company: o,
					location: t || "Remote / Various",
					description: a || "Direct career posting retrieved via Google Web Search.",
					job_url: e,
					site: c,
					jobType: "Full-Time"
				});
			}
		}
		return s.slice(0, 15);
	} catch (e) {
		return console.warn("[fetchGoogleCareerJobs] error:", e), [];
	}
}
async function E(e, t) {
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
async function D(e, t, n) {
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
	let n = (t.jobRole || "").trim(), r = (t.keyword || "").trim(), i = n || r || "Software Engineer", a = C(t.location, t.country);
	console.log("[jobs:search] primary search term:", JSON.stringify(i), "country:", a);
	let o = t.sites && Array.isArray(t.sites) && t.sites.length > 0 ? t.sites : [
		"linkedin",
		"indeed",
		"google",
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
	if (o.includes("google") || o.includes("naukri") || o.includes("glassdoor")) try {
		let e = await T(i, t.location || "");
		c.google = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] google career scraper error:", e);
	}
	if (o.includes("remote") || t.isRemote) try {
		let e = await E(i, r);
		c.remote = e.length, s.push(...e);
	} catch (e) {
		console.warn("[jobs:search] remote tech API error:", e);
	}
	if (o.includes("adzuna") || o.includes("zip_recruiter")) try {
		let e = await D(i, t.location || "", a);
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
	})), f = /* @__PURE__ */ new Set();
	return {
		success: !0,
		jobs: d.filter((e) => {
			let t = (e.job_url || `${e.title}-${e.company}`).toLowerCase();
			return f.has(t) ? !1 : (f.add(t), !0);
		}),
		stats: c
	};
}), r.handle("browser:open", (e, t) => {
	i.openExternal(t);
});
//#endregion
export {};
