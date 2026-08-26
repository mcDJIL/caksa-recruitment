import crypto from 'node:crypto';
import { randomBytes } from 'node:crypto';
import ExcelJS from 'exceljs';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { requireAdmin } from '../lib/adminSession.js';
import { deleteDriveFiles, uploadFilesToDrive } from '../lib/googleDrive.js';
import { supabase } from '../lib/supabase.js';
import { appendApplicationToSheet } from '../lib/googleSheets.js';

const router = express.Router();
const MAX_FILE_SIZE = 30 * 1024 * 1024;
const allowedFileFields = new Set([
  'curriculumVitae',
  'essay',
  'parentPermissionLetter',
  'motivationLetter',
]);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 8, fileSize: MAX_FILE_SIZE, fields: 30, fieldSize: 20_000 },
  fileFilter: (_request, file, callback) => {
    callback(null, allowedFileFields.has(file.fieldname) && allowedMimeTypes.has(file.mimetype));
  },
});

type UploadedFile = Express.Multer.File;

class ApplicationValidationError extends Error {}

type ApplicationStatus =
  | 'PENDING'
  | 'ADMINISTRATION'
  | 'INTERVIEW'
  | 'MEMBER'
  | 'NOT_SELECTED_ADMINISTRATION'
  | 'NOT_SELECTED_INTERVIEW';

const applicationStatuses: ApplicationStatus[] = [
  'PENDING',
  'ADMINISTRATION',
  'INTERVIEW',
  'MEMBER',
  'NOT_SELECTED_ADMINISTRATION',
  'NOT_SELECTED_INTERVIEW',
];

const requiredString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApplicationValidationError(`${field} is required`);
  }
  return value.trim();
};

const applicationCode = (): string => `CAKSA-26-${Math.floor(Math.random() * 1000) + 1}`;

const trackingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const normalizeNrp = (value: string | string[]): string =>
  (Array.isArray(value) ? value[0] : value).trim().toUpperCase();

const hasFile = (files: UploadedFile[], fieldName: string): boolean =>
  files.some((file) => file.fieldname === fieldName);

const parsedQueryString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const parsedPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const escapedForIlike = (value: string): string =>
  value.replace(/,/g, ' ').replace(/[\\%_]/g, (char) => `\\${char}`);

const safeSpreadsheetValue = (value: string | number | boolean | null | undefined) =>
  typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;

const statusFromQuery = (value: unknown): ApplicationStatus | null => {
  const normalized = parsedQueryString(value).toUpperCase();
  if (!normalized) return null;
  return applicationStatuses.includes(normalized as ApplicationStatus)
    ? (normalized as ApplicationStatus)
    : null;
};

const isGoogleDocsOrDriveUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'drive.google.com' || parsed.hostname === 'docs.google.com') &&
      parsed.pathname.length > 1
    );
  } catch {
    return false;
  }
};

const validateApplicationRequirements = (body: Record<string, unknown>, files: UploadedFile[]) => {
  const interestedWing = body.interestedWing;
  const division = body.division;
  const technicalDivisions = ['Electrical', 'Mechanical', 'Programming', 'Research & Development'];
  const nonTechnicalDivisions = ['Administration', 'Branding', 'Public Relations', 'Project Management'];
  const requiresTechnicalDocuments = interestedWing === 'Technical';

  if (
    (interestedWing !== 'Technical' && interestedWing !== 'Non-Technical') ||
    (interestedWing === 'Technical' && !technicalDivisions.includes(String(division))) ||
    (interestedWing === 'Non-Technical' && !nonTechnicalDivisions.includes(String(division)))
  ) {
    throw new ApplicationValidationError('Invalid wing or division');
  }

  if (
    !hasFile(files, 'curriculumVitae') ||
    !isGoogleDocsOrDriveUrl(String(body.portfolioUrl ?? ''))
  ) {
    throw new ApplicationValidationError('CV and a valid portfolio link are required');
  }

  if (requiresTechnicalDocuments) {
    if (!hasFile(files, 'essay') || !hasFile(files, 'parentPermissionLetter')) {
      throw new ApplicationValidationError('Essay and parent permission letter files are required');
    }
    return;
  }

  if (!hasFile(files, 'motivationLetter') || !hasFile(files, 'parentPermissionLetter')) {
    throw new ApplicationValidationError('Motivation letter and parent permission letter files are required');
  }

  if (division === 'Administration' || division === 'Branding') {
    if (!isGoogleDocsOrDriveUrl(String(body.specialTaskUrl ?? ''))) {
      throw new ApplicationValidationError('A valid special task link is required');
    }
  }
};

