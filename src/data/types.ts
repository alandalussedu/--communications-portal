/**
 * Data shapes for the platform. Every record mirrors a row in an existing
 * Google Sheet; nothing here is calculated by the platform.
 *
 * A cell value keeps its original text (`raw`). `num` is only filled when the
 * text is plainly numeric, so charts never guess.
 */
export type CellValue = { raw: string; num: number | null; unit: "%" | "" } | null

export type IndicatorKey = "satisfaction" | "communication"

export type BranchLink = {
  /** The URL exactly as recorded in the branch-links sheet, when one is visible. */
  recorded: string | null
  /** Text shown in the sheet when the link sits behind a file chip. */
  chipTitle: string | null
  fileId?: string | null
  range?: [number, number] | null
  /** A data-quality note about this link, shown to the viewer. */
  flag?: string | null
  /** The link exactly as the register holds it, when the platform uses a corrected one. */
  registerUrl?: string | null
  /** Why the register link differs from the one the platform uses. */
  registerNote?: string | null
}

export type Branch = {
  id: string
  slug: string
  name: string
  order: number
  fileId: string | null
  fileTitle: string | null
  fileUrl: string | null
  links: Record<IndicatorKey, BranchLink>
  capturedAt: string
  source: string
  updatedAt?: string
}

export type IndicatorSummary = {
  id: string
  branch: string
  indicator: IndicatorKey
  code: string
  title: string
  owner: string | null
  status: string | null
  prior: CellValue
  annualTarget: CellValue
  s1Target: CellValue
  s1Result: CellValue
  s2Target: CellValue
  s2Result: CellValue
  yearEnd: CellValue
  components: string[]
  /** Values of each component when the source records them at branch level, keyed by component name. */
  componentValues?: Record<string, { result?: CellValue; target?: CellValue; period?: string | null }>
  note: string | null
  source: string
  capturedAt: string
  sourceRow?: number | null
}

export type SubIndicator = {
  name: string
  perStudent: CellValue
  annualTarget: CellValue
  s1Target: CellValue
  s1Result: CellValue
  s2Target: CellValue
  s2Result: CellValue
  yearEnd: CellValue
}

export type StageSummary = {
  id: string
  branch: string
  indicator: IndicatorKey
  stage: string | null
  track: string | null
  level: string | null
  owner: string | null
  prior: CellValue
  annualTarget: CellValue
  s1Target: CellValue
  s1Result: CellValue
  s2Target: CellValue
  s2Result: CellValue
  yearEnd: CellValue
  components?: string[]
  studentCount?: CellValue
  subIndicators?: SubIndicator[]
  source: string
  capturedAt: string
}

/** One file or folder in the library. Each link from the source sheet is its own item. */
export type FileItem = {
  id: string
  title: string
  /** The sheet row the link came from, e.g. "الهوية · الأهلية". Used only as a filter. */
  group: string
  kind: "folder" | "file" | "doc"
  url: string | null
  /** File name shown in the sheet when the link sits behind a chip. */
  fileLabel: string | null
  /** False when the title is a placeholder because the real name was not available. */
  named: boolean
  order: number
  source: string
  capturedAt: string
  updatedAt?: string
  /* Optional catalogue fields. Each is empty until someone records it; the
   * platform never infers them. */
  description?: string | null
  keywords?: string[]
  /** Approval state exactly as recorded by an editor. */
  status?: FileStatus | null
  version?: string | null
  section?: LibrarySection | null
  owner?: string | null
  /** Date the file was last updated, as recorded (YYYY-MM-DD). */
  docDate?: string | null
}

/** The library section an item belongs to. Set by an editor; never inferred. */
export type LibrarySection = "identity" | "guides" | "forms"
export const LIBRARY_SECTIONS: { key: LibrarySection; label: string; hint: string }[] = [
  { key: "identity", label: "الهوية البصرية", hint: "الشعارات وأدلة الهوية والقوالب البصرية" },
  { key: "guides", label: "الأدلة والسياسات", hint: "الأدلة الإجرائية والسياسات واللوائح" },
  { key: "forms", label: "النماذج", hint: "نماذج جاهزة للتحميل والتعبئة" },
]

