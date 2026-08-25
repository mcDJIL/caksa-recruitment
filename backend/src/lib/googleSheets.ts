import { google } from 'googleapis';
import { config } from '../config.js';

const oauth2Client = new google.auth.OAuth2(
    config.googleOAuthClientId,
    config.googleOAuthClientSecret,
    config.googleOAuthRedirectUri,
);

oauth2Client.setCredentials({
    refresh_token: config.googleOAuthRefreshToken,
});

const sheets = google.sheets({
    version: 'v4',
    auth: oauth2Client,
});

export type ApplicationSheetData = {
    timestamp: string;
    email: string;
    fullName: string;
    nrp: string;
    degreeLevel: string;
    studyProgram: string;
    batch: string;
    instagram: string;
    referralSource: string;
    division: string;

    curriculumVitaeUrl: string;
    essayOrMotivationLetterUrl: string;
    parentPermissionLetterUrl: string;

    portfolioUrl: string;
    specialTaskUrl: string;

    status: string;
};

export const appendApplicationToSheet = async (
    data: ApplicationSheetData,
): Promise<void> => {
    await sheets.spreadsheets.values.append({
        spreadsheetId:
            config.googleSheetsSpreadsheetId,

        range: `${config.googleSheetsSheetName}!A:Z`,

        valueInputOption: 'USER_ENTERED',

        insertDataOption: 'INSERT_ROWS',

        requestBody: {
            values: [
                [
                    data.timestamp,                    // A
                    data.email,                        // B
                    data.fullName,                     // C
                    data.nrp,                          // D
                    data.degreeLevel,                  // E
                    data.studyProgram,                 // F
                    data.batch,                        // G
                    data.instagram,                    // H
                    data.referralSource,               // I
                    data.division,                     // J
                    data.curriculumVitaeUrl,           // K
                    data.essayOrMotivationLetterUrl,   // L
                    data.parentPermissionLetterUrl,    // M
                    data.portfolioUrl,                 // N
                    data.specialTaskUrl,               // O

                    '', // P - Ide
                    '', // Q - Kerelevanan
                    '', // R - Skill/Pengalaman/Prestasi
                    '', // S - Nama, Alamat, Kontak
                    '', // T - Portofolio
                    '', // U - Special Task
                    '', // V - Portofolio (Jika Ada)
                    '', // W - Jumlah Poin

                    data.status, // X - Status

                    '', // Y - Noted

                    '', // Z - kosong
                ],
            ],
        },
    });
};