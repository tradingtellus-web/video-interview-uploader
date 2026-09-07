const express = require('express');
const AWS = require('aws-sdk');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const PORT = process.env.PORT || 3001;

// AWS S3 Setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Mailgun Setup
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

app.post('/upload', async (req, res) => {
  try {
    const { videos, role } = req.body;

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'No videos provided' });
    }

    const recipientEmail = process.env.RECIPIENT_EMAIL;
    const domain = process.env.MAILGUN_DOMAIN;
    const bucket = process.env.AWS_S3_BUCKET;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email not configured' });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Mailgun domain not configured' });
    }

    if (!bucket) {
      return res.status(400).json({ error: 'S3 bucket not configured' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderName = `interview-${role}-${timestamp}`;
    const downloadLinks = [];

    // Upload each video to S3
    const uploadPromises = videos.map(async (video, index) => {
      const buffer = Buffer.from(video.data, 'base64');
      const fileName = `${folderName}/Question_${index + 1}_Answer.webm`;

      const params = {
        Bucket: bucket,
        Key: fileName,
        Body: buffer,
        ContentType: 'video/webm'
      };

      return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
          if (err) {
            reject(err);
          } else {
            downloadLinks.push({
              question: index + 1,
              url: data.Location
            });
            resolve(data);
          }
        });
      });
    });

    await Promise.all(uploadPromises);

    // Create email with download links
    const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Interview';
    const subject = `${roleLabel} Interview Recordings - ${new Date().toLocaleString()}`;

    const emailBody = `
<h2>${roleLabel} Interview Recordings Received</h2>
<p>Submitted at: ${new Date().toLocaleString()}</p>
<p>${videos.length} video(s) uploaded to cloud storage. Download links below:</p>
<hr>
${downloadLinks.map(link => `
<p>
  <strong>Question ${link.question}:</strong><br>
  <a href="${link.url}">Download Video</a>
</p>
`).join('')}
<hr>
<p><em>Links will expire in 7 days.</em></p>
    `;

    const messageData = {
      from: `Interview Recorder <noreply@${domain}>`,
      to: recipientEmail,
      subject: subject,
      html: emailBody
    };

    await mg.messages.create(domain, messageData);

    res.json({
      success: true,
      message: 'Videos uploaded successfully and notification sent'
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
