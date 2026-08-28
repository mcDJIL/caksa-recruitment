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
    interestedWing: string;
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
                    data.interestedWing,                // J
                    data.division,                      // K
                    data.curriculumVitaeUrl,            // L
                    data.essayOrMotivationLetterUrl,    // M
                    data.parentPermissionLetterUrl,     // N
                    data.portfolioUrl,                  // O
                    data.specialTaskUrl,                // P

                    '', // Q - Ide
                    '', // R - Kerelevanan
                    '', // S - Skill/Pengalaman/Prestasi
                    '', // T - Nama, Alamat, Kontak
                    '', // U - Portofolio
                    '', // V - Additional Doc
                    '', // W - Portofolio (Jika Ada)
                    '', // X - Jumlah Poin

                    data.status, // Y - Status

                    '', // Z - Noted
                ],
            ],
        },
    });
};
