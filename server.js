const express = require('express');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const PORT = process.env.PORT || 3001;

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY
});

app.post('/upload', async (req, res) => {
  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'No videos provided' });
    }

    const recipientEmail = process.env.RECIPIENT_EMAIL;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email not configured' });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Mailgun domain not configured' });
    }

    const timestamp = new Date().toLocaleString();
    const subject = `Interview Recordings - ${timestamp}`;

    const messageData = {
      from: `Interview Recorder <noreply@${domain}>`,
      to: recipientEmail,
      subject: subject,
      text: `Interview recordings submitted at ${timestamp}\n\n${videos.length} video(s) attached.`,
      html: `<h2>Interview Recordings Received</h2><p>Submitted at: ${timestamp}</p><p>${videos.length} video(s) have been attached to this email.</p>`,
      attachment: []
    };

    // Add all attachments to array
    videos.forEach((video, index) => {
      const buffer = Buffer.from(video.data, 'base64');
      messageData.attachment.push({
        filename: `Question_${index + 1}_Answer.webm`,
        data: buffer
      });
    });

    await mg.messages.create(domain, messageData);

    res.json({
      success: true,
      message: 'Videos sent via email successfully'
    });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      error: 'Email failed',
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
