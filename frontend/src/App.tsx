import { useEffect, useState, type FormEvent } from "react";
import "./App.css";

type ApplicationStatus =
  | "PENDING"
  | "ADMINISTRATION"
  | "INTERVIEW"
  | "MEMBER"
  | "NOT_SELECTED_ADMINISTRATION"
  | "NOT_SELECTED_INTERVIEW";

type AcceptancePriority = "HIGH" | "MEDIUM" | "LOW" | "NOT_RECOMMENDED";

type ApplicantDocument = {
  fieldName: string;
  driveFileId?: string;
  url?: string;
  path?: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type ApplicationScore = {
  idea: number | null;
  relevance: number | null;
  skills_experience_achievements: number | null;
  identity_contact: number | null;
  portfolio: number | null;
  total: number | null;
};

type RecruitmentApplication = {
  id: string;
  full_name: string;
  email: string;
  nrp: string;
  study_program_code: string;
  degree_level_code: string;
  batch_year: number;
  division_code: string;
  interested_wing_code: string;
  status: ApplicationStatus;
  draft_status: ApplicationStatus | null;
  file_metadata?: ApplicantDocument[];
  portfolio_url?: string;
  special_task_url?: string;
  idea_score?: number | null;
  relevance_score?: number | null;
  skills_experience_achievements_score?: number | null;
  identity_contact_score?: number | null;
  portfolio_score?: number | null;
  total_score?: number | null;
  acceptance_priority?: AcceptancePriority | null;
  created_at: string;
  updated_at: string;
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApplicationListResponse = {
  applications?: RecruitmentApplication[];
  pagination?: PaginationData;
  error?: string;
};

type StatusCounts = Record<ApplicationStatus, number>;

type ApplicationSummaryResponse = {
  statusCounts?: Partial<StatusCounts>;
  error?: string;
};

const emptyStatusCounts = (): StatusCounts => ({
  PENDING: 0,
  ADMINISTRATION: 0,
  INTERVIEW: 0,
  MEMBER: 0,
  NOT_SELECTED_ADMINISTRATION: 0,
  NOT_SELECTED_INTERVIEW: 0,
});

type DivisionFilter = "ALL" | "technical" | "research-development" | "non-technical";

const divisionOptions: { value: DivisionFilter; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "research-development", label: "Research & Development" },
  { value: "non-technical", label: "Non-Technical" },
];

const subDivisionOptions: Record<Exclude<DivisionFilter, "ALL">, { value: string; label: string }[]> = {
  technical: [
    { value: "electrical", label: "Electrical" },
    { value: "mechanical", label: "Mechanical" },
    { value: "programming", label: "Programming" },
  ],
  "research-development": [
    { value: "electrical", label: "Electrical" },
    { value: "mechanical", label: "Mechanical" },
    { value: "programming", label: "Programming" },
  ],
  "non-technical": [
    { value: "branding", label: "Branding" },
    { value: "project-management", label: "Project Management" },
    { value: "public-relations", label: "Public Relations" },
    { value: "internal", label: "Internal" },
  ],
};

const API_BASE = (import.meta.env.VITE_RECRUITMENT_API_URL ?? "http://localhost:3000/api").replace(/\/$/, "");

const statusOptions: ApplicationStatus[] = [
  "PENDING",
  "ADMINISTRATION",
  "INTERVIEW",
  "MEMBER",
  "NOT_SELECTED_ADMINISTRATION",
  "NOT_SELECTED_INTERVIEW",
];

const statusLabel: Record<ApplicationStatus, string> = {
  PENDING: "Pending",
  ADMINISTRATION: "Administrasi",
  INTERVIEW: "Wawancara",
  MEMBER: "Member",
  NOT_SELECTED_ADMINISTRATION: "Tidak lolos administrasi",
  NOT_SELECTED_INTERVIEW: "Tidak lolos wawancara",
};

const statusTone: Record<ApplicationStatus, string> = {
  PENDING: "pending",
  ADMINISTRATION: "administration",
  INTERVIEW: "interview",
  MEMBER: "member",
  NOT_SELECTED_ADMINISTRATION: "not-selected",
  NOT_SELECTED_INTERVIEW: "not-selected",
};

const acceptancePriorityLabel: Record<AcceptancePriority, string> = {
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
  NOT_RECOMMENDED: "Tidak Relevan",
};

const buildApplicationsUrl = (page: number, limit: number, query: string, statusFilter: "ALL" | ApplicationStatus, divisionFilter: DivisionFilter, subDivisionFilter: string) => {
  const url = new URL(`${API_BASE}/applications`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  if (query.trim()) url.searchParams.set("q", query.trim());
  if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
  if (divisionFilter !== "ALL") url.searchParams.set("wing", divisionFilter);
  if (subDivisionFilter !== "ALL") url.searchParams.set("division", subDivisionFilter);
  return url.toString();
};

const buildSummaryUrl = (query: string, divisionFilter: DivisionFilter, subDivisionFilter: string) => {
  const url = new URL(`${API_BASE}/applications/summary`);
  if (query.trim()) url.searchParams.set("q", query.trim());
  if (divisionFilter !== "ALL") url.searchParams.set("wing", divisionFilter);
  if (subDivisionFilter !== "ALL") url.searchParams.set("division", subDivisionFilter);
  return url.toString();
};

const buildExportUrl = (query: string, statusFilter: "ALL" | ApplicationStatus, divisionFilter: DivisionFilter, subDivisionFilter: string) => {
  const url = new URL(`${API_BASE}/applications/export`);
  if (query.trim()) url.searchParams.set("q", query.trim());
  if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
  if (divisionFilter !== "ALL") url.searchParams.set("wing", divisionFilter);
  if (subDivisionFilter !== "ALL") url.searchParams.set("division", subDivisionFilter);
  return url.toString();
};

const fetchApplications = async (
  page: number,
  limit: number,
  query: string,
  statusFilter: "ALL" | ApplicationStatus,
  divisionFilter: DivisionFilter,
  subDivisionFilter: string,
): Promise<{ applications: RecruitmentApplication[]; pagination: PaginationData }> => {
  const response = await fetch(buildApplicationsUrl(page, limit, query, statusFilter, divisionFilter, subDivisionFilter), { credentials: "include" });
  const result = (await response.json()) as ApplicationListResponse;
  if (!response.ok) throw new Error(result.error ?? "Gagal memuat data pendaftar");
  return {
    applications: result.applications ?? [],
    pagination: result.pagination ?? { page, limit, total: 0, totalPages: 1 },
  };
};

const fetchStatusCounts = async (query: string, divisionFilter: DivisionFilter, subDivisionFilter: string): Promise<StatusCounts> => {
  const response = await fetch(buildSummaryUrl(query, divisionFilter, subDivisionFilter), { credentials: "include" });
  const result = (await response.json()) as ApplicationSummaryResponse;
  if (!response.ok) throw new Error(result.error ?? "Gagal memuat ringkasan pendaftar");
  return { ...emptyStatusCounts(), ...result.statusCounts };
};

const readableFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

function Mark() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>;
}

function App() {
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState("");
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(emptyStatusCounts);
  const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [errorMessage, setErrorMessage] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>("ALL");
  const [divisionFilter, setDivisionFilter] = useState<DivisionFilter>("ALL");
  const [subDivisionFilter, setSubDivisionFilter] = useState("ALL");
  const [updatingNrp, setUpdatingNrp] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<RecruitmentApplication | null>(null);
  const [scoreDraft, setScoreDraft] = useState<ApplicationScore | null>(null);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [isSavingPriority, setIsSavingPriority] = useState(false);

  const scoreCriteria: { key: keyof Omit<ApplicationScore, "total">; label: string; max: number }[] = [
    { key: "idea", label: "Ide", max: 30 },
    { key: "relevance", label: "Kerelevanan", max: 20 },
    { key: "skills_experience_achievements", label: "Skill, pengalaman & prestasi relevan", max: 20 },
    { key: "identity_contact", label: "Nama, alamat & kontak", max: 5 },
    { key: "portfolio", label: "Portofolio", max: 15 },
  ];

  const loadApplications = async (targetPage = pagination.page) => {
    setIsRefreshing(true);
    setErrorMessage("");
    try {
      const [result, statusCounts] = await Promise.all([
        fetchApplications(targetPage, pagination.limit, query, statusFilter, divisionFilter, subDivisionFilter),
        fetchStatusCounts(query, divisionFilter, subDivisionFilter),
      ]);
      setApplications(result.applications);
      setStatusCounts(statusCounts);
      setPagination(result.pagination);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal memuat data pendaftar");
      throw error;
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin-session`, { credentials: "include" });
        setIsAuthenticated(response.ok);
      } finally {
        setIsBooting(false);
      }
    };
    void verifySession();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadApplications(pagination.page).catch((error) => {
      if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) void handleLogout();
    });
  }, [isAuthenticated, pagination.page, statusFilter, query, divisionFilter, subDivisionFilter]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = adminTokenInput.trim();
    if (!token) {
      setErrorMessage("Admin token wajib diisi.");
      return;
    }
    setIsLoggingIn(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/admin-session`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Login gagal");
      setAdminTokenInput("");
      setIsAuthenticated(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login gagal");
      setIsAuthenticated(false);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/admin-session`, { method: "DELETE", credentials: "include" }).catch(() => undefined);
    setIsAuthenticated(false);
    setAdminTokenInput("");
    setApplications([]);
    setStatusCounts(emptyStatusCounts());
    setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    setQueryInput("");
    setQuery("");
    setStatusFilter("ALL");
    setDivisionFilter("ALL");
    setSubDivisionFilter("ALL");
    setErrorMessage("");
    setSelectedApplication(null);
  };

  const handleExport = async () => {
    if (!isAuthenticated) return;
    setIsExporting(true);
    setErrorMessage("");
    try {
      const response = await fetch(buildExportUrl(query, statusFilter, divisionFilter, subDivisionFilter), { credentials: "include" });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Gagal mengekspor spreadsheet");
      }
      const blob = await response.blob();
      const filename = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/i)?.[1]
        ?? `caksa-recruitment-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengekspor spreadsheet");
    } finally {
      setIsExporting(false);
    }
  };

  const openApplication = (application: RecruitmentApplication) => {
    setSelectedApplication(application);
    setScoreDraft({
      idea: application.idea_score ?? null,
      relevance: application.relevance_score ?? null,
      skills_experience_achievements: application.skills_experience_achievements_score ?? null,
      identity_contact: application.identity_contact_score ?? null,
      portfolio: application.portfolio_score ?? null,
      total: application.total_score ?? null,
    });
  };

  const handleScoreUpdate = async () => {
    if (!isAuthenticated || !selectedApplication || !scoreDraft || scoreCriteria.some(({ key }) => scoreDraft[key] === null)) return;
    setIsSavingScore(true);
    setErrorMessage("");
    setNoticeMessage("");
    try {
      const response = await fetch(`${API_BASE}/applications/${encodeURIComponent(selectedApplication.nrp)}/score`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoreDraft),
      });
      const result = await response.json() as { error?: string; updated_at?: string; idea_score?: number; relevance_score?: number; skills_experience_achievements_score?: number; identity_contact_score?: number; portfolio_score?: number; total_score?: number };
      if (!response.ok) throw new Error(result.error ?? "Gagal menyimpan penilaian");
      const updated = { ...selectedApplication, ...result };
      setSelectedApplication(updated);
      setScoreDraft({ idea: result.idea_score ?? null, relevance: result.relevance_score ?? null, skills_experience_achievements: result.skills_experience_achievements_score ?? null, identity_contact: result.identity_contact_score ?? null, portfolio: result.portfolio_score ?? null, total: result.total_score ?? null });
      setApplications((items) => items.map((item) => item.nrp === updated.nrp ? updated : item));
      setNoticeMessage("Penilaian kandidat berhasil disimpan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan penilaian");
    } finally {
      setIsSavingScore(false);
    }
  };

  const handleAcceptancePriorityUpdate = async (acceptancePriority: AcceptancePriority | null) => {
    if (!isAuthenticated || !selectedApplication || selectedApplication.division_code !== "electrical") return;
    setIsSavingPriority(true);
    setErrorMessage("");
    setNoticeMessage("");
    try {
      const response = await fetch(`${API_BASE}/applications/${encodeURIComponent(selectedApplication.nrp)}/acceptance-priority`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptancePriority }),
      });
      const result = await response.json() as { error?: string; acceptance_priority?: AcceptancePriority | null; updated_at?: string };
      if (!response.ok) throw new Error(result.error ?? "Gagal menyimpan prioritas penerimaan");
      const updated = { ...selectedApplication, acceptance_priority: result.acceptance_priority ?? null, updated_at: result.updated_at ?? selectedApplication.updated_at };
      setSelectedApplication(updated);
      setApplications((items) => items.map((item) => item.nrp === updated.nrp ? updated : item));
      setNoticeMessage("Prioritas penerimaan berhasil disimpan.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan prioritas penerimaan");
    } finally {
      setIsSavingPriority(false);
    }
  };

  const handleStatusUpdate = async (nrp: string, status: ApplicationStatus) => {
    if (!isAuthenticated) return;
    setUpdatingNrp(nrp);
    setErrorMessage("");
    setNoticeMessage("");
    try {
      const response = await fetch(`${API_BASE}/applications/${encodeURIComponent(nrp)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { nrp?: string; draft_status?: ApplicationStatus; error?: string };
      if (!response.ok || result.nrp !== nrp || !result.draft_status) throw new Error(result.error ?? "Gagal menyimpan keputusan");
      setApplications((items) => items.map((item) => item.nrp === nrp ? { ...item, draft_status: result.draft_status!, updated_at: new Date().toISOString() } : item));
      setSelectedApplication((item) => item && item.nrp === nrp ? { ...item, draft_status: result.draft_status!, updated_at: new Date().toISOString() } : item);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menyimpan keputusan");
    } finally {
      setUpdatingNrp("");
    }
  };

  const handlePublishStatuses = async () => {
    if (!isAuthenticated || !window.confirm("Terbitkan seluruh keputusan yang sudah disiapkan? Status peserta akan diperbarui sekaligus dan tidak dapat dibatalkan dari sini.")) return;
    setIsPublishing(true);
    setErrorMessage("");
    setNoticeMessage("");
    try {
      const response = await fetch(`${API_BASE}/applications/publish-statuses`, { method: "POST", credentials: "include" });
      const result = (await response.json()) as { published?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Gagal menerbitkan keputusan");
      setNoticeMessage(`${result.published ?? 0} keputusan berhasil diterbitkan serentak.`);
      await loadApplications(pagination.page);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal menerbitkan keputusan");
    } finally {
      setIsPublishing(false);
    }
  };

  const activeStatus = (application: RecruitmentApplication): ApplicationStatus => application.draft_status ?? application.status;

  if (isBooting) {
    return <main className="boot-screen"><span className="pulse-dot" />Menyiapkan ruang operasi CAKSA</main>;
  }

  if (!isAuthenticated) {
    return (
      <main className="login-page">
        <div className="login-grid" aria-hidden="true" />
        <section className="login-shell">
          <aside className="login-intro">
            <div className="brand"><Mark /><span>CAKSA <b>/ OPS</b></span></div>
            <div className="intro-copy">
              <p className="eyebrow light">Recruitment Control</p>
              <h1>Seleksi dimulai dari pandangan yang jernih.</h1>
              <p>Ruang kendali untuk memantau setiap kandidat dan menggerakkan proses rekrutmen CAKSA dengan presisi.</p>
            </div>
            <div className="flight-coordinates"><span>07°16′S / 112°47′E</span><span>PENS · SURABAYA</span></div>
          </aside>
          <form onSubmit={handleLogin} className="login-form">
            <p className="eyebrow">Admin access</p>
            <h2>Masuk ke ruang kendali</h2>
            <p className="form-lead">Gunakan token admin untuk mengakses data seleksi.</p>
            <label htmlFor="admin-token">Admin token</label>
            <input id="admin-token" type="password" value={adminTokenInput} onChange={(event) => setAdminTokenInput(event.target.value)} placeholder="Masukkan ADMIN_API_TOKEN" autoComplete="off" required />
            {errorMessage && <p className="alert" role="alert">{errorMessage}</p>}
            <button className="primary-button" type="submit" disabled={isLoggingIn}>{isLoggingIn ? "Memeriksa akses…" : "Buka dashboard"}<span aria-hidden="true">↗</span></button>
            <p className="security-note">Token hanya digunakan untuk membuat sesi aman dan tidak disimpan di browser.</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><Mark /><span>CAKSA <b>/ OPS</b></span></div>
          <div className="topbar-meta"><span className="live-indicator"><i />Sistem aktif</span><span className="desktop-only">Recruitment 2025</span><button className="logout-button" type="button" onClick={() => void handleLogout()}>Keluar</button></div>
        </div>
      </header>
      <div className="dashboard-shell">
        <section className="page-heading">
          <div><p className="eyebrow">Candidate overview</p><h1>Ruang seleksi.</h1><p>Kelola perjalanan kandidat CAKSA dari satu panel yang ringkas dan terarah.</p></div>
          <div className="heading-actions"><button className="secondary-button" type="button" onClick={() => void loadApplications(pagination.page)} disabled={isRefreshing || isPublishing}>{isRefreshing ? "Memuat…" : "Muat ulang"}</button><button className="publish-button" type="button" onClick={() => void handlePublishStatuses()} disabled={isPublishing || isRefreshing}>{isPublishing ? "Menerbitkan…" : "Terbitkan keputusan"}</button><button className="primary-button compact" type="button" onClick={() => void handleExport()} disabled={isExporting || isRefreshing || isPublishing}>{isExporting ? "Mengekspor…" : "Export .xlsx"}<span aria-hidden="true">↓</span></button></div>
        </section>

        <section className="metrics" aria-label="Ringkasan pendaftar">
          <article className="metric-card metric-total"><p>Total kandidat</p><strong>{pagination.total}</strong><span>Halaman {pagination.page} dari {pagination.totalPages}</span></article>
          {statusOptions.map((status) => <article className={`metric-card ${statusTone[status]}`} key={status}><p>{statusLabel[status]}</p><strong>{statusCounts[status]}</strong><span>{status === "MEMBER" ? "kandidat terpilih" : "seluruh kandidat"}</span></article>)}
        </section>

        <section className="data-panel">
          <div className="panel-toolbar">
            <div className="panel-title"><p className="eyebrow">Manifest</p><h2>Daftar pendaftar</h2></div>
            <div className="filters">
              <label className="search-field"><span aria-hidden="true">⌕</span><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { setPagination((item) => ({ ...item, page: 1 })); setQuery(queryInput); } }} placeholder="Cari nama, NRP, email, atau prodi" /></label>
              <select value={statusFilter} onChange={(event) => { setPagination((item) => ({ ...item, page: 1 })); setStatusFilter(event.target.value as "ALL" | ApplicationStatus); }} aria-label="Filter status"><option value="ALL">Semua status</option>{statusOptions.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select>
              <select value={divisionFilter} onChange={(event) => { setPagination((item) => ({ ...item, page: 1 })); setDivisionFilter(event.target.value as DivisionFilter); setSubDivisionFilter("ALL"); }} aria-label="Filter divisi"><option value="ALL">Semua divisi</option>{divisionOptions.map((division) => <option key={division.value} value={division.value}>{division.label}</option>)}</select>
              <select value={subDivisionFilter} onChange={(event) => { setPagination((item) => ({ ...item, page: 1 })); setSubDivisionFilter(event.target.value); }} aria-label="Filter sub-divisi" disabled={divisionFilter === "ALL"}><option value="ALL">Semua sub-divisi</option>{divisionFilter !== "ALL" && subDivisionOptions[divisionFilter].map((division) => <option key={division.value} value={division.value}>{division.label}</option>)}</select>
              <button className="filter-button" type="button" onClick={() => { setPagination((item) => ({ ...item, page: 1 })); setQuery(queryInput); }}>Terapkan</button>
            </div>
          </div>
          {errorMessage && <p className="alert panel-alert" role="alert">{errorMessage}</p>}
          {noticeMessage && <p className="notice panel-alert" role="status">{noticeMessage}</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>NRP</th>
                  <th>Kandidat</th>
                  <th>Akademik</th>
                  <th>Wing / divisi</th>
                  <th>Dokumen</th>
                  <th>Status</th>
                  <th>Prioritas</th>
                  <th>Didaftarkan</th>
                </tr>
              </thead>
              <tbody>
            {applications.map((application) => <tr key={application.id} onClick={() => openApplication(application)}><td className="nrp">{application.nrp}</td><td><strong>{application.full_name}</strong><span>{application.email}</span></td><td><strong>{application.degree_level_code}</strong><span>{application.study_program_code} · {application.batch_year}</span></td><td><strong>{application.interested_wing_code}</strong><span>{application.division_code}</span></td><td><span className="file-count">{application.file_metadata?.length ?? 0} berkas</span></td><td><select className={`status-select ${statusTone[activeStatus(application)]}`} value={activeStatus(application)} onChange={(event) => { event.stopPropagation(); void handleStatusUpdate(application.nrp, event.target.value as ApplicationStatus); }} onClick={(event) => event.stopPropagation()} disabled={updatingNrp === application.nrp}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select>{application.draft_status && <small className="draft-label">Draft · belum diumumkan</small>}{updatingNrp === application.nrp && <small>Memperbarui…</small>}</td><td>{application.division_code === "electrical" ? application.acceptance_priority ? acceptancePriorityLabel[application.acceptance_priority] : "Belum diatur" : "—"}</td><td className="date-cell">{new Date(application.created_at).toLocaleString("id-ID")}</td></tr>)}
          </tbody></table></div>
          {applications.length === 0 && <p className="empty-state">Belum ada pendaftar yang cocok dengan filter ini.</p>}
          <footer className="panel-footer"><p>Menampilkan <b>{applications.length}</b> dari <b>{pagination.total}</b> kandidat</p><div className="pagination"><button type="button" disabled={pagination.page <= 1 || isRefreshing} onClick={() => setPagination((item) => ({ ...item, page: item.page - 1 }))}>Sebelumnya</button><span>{pagination.page} / {pagination.totalPages}</span><button type="button" disabled={pagination.page >= pagination.totalPages || isRefreshing} onClick={() => setPagination((item) => ({ ...item, page: item.page + 1 }))}>Berikutnya</button></div></footer>
        </section>
      </div>

      {selectedApplication &&
        <div className="modal-backdrop" onClick={() => setSelectedApplication(null)}>
          <aside className="detail-panel" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="detail-name">
            <header>
              <div>
                <p className="eyebrow">Candidate file</p>
                <h2 id="detail-name">{selectedApplication.full_name}</h2>
                <span className="detail-nrp">{selectedApplication.nrp}</span>
              </div>
              <button type="button" className="close-button" onClick={() => setSelectedApplication(null)} aria-label="Tutup detail">×</button>
            </header>
            <div className="detail-content">
              <section className="detail-status">
                <label htmlFor="detail-status">Keputusan seleksi</label>
                <select id="detail-status" className={`status-select ${statusTone[activeStatus(selectedApplication)]}`} value={activeStatus(selectedApplication)} onChange={(event) => void handleStatusUpdate(selectedApplication.nrp, event.target.value as ApplicationStatus)} disabled={updatingNrp === selectedApplication.nrp}>{statusOptions.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                </select>{selectedApplication.draft_status && <p className="draft-label">Tersimpan sebagai draft dan belum terlihat oleh peserta.</p>}
              </section>
              {selectedApplication.division_code === "electrical" && <section className="detail-status">
                <label htmlFor="acceptance-priority">Prioritas penerimaan</label>
                <select id="acceptance-priority" className="status-select" value={selectedApplication.acceptance_priority ?? ""} onChange={(event) => void handleAcceptancePriorityUpdate(event.target.value === "" ? null : event.target.value as AcceptancePriority)} disabled={isSavingPriority}>
                  <option value="">Belum diatur</option>
                  {Object.entries(acceptancePriorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </section>}
              <div className="detail-grid">
                <section>
                  <h3>Kontak</h3>
                  <p>{selectedApplication.email}</p>
                  <p>NRP · {selectedApplication.nrp}</p>
                </section>
                <section>
                  <h3>Akademik</h3>
                  <p>{selectedApplication.degree_level_code}</p>
                  <p>{selectedApplication.study_program_code} · {selectedApplication.batch_year}</p>
                </section>
                <section>
                  <h3>Penempatan</h3>
                  <p>Divisi · {selectedApplication.interested_wing_code}</p>
                  <p>Subivisi · {selectedApplication.division_code}</p></section><section><h3>Waktu</h3>
                  <p>Masuk · {new Date(selectedApplication.created_at).toLocaleString("id-ID")}</p>
                  <p>Update · {new Date(selectedApplication.updated_at).toLocaleString("id-ID")}</p>
                </section>
              </div>
              <section className="document-list">
                <h3>Dokumen <span>{selectedApplication.file_metadata?.length ?? 0}</span>
                </h3>{(selectedApplication.file_metadata ?? []).length === 0 && <p className="no-documents">Tidak ada dokumen yang dilampirkan.</p>}{(selectedApplication.file_metadata ?? []).map((file) => <article key={`${file.fieldName}-${file.originalName}`}><div><strong>{file.fieldName}</strong>{file.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.originalName}</a> : <span>{file.originalName}</span>}</div><small>{file.mimeType} · {readableFileSize(file.size)}</small></article>)}
              </section>
              <section className="score-card">
                <div className="score-heading"><div><p className="eyebrow">Candidate assessment</p><h3>Penilaian kandidat</h3></div><strong>{scoreDraft && scoreCriteria.every(({ key }) => scoreDraft[key] !== null) ? scoreCriteria.reduce((total, { key }) => total + (scoreDraft[key] ?? 0), 0) : "—"}<small>/ 90</small></strong></div>
                <div className="score-fields">{scoreCriteria.map(({ key, label, max }) => <label key={key}><span>{label}<small>0–{max}</small></span><input type="number" min="0" max={max} value={scoreDraft?.[key] ?? ""} onChange={(event) => setScoreDraft((current) => current ? { ...current, [key]: event.target.value === "" ? null : Number(event.target.value), total: null } : current)} /></label>)}</div>
                <button className="primary-button score-save" type="button" onClick={() => void handleScoreUpdate()} disabled={isSavingScore || !scoreDraft || scoreCriteria.some(({ key }) => scoreDraft[key] === null)}>{isSavingScore ? "Menyimpan…" : "Simpan penilaian"}</button>
              </section>
              <section className="document-list">
                <h3>Link Portfolio</h3>
                <a target="_blank" rel="noreferrer" href={selectedApplication.portfolio_url} className="text-sm">{selectedApplication?.portfolio_url ?? '-'}</a>
              </section>
              <section className="document-list">
                <h3>Special Task</h3>
                <a target="_blank" rel="noreferrer" href={selectedApplication.special_task_url} className="text-sm">{selectedApplication?.special_task_url ?? '-'}</a>
              </section>
            </div>
          </aside>
        </div>}
    </main>
  );
}

export default App;