const findReferenceCodes = async (body: Record<string, unknown>) => {
  const degreeLevelCode = requiredString(body.degreeLevel, 'degreeLevel');
  const studyProgramCode = requiredString(body.studyProgram, 'studyProgram');
  const batchYear = Number(requiredString(body.batch, 'batch'));
  const interestedWingCode = requiredString(body.interestedWing, 'interestedWing') === 'Technical'
    ? 'technical'
    : 'non-technical';
  const divisionName = requiredString(body.division, 'division');

  const [{ data: degree }, { data: program }, { data: batch }, { data: wing }, { data: division }] = await Promise.all([
    supabase.from('degree_levels').select('code, name').eq('code', degreeLevelCode).maybeSingle(),
    supabase.from('study_programs').select('code, name').eq('code', studyProgramCode).maybeSingle(),
    supabase.from('recruitment_batches').select('year').eq('year', batchYear).eq('is_open', true).maybeSingle(),
    supabase.from('interested_wings').select('code').eq('code', interestedWingCode).maybeSingle(),
    supabase.from('divisions').select('code').eq('name', divisionName).eq('interested_wing_code', interestedWingCode).maybeSingle(),
  ]);

  if (!degree) throw new ApplicationValidationError(`Degree level "${degreeLevelCode}" not found`);
  if (!program) throw new ApplicationValidationError(`Study program "${studyProgramCode}" not found`);
  if (!batch) throw new ApplicationValidationError(`Batch ${batchYear} is not open or invalid`);
  if (!wing) throw new ApplicationValidationError(`Wing "${interestedWingCode}" not found`);
  if (!division) throw new ApplicationValidationError(`Division "${divisionName}" not found for wing "${interestedWingCode}"`);

  return {
    degreeLevelCode: degree.code,
    studyProgramCode: program.code,
    studyProgramName: program.name,
    batchYear: batch.year,
    interestedWingCode: wing.code,
    divisionCode: division.code,
  };
};