export type FileStatus = "معتمد" | "مسودة" | "مؤرشف"
export const FILE_STATUSES: FileStatus[] = ["معتمد", "مسودة", "مؤرشف"]

/** One attempt to read a source. Written by the import and, later, by the scheduled sync. */
export type SyncEvent = {
  id: string
  /** Matches a SourceInfo id in meta.sources. */
  source: string
  /** The branch this read covers, or null for a source shared by all branches. */
  branch: string | null
  /** "data" reads indicator values; "links" and "library" read registers. */
  kind: "data" | "links" | "library"
  attemptedAt: string
  succeededAt: string | null
  result: "success" | "partial" | "failed"
  method: string
  message: string | null
  url: string | null
}

export type Settings = {
  id: string
  /** Days after the last successful read before a branch counts as not updated. */
  staleDays?: number
  /** Arabic synonym groups used by library search. Each group is a list of equivalent words. */
  synonyms?: string[][]
  /** Branch names for the open tabs (the full branch records are encrypted). */
  branchNames?: { slug: string; name: string; order: number }[]
  /** Home-page welcome band: editable text and the background video (asset ids). */
  hero?: HeroSettings
  /** Home-page quick links: library item ids in display order, chosen by an editor. */
  quickLinks?: string[]
}

export type HeroSettings = {
  title?: string | null
  subtitle?: string | null
  videoId?: string | null
  posterId?: string | null
  /** The editor stopped the video: the still image (or the brand gradient) shows instead. */
  videoOff?: boolean
}

/** An editor's follow-up mark on an alert. `signature` ties it to the data that raised it. */
export type AlertState = {
  id: string
  signature: string
  state: "done"
  at: string
}

export type SourceInfo = {
  id: string
  title: string
  url: string | null
  method: string
  capturedAt: string
}

export type Meta = {
  id: string
  capturedAt: string
  seededAt: string | null
  liveSync: { enabled: boolean; reason: string; lastRun?: string | null; lastError?: string | null }
  sources: SourceInfo[]
}

export type CollectionName = "branches" | "indicators" | "stages" | "files" | "meta" | "syncLog" | "settings" | "alertState" | "socialAccounts" | "socialReadings" | "remedialFiles" | "remedialStages" | "remedialRows" | "remedialMonthly" | "remedialLog" | "remedialSync" | "events" | "competitors" | "competitorsMeta" | "complaintReports" | "csrInitiatives" | "csrPartners" | "pbxOfficers" | "pbxReports" | "csrPlans"

/* ------------------------------------------------------------ branch CSR plans, read from «PROJECTS 2027» in each branch file */
export type CsrPlanStep = { action: string; owner: string; date: string; dateIso: string | null; dateFlag: "before-year" | null; budget: string; budgetNum: number | null; item: string; tech: string; reply: string; row: number }
export type CsrPlanProject = {
  track: "edu" | "val" | "other"
  heading: string
  trackNote?: string
  row: number
  name: string
  nameLink: string | null
  goal: string
  description: string
  audience: string
  target: string
  follow: { text: string; url: string | null } | null
  indicators: string[]
  approval: string | null
  approvalNote: string
  steps: CsrPlanStep[]
  budget: number
  empty: boolean
}
/** id = branch slug. Read-only copy of the sheet; nothing here is typed into the portal. */
export type CsrPlan = {
  id: string
  branch: string
  status: "ok" | "no-link"
  note?: string
  register: string
  readAt: string
  fileId?: string
  sheetId?: number
  sheetTitle?: string
  sourceUrl?: string
  summary?: { projects: number | null; approved: number | null; notApproved: number | null; measure: string | null } | null
  kpi?: { col: string; label: string; value: string | null }[]
  projects?: CsrPlanProject[]
  issues?: string[]
}

