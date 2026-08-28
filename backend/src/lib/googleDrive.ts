import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { config } from '../config.js';

const oauth2Client = new google.auth.OAuth2(
  config.googleOAuthClientId,
  config.googleOAuthClientSecret,
  config.googleOAuthRedirectUri,
);

oauth2Client.setCredentials({
  refresh_token: config.googleOAuthRefreshToken,
});

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

export type DriveFileMetadata = {
  fieldName: string;
  driveFileId: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
};

const folderIdForField = (fieldName: string): string => {
  const folderMap: Record<string, string | undefined> = {
    curriculumVitae:
      config.googleDriveFolderIds.curriculumVitae,

    essay:
      config.googleDriveFolderIds.essay,

    motivationLetter:
      config.googleDriveFolderIds.motivationLetter,

    parentPermissionLetter:
      config.googleDriveFolderIds.parentPermissionLetter,
  };

  const folderId = folderMap[fieldName];

  if (!folderId) {
    throw new Error(
      `No Google Drive folder configured for ${fieldName}`,
    );
  }

  return folderId;
};

export const uploadFilesToDrive = async (
  nrp: string,
  files: Express.Multer.File[],
): Promise<DriveFileMetadata[]> => {
  const uploads = files.map(async (file) => {
    const result = await drive.files.create({
      requestBody: {
        name: `${nrp} - ${file.originalname}`,
        parents: [folderIdForField(file.fieldname)],
      },

      media: {
        mimeType: file.mimetype,
        body: Readable.from(file.buffer),
      },

      fields: 'id,webViewLink',
    });

    const driveFileId = result.data.id;

    if (!driveFileId) {
      throw new Error(
        `Google Drive did not return a file ID for ${file.fieldname}`,
      );
    }

    return {
      fieldName: file.fieldname,
      driveFileId,
      url:
        result.data.webViewLink ??
        `https://drive.google.com/file/d/${driveFileId}/view`,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  });

  return Promise.all(uploads);
};

export const deleteDriveFiles = async (
  fileIds: string[],
): Promise<void> => {
  await Promise.allSettled(
    fileIds.map((fileId) =>
      drive.files.delete({
        fileId,
      }),
    ),
  );
};