router.post(
  '/',
  upload.any(),
  async (request, response, next) => {
    const files = (request.files ?? []) as UploadedFile[];

    const uploadedDriveFileIds: string[] = [];

    try {
      // =====================================================
      // BODY
      // =====================================================

      const body =
        request.body as Record<string, unknown>;

      const batch = requiredString(
        body.batch,
        'batch',
      );

      const email = requiredString(
        body.email,
        'email',
      ).toLowerCase();

      const fullName = requiredString(
        body.fullName,
        'fullName',
      );

      const nrp = requiredString(
        body.nrp,
        'nrp',
      );

      const instagram = requiredString(
        body.instagram,
        'instagram',
      );

      const referralSource = requiredString(
        body.referralSource,
        'referralSource',
      );

      const whyCaksa = requiredString(
        body.whyCaksa,
        'whyCaksa',
      );

      const interestedWing = requiredString(
        body.interestedWing,
        'interestedWing',
      );

      const division = requiredString(
        body.division,
        'division',
      );

      const degreeLevel = requiredString(
        body.degreeLevel,
        'degreeLevel',
      );

      const studyProgram = requiredString(
        body.studyProgram,
        'studyProgram',
      );

      const portfolioUrl = requiredString(
        body.portfolioUrl,
        'portfolioUrl',
      );

      // =====================================================
      // BASIC VALIDATION
      // =====================================================

      if (!email.includes('@')) {
        response.status(400).json({
          error: 'Invalid email',
        });

        return;
      }

      if (!/^\d{4}$/.test(batch)) {
        response.status(400).json({
          error: 'Invalid batch',
        });

        return;
      }

      // =====================================================
      // SPECIAL TASK URL
      // =====================================================

      const requiresSpecialTask =
        interestedWing === 'Non-Technical' &&
        (
          division === 'Administration' ||
          division === 'Branding'
        );

      const specialTaskUrl =
        requiresSpecialTask
          ? requiredString(
            body.specialTaskUrl,
            'specialTaskUrl',
          )
          : null;

      // =====================================================
      // FILE VALIDATION
      // =====================================================

      const allowedFileFields = new Set([
        'curriculumVitae',
        'parentPermissionLetter',
        'essay',
        'motivationLetter',
      ]);

      if (
        files.some(
          (file) =>
            !allowedFileFields.has(
              file.fieldname,
            ) ||
            !allowedMimeTypes.has(
              file.mimetype,
            ),
        )
      ) {
        response.status(400).json({
          error:
            'Unsupported file field or type',
        });

        return;
      }

      // =====================================================
      // APPLICATION REQUIREMENTS
      // =====================================================

      validateApplicationRequirements(
        body,
        files,
      );

      // =====================================================
      // DATABASE REFERENCES
      // =====================================================

      const references =
        await findReferenceCodes(body);

      // =====================================================
      // APPLICATION ID
      // =====================================================

      const id = crypto.randomUUID();

      const code = applicationCode();

      // =====================================================
      // UPLOAD FILES TO GOOGLE DRIVE
      // =====================================================

      const fileMetadata =
        await uploadFilesToDrive(
          code,
          files,
        );

      uploadedDriveFileIds.push(
        ...fileMetadata.map(
          (file) => file.driveFileId,
        ),
      );

      // =====================================================
      // GET FILE URL
      // =====================================================

      const curriculumVitaeUrl =
        fileMetadata.find(
          (file) =>
            file.fieldName ===
            'curriculumVitae',
        )?.url ?? null;

      const parentPermissionLetterUrl =
        fileMetadata.find(
          (file) =>
            file.fieldName ===
            'parentPermissionLetter',
        )?.url ?? null;

      const essayUrl =
        fileMetadata.find(
          (file) =>
            file.fieldName === 'essay',
        )?.url ?? null;

      const motivationLetterUrl =
        fileMetadata.find(
          (file) =>
            file.fieldName ===
            'motivationLetter',
        )?.url ?? null;

      // =====================================================
      // INSERT SUPABASE
      // =====================================================

      const { error } = await supabase
        .from('recruitment_applications')
        .insert({
          // -------------------------
          // ID
          // -------------------------

          id,

          application_code: code,

          // -------------------------
          // RECRUITMENT
          // -------------------------

          recruitment_year:
            Number(batch),

          batch_year:
            references.batchYear,

          // -------------------------
          // PERSONAL
          // -------------------------

          email,

          full_name:
            fullName,

          nrp,

          instagram,

          // -------------------------
          // EDUCATION
          // -------------------------

          degree_level_code:
            references.degreeLevelCode,

          study_program_code:
            references.studyProgramCode,

          // -------------------------
          // RECRUITMENT CHOICE
          // -------------------------

          interested_wing_code:
            references.interestedWingCode,

          division_code:
            references.divisionCode,

          // -------------------------
          // OTHER
          // -------------------------

          referral_source:
            referralSource,

          why_caksa:
            whyCaksa,

          portfolio_url:
            portfolioUrl,

          special_task_url:
            specialTaskUrl,

          // -------------------------
          // GOOGLE DRIVE FILES
          // -------------------------

          curriculum_vitae_url:
            curriculumVitaeUrl,

          essay_url:
            essayUrl,

          motivation_letter_url:
            motivationLetterUrl,

          parent_permission_letter_url:
            parentPermissionLetterUrl,

          // -------------------------
          // STATUS
          // -------------------------

          status:
            'PENDING',

          // -------------------------
          // FILE METADATA
          // -------------------------

          file_metadata:
            fileMetadata,
        });

      // =====================================================
      // SUPABASE ERROR
      // =====================================================

      if (error?.code === '23505') {
        throw new ApplicationValidationError('An application with this NRP already exists');
      }

      if (error) {
        throw error;
      }

      // =====================================================
      // SUCCESS
      // =====================================================

      response.status(201).json({
        applicationCode: code,
        status:
          'PENDING' satisfies ApplicationStatus,
      });

      try {
        await appendApplicationToSheet({
          timestamp: new Date().toLocaleString("sv-SE", {
              timeZone: "Asia/Jakarta",
          }).replace(" ", "T"),

          email,

          fullName,

          nrp,

          degreeLevel: degreeLevel,

          studyProgram: references.studyProgramName,

          batch: String(references.batchYear),

          instagram,

          referralSource,

          division: division,

          curriculumVitaeUrl: curriculumVitaeUrl ?? '',

          essayOrMotivationLetterUrl:
            essayUrl ??
            motivationLetterUrl ??
            '',

          parentPermissionLetterUrl:
            parentPermissionLetterUrl ?? '',

          portfolioUrl,

          specialTaskUrl:
            specialTaskUrl ?? '',

          status: 'PENDING',
        });
      } catch (sheetError) {
        console.error(
          'Failed to append application to Google Sheets:',
          sheetError,
        );
      }

    } catch (error) {
      // =====================================================
      // ROLLBACK GOOGLE DRIVE
      // =====================================================

      if (
        uploadedDriveFileIds.length > 0
      ) {
        await deleteDriveFiles(
          uploadedDriveFileIds,
        );
      }

      // =====================================================
      // CLIENT ERROR
      // =====================================================

      if (error instanceof ApplicationValidationError) {
        response.status(400).json({ error: error.message });
        return;
      }

      next(error);
    }
  },
);