/* ------------------------------------------------------------ PBX (3CX) monthly response of branch communication officers */
/** A branch communication officer and the extension(s) central transfers ring. id = a stable slug. */
export type PbxOfficer = { id: string; name: string; branch: string; school: string; exts: string[]; order: number; active: boolean }
/** One officer's month: counted on their own extension(s) only. «Waiting» calls are left out. */
export type PbxLine = { officer: string; name: string; branch: string; school: string; exts: string[]; attempts: number; answered: number; unanswered: number; voicemail: number }
/** id = YYYY-MM. Only these counts are kept: the uploaded file (with callers' numbers) is never stored. */
export type PbxReport = {
  id: string
  month: string
  /** first and last call date the file had inside this month (YYYY-MM-DD) */
  from: string | null
  to: string | null
  lines: PbxLine[]
  waitingExcluded: number
  source: string
  fileName: string | null
  uploadedAt: string
}

/* ------------------------------------------------------------ monthly complaint reports (uploaded Word files) */
/** One piece of the report, in the order it appears in the Word file. Nothing is computed or added. */
export type ComplaintBlock = { t: "p"; style: "title" | "h1" | "h2" | "p"; text: string } | { t: "table"; rows: string[][] }
/** id = `${branch}__${month}`. The original file is kept in the collection complaintFiles under the same id. */
export type ComplaintReport = {
  id: string
  branch: string
  /** YYYY-MM */
  month: string
  title: string
  fileName: string
  fileSize: number
  blocks: ComplaintBlock[]
  uploadedAt: string
}

/* ------------------------------------------------------------ remedial plans (read from the branch Google Sheets) */
export type RemedialStatus = "done" | "not-done" | "no-plan" | "no-checkbox"
export type RemedialSheet = { title: string; kind: "plan" | "monthly" | "excluded"; reason?: string; headerRow?: number; rows?: number; stage?: string; columns?: string[] }
export type RemedialFile = {
  id: string
  branch: string | null
  fileId: string
  label: string | null
  url: string
  inRegister: boolean
  isRegister?: boolean
  readAt: string | null
  firstReadAt?: string | null
  readStatus: "success" | "failed" | "not-read"
  message: string | null
  sheets: RemedialSheet[]
}
export type RemedialStage = {
  id: string
  branch: string
  file: string
  name: string
  title: string
  order: number
  headerRow: number
  columns: string[]
  heading: string[]
  approval: { raw: string | null; filled: boolean; value: string | null }
  counts: { done: number; notDone: number; noPlan: number; noCheckbox: number }
  total: number
  empty: boolean
  hasExecutionColumn: boolean
  readAt: string
}
export type RemedialRow = {
  id: string
  branch: string
  file: string
  stage: string
  stageName: string
  sheetRow: number
  num: string | null
  cause: string | null
  problem: string | null
  actions: string | null
  owner: string | null
  start: string | null
  end: string | null
  indicator: string | null
  baseline: string | null
  target: string | null
  extra: Record<string, string>
  hasCheckbox: boolean
  executionRaw: string | null
  status: RemedialStatus
  readAt: string
  lastChangeAt?: string | null
}
export type RemedialMonthly = { id: string; branch: string; file: string; sheet: string; sheetRow: number; order: number; columns: string[]; cells: Record<string, string>; readAt: string }
export type RemedialLogEntry = {
  id: string
  branch: string
  file: string
  stage: string
  stageName: string
  row: string
  sheetRow: number
  cause: string | null
  problem: string | null
  from: string | null
  to: string | null
  fromStatus: RemedialStatus | null
  toStatus: RemedialStatus
  readAt: string
  prevReadAt: string | null
}
export type RemedialSync = { id: string; lastRun: string | null; firstReadOfRun?: string | null; method: string; register: string; previousRunCompared: boolean; changes: number }

/** A social-media account or WhatsApp channel, added by an editor. */
export type SocialAccount = {
  id: string
  platform: string
  name: string
  handle?: string | null
  url?: string | null
  /** "company" or a branch slug. */
  owner: string
  order: number
  active: boolean
  createdAt: string
  updatedAt?: string
}

/** The follower count an editor recorded for one account in one month. Id: `<account>__<YYYY-MM>`. */
export type SocialReading = {
  id: string
  account: string
  month: string
  followers: number
  recordedAt: string
}

export type ConnectionState =
  | { kind: "connecting" }
  | { kind: "ready" }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; code: string; message: string }

