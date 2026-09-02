const express = require('express');
const sgMail = require('@sendgrid/mail');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

const PORT = process.env.PORT || 3001;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

app.post('/upload', async (req, res) => {
  try {
    const { videos } = req.body;

    if (!videos || !Array.isArray(videos)) {
      return res.status(400).json({ error: 'No videos provided' });
    }

    const recipientEmail = process.env.RECIPIENT_EMAIL;
    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email not configured' });
    }

    const timestamp = new Date().toLocaleString();
    const subject = `Interview Recordings - ${timestamp}`;

    // Create attachments from videos
    const attachments = videos.map((video, index) => ({
      content: video.data,
      filename: `Question_${index + 1}_Answer.webm`,
      type: 'video/webm',
      disposition: 'attachment'
    }));

    const msg = {
      to: recipientEmail,
      from: 'tradingtellus@gmail.com',
      subject: subject,
      text: `Interview recordings submitted at ${timestamp}\n\n${videos.length} video(s) attached.`,
      html: `<h2>Interview Recordings Received</h2><p>Submitted at: ${timestamp}</p><p>${videos.length} video(s) have been attached to this email.</p>`,
      attachments: attachments
    };

    await sgMail.send(msg);

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