router.get('/export', requireAdmin, async (request, response, next) => {
  try {
    const query = parsedQueryString(request.query.q);
    const status = statusFromQuery(request.query.status);

    let exportQuery = supabase
      .from('recruitment_applications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 4999);

    if (query) {
      const ilike = `%${escapedForIlike(query)}%`;
      exportQuery = exportQuery.or(
        `application_code.ilike.${ilike},full_name.ilike.${ilike},email.ilike.${ilike},nrp.ilike.${ilike},study_program_code.ilike.${ilike}`,
      );
    }

    if (status) {
      exportQuery = exportQuery.eq('status', status);
    }

    const { data, error } = await exportQuery;
    if (error) throw error;

    const [degreeLevelsResult, studyProgramsResult, interestedWingsResult, divisionsResult] = await Promise.all([
      supabase.from('degree_levels').select('code, name'),
      supabase.from('study_programs').select('code, name'),
      supabase.from('interested_wings').select('code, name'),
      supabase.from('divisions').select('code, name'),
    ]);

    if (degreeLevelsResult.error) throw degreeLevelsResult.error;
    if (studyProgramsResult.error) throw studyProgramsResult.error;
    if (interestedWingsResult.error) throw interestedWingsResult.error;
    if (divisionsResult.error) throw divisionsResult.error;

    const degreeLevelNameByCode = new Map((degreeLevelsResult.data ?? []).map((row) => [row.code, row.name]));
    const studyProgramNameByCode = new Map((studyProgramsResult.data ?? []).map((row) => [row.code, row.name]));
    const interestedWingNameByCode = new Map((interestedWingsResult.data ?? []).map((row) => [row.code, row.name]));
    const divisionNameByCode = new Map((divisionsResult.data ?? []).map((row) => [row.code, row.name]));

    const rows = data ?? [];
    const header = [
      'Timestamp',
      'Email Address',
      'Full Name',
      'NRP',
      'Degree Level',
      'Study Program',
      'Batch',
      'Instagram',
      'Where do you know about this Open Recruitment?',
      'Available Position (Divisions)',
      'Curriculum Vitae / Example CV Caksa',
      'Essay (Technical Division) /Motivation Letter (Non Technical Division) / Example MotLett',
      'Parent Permission Letter (Surat Izin Orang Tua) / Parent Permission Letter',
      'Google Drive Link Portfolio (Make sure to set the access into viewer)',
      'Special Task Branding and Administration Division Only (Make sure to set the access into viewer)',
      'Ide (40 poin)',
      'Kerelevanan (20 poin)',
      'Skill Pengalaman, Prestasi yang relevan (20 poin)',
      'Nama, Alamat, Kontak (5 Poin)',
      'Portofolio (5)',
      'Additional Doc (10)',
      'Portofolio (Jika Ada) 15 poin',
      'Jumlah Poin',
      'Status',
      'Noted',
    ];

    const sheetRows = rows.map((row) => {
      const degreeLevelName = degreeLevelNameByCode.get(String(row.degree_level_code)) ?? String(row.degree_level_code ?? '');
      const studyProgramName = studyProgramNameByCode.get(String(row.study_program_code)) ?? String(row.study_program_code ?? '');
      const interestedWingName = interestedWingNameByCode.get(String(row.interested_wing_code)) ?? String(row.interested_wing_code ?? '');
      const divisionName = divisionNameByCode.get(String(row.division_code)) ?? String(row.division_code ?? '');

      const essayOrMotivationUrl = row.essay_url ?? row.motivation_letter_url ?? '';
      const additionalDocumentUrls = [
        row.special_task_url,
        row.motion_graphic_video_url,
        row.design_graphic_url,
      ].filter(Boolean).join(' | ');

      return [
        row.created_at,
        row.email,
        row.full_name,
        row.nrp,
        degreeLevelName,
        studyProgramName,
        row.batch_year,
        row.instagram,
        row.referral_source,
        `${interestedWingName} / ${divisionName}`,
        row.curriculum_vitae_url ?? '',
        essayOrMotivationUrl,
        row.parent_permission_letter_url ?? '',
        row.portfolio_url,
        additionalDocumentUrls,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        row.status,
        '',
      ].map(safeSpreadsheetValue);
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CAKSA Recruitment API';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Recruitment Applications', {
      properties: {
        defaultRowHeight: 20,
      },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    worksheet.addRow(header);
    sheetRows.forEach((row) => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FF0F172A' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' },
    };

    worksheet.eachRow((row, rowNumber) => {
      row.alignment = {
        vertical: 'top',
        horizontal: rowNumber === 1 ? 'center' : 'left',
        wrapText: true,
      };
      row.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    worksheet.columns.forEach((column, index) => {
      const headerText = String(header[index] ?? '');
      let maxWidth = headerText.length;

      if (typeof column.eachCell !== 'function') {
        column.width = Math.max(14, Math.min(maxWidth + 3, 70));
        return;
      }

      column.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        let text = '';

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          text = String(value);
        } else if (value && typeof value === 'object' && 'text' in value) {
          text = String(value.text ?? '');
        }

        const length = text.length;
        if (length > maxWidth) {
          maxWidth = length;
        }
      });

      column.width = Math.max(14, Math.min(maxWidth + 3, 70));
    });

    const dateStamp = new Date().toISOString().slice(0, 10);
    const workbookBuffer = await workbook.xlsx.writeBuffer();
    const payload = Buffer.isBuffer(workbookBuffer)
      ? workbookBuffer
      : Buffer.from(workbookBuffer);

    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', `attachment; filename="caksa-recruitment-${dateStamp}.xlsx"`);
    response.send(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/:nrp', trackingRateLimit, async (request, response, next) => {
  try {
    const nrp = normalizeNrp(request.params.nrp);
    const { data, error } = await supabase
      .from('recruitment_applications')
      .select('nrp, status, updated_at')
      .eq('nrp', nrp)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      response.status(404).json({ error: 'Application not found' });
      return;
    }
    response.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/', requireAdmin, async (request, response, next) => {
  try {
    const page = parsedPositiveInteger(request.query.page, 1);
    const limit = Math.min(parsedPositiveInteger(request.query.limit, 20), 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const query = parsedQueryString(request.query.q);
    const status = statusFromQuery(request.query.status);

    let applicationsQuery = supabase
      .from('recruitment_applications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query) {
      const ilike = `%${escapedForIlike(query)}%`;
      applicationsQuery = applicationsQuery.or(
        `application_code.ilike.${ilike},full_name.ilike.${ilike},email.ilike.${ilike},nrp.ilike.${ilike},study_program_code.ilike.${ilike}`,
      );
    }

    if (status) {
      applicationsQuery = applicationsQuery.eq('status', status);
    }

    const { data, error, count } = await applicationsQuery;

    if (error) throw error;

    const total = count ?? 0;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    response.json({
      applications: data ?? [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:nrp/status', requireAdmin, async (request, response, next) => {
  try {
    const status = request.body?.status as ApplicationStatus;
    if (!applicationStatuses.includes(status)) {
      response.status(400).json({ error: 'Invalid status' });
      return;
    }

    const { data, error } = await supabase
      .from('recruitment_applications')
      .update({ status })
      .eq('nrp', normalizeNrp(request.params.nrp))
      .select('nrp, status, updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      response.status(404).json({ error: 'Application not found' });
      return;
    }
    response.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
