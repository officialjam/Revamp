"use client";
/**
 * Career Copilot — full build (standalone Next.js version)
 * -------------------------------------------------------------
 * Career Profile (14 sections) + Preferences (AI memory of style/
 * tone) + Generate (resume/cover letter, with editable output that
 * feeds a lightweight continuous-learning loop) + Applications
 * (history/status tracking) + Ask Copilot (interview prep, LinkedIn
 * posts, career advice — grounded in the profile).
 *
 * Persistence: browser localStorage, three keys — career-profile,
 * career-applications, career-edit-signals. (The Claude.ai artifact
 * version used window.storage; this version runs in a normal
 * browser, so localStorage is the direct swap-in.)
 *
 * Model calls go through this app's own /api/anthropic route, which
 * holds the real ANTHROPIC_API_KEY server-side — never call
 * api.anthropic.com with a key from the browser.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  User, Target, Cpu, Briefcase, FolderGit2, GraduationCap, Award,
  Sparkles, Plus, Trash2, Copy, Check, Loader2, AlertCircle, RotateCcw,
  BookOpen, Trophy, HeartHandshake, FileText, Mic, Languages, Heart,
  ChevronDown, Sliders, Inbox, Bot, Send, Download,
} from "lucide-react";

/* ------------------------------------------------------------------
   localStorage shim — same {key, value} shape the app expects
   ------------------------------------------------------------------ */
