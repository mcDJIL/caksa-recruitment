import { useEffect, useMemo, useState, type FormEvent } from "react";

// ---------- Types (sama seperti sebelumnya) ----------
type ApplicationStatus =
  | "PENDING"
  | "ADMINISTRATION"
  | "INTERVIEW"
  | "MEMBER"
  | "NOT_SELECTED_ADMINISTRATION"
  | "NOT_SELECTED_INTERVIEW";

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
  file_metadata?: ApplicantDocument[];
  created_at: string;
  updated_at: string;
};

type ApplicantDocument = {
  fieldName: string;
  driveFileId?: string;
  url?: string;
  path?: string;
  originalName: string;
  mimeType: string;
  size: number;
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

// ---------- Constants & Helpers ----------
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
  ADMINISTRATION: "Administration",
  INTERVIEW: "Interview",
  MEMBER: "Member",
  NOT_SELECTED_ADMINISTRATION: "Not Selected (Administration)",
  NOT_SELECTED_INTERVIEW: "Not Selected (Interview)",
};

const buildApplicationsUrl = (page: number, limit: number, query: string, statusFilter: "ALL" | ApplicationStatus) => {
  const url = new URL(`${API_BASE}/applications`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  const trimmedQuery = query.trim();
  if (trimmedQuery) url.searchParams.set("q", trimmedQuery);
  if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
  return url.toString();
};

const buildExportUrl = (query: string, statusFilter: "ALL" | ApplicationStatus) => {
  const url = new URL(`${API_BASE}/applications/export`);
  const trimmedQuery = query.trim();
  if (trimmedQuery) url.searchParams.set("q", trimmedQuery);
  if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);
  return url.toString();
};

const fetchApplications = async (
  page: number,
  limit: number,
  query: string,
  statusFilter: "ALL" | ApplicationStatus,
): Promise<{ applications: RecruitmentApplication[]; pagination: PaginationData }> => {
  const response = await fetch(buildApplicationsUrl(page, limit, query, statusFilter), {
    credentials: "include",
  });
  const result = (await response.json()) as ApplicationListResponse;
  if (!response.ok) throw new Error(result.error ?? "Failed to load applications");
  return {
    applications: result.applications ?? [],
    pagination: result.pagination ?? { page, limit, total: 0, totalPages: 1 },
  };
};

const readableFileSize = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

