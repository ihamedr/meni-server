// === Import libraries
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

// === Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// === Middlewares
app.use(express.json());
app.use(cors({
  origin: 'https://meni-test.onrender.com',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// === Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// === Routes

// Health Check
app.get('/', (req, res) => {
  res.send('MENI Server is running...');
});

// Fetch all memes
app.get('/memes', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('resource_type:image') // Customize if needed
      .sort_by('created_at','desc')
      .max_results(50)
      .execute();

    const memes = result.resources.map(meme => ({
      id: meme.public_id,
      memeUrl: meme.secure_url,
      telegramUsername: meme.context?.custom?.telegramUsername || 'Anonymous',
      likes: parseInt(meme.context?.custom?.likes || '0'),
      votes: parseInt(meme.context?.custom?.votes || '0')
    }));

    res.json(memes);
  } catch (error) {
    console.error('Fetching memes error:', error);
    res.status(500).json({ error: 'Server error fetching memes' });
  }
});

// Check if user uploaded a meme
app.get('/check-upload/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const result = await cloudinary.search
      .expression(`context.custom.telegramId=${telegramId}`)
      .max_results(1)
      .execute();

    res.json({ uploaded: result.resources.length > 0 });
  } catch (error) {
    console.error('Cloudinary Search Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Receive upload info (optional, no actual upload here)
app.post('/upload', (req, res) => {
  const { memeUrl, title, telegramUsername, telegramId, likes, votes, uploadTime } = req.body;

  if (!memeUrl || !title || !telegramId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  console.log('New Meme Uploaded:', { title, telegramUsername, telegramId, memeUrl, likes, votes, uploadTime });
  res.json({ success: true });
});

// Like a meme
app.post('/like', async (req, res) => {
  const { telegramId, memeId } = req.body;

  if (!telegramId || !memeId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const result = await cloudinary.search
      .expression(`public_id=${memeId}`)
      .max_results(1)
      .execute();

    if (result.resources.length === 0) {
      return res.status(404).json({ success: false, message: 'Meme not found.' });
    }

    const meme = result.resources[0];
    const context = meme.context?.custom || {};

    const likes = parseInt(context.likes || '0');
    const likedBy = context.likedBy ? context.likedBy.split(',') : [];

    if (likedBy.includes(telegramId)) {
      return res.status(400).json({ success: false, message: 'You have already liked this meme.' });
    }

    likedBy.push(telegramId);

    await cloudinary.uploader.explicit(meme.public_id, {
      context: {
        ...context,
        likedBy: likedBy.join(','),
        likes: (likes + 1).toString()
      },
      type: 'upload',
      resource_type: 'image'
    });

    res.json({ success: true, message: 'Like registered successfully.' });

  } catch (error) {
    console.error('Like Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Vote for a meme
app.post('/vote', async (req, res) => {
  const { telegramId, memeId } = req.body;

  if (!telegramId || !memeId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const result = await cloudinary.search
      .expression(`public_id=${memeId}`)
      .max_results(1)
      .execute();

    if (result.resources.length === 0) {
      return res.status(404).json({ success: false, message: 'Meme not found.' });
    }

    const meme = result.resources[0];
    const context = meme.context?.custom || {};

    const votes = parseInt(context.votes || '0');
    const votedBy = context.votedBy ? context.votedBy.split(',') : [];

    if (votedBy.includes(telegramId)) {
      return res.status(400).json({ success: false, message: 'You have already voted for this meme.' });
    }

    votedBy.push(telegramId);

    await cloudinary.uploader.explicit(meme.public_id, {
      context: {
        ...context,
        votedBy: votedBy.join(','),
        votes: (votes + 1).toString()
      },
      type: 'upload',
      resource_type: 'image'
    });

    res.json({ success: true, message: 'Vote registered successfully.' });

  } catch (error) {
    console.error('Voting Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// === Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});