const storage = {
  async get(key) {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(key);
      return value === null ? null : { key, value };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    if (typeof window === "undefined") return null;
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
  async delete(key) {
    if (typeof window === "undefined") return null;
    try {
      window.localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },
};

/* ------------------------------------------------------------------
   Style tokens — dark instrument-panel palette, IBM Plex family
   ------------------------------------------------------------------ */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.cc-root {
  --bg: #10161D;
  --panel: #1A222C;
  --panel-raised: #212B37;
  --border: #2A3542;
  --text: #E7EDF3;
  --text-muted: #8A96A3;
  --amber: #F2A93B;
  --amber-dim: #B8802A;
  --cyan: #56D9C6;
  --danger: #E37070;
  --font-display: 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Consolas, monospace;

  background: var(--bg);
  color: var(--text);
  font-family: var(--font-display);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.cc-root * { box-sizing: border-box; }
.cc-root button, .cc-root input, .cc-root select, .cc-root textarea {
  font-family: inherit;
  color: inherit;
}
.cc-root :focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.cc-brand { display: flex; align-items: baseline; gap: 10px; }
.cc-brand-mark {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--amber);
  border: 1px solid var(--amber-dim);
  padding: 2px 6px;
  border-radius: 3px;
}
.cc-brand-name { font-weight: 600; font-size: 16px; letter-spacing: -0.01em; }
.cc-readiness { display: flex; align-items: center; gap: 10px; }
.cc-readiness-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
  white-space: nowrap;
}
.cc-readiness-track { width: 120px; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
.cc-readiness-fill { height: 100%; background: var(--amber); transition: width 200ms ease; }

.cc-shell { display: flex; flex: 1; min-height: 0; }
.cc-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 6px;
  border-left: 2px solid transparent;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 13.5px;
  color: var(--text-muted);
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.cc-nav-item:hover { background: var(--panel); color: var(--text); }
.cc-nav-item.active { background: var(--panel); color: var(--text); border-left-color: var(--amber); }

.cc-main { flex: 1; min-width: 0; overflow-y: auto; padding: 28px 32px 60px; }
.cc-page-title { font-size: 22px; font-weight: 600; margin-bottom: 4px; letter-spacing: -0.01em; }
.cc-page-desc { color: var(--text-muted); font-size: 13.5px; margin-bottom: 22px; max-width: 62ch; }

.cc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cc-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.cc-field-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.cc-input, .cc-textarea, select.cc-input {
  background: var(--panel-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 9px 11px;
  font-size: 13.5px;
  color: var(--text);
  width: 100%;
  transition: border-color 150ms ease;
}
.cc-input:focus, .cc-textarea:focus { border-color: var(--cyan); }
.cc-textarea { resize: vertical; min-height: 70px; line-height: 1.5; font-family: var(--font-mono); font-size: 12.5px; }
.cc-cover-letter-edit { min-height: 220px; font-family: var(--font-display); font-size: 13.5px; line-height: 1.7; }
.cc-field-hint { font-size: 11px; color: var(--text-muted); opacity: 0.85; }

.cc-card { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
.cc-card-index { font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted); margin-bottom: 10px; }

.cc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 9px 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 150ms ease, border-color 150ms ease, opacity 150ms ease, color 150ms ease;
}
.cc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cc-btn-primary { background: var(--amber); color: #1A1206; font-weight: 600; }
.cc-btn-primary:hover:not(:disabled) { background: #f5ba5c; }
.cc-btn-ghost { background: transparent; border-color: var(--border); color: var(--text-muted); }
.cc-btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
.cc-btn-dashed { background: transparent; border: 1px dashed var(--border); color: var(--text-muted); width: 100%; justify-content: center; }
.cc-btn-dashed:hover { color: var(--cyan); border-color: var(--cyan); }
.cc-btn-remove { margin-top: 10px; font-size: 12px; padding: 5px 10px; color: var(--danger); }
.cc-btn-remove:hover { color: #ff8f8f; border-color: var(--danger); }
.cc-btn-sm { padding: 6px 10px; font-size: 12px; }

.cc-savebar { display: flex; align-items: center; gap: 10px; margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.cc-save-status { font-size: 12px; color: var(--text-muted); font-family: var(--font-mono); }
.cc-save-status.dirty { color: var(--amber); }
.cc-save-status.saved { color: var(--cyan); }

.cc-accordion { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; background: var(--panel); overflow: hidden; }
.cc-accordion-summary { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; cursor: pointer; list-style: none; font-size: 13.5px; font-weight: 500; }
.cc-accordion-summary::-webkit-details-marker { display: none; }
.cc-accordion-summary-left { display: flex; align-items: center; gap: 10px; color: var(--text); }
.cc-accordion-summary-right { display: flex; align-items: center; gap: 10px; }
.cc-accordion-chevron { transition: transform 150ms ease; color: var(--text-muted); flex-shrink: 0; }
.cc-accordion[open] .cc-accordion-chevron { transform: rotate(180deg); }
.cc-accordion-body { padding: 6px 16px 18px; border-top: 1px solid var(--border); }
.cc-accordion-desc { font-size: 12.5px; color: var(--text-muted); margin: 12px 0 14px; }

.cc-generate-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
.cc-result { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
.cc-result-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.cc-result-title { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
.cc-resume-summary { font-size: 13.5px; line-height: 1.6; margin-bottom: 16px; }
.cc-tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.cc-tag { font-family: var(--font-mono); font-size: 11px; background: var(--panel-raised); border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; color: var(--text); }
.cc-exp-block { margin-bottom: 14px; }
.cc-exp-title { font-weight: 600; font-size: 13.5px; }
.cc-exp-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 6px; }
.cc-bullets { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
.cc-error { display: flex; gap: 8px; align-items: flex-start; background: rgba(227, 112, 112, 0.1); border: 1px solid var(--danger); color: #ffb3b3; padding: 12px 14px; border-radius: 6px; font-size: 13px; margin-top: 14px; }
.cc-spin { animation: cc-spin 0.8s linear infinite; }
@keyframes cc-spin { to { transform: rotate(360deg); } }

.cc-chat-log { display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px; }
.cc-chat-msg { padding: 12px 14px; border-radius: 8px; font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; max-width: 85%; }
.cc-chat-user { background: var(--panel); border: 1px solid var(--border); align-self: flex-end; }
.cc-chat-assistant { background: var(--panel-raised); border: 1px solid var(--border); align-self: flex-start; }
.cc-chat-role { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--cyan); margin-bottom: 4px; }
.cc-chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
.cc-chat-input-row .cc-textarea { flex: 1; min-height: 50px; }

@media (prefers-reduced-motion: reduce) {
  .cc-root * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
  .cc-spin { animation-duration: 0.8s !important; }
}

@media (max-width: 760px) {
  .cc-shell { flex-direction: column; }
  .cc-sidebar { width: 100%; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--border); }
  .cc-nav-item { flex-shrink: 0; }
  .cc-grid-2 { grid-template-columns: 1fr; }
  .cc-main { padding: 20px 16px 48px; }
  .cc-chat-msg { max-width: 100%; }
}
`;

/* ------------------------------------------------------------------
   Constants
   ------------------------------------------------------------------ */
const EMPTY_PROFILE = {
  personalInfo: { name: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", personalWebsite: "" },
  careerGoals: [],
  skills: [],
  workExperience: [],
  projects: [],
  education: [],
  certifications: [],
  courses: [],
  awards: [],
  volunteerExperience: [],
  publications: [],
  speakingEngagements: [],
  languages: [],
  interestsText: "",
  preferences: {
    preferredResumeStyle: "",
    preferredWritingTone: "",
    preferredCoverLetterTone: "",
    favoriteTechnologiesText: "",
    industriesOfInterestText: "",
  },
};

const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"];
const LANGUAGE_PROFICIENCIES = ["basic", "conversational", "fluent", "native"];
const STYLE_OPTIONS = ["concise", "detailed", "achievement-focused", "narrative"];
const TONE_OPTIONS = ["confident", "formal", "direct", "warm", "concise"];
const INTERVIEW_STATUSES = ["not started", "phone screen", "technical interview", "onsite / final round", "rejected", "withdrawn"];
const OFFER_STATUSES = ["n/a", "pending", "offer received", "accepted", "declined", "rejected"];

const PROFILE_SECTIONS = [
  { key: "personalInfo", label: "Personal Info", icon: User },
  { key: "careerGoals", label: "Career Goals", icon: Target },
  { key: "skills", label: "Skills", icon: Cpu },
  { key: "workExperience", label: "Work Experience", icon: Briefcase },
  { key: "projects", label: "Projects", icon: FolderGit2 },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "certifications", label: "Certifications", icon: Award },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "awards", label: "Awards", icon: Trophy },
  { key: "volunteerExperience", label: "Volunteer Experience", icon: HeartHandshake },
  { key: "publications", label: "Publications", icon: FileText },
  { key: "speakingEngagements", label: "Speaking Engagements", icon: Mic },
  { key: "languages", label: "Languages", icon: Languages },
  { key: "interests", label: "Interests", icon: Heart },
];
function sectionMeta(key) { return PROFILE_SECTIONS.find((s) => s.key === key); }

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "preferences", label: "Preferences", icon: Sliders },
  { key: "generate", label: "Generate", icon: Sparkles },
  { key: "applications", label: "Applications", icon: Inbox },
  { key: "askCopilot", label: "Ask Copilot", icon: Bot },
];

const EMPTY_GOAL = { targetRole: "", priority: 1 };
const EMPTY_SKILL = { name: "", category: "", level: "intermediate", yearsExperience: 0, lastUsed: "", confidenceScore: 70 };
const EMPTY_WORK = { company: "", position: "", location: "", startDate: "", endDate: "", current: false, responsibilitiesText: "", technologiesText: "", achievementsText: "" };
const EMPTY_PROJECT = { title: "", description: "", technologiesText: "", githubLink: "", demoLink: "", problemsSolved: "", tagsText: "" };
const EMPTY_EDU = { school: "", degree: "", gpa: "", graduationYear: "" };
const EMPTY_CERT = { name: "", provider: "", dateEarned: "", expiryDate: "", credentialId: "", verificationUrl: "" };
const EMPTY_COURSE = { name: "", provider: "", dateCompleted: "", certificateUrl: "" };
const EMPTY_AWARD = { title: "", issuer: "", date: "", description: "" };
const EMPTY_VOLUNTEER = { organization: "", role: "", startDate: "", endDate: "", current: false, description: "" };
const EMPTY_PUBLICATION = { title: "", venue: "", date: "", url: "", coAuthorsText: "" };
const EMPTY_SPEAKING = { title: "", event: "", date: "", url: "" };
const EMPTY_LANGUAGE = { name: "", proficiency: "conversational" };

/* ------------------------------------------------------------------
   Utilities
   ------------------------------------------------------------------ */
let idSeq = 0;
function makeId() {
  idSeq += 1;
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try { return crypto.randomUUID(); } catch (e) { /* fall through */ }
  }
  return "id-" + Date.now() + "-" + idSeq;
}

function linesToArray(text) { return (text || "").split("\n").map((s) => s.trim()).filter(Boolean); }
function csvToArray(text) { return (text || "").split(",").map((s) => s.trim()).filter(Boolean); }
function truncate(s, n) { if (!s) return ""; return s.length > n ? s.slice(0, n) + "…" : s; }

function isSectionFilled(profile, key) {
  if (key === "personalInfo") {
    const p = profile.personalInfo;
    return Boolean(p.name && p.email);
  }
  if (key === "interests") {
    return Boolean(profile.interestsText && profile.interestsText.trim().length > 0);
  }
  const list = profile[key];
  return Array.isArray(list) && list.length > 0;
}

function computeReadiness(profile) {
  const filled = PROFILE_SECTIONS.filter((s) => isSectionFilled(profile, s.key)).length;
  return { filled, total: PROFILE_SECTIONS.length };
}

function stripEmptyItems(profile) {
  const notBlank = (obj) =>
    Object.entries(obj).some(([k, v]) => {
      if (k === "id") return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return false;
    });
  return {
    personalInfo: profile.personalInfo,
    careerGoals: profile.careerGoals.filter(notBlank),
    skills: profile.skills.filter(notBlank),
    workExperience: profile.workExperience.filter(notBlank),
    projects: profile.projects.filter(notBlank),
    education: profile.education.filter(notBlank),
    certifications: profile.certifications.filter(notBlank),
    courses: profile.courses.filter(notBlank),
    awards: profile.awards.filter(notBlank),
    volunteerExperience: profile.volunteerExperience.filter(notBlank),
    publications: profile.publications.filter(notBlank),
    speakingEngagements: profile.speakingEngagements.filter(notBlank),
    languages: profile.languages.filter(notBlank),
    interests: csvToArray(profile.interestsText),
  };
}

function buildGenerationProfile(profile) {
  const clean = stripEmptyItems(profile);
  return {
    personalInfo: clean.personalInfo,
    careerGoals: clean.careerGoals.map((g) => ({ targetRole: g.targetRole, priority: g.priority })),
    skills: clean.skills.map((s) => ({ name: s.name, category: s.category, level: s.level, yearsExperience: s.yearsExperience, lastUsed: s.lastUsed, confidenceScore: s.confidenceScore })),
    workExperience: clean.workExperience.map((w) => ({
      company: w.company, position: w.position, location: w.location,
      startDate: w.startDate, endDate: w.current ? "Present" : w.endDate,
      responsibilities: linesToArray(w.responsibilitiesText),
      technologies: csvToArray(w.technologiesText),
      achievements: linesToArray(w.achievementsText),
    })),
    projects: clean.projects.map((p) => ({
      title: p.title, description: p.description, technologies: csvToArray(p.technologiesText),
      githubLink: p.githubLink, demoLink: p.demoLink, problemsSolved: p.problemsSolved, tags: csvToArray(p.tagsText),
    })),
    education: clean.education,
    certifications: clean.certifications,
    courses: clean.courses,
    awards: clean.awards,
    volunteerExperience: clean.volunteerExperience.map((v) => ({ ...v, endDate: v.current ? "Present" : v.endDate })),
    publications: clean.publications.map((p) => ({ ...p, coAuthors: csvToArray(p.coAuthorsText) })),
    speakingEngagements: clean.speakingEngagements,
    languages: clean.languages,
    interests: clean.interests,
  };
}

function buildStyleContext(preferences, editSignals) {
  const parts = [];
  if (preferences.preferredResumeStyle) parts.push(`Preferred resume style: ${preferences.preferredResumeStyle}.`);
  if (preferences.preferredWritingTone) parts.push(`Preferred resume tone: ${preferences.preferredWritingTone}.`);
  if (preferences.preferredCoverLetterTone) parts.push(`Preferred cover letter tone: ${preferences.preferredCoverLetterTone}.`);
  if (preferences.favoriteTechnologiesText) parts.push(`Favorite technologies to highlight when genuinely relevant: ${preferences.favoriteTechnologiesText}.`);
  if (preferences.industriesOfInterestText) parts.push(`Industries of interest: ${preferences.industriesOfInterestText}.`);
  if (editSignals && editSignals.length > 0) {
    const recent = editSignals.slice(-3);
    parts.push("Style feedback from past edits (match this direction where it applies):");
    recent.forEach((sig, i) => parts.push(`${i + 1}. Changed "${truncate(sig.original, 140)}" to "${truncate(sig.edited, 140)}".`));
  }
  return parts.join("\n");
}

function exportProfile(profile, applications, editSignals) {
  const data = { profile, applications, editSignals, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "career-profile-export.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------
   Reusable field / list / accordion components
   ------------------------------------------------------------------ */
function Field({ label, hint, children }) {
  return (
    <label className="cc-field">
      <span className="cc-field-label">{label}</span>
      {children}
      {hint ? <span className="cc-field-hint">{hint}</span> : null}
    </label>
  );
}

function RepeatingList({ items, onChange, renderItem, emptyItem, addLabel }) {
  const updateItem = (idx, patch) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const addItem = () => onChange([...items, { ...emptyItem, id: makeId() }]);
  return (
    <div>
      {items.map((item, idx) => (
        <div className="cc-card" key={item.id}>
          <div className="cc-card-index">#{idx + 1}</div>
          {renderItem(item, (patch) => updateItem(idx, patch))}
          <button type="button" className="cc-btn cc-btn-ghost cc-btn-remove" onClick={() => removeItem(idx)}>
            <Trash2 size={13} /> Remove
          </button>
        </div>
      ))}
      <button type="button" className="cc-btn cc-btn-dashed" onClick={addItem}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function AccordionSection({ meta, count, defaultOpen, desc, children }) {
  const Icon = meta.icon;
  return (
    <details className="cc-accordion" open={defaultOpen || undefined}>
      <summary className="cc-accordion-summary">
        <span className="cc-accordion-summary-left">
          <Icon size={16} />
          <span>{meta.label}</span>
        </span>
        <span className="cc-accordion-summary-right">
          {count > 0 && <span className="cc-field-hint" style={{ fontFamily: "var(--font-mono)" }}>{count}</span>}
          <ChevronDown size={16} className="cc-accordion-chevron" />
        </span>
      </summary>
      <div className="cc-accordion-body">
        {desc && <div className="cc-accordion-desc">{desc}</div>}
        {children}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------
   Profile section bodies
   ------------------------------------------------------------------ */
function PersonalInfoSection({ value, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <div className="cc-grid-2">
      <Field label="Full name"><input className="cc-input" value={value.name} onChange={set("name")} /></Field>
      <Field label="Email"><input className="cc-input" type="email" value={value.email} onChange={set("email")} /></Field>
      <Field label="Phone"><input className="cc-input" value={value.phone} onChange={set("phone")} /></Field>
      <Field label="Location"><input className="cc-input" value={value.location} onChange={set("location")} placeholder="City, Country" /></Field>
      <Field label="LinkedIn"><input className="cc-input" value={value.linkedin} onChange={set("linkedin")} /></Field>
      <Field label="GitHub"><input className="cc-input" value={value.github} onChange={set("github")} /></Field>
      <Field label="Portfolio"><input className="cc-input" value={value.portfolio} onChange={set("portfolio")} /></Field>
      <Field label="Personal website"><input className="cc-input" value={value.personalWebsite} onChange={set("personalWebsite")} /></Field>
    </div>
  );
}

function CareerGoalsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a target role" emptyItem={EMPTY_GOAL}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Target role"><input className="cc-input" value={item.targetRole} onChange={(e) => patch({ targetRole: e.target.value })} placeholder="Platform Engineer" /></Field>
          <Field label="Priority" hint="1 = primary"><input className="cc-input" type="number" min="1" value={item.priority} onChange={(e) => patch({ priority: Number(e.target.value) })} /></Field>
        </div>
      )} />
  );
}

function SkillsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a skill" emptyItem={EMPTY_SKILL}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Skill"><input className="cc-input" value={item.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Terraform" /></Field>
          <Field label="Category" hint="optional, for grouping"><input className="cc-input" value={item.category} onChange={(e) => patch({ category: e.target.value })} placeholder="IaC" /></Field>
          <Field label="Level">
            <select className="cc-input" value={item.level} onChange={(e) => patch({ level: e.target.value })}>
              {SKILL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Years of experience"><input className="cc-input" type="number" min="0" step="0.5" value={item.yearsExperience} onChange={(e) => patch({ yearsExperience: Number(e.target.value) })} /></Field>
          <Field label="Last used"><input className="cc-input" value={item.lastUsed} onChange={(e) => patch({ lastUsed: e.target.value })} placeholder="2026 or Present" /></Field>
          <Field label="Confidence" hint={`${item.confidenceScore}/100`}>
            <input type="range" min="0" max="100" value={item.confidenceScore} onChange={(e) => patch({ confidenceScore: Number(e.target.value) })} />
          </Field>
        </div>
      )} />
  );
}

function WorkExperienceSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a role" emptyItem={EMPTY_WORK}
      renderItem={(item, patch) => (
        <div>
          <div className="cc-grid-2">
            <Field label="Company"><input className="cc-input" value={item.company} onChange={(e) => patch({ company: e.target.value })} /></Field>
            <Field label="Position"><input className="cc-input" value={item.position} onChange={(e) => patch({ position: e.target.value })} /></Field>
            <Field label="Location"><input className="cc-input" value={item.location} onChange={(e) => patch({ location: e.target.value })} /></Field>
            <Field label="Technologies" hint="comma-separated"><input className="cc-input" value={item.technologiesText} onChange={(e) => patch({ technologiesText: e.target.value })} placeholder="AWS, Terraform, Kubernetes" /></Field>
            <Field label="Start date"><input className="cc-input" value={item.startDate} onChange={(e) => patch({ startDate: e.target.value })} placeholder="2023-06" /></Field>
            <Field label="End date">
              <input className="cc-input" value={item.current ? "Present" : item.endDate} disabled={item.current} onChange={(e) => patch({ endDate: e.target.value })} placeholder="2025-01" />
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "14px" }}>
            <input type="checkbox" checked={item.current} onChange={(e) => patch({ current: e.target.checked, endDate: e.target.checked ? "" : item.endDate })} />
            I currently work here
          </label>
          <Field label="Responsibilities" hint="one per line"><textarea className="cc-textarea" value={item.responsibilitiesText} onChange={(e) => patch({ responsibilitiesText: e.target.value })} /></Field>
          <Field label="Achievements" hint="one per line, quantify where you can"><textarea className="cc-textarea" value={item.achievementsText} onChange={(e) => patch({ achievementsText: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function ProjectsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a project" emptyItem={EMPTY_PROJECT}
      renderItem={(item, patch) => (
        <div>
          <div className="cc-grid-2">
            <Field label="Title"><input className="cc-input" value={item.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
            <Field label="Technologies" hint="comma-separated"><input className="cc-input" value={item.technologiesText} onChange={(e) => patch({ technologiesText: e.target.value })} /></Field>
            <Field label="GitHub link"><input className="cc-input" value={item.githubLink} onChange={(e) => patch({ githubLink: e.target.value })} /></Field>
            <Field label="Demo link"><input className="cc-input" value={item.demoLink} onChange={(e) => patch({ demoLink: e.target.value })} /></Field>
          </div>
          <Field label="Description"><textarea className="cc-textarea" value={item.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
          <Field label="Problem(s) solved"><textarea className="cc-textarea" value={item.problemsSolved} onChange={(e) => patch({ problemsSolved: e.target.value })} /></Field>
          <Field label="Tags" hint="comma-separated"><input className="cc-input" value={item.tagsText} onChange={(e) => patch({ tagsText: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function EducationSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add education" emptyItem={EMPTY_EDU}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="School"><input className="cc-input" value={item.school} onChange={(e) => patch({ school: e.target.value })} /></Field>
          <Field label="Degree"><input className="cc-input" value={item.degree} onChange={(e) => patch({ degree: e.target.value })} /></Field>
          <Field label="GPA" hint="optional"><input className="cc-input" value={item.gpa} onChange={(e) => patch({ gpa: e.target.value })} /></Field>
          <Field label="Graduation year"><input className="cc-input" value={item.graduationYear} onChange={(e) => patch({ graduationYear: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function CertificationsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a certification" emptyItem={EMPTY_CERT}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Certificate"><input className="cc-input" value={item.name} onChange={(e) => patch({ name: e.target.value })} placeholder="AWS Solutions Architect" /></Field>
          <Field label="Provider"><input className="cc-input" value={item.provider} onChange={(e) => patch({ provider: e.target.value })} /></Field>
          <Field label="Date earned"><input className="cc-input" value={item.dateEarned} onChange={(e) => patch({ dateEarned: e.target.value })} /></Field>
          <Field label="Expiry" hint="optional"><input className="cc-input" value={item.expiryDate} onChange={(e) => patch({ expiryDate: e.target.value })} /></Field>
          <Field label="Credential ID" hint="optional"><input className="cc-input" value={item.credentialId} onChange={(e) => patch({ credentialId: e.target.value })} /></Field>
          <Field label="Verification URL" hint="optional"><input className="cc-input" value={item.verificationUrl} onChange={(e) => patch({ verificationUrl: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function CoursesSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a course" emptyItem={EMPTY_COURSE}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Course name"><input className="cc-input" value={item.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Provider"><input className="cc-input" value={item.provider} onChange={(e) => patch({ provider: e.target.value })} placeholder="Coursera, Udemy..." /></Field>
          <Field label="Date completed"><input className="cc-input" value={item.dateCompleted} onChange={(e) => patch({ dateCompleted: e.target.value })} /></Field>
          <Field label="Certificate URL" hint="optional"><input className="cc-input" value={item.certificateUrl} onChange={(e) => patch({ certificateUrl: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function AwardsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add an award" emptyItem={EMPTY_AWARD}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Title"><input className="cc-input" value={item.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Issuer"><input className="cc-input" value={item.issuer} onChange={(e) => patch({ issuer: e.target.value })} /></Field>
          <Field label="Date"><input className="cc-input" value={item.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label="Description" hint="optional"><input className="cc-input" value={item.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function VolunteerSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add volunteer experience" emptyItem={EMPTY_VOLUNTEER}
      renderItem={(item, patch) => (
        <div>
          <div className="cc-grid-2">
            <Field label="Organization"><input className="cc-input" value={item.organization} onChange={(e) => patch({ organization: e.target.value })} /></Field>
            <Field label="Role"><input className="cc-input" value={item.role} onChange={(e) => patch({ role: e.target.value })} /></Field>
            <Field label="Start date"><input className="cc-input" value={item.startDate} onChange={(e) => patch({ startDate: e.target.value })} /></Field>
            <Field label="End date">
              <input className="cc-input" value={item.current ? "Present" : item.endDate} disabled={item.current} onChange={(e) => patch({ endDate: e.target.value })} />
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: "var(--text-muted)", marginBottom: "14px" }}>
            <input type="checkbox" checked={item.current} onChange={(e) => patch({ current: e.target.checked, endDate: e.target.checked ? "" : item.endDate })} />
            Ongoing
          </label>
          <Field label="Description"><textarea className="cc-textarea" value={item.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function PublicationsSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a publication" emptyItem={EMPTY_PUBLICATION}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Title"><input className="cc-input" value={item.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Venue"><input className="cc-input" value={item.venue} onChange={(e) => patch({ venue: e.target.value })} /></Field>
          <Field label="Date"><input className="cc-input" value={item.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label="URL" hint="optional"><input className="cc-input" value={item.url} onChange={(e) => patch({ url: e.target.value })} /></Field>
          <Field label="Co-authors" hint="comma-separated, optional"><input className="cc-input" value={item.coAuthorsText} onChange={(e) => patch({ coAuthorsText: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function SpeakingSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a speaking engagement" emptyItem={EMPTY_SPEAKING}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Title"><input className="cc-input" value={item.title} onChange={(e) => patch({ title: e.target.value })} /></Field>
          <Field label="Event"><input className="cc-input" value={item.event} onChange={(e) => patch({ event: e.target.value })} /></Field>
          <Field label="Date"><input className="cc-input" value={item.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
          <Field label="URL" hint="optional"><input className="cc-input" value={item.url} onChange={(e) => patch({ url: e.target.value })} /></Field>
        </div>
      )} />
  );
}

function LanguagesSection({ value, onChange }) {
  return (
    <RepeatingList items={value} onChange={onChange} addLabel="Add a language" emptyItem={EMPTY_LANGUAGE}
      renderItem={(item, patch) => (
        <div className="cc-grid-2">
          <Field label="Language"><input className="cc-input" value={item.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Proficiency">
            <select className="cc-input" value={item.proficiency} onChange={(e) => patch({ proficiency: e.target.value })}>
              {LANGUAGE_PROFICIENCIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      )} />
  );
}

function InterestsSection({ value, onChange }) {
  return (
    <Field label="Interests" hint="comma-separated">
      <input className="cc-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder="rock climbing, open source, chess" />
    </Field>
  );
}

/* ------------------------------------------------------------------
   Profile page (accordion of all 14 sections)
   ------------------------------------------------------------------ */
function ProfilePage({ profile, updateSection, updateInterestsText }) {
  return (
    <div>
      <div className="cc-page-title">Career Profile</div>
      <div className="cc-page-desc">Everything here powers Generate and Ask Copilot. Expand a section to edit it — nothing saves until you hit Save Profile below.</div>

      <AccordionSection meta={sectionMeta("personalInfo")} defaultOpen desc="The contact details that go at the top of every resume and cover letter.">
        <PersonalInfoSection value={profile.personalInfo} onChange={updateSection("personalInfo")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("careerGoals")} count={profile.careerGoals.length} desc="Roles you're targeting — the generator weighs these when deciding what to emphasize.">
        <CareerGoalsSection value={profile.careerGoals} onChange={updateSection("careerGoals")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("skills")} count={profile.skills.length} desc="Every tool, language, or platform worth listing.">
        <SkillsSection value={profile.skills} onChange={updateSection("skills")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("workExperience")} count={profile.workExperience.length} desc="One entry per role. Responsibilities/achievements: one line each.">
        <WorkExperienceSection value={profile.workExperience} onChange={updateSection("workExperience")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("projects")} count={profile.projects.length} desc="Side projects, portfolio pieces, anything with a repo or a demo.">
        <ProjectsSection value={profile.projects} onChange={updateSection("projects")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("education")} count={profile.education.length} desc="Degrees and formal programs.">
        <EducationSection value={profile.education} onChange={updateSection("education")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("certifications")} count={profile.certifications.length} desc="Vendor and industry certifications.">
        <CertificationsSection value={profile.certifications} onChange={updateSection("certifications")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("courses")} count={profile.courses.length} desc="Online courses, separate from formal certifications.">
        <CoursesSection value={profile.courses} onChange={updateSection("courses")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("awards")} count={profile.awards.length} desc="Honors and awards worth naming.">
        <AwardsSection value={profile.awards} onChange={updateSection("awards")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("volunteerExperience")} count={profile.volunteerExperience.length} desc="Unpaid work worth including.">
        <VolunteerSection value={profile.volunteerExperience} onChange={updateSection("volunteerExperience")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("publications")} count={profile.publications.length} desc="Papers, articles, or other published work.">
        <PublicationsSection value={profile.publications} onChange={updateSection("publications")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("speakingEngagements")} count={profile.speakingEngagements.length} desc="Talks, panels, conferences.">
        <SpeakingSection value={profile.speakingEngagements} onChange={updateSection("speakingEngagements")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("languages")} count={profile.languages.length} desc="Languages you speak, beyond your resume's primary language.">
        <LanguagesSection value={profile.languages} onChange={updateSection("languages")} />
      </AccordionSection>
      <AccordionSection meta={sectionMeta("interests")} count={csvToArray(profile.interestsText).length} desc="Only pulled into a resume if genuinely relevant to the job.">
        <InterestsSection value={profile.interestsText} onChange={updateInterestsText} />
      </AccordionSection>
    </div>
  );
}

/* ------------------------------------------------------------------
   Preferences page
   ------------------------------------------------------------------ */
function PreferencesPage({ preferences, onChange }) {
  const set = (field) => (e) => onChange({ ...preferences, [field]: e.target.value });
  return (
    <div>
      <div className="cc-page-title">Preferences</div>
      <div className="cc-page-desc">How the copilot should write. These get folded into every Generate and Ask Copilot call.</div>
      <div className="cc-grid-2">
        <Field label="Preferred resume style">
          <select className="cc-input" value={preferences.preferredResumeStyle} onChange={set("preferredResumeStyle")}>
            <option value="">No preference</option>
            {STYLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Preferred writing tone">
          <select className="cc-input" value={preferences.preferredWritingTone} onChange={set("preferredWritingTone")}>
            <option value="">No preference</option>
            {TONE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Preferred cover letter tone">
          <select className="cc-input" value={preferences.preferredCoverLetterTone} onChange={set("preferredCoverLetterTone")}>
            <option value="">No preference</option>
            {TONE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Favorite technologies" hint="comma-separated"><input className="cc-input" value={preferences.favoriteTechnologiesText} onChange={set("favoriteTechnologiesText")} /></Field>
        <Field label="Industries of interest" hint="comma-separated"><input className="cc-input" value={preferences.industriesOfInterestText} onChange={set("industriesOfInterestText")} /></Field>
      </div>
      <div className="cc-field-hint" style={{ maxWidth: "60ch" }}>
        Nothing here is sent anywhere until you click Generate or Ask Copilot — those calls send your profile and preferences so the copilot has context. Saving to your device only happens when you click Save Profile or Export.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Generation + Ask Copilot API calls
   ------------------------------------------------------------------ */
function buildSystemPrompt(styleContext) {
  return `You are an expert technical resume writer. You'll receive a candidate's full career profile as JSON (work experience, projects, skills, education, certifications, and possibly courses, awards, volunteer work, publications, speaking engagements, languages, and interests) and a job description as plain text.

Rules:
- Use ONLY information present in the profile. Never invent employers, dates, metrics, or skills.
- Select and prioritize whichever goals, skills, work experience, and projects are most relevant to this job. Only pull in courses, awards, volunteer work, publications, speaking engagements, languages, or interests if genuinely relevant — the resume should usually stay focused on experience, projects, education, and certifications.
- Write in a confident, direct tone. No filler, no cliches.
- Keep it concise so the whole response fits in a short budget: summary max 2 sentences; at most 2 work experience entries, max 3 bullets each, each bullet under 20 words; at most 2 projects, max 2 bullets each; cover letter under 160 words in 3 short paragraphs; keyword lists short.
- Also assess ATS keyword alignment: identify the concrete skills, tools, and requirements stated or implied in the job description, then compare against what's actually in the profile. Return a 0-100 score estimating overlap, up to 8 short matchedKeywords genuinely present in the profile, and up to 6 short missingKeywords that appear in the job description but aren't in the profile. Never suggest inventing or padding the profile to close a gap — missing means missing, and the resume itself must still only use real profile content.
- Respond with ONLY one valid JSON object. No markdown fences, no commentary, no text outside the JSON.
${styleContext ? "\n" + styleContext + "\n" : ""}
JSON shape:
{"resume":{"summary":"","skills":[""],"experience":[{"company":"","position":"","dates":"","bullets":[""]}],"projects":[{"title":"","bullets":[""]}],"education":[{"school":"","degree":"","year":""}],"certifications":[{"name":"","provider":"","date":""}]},"coverLetter":"","atsMatch":{"score":0,"matchedKeywords":[""],"missingKeywords":[""]}}`;
}

async function generateApplication(profile, jobDescription, preferences, editSignals) {
  const payload = buildGenerationProfile(profile);
  const systemPrompt = buildSystemPrompt(buildStyleContext(preferences, editSignals));
  const userContent = `CAREER PROFILE (JSON):\n${JSON.stringify(payload)}\n\nJOB DESCRIPTION:\n${jobDescription}`;

  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || ("The generator is unavailable right now (status " + response.status + ")."));

  const text = (data.content || []).map((block) => (block.type === "text" ? block.text : "")).join("\n");
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Got a response back but couldn't parse it. Try again, or trim the job description.");
  }
}

async function askCopilot(profile, preferences, messages) {
  const payload = buildGenerationProfile(profile);
  const styleContext = buildStyleContext(preferences, []);
  const systemPrompt = `You are a career copilot for the candidate described by the following profile. Ground every answer only in real information from this profile — never invent employers, projects, or accomplishments they don't have. You help with interview prep, LinkedIn post drafts, career advice, and similar career or job-search questions. Keep answers concise and directly usable.
${styleContext ? "\n" + styleContext + "\n" : ""}
CANDIDATE PROFILE (JSON):
${JSON.stringify(payload)}`;

  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || ("The copilot is unavailable right now (status " + response.status + ")."));
  const text = (data.content || []).map((block) => (block.type === "text" ? block.text : "")).join("\n");
  return text.trim();
}

function resumeToText(resume, personalInfo) {
  // Plain text, standard all-caps section labels, hyphen bullets — the
  // format most ATS parsers read correctly. No tables, columns, or icons.
  const lines = [];
  if (personalInfo) {
    if (personalInfo.name) lines.push(personalInfo.name);
    const contact = [personalInfo.email, personalInfo.phone, personalInfo.location, personalInfo.linkedin, personalInfo.github].filter(Boolean);
    if (contact.length) lines.push(contact.join(" | "));
    lines.push("");
  }
  if (resume.summary) {
    lines.push("SUMMARY");
    lines.push(resume.summary);
    lines.push("");
  }
  if (resume.skills && resume.skills.length) {
    lines.push("SKILLS");
    lines.push(resume.skills.join(", "));
    lines.push("");
  }
  if (resume.experience && resume.experience.length) {
    lines.push("EXPERIENCE");
    resume.experience.forEach((exp) => {
      lines.push(`${exp.position} — ${exp.company} (${exp.dates})`);
      (exp.bullets || []).forEach((b) => lines.push("- " + b));
    });
    lines.push("");
  }
  if (resume.projects && resume.projects.length) {
    lines.push("PROJECTS");
    resume.projects.forEach((p) => {
      lines.push(p.title);
      (p.bullets || []).forEach((b) => lines.push("- " + b));
    });
    lines.push("");
  }
  if (resume.education && resume.education.length) {
    lines.push("EDUCATION");
    resume.education.forEach((ed) => lines.push(`${ed.degree}, ${ed.school}${ed.year ? " — " + ed.year : ""}`));
    lines.push("");
  }
  if (resume.certifications && resume.certifications.length) {
    lines.push("CERTIFICATIONS");
    resume.certifications.forEach((c) => lines.push(`${c.name} — ${c.provider} (${c.date})`));
  }
  return lines.join("\n").trim();
}

/* ------------------------------------------------------------------
   Generate page
   ------------------------------------------------------------------ */
function GenerateSection({ profile, preferences, editSignals, readiness, onAddEditSignal, onLogApplication }) {
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");
  const [editedCoverLetter, setEditedCoverLetter] = useState("");
  const [editSaved, setEditSaved] = useState(false);
  const [logCompany, setLogCompany] = useState("");
  const [logRole, setLogRole] = useState("");
  const [logged, setLogged] = useState(false);

  const canGenerate = jobDescription.trim().length > 30 && readiness.filled >= 3 && status !== "loading";

  const handleGenerate = async () => {
    setStatus("loading");
    setError("");
    setLogged(false);
    try {
      const data = await generateApplication(profile, jobDescription, preferences, editSignals);
      setResult(data);
      setEditedCoverLetter(data.coverLetter || "");
      setEditSaved(false);
      setStatus("done");
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setStatus("error");
    }
  };

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch (e) { /* clipboard unavailable; text is still selectable */ }
  };

  const handleSaveEdits = async () => {
    await onAddEditSignal(result.coverLetter, editedCoverLetter);
    setEditSaved(true);
    setTimeout(() => setEditSaved(false), 1800);
  };

  const handleLog = async () => {
    await onLogApplication({
      company: logCompany, role: logRole,
      resumeSnapshot: resumeToText(result.resume, profile.personalInfo),
      coverLetterSnapshot: editedCoverLetter,
      atsScore: result.atsMatch ? String(result.atsMatch.score) : "",
    });
    setLogged(true);
  };

  const coverLetterEdited = result && editedCoverLetter !== result.coverLetter;

  return (
    <div>
      <div className="cc-page-title">Generate</div>
      <div className="cc-page-desc">
        Paste a job description. The generator draws on your profile ({readiness.filled}/{readiness.total} sections filled) and preferences to write a tailored resume and cover letter — nothing invented, only what's in your profile.
      </div>

      <details style={{ marginBottom: "18px" }}>
        <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-muted)" }}>Why this format is ATS-friendly</summary>
        <div className="cc-field-hint" style={{ marginTop: "8px", maxWidth: "62ch" }}>
          Most ATS parsing failures come from formatting, not content: multi-column layouts, text inside images or tables, headers/footers, and non-standard section titles all trip up parsers. This output is plain text with one column and standard section labels (SUMMARY, SKILLS, EXPERIENCE...) on purpose — keep it that way if you paste it into a styled document. The match score below estimates keyword overlap with the job description; it isn't any specific company's real scoring model, so treat it as directional.
        </div>
      </details>

      <Field label="Job description">
        <textarea className="cc-textarea" style={{ minHeight: "160px" }} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the full job posting here..." />
      </Field>

      <button type="button" className="cc-btn cc-btn-primary" disabled={!canGenerate} onClick={handleGenerate}>
        {status === "loading" ? <Loader2 size={15} className="cc-spin" /> : <Sparkles size={15} />}
        {status === "loading" ? "Generating..." : "Generate"}
      </button>
      {readiness.filled < 3 && <div className="cc-field-hint" style={{ marginTop: "8px" }}>Fill in at least 3 profile sections for a result worth reading.</div>}
      {status === "error" && <div className="cc-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {result && (
        <div className="cc-generate-grid" style={{ marginTop: "24px" }}>
          {result.atsMatch && (
            <div className="cc-result">
              <div className="cc-result-head"><span className="cc-result-title">ATS Match</span></div>
              <div className="cc-field" style={{ marginBottom: result.atsMatch.matchedKeywords || result.atsMatch.missingKeywords ? "16px" : 0 }}>
                <span className="cc-field-label">Estimated keyword overlap with this job description</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <div className="cc-readiness-track" style={{ width: "180px" }}>
                    <div className="cc-readiness-fill" style={{ width: result.atsMatch.score + "%" }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>{result.atsMatch.score}/100</span>
                </div>
              </div>
              {result.atsMatch.matchedKeywords && result.atsMatch.matchedKeywords.length > 0 && (
                <div style={{ marginBottom: "14px" }}>
                  <div className="cc-field-label" style={{ color: "var(--cyan)", marginBottom: "6px" }}>Covered</div>
                  <div className="cc-tag-row">{result.atsMatch.matchedKeywords.map((k, i) => <span className="cc-tag" key={i}>{k}</span>)}</div>
                </div>
              )}
              {result.atsMatch.missingKeywords && result.atsMatch.missingKeywords.length > 0 && (
                <div>
                  <div className="cc-field-label" style={{ color: "var(--danger)", marginBottom: "6px" }}>Missing from your profile</div>
                  <div className="cc-tag-row">{result.atsMatch.missingKeywords.map((k, i) => <span className="cc-tag" key={i} style={{ borderColor: "var(--danger)" }}>{k}</span>)}</div>
                  <div className="cc-field-hint" style={{ marginTop: "8px" }}>Only add these to your profile if they're genuinely true — Generate won't invent them for you.</div>
                </div>
              )}
            </div>
          )}

          <div className="cc-result">
            <div className="cc-result-head">
              <span className="cc-result-title">Resume</span>
              <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => copyText("resume", resumeToText(result.resume, profile.personalInfo))}>
                {copied === "resume" ? <Check size={13} /> : <Copy size={13} />} {copied === "resume" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="cc-resume-summary">{result.resume.summary}</p>
            {result.resume.skills && result.resume.skills.length > 0 && (
              <div className="cc-tag-row">{result.resume.skills.map((s, i) => <span className="cc-tag" key={i}>{s}</span>)}</div>
            )}
            {(result.resume.experience || []).map((exp, i) => (
              <div className="cc-exp-block" key={i}>
                <div className="cc-exp-title">{exp.position} — {exp.company}</div>
                <div className="cc-exp-sub">{exp.dates}</div>
                <ul className="cc-bullets">{(exp.bullets || []).map((b, j) => <li key={j}>{b}</li>)}</ul>
              </div>
            ))}
            {(result.resume.projects || []).map((p, i) => (
              <div className="cc-exp-block" key={i}>
                <div className="cc-exp-title">{p.title}</div>
                <ul className="cc-bullets">{(p.bullets || []).map((b, j) => <li key={j}>{b}</li>)}</ul>
              </div>
            ))}
            {(result.resume.education || []).map((ed, i) => (
              <div className="cc-exp-block" key={i}>
                <div className="cc-exp-title">{ed.degree}</div>
                <div className="cc-exp-sub">{ed.school} {ed.year ? `· ${ed.year}` : ""}</div>
              </div>
            ))}
            {(result.resume.certifications || []).length > 0 && (
              <div className="cc-exp-block">
                <div className="cc-exp-title">Certifications</div>
                <ul className="cc-bullets">{result.resume.certifications.map((c, i) => <li key={i}>{c.name} — {c.provider} ({c.date})</li>)}</ul>
              </div>
            )}
          </div>

          <div className="cc-result">
            <div className="cc-result-head">
              <span className="cc-result-title">Cover Letter</span>
              <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" onClick={() => copyText("cover", editedCoverLetter)}>
                {copied === "cover" ? <Check size={13} /> : <Copy size={13} />} {copied === "cover" ? "Copied" : "Copy"}
              </button>
            </div>
            <textarea className="cc-textarea cc-cover-letter-edit" value={editedCoverLetter} onChange={(e) => setEditedCoverLetter(e.target.value)} />
            {coverLetterEdited && (
              <button type="button" className="cc-btn cc-btn-ghost cc-btn-sm" style={{ marginTop: "10px" }} onClick={handleSaveEdits}>
                <Check size={13} /> {editSaved ? "Saved — future generations will learn from this" : "Save edits (teaches future generations)"}
              </button>
            )}
          </div>

          <div className="cc-result">
            <div className="cc-result-head"><span className="cc-result-title">Log this application</span></div>
            <div className="cc-grid-2">
              <Field label="Company"><input className="cc-input" value={logCompany} onChange={(e) => setLogCompany(e.target.value)} /></Field>
              <Field label="Role"><input className="cc-input" value={logRole} onChange={(e) => setLogRole(e.target.value)} /></Field>
            </div>
            <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={handleLog} disabled={!logCompany.trim() || !logRole.trim() || logged}>
              {logged ? <Check size={13} /> : <Plus size={13} />} {logged ? "Logged" : "Log Application"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------
   Applications page
   ------------------------------------------------------------------ */
function ApplicationsPage({ applications, onChange, saveState, onSave, isDirty }) {
  const updateApp = (idx, patch) => onChange(applications.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  const removeApp = (idx) => onChange(applications.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="cc-page-title">Application History</div>
      <div className="cc-page-desc">Everything you've logged from Generate, with status tracking.</div>

      {applications.length === 0 && <div className="cc-field-hint">Nothing logged yet — generate a resume and cover letter, then log it from the Generate tab.</div>}

      {applications.map((app, idx) => (
        <div className="cc-card" key={app.id}>
          <div className="cc-exp-title">{app.role || "Untitled role"} — {app.company || "Unknown company"}</div>
          <div className="cc-exp-sub">Applied {app.dateApplied}</div>
          <div className="cc-grid-2" style={{ marginTop: "12px" }}>
            <Field label="Interview status">
              <select className="cc-input" value={app.interviewStatus} onChange={(e) => updateApp(idx, { interviewStatus: e.target.value })}>
                {INTERVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Offer status">
              <select className="cc-input" value={app.offerStatus} onChange={(e) => updateApp(idx, { offerStatus: e.target.value })}>
                {OFFER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="ATS score" hint="from Generate's match score, editable"><input className="cc-input" value={app.atsScore} onChange={(e) => updateApp(idx, { atsScore: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><textarea className="cc-textarea" value={app.notes} onChange={(e) => updateApp(idx, { notes: e.target.value })} /></Field>
          <details>
            <summary style={{ cursor: "pointer", fontSize: "12px", color: "var(--text-muted)", marginBottom: "10px" }}>View resume + cover letter used</summary>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", whiteSpace: "pre-wrap", marginBottom: "10px", color: "var(--text-muted)" }}>{app.resumeSnapshot}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px", whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>{app.coverLetterSnapshot}</div>
          </details>
          <button type="button" className="cc-btn cc-btn-ghost cc-btn-remove" onClick={() => removeApp(idx)}>
            <Trash2 size={13} /> Remove
          </button>
        </div>
      ))}

      <div className="cc-savebar">
        <button type="button" className="cc-btn cc-btn-primary" onClick={onSave} disabled={saveState === "saving"}>
          {saveState === "saving" ? "Saving..." : "Save Applications"}
        </button>
        <span className={"cc-save-status" + (isDirty ? " dirty" : saveState === "saved" ? " saved" : "")}>
          {saveState === "saved" ? "Saved" : isDirty ? "Unsaved changes" : "All changes saved"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Ask Copilot page
   ------------------------------------------------------------------ */
function AskCopilotPage({ profile, preferences }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const handleSend = async () => {
    const question = input.trim();
    if (!question || status === "loading") return;
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setStatus("loading");
    setError("");
    try {
      const reply = await askCopilot(profile, preferences, nextMessages);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      setStatus("idle");
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setStatus("error");
    }
  };

  return (
    <div>
      <div className="cc-page-title">Ask Copilot</div>
      <div className="cc-page-desc">Interview prep, LinkedIn post drafts, career advice — grounded in your profile. This conversation isn't saved between visits.</div>

      <div className="cc-chat-log">
        {messages.length === 0 && (
          <div className="cc-field-hint">Try: "Draft a LinkedIn post about my most recent project" or "Give me a strong answer to 'tell me about a time you fixed a production incident'".</div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"cc-chat-msg " + (m.role === "user" ? "cc-chat-user" : "cc-chat-assistant")}>
            <div className="cc-chat-role">{m.role === "user" ? "You" : "Copilot"}</div>
            <div>{m.content}</div>
          </div>
        ))}
        {status === "loading" && (
          <div className="cc-field-hint">
            <Loader2 size={13} className="cc-spin" style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
            Thinking...
          </div>
        )}
      </div>

      {status === "error" && <div className="cc-error"><AlertCircle size={16} /><span>{error}</span></div>}

      <div className="cc-chat-input-row">
        <textarea
          className="cc-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask anything career-related..."
        />
        <button type="button" className="cc-btn cc-btn-primary" onClick={handleSend} disabled={status === "loading" || !input.trim()}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Chrome: readiness bar, sidebar, save bar
   ------------------------------------------------------------------ */
function ReadinessBar({ profile }) {
  const { filled, total } = computeReadiness(profile);
  const pct = Math.round((filled / total) * 100);
  return (
    <div className="cc-readiness">
      <span className="cc-readiness-label">Profile {filled}/{total}</span>
      <div className="cc-readiness-track"><div className="cc-readiness-fill" style={{ width: pct + "%" }} /></div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }) {
  return (
    <nav className="cc-sidebar">
      {TABS.map((t) => (
        <button key={t.key} type="button" className={"cc-nav-item" + (activeTab === t.key ? " active" : "")} onClick={() => setActiveTab(t.key)}>
          <t.icon size={15} />
          {t.label}
        </button>
      ))}
    </nav>
  );
}

function SaveBar({ isDirty, saveState, onSave, onReset, onExport }) {
  return (
    <div className="cc-savebar">
      <button type="button" className="cc-btn cc-btn-primary" onClick={onSave} disabled={saveState === "saving"}>
        {saveState === "saving" ? "Saving..." : "Save Profile"}
      </button>
      <button type="button" className="cc-btn cc-btn-ghost" onClick={onReset}>
        <RotateCcw size={13} /> Reset
      </button>
      <button type="button" className="cc-btn cc-btn-ghost" onClick={onExport}>
        <Download size={13} /> Export
      </button>
      <span className={"cc-save-status" + (isDirty ? " dirty" : saveState === "saved" ? " saved" : "")}>
        {saveState === "saved" ? "Saved" : isDirty ? "Unsaved changes" : "All changes saved"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------
   App
   ------------------------------------------------------------------ */
export default function App() {
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(EMPTY_PROFILE));
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saveState, setSaveState] = useState("idle");

  const [applications, setApplications] = useState([]);
  const [applicationsSavedSnapshot, setApplicationsSavedSnapshot] = useState(() => JSON.stringify([]));
  const [appSaveState, setAppSaveState] = useState("idle");

  const [editSignals, setEditSignals] = useState([]);

  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await storage.get("career-profile");
        if (!cancelled && res && res.value) {
          const parsed = JSON.parse(res.value);
          const merged = {
            ...EMPTY_PROFILE,
            ...parsed,
            personalInfo: { ...EMPTY_PROFILE.personalInfo, ...(parsed.personalInfo || {}) },
            preferences: { ...EMPTY_PROFILE.preferences, ...(parsed.preferences || {}) },
          };
          setProfile(merged);
          setSavedSnapshot(JSON.stringify(merged));
        }
      } catch (e) { /* no saved profile yet — start fresh */ }
      finally { if (!cancelled) setLoadingProfile(false); }
    })();
    (async () => {
      try {
        const res = await storage.get("career-applications");
        if (!cancelled && res && res.value) {
          setApplications(JSON.parse(res.value));
          setApplicationsSavedSnapshot(res.value);
        }
      } catch (e) { /* start fresh */ }
    })();
    (async () => {
      try {
        const res = await storage.get("career-edit-signals");
        if (!cancelled && res && res.value) setEditSignals(JSON.parse(res.value));
      } catch (e) { /* start fresh */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const isDirty = savedSnapshot !== JSON.stringify(profile);
  const appIsDirty = applicationsSavedSnapshot !== JSON.stringify(applications);

  const saveProfile = useCallback(async () => {
    setSaveState("saving");
    try {
      const serialized = JSON.stringify(profile);
      await storage.set("career-profile", serialized);
      setSavedSnapshot(serialized);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) { setSaveState("idle"); }
  }, [profile]);

  const saveApplications = useCallback(async () => {
    setAppSaveState("saving");
    try {
      const serialized = JSON.stringify(applications);
      await storage.set("career-applications", serialized);
      setApplicationsSavedSnapshot(serialized);
      setAppSaveState("saved");
      setTimeout(() => setAppSaveState("idle"), 1500);
    } catch (e) { setAppSaveState("idle"); }
  }, [applications]);

  const resetProfile = async () => {
    if (!window.confirm("Clear your saved career profile? This can't be undone.")) return;
    try { await storage.delete("career-profile"); } catch (e) { /* ignore */ }
    setProfile(EMPTY_PROFILE);
    setSavedSnapshot(JSON.stringify(EMPTY_PROFILE));
  };

  const handleExport = () => exportProfile(profile, applications, editSignals);

  const addEditSignal = useCallback(async (original, edited) => {
    const next = [...editSignals, { id: makeId(), original, edited, createdAt: new Date().toISOString() }].slice(-10);
    setEditSignals(next);
    try { await storage.set("career-edit-signals", JSON.stringify(next)); } catch (e) { /* best effort */ }
  }, [editSignals]);

  const logApplication = useCallback(async ({ company, role, resumeSnapshot, coverLetterSnapshot, atsScore }) => {
    const record = {
      id: makeId(), company, role,
      dateApplied: new Date().toISOString().slice(0, 10),
      resumeSnapshot, coverLetterSnapshot,
      atsScore: atsScore || "", interviewStatus: "not started", offerStatus: "n/a", notes: "",
    };
    const next = [record, ...applications];
    setApplications(next);
    try {
      await storage.set("career-applications", JSON.stringify(next));
      setApplicationsSavedSnapshot(JSON.stringify(next));
    } catch (e) { /* best effort */ }
  }, [applications]);

  const readiness = useMemo(() => computeReadiness(profile), [profile]);
  const updateSection = (key) => (val) => setProfile((p) => ({ ...p, [key]: val }));
  const updateInterestsText = (val) => setProfile((p) => ({ ...p, interestsText: val }));

  return (
    <div className="cc-root">
      <style>{STYLE}</style>
      {loadingProfile ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "13px" }}>Loading your profile…</div>
        </div>
      ) : (
        <>
          <header className="cc-header">
            <div className="cc-brand">
              <span className="cc-brand-mark">CC</span>
              <span className="cc-brand-name">Career Copilot</span>
            </div>
            <ReadinessBar profile={profile} />
          </header>
          <div className="cc-shell">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="cc-main">
              {activeTab === "profile" && <ProfilePage profile={profile} updateSection={updateSection} updateInterestsText={updateInterestsText} />}
              {activeTab === "preferences" && <PreferencesPage preferences={profile.preferences} onChange={updateSection("preferences")} />}
              {activeTab === "generate" && (
                <GenerateSection
                  profile={profile}
                  preferences={profile.preferences}
                  editSignals={editSignals}
                  readiness={readiness}
                  onAddEditSignal={addEditSignal}
                  onLogApplication={logApplication}
                />
              )}
              {activeTab === "applications" && (
                <ApplicationsPage applications={applications} onChange={setApplications} saveState={appSaveState} onSave={saveApplications} isDirty={appIsDirty} />
              )}
              {activeTab === "askCopilot" && <AskCopilotPage profile={profile} preferences={profile.preferences} />}

              {(activeTab === "profile" || activeTab === "preferences") && (
                <SaveBar isDirty={isDirty} saveState={saveState} onSave={saveProfile} onReset={resetProfile} onExport={handleExport} />
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}