/* ------------------------------------------------------------ communication journey (calendar) */
export type EventType = "branch-meeting" | "indicator" | "deadline" | "campaign" | "workshop" | "holiday"
export type EventRepeat = { every: "week" | "2weeks" | "month"; until: string }
/** One entry in «رحلة التواصل». Dates are plain "YYYY-MM-DD" (no time zone). */
export type CalendarEvent = {
  id: string
  title: string
  type: EventType
  start: string
  end?: string | null
  time?: string | null
  branch?: string | null
  link?: string | null
  notes?: string | null
  repeat?: EventRepeat | null
  createdAt?: string
  updatedAt?: string
}

/* ------------------------------------------------------------ competitor study (read from the team's own Google Sheet) */
export type CompetitorProximity = "near" | "mid" | "far" | "closed"
export type Competitor = {
  id: string
  order: number
  name: string
  owner: string | null
  /** The reference school of the study («مدارس اليسر»): the sheet compares everything against it. */
  baseline: boolean
  /** Listed under the sheet's note as «close but not yet in the table»: no data collected. */
  suggested: boolean
  branches: string | null
  founded: string | null
  kind: string | null
  fees: string | null
  feesText: string | null
  feesLinks: string[]
  feesMin: number | null
  feesMax: number | null
  proximity: string | null
  proxKey: CompetitorProximity | null
  offers: string | null
  offers3: "yes" | "no" | null
  strengths: string | null
  weaknesses: string | null
  students: string | null
  studentsNum: number | null
  classSize: string | null
  facilities: string | null
  stages: string | null
  gender: string | null
  tracks: string | null
  rankings: string | null
  accreditations: string | null
  staff: string | null
  pd: string | null
  social: string | null
  website: string | null
  enrichment: string | null
  platform: string | null
  digital: string | null
  growth: string | null
  marketing: string | null
  /** Labels read out of the sheet text (curricula, accreditations, accounts, themes), not separate data. */
  curricula: string[]
  accredTags: string[]
  socialTags: string[]
  strengthThemes: string[]
  weaknessThemes: string[]
}
export type CompetitorsMeta = {
  id: string
  title: string
  sheetId: string
  sheetName: string
  region: string
  readAt: string
  count: number
  baselineId: string
  columns: Record<string, string>
  notes: string[]
}

/* ------------------------------------------------------------ community responsibility (دليل المسؤولية المجتمعية للفروع) */
export type CsrTrack = "edu" | "val"
/** The five evidence items of the guide. `partner` is complete when the initiative has no partner. */
export type CsrEvidence = { photos: boolean; report: boolean; count: boolean; proof: boolean; partner: boolean }
/** Entered and approved by the management team only. Counting is their decision; the platform warns, never decides. */
export type CsrInitiative = {
  id: string
  /** academic year, e.g. "2026/2027" */
  year: string
  branch: string
  track: CsrTrack
  name: string
  audience: string
  plannedDate: string | null
  /** condition 1: in the approved annual plan */
  inPlan: boolean
  /** condition 2: the beneficiaries are from outside the school's students and staff */
  external: boolean
  /** condition 4: no fee at all */
  free: boolean
  planApproved: boolean
  planApprovedAt?: string | null
  planApprovedBy?: string | null
  partnerName: string
  charity: boolean
  status: "planned" | "done"
  executedDate: string | null
  beneficiaries: number | null
  countMethod: string
  students: number | null
  staff: number | null
  hours: number | null
  cost: number | null
  evidenceDate: string | null
  evidenceLink: string
  ev: CsrEvidence
  /** the management decision on counting: null = not decided yet */
  decision: "counted" | "rejected" | null
  decidedAt?: string | null
  decidedBy?: string | null
  /** the evidence was late (over two weeks) when the decision was taken */
  decidedLate?: boolean
  notes: string
  /** «slug:track» when created from a branch plan */
  fromPlan?: string
  createdAt: string
  updatedAt: string
}
export type CsrPartnerStage = "opp" | "contact" | "mou" | "deal"
export type CsrPartner = {
  id: string
  name: string
  org: string
  branch: string | null
  track: CsrTrack | null
  stage: CsrPartnerStage
  /** 0 = not rated, else 1..5 set by the management team */
  quality: number
  approved: boolean
  contact: string
  note: string
  createdAt: string
  updatedAt: string
}
