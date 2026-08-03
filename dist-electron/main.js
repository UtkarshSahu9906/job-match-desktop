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
var g = /* @__PURE__ */ new Set(/* @__PURE__ */ "a.an.the.and.or.but.of.to.in.on.at.for.with.by.from.is.are.was.were.be.been.being.i.my.me.we.our.you.your.as.it.this.that.these.those.have.has.had.will.would.can.not.no.if.so.also.than.then.into.about.over.under.more.years.year.experience.experienced.worked.working.work.responsible.responsibilities.project.projects.developed.development.using.used.team.role.company.various.strong.good.skills.skill.including.etc.across.within.new.all.one.two.key.able".split(".")), _ = [
	"spring boot",
	"spring mvc",
	"rest api",
	"restful api",
	"machine learning",
	"android development",
	"android studio",
	"java streams",
	"multi threading",
	"multithreading",
	"data structures",
	"unit testing",
	"ci cd",
	"node js",
	"react native",
	"material design",
	"google play",
	"play store",
	"firebase firestore",
	"sql server",
	"object oriented"
], v = /[\w.+-]+@[\w-]+\.[a-z]{2,}|https?:\/\/\S+|www\.\S+|\b(?:github|linkedin|gitlab|bitbucket|twitter|medium|stackoverflow|behance|dribbble)\.com\/\S+/gi, y = /[^a-z0-9 ]/gi, b = /[^a-z0-9+#\- ]/gi, x = /^-+|-+$/g;
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
r.handle("jobs:search", async (e, t) => {
	console.log("[jobs:search] received params:", t);
	let n = [
		t.jobRole,
		t.keyword,
		t.experienceLevel
	].map((e) => (e || "").trim()).filter(Boolean).join(" "), r = C(t.location, t.country);
	console.log("[jobs:search] built search term:", JSON.stringify(n), "country:", r);
	let i = t.sites && Array.isArray(t.sites) && t.sites.length > 0 ? t.sites : [
		"google",
		"linkedin",
		"indeed",
		"naukri",
		"zip_recruiter"
	];
	console.log("[jobs:search] scraping platforms:", i);
	let a = i.map(async (e) => {
		try {
			return await u({
				siteName: [e],
				searchTerm: n,
				location: t.location || "",
				resultsWanted: 10,
				hoursOld: t.hoursOld || 168,
				countryIndeed: r,
				linkedinFetchDescription: !0
			});
		} catch (t) {
			return console.warn(`[jobs:search] scraper failed for platform "${e}":`, t), [];
		}
	}), o = await Promise.allSettled(a), s = [];
	for (let e of o) e.status === "fulfilled" && Array.isArray(e.value) && s.push(...e.value);
	console.log(`[jobs:search] total scraped raw jobs across platforms: ${s.length}`);
	let c = await Promise.all(s.map(async (e) => {
		let n = (e.description || "").trim(), r = e.jobUrl || e.jobUrlDirect || "";
		if (n.length < 50 && r) {
			let e = await w(r);
			e && (n = e);
		}
		return {
			title: e.title || "Job Listing",
			company: e.company || "Company",
			location: e.location || t.location || "Remote",
			description: n || "No description provided by platform. Click Apply Now to view details.",
			job_url: r,
			site: e.site ? e.site.charAt(0).toUpperCase() + e.site.slice(1) : "Web",
			jobLevel: e.jobLevel || null,
			jobType: e.jobType || null
		};
	})), l = /* @__PURE__ */ new Set();
	return {
		success: !0,
		jobs: c.filter((e) => {
			let t = (e.job_url || `${e.title}-${e.company}`).toLowerCase();
			return l.has(t) ? !1 : (l.add(t), !0);
		})
	};
}), r.handle("browser:open", (e, t) => {
	i.openExternal(t);
});
//#endregion
export {};