// ---------- Component Utama ----------
function App() {
  // State autentikasi & loading
  const [adminTokenInput, setAdminTokenInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // State data
  const [applications, setApplications] = useState<RecruitmentApplication[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [errorMessage, setErrorMessage] = useState("");

  // Filter
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ApplicationStatus>("ALL");

  // Update status
  const [updatingNrp, setUpdatingNrp] = useState("");

  // Detail modal
  const [selectedApplication, setSelectedApplication] = useState<RecruitmentApplication | null>(null);

  const loadApplications = async (targetPage = pagination.page) => {
    setIsRefreshing(true);
    setErrorMessage("");
    try {
      const result = await fetchApplications(targetPage, pagination.limit, query, statusFilter);
      setApplications(result.applications);
      setPagination(result.pagination);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load applications");
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
      if (error instanceof Error && error.message.toLowerCase().includes("unauthorized")) {
        void handleLogout();
      }
    });
  }, [isAuthenticated, pagination.page, statusFilter, query]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextToken = adminTokenInput.trim();
    if (!nextToken) {
      setErrorMessage("Admin token wajib diisi.");
      return;
    }
    setIsLoggingIn(true);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/admin-session`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${nextToken}` },
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
    setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
    setQueryInput("");
    setQuery("");
    setStatusFilter("ALL");
    setErrorMessage("");
    setSelectedApplication(null);
  };

  const handleExportCsv = async () => {
    if (!isAuthenticated) return;
    setIsExporting(true);
    setErrorMessage("");
    try {
      const response = await fetch(buildExportUrl(query, statusFilter), { credentials: "include" });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Failed to export spreadsheet");
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = filenameMatch?.[1] ?? `caksa-recruitment-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to export spreadsheet");
    } finally {
      setIsExporting(false);
    }
  };

  const handleStatusUpdate = async (nrp: string, status: ApplicationStatus) => {
    if (!isAuthenticated) return;
    setUpdatingNrp(nrp);
    setErrorMessage("");
    try {
      const response = await fetch(`${API_BASE}/applications/${encodeURIComponent(nrp)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { nrp?: string; status?: ApplicationStatus; error?: string };
      if (!response.ok || result.nrp !== nrp || !result.status) {
        throw new Error(result.error ?? "Failed to update status");
      }
      setApplications((previous) =>
        previous.map((item) =>
          item.nrp === result.nrp
            ? { ...item, status: result.status ?? item.status, updated_at: new Date().toISOString() }
            : item,
        ),
      );
      setSelectedApplication((prev) =>
        prev && prev.nrp === result.nrp
          ? { ...prev, status: result.status ?? prev.status, updated_at: new Date().toISOString() }
          : prev,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setUpdatingNrp("");
    }
  };

  const statusCount = useMemo(() => {
    return applications.reduce<Record<ApplicationStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, {
      PENDING: 0,
      ADMINISTRATION: 0,
      INTERVIEW: 0,
      MEMBER: 0,
      NOT_SELECTED_ADMINISTRATION: 0,
      NOT_SELECTED_INTERVIEW: 0,
    });
  }, [applications]);

  const canGoPrev = pagination.page > 1;
  const canGoNext = pagination.page < pagination.totalPages;

  // ---------- Render Loading Boot ----------
  if (isBooting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0f0e] p-6">
        <div className="inline-flex items-center gap-3 rounded-full border border-lime-300/20 bg-slate-900/80 px-6 py-3 text-sm tracking-[0.2em] uppercase text-lime-200">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-lime-300" />
          Initializing admin panel
        </div>
      </main>
    );
  }

  // ---------- Render Login ----------
  if (!isAuthenticated) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0b0f0e] p-6 text-slate-100 sm:p-10">
        {/* Gradient mesh background */}
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-20 top-0 h-96 w-96 rounded-full bg-lime-500/20 blur-3xl" />
          <div className="absolute right-0 bottom-0 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        <section className="relative mx-auto flex min-h-[86vh] w-full max-w-5xl items-center justify-center">
          <div className="grid w-full gap-8 rounded-[2rem] border border-lime-200/10 bg-[#111815]/90 p-8 shadow-2xl backdrop-blur sm:grid-cols-[1.1fr_0.9fr] sm:p-12">
            <aside className="space-y-6">
              <p className="text-xs font-semibold tracking-[0.25em] text-lime-300/80 uppercase">CAKSA Recruitment Ops</p>
              <h1 className="max-w-sm text-4xl leading-tight font-black tracking-tight text-white sm:text-5xl">
                Command the
                <span className="block text-lime-300">Selection Runway</span>
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-slate-300 sm:text-base">
                Panel admin CAKSA untuk memeriksa pendaftar, memfilter kandidat, dan mengubah status seleksi secara real‑time.
              </p>
              <ul className="space-y-2 text-xs text-lime-100/80 sm:text-sm">
                <li>Secure access via HTTP‑only admin session.</li>
                <li>Tracking status: Pending to Member.</li>
                <li>Optimized for desktop and mobile review.</li>
              </ul>
            </aside>

            <form onSubmit={handleLogin} className="rounded-2xl border border-lime-200/10 bg-[#0f1513] p-6">
              <label className="mb-3 block text-xs font-semibold tracking-[0.2em] text-lime-200 uppercase" htmlFor="admin-token">
                Admin token
              </label>
              <input
                id="admin-token"
                type="password"
                value={adminTokenInput}
                onChange={(event) => setAdminTokenInput(event.target.value)}
                placeholder="Masukkan ADMIN_API_TOKEN"
                className="w-full rounded-xl border border-slate-700 bg-[#0b0f0e] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/30"
                autoComplete="off"
                required
              />
              {errorMessage && (
                <p className="mt-3 rounded-lg border border-red-400/30 bg-red-900/30 px-3 py-2 text-sm font-medium text-red-300" role="alert">
                  {errorMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoggingIn ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" aria-hidden="true" />
                    Checking token...
                  </>
                ) : (
                  "Login to dashboard"
                )}
              </button>
              <p className="mt-3 text-xs text-slate-400">Token hanya dipakai saat login dan tidak disimpan di browser.</p>
            </form>
          </div>
        </section>
      </main>
    );
  }

  // ---------- Render Dashboard ----------
  return (
    <main className="relative min-h-screen bg-[#0b0f0e] p-4 text-slate-100 sm:p-7">
      {/* Gradient background */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-30">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-lime-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl rounded-[2rem] border border-lime-200/10 bg-[#111815]/90 p-4 shadow-2xl backdrop-blur sm:p-6">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 border-b border-lime-200/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] text-lime-300/80 uppercase">Admin Dashboard</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">Recruitment Control Tower</h1>
            <p className="mt-2 text-sm text-slate-300">Kelola seluruh pendaftar CAKSA dari satu panel.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void loadApplications(pagination.page)}
              disabled={isRefreshing}
              className="rounded-full border border-lime-300/35 px-4 py-2 text-sm font-semibold text-lime-200 transition hover:bg-lime-400/10 disabled:opacity-50"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => void handleExportCsv()}
              disabled={isExporting || isRefreshing}
              className="rounded-full border border-amber-300/40 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export Spreadsheet (.xlsx)"}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-full border border-red-300/40 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/10"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Stat Cards - Pills style */}
        <section className="mb-6 flex flex-wrap gap-3">
          <div className="flex-1 min-w-[150px] rounded-2xl border border-slate-700/50 bg-[#0f1513] p-4 text-center">
            <p className="text-xs tracking-[0.15em] text-slate-400 uppercase">Total Data</p>
            <p className="mt-1 text-3xl font-bold text-lime-300">{pagination.total}</p>
            <p className="text-[11px] text-slate-400">Page {pagination.page} / {pagination.totalPages}</p>
          </div>
          {statusOptions.map((status) => (
            <div key={status} className="flex-1 min-w-[120px] rounded-2xl border border-slate-700/50 bg-[#0f1513] p-4 text-center">
              <p className="text-[11px] tracking-[0.12em] text-slate-400 uppercase">{statusLabel[status]}</p>
              <p className="mt-1 text-2xl font-bold text-slate-100">{statusCount[status]}</p>
            </div>
          ))}
        </section>

        {/* Filter Section */}
        <section className="mb-5 grid gap-3 rounded-2xl border border-slate-700/50 bg-[#0f1513] p-4 md:grid-cols-[1fr_220px_auto]">
          <input
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setQuery(queryInput);
              }
            }}
            placeholder="Cari berdasarkan kode, nama, email, NRP, atau prodi"
            className="w-full rounded-xl border border-slate-700 bg-[#0b0f0e] px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/30"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setStatusFilter(event.target.value as "ALL" | ApplicationStatus);
            }}
            className="rounded-xl border border-slate-700 bg-[#0b0f0e] px-3 py-3 text-sm text-slate-100 outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/30"
          >
            <option value="ALL">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setPagination((prev) => ({ ...prev, page: 1 }));
              setQuery(queryInput);
            }}
            className="rounded-full bg-lime-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-300"
          >
            Apply
          </button>
        </section>

        {errorMessage && (
          <p className="mb-4 rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300" role="alert">
            {errorMessage}
          </p>
        )}

        {/* Table Section */}
        <section className="overflow-hidden rounded-2xl border border-slate-700/50">
          <div className="max-h-[68vh] overflow-auto">
            <table className="min-w-full divide-y divide-slate-700/50 text-left">
              <thead className="sticky top-0 z-10 bg-[#0f1513]/95 backdrop-blur">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">NRP</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Applicant</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Academic</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Wing / Division</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Documents</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">Applied At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {applications.map((application) => (
                  <tr
                    key={application.id}
                    onClick={() => setSelectedApplication(application)}
                    className="cursor-pointer align-top transition hover:bg-lime-400/5"
                  >
                    <td className="px-4 py-3 text-xs font-bold tracking-wide text-lime-200">{application.nrp}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-100">{application.full_name}</p>
                      <p className="text-xs text-slate-400">{application.email}</p>
                      <p className="mt-1 text-xs text-slate-500">NRP: {application.nrp}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <p>{application.degree_level_code}</p>
                      <p className="mt-1 text-slate-400">{application.study_program_code}</p>
                      <p className="mt-1 text-slate-500">Batch {application.batch_year}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <p>{application.interested_wing_code}</p>
                      <p className="mt-1 text-slate-400">{application.division_code}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] font-semibold">
                        {application.file_metadata?.length ?? 0} files
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={application.status}
                        onChange={(event) => {
                          event.stopPropagation();
                          void handleStatusUpdate(application.nrp, event.target.value as ApplicationStatus);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        disabled={updatingNrp === application.nrp}
                        className="w-full rounded-lg border border-slate-700 bg-[#0b0f0e] px-2 py-2 text-xs text-slate-100 outline-none focus:border-lime-300 disabled:opacity-60"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabel[status]}
                          </option>
                        ))}
                      </select>
                      {updatingNrp === application.nrp && (
                        <p className="mt-1 text-[11px] text-lime-200">Updating...</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{new Date(application.created_at).toLocaleString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pagination */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            Menampilkan {applications.length} data dari total {pagination.total} data.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canGoPrev || isRefreshing}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={!canGoNext || isRefreshing}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {applications.length === 0 && (
          <p className="mt-4 rounded-xl border border-slate-700/50 bg-[#0f1513] px-4 py-3 text-sm text-slate-300">
            Tidak ada data pendaftar yang cocok dengan filter saat ini.
          </p>
        )}
      </div>

      {/* Detail Modal (Slide-over) */}
      {selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApplication(null)}>
          <div
            className="h-full w-full max-w-2xl overflow-y-auto bg-[#111815] p-6 shadow-2xl border-l border-lime-200/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs tracking-[0.2em] text-lime-300/80 uppercase">Applicant Detail</p>
                <h2 className="mt-1 text-2xl font-bold text-white">{selectedApplication.full_name}</h2>
                <p className="text-sm text-slate-400">{selectedApplication.nrp}</p>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
              >
                ✕ Close
              </button>
            </div>

            {/* Status update inside modal */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-slate-300">Status:</label>
                <select
                  value={selectedApplication.status}
                  onChange={(e) => void handleStatusUpdate(selectedApplication.nrp, e.target.value as ApplicationStatus)}
                  disabled={updatingNrp === selectedApplication.nrp}
                  className="rounded-lg border border-slate-700 bg-[#0b0f0e] px-3 py-2 text-sm text-slate-100 outline-none focus:border-lime-300"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </select>
                {updatingNrp === selectedApplication.nrp && (
                  <span className="text-xs text-lime-300">Updating...</span>
                )}
              </div>

              {/* Grid informasi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Kontak</h3>
                  <p className="mt-1 text-sm text-slate-200">Email: {selectedApplication.email}</p>
                  <p className="text-sm text-slate-200">NRP: {selectedApplication.nrp}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Akademik</h3>
                  <p className="mt-1 text-sm text-slate-200">Jenjang: {selectedApplication.degree_level_code}</p>
                  <p className="text-sm text-slate-200">Prodi: {selectedApplication.study_program_code}</p>
                  <p className="text-sm text-slate-200">Batch: {selectedApplication.batch_year}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Penempatan</h3>
                  <p className="mt-1 text-sm text-slate-200">Wing: {selectedApplication.interested_wing_code}</p>
                  <p className="text-sm text-slate-200">Divisi: {selectedApplication.division_code}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Waktu</h3>
                  <p className="mt-1 text-sm text-slate-200">Dibuat: {new Date(selectedApplication.created_at).toLocaleString("id-ID")}</p>
                  <p className="text-sm text-slate-200">Diperbarui: {new Date(selectedApplication.updated_at).toLocaleString("id-ID")}</p>
                </div>
              </div>

              {/* Dokumen */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dokumen ({selectedApplication.file_metadata?.length ?? 0})</h3>
                <div className="mt-2 space-y-2">
                  {(selectedApplication.file_metadata ?? []).length === 0 && (
                    <p className="text-sm text-slate-500">Tidak ada dokumen.</p>
                  )}
                  {(selectedApplication.file_metadata ?? []).map((file, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-700/50 bg-[#0f1513] p-3">
                      <p className="text-sm font-semibold text-slate-200">{file.fieldName}</p>
                      {file.url ? (
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-lime-300 underline underline-offset-2 hover:text-lime-200"
                        >
                          {file.originalName}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-400">{file.originalName}</p>
                      )}
                      <p className="text-xs text-slate-500">{file.mimeType} · {readableFileSize(file.size)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
