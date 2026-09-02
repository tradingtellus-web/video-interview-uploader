const express = require('express');
const { google } = require('googleapis');
const { Readable } = require('stream');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const PORT = process.env.PORT || 3001;

let googleAuth = null;
let drive = null;

function initializeGoogleAuth() {
  const serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  
  googleAuth = new google.auth.GoogleAuth({
    credentials: serviceAccountKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  drive = google.drive({ version: 'v3', auth: googleAuth });
}

initializeGoogleAuth();

app.post('/upload', async (req, res) => {
  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'No videos provided' });
    }

    const timestamp = new Date().toLocaleString();
    const folderName = `Interview Recordings - ${timestamp}`;

    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    };

    const folderRes = await drive.files.create({
      resource: folderMetadata,
      fields: 'id, webViewLink'
    });

    const folderId = folderRes.data.id;
    const folderLink = folderRes.data.webViewLink;

    const uploadPromises = videos.map(async (video, index) => {
      const base64Data = video.data;
      const buffer = Buffer.from(base64Data, 'base64');

      const fileMetadata = {
        name: `Question_${index + 1}_Answer.webm`,
        parents: [folderId]
      };

      const media = {
        mimeType: 'video/webm',
        body: Readable.from(buffer)
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      return file.data.id;
    });

    await Promise.all(uploadPromises);

    res.json({
      success: true,
      folderId: folderId,
      folderLink: folderLink,
      message: 'All videos uploaded successfully'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
