require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // اضافه شد برای پارس کردن JSON

// تنظیمات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// روت ساده برای چک کردن
app.get('/', (req, res) => {
  res.send('MENI Server is running...');
});

// روت چک کردن آپلود قبلی
app.get('/check-upload/:telegramId', async (req, res) => {
  const { telegramId } = req.params;

  try {
    const result = await cloudinary.search
      .expression(`context.telegramId=${telegramId}`)
      .max_results(1)
      .execute();

    if (result.resources.length > 0) {
      return res.json({ uploaded: true });
    } else {
      return res.json({ uploaded: false });
    }
  } catch (error) {
    console.error('Cloudinary Search Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/memes/:id/like', async (req, res) => {
  const memeId = req.params.id;

  try {
    const resource = await cloudinary.api.resource(memeId, { resource_type: 'image' });

    const currentLikes = parseInt(resource.context?.custom?.likes) || 0;
    const newLikes = currentLikes + 1;

    await cloudinary.uploader.update(memeId, {
      context: {
        ...resource.context.custom,
        likes: newLikes.toString(),
      }
    });

    res.json({ success: true, newLikes });
  } catch (error) {
    console.error('Error updating like:', error);
    res.status(500).json({ error: 'Failed to update like.' });
  }
});
app.post('/memes/:id/vote', async (req, res) => {
  const memeId = req.params.id;
  const { voterId } = req.body; // voterId = telegramId کسی که رای داده

  if (!voterId) {
    return res.status(400).json({ error: 'voterId is required.' });
  }

  try {
    const resource = await cloudinary.api.resource(memeId, { resource_type: 'image' });

    const currentVotes = parseInt(resource.context?.custom?.votes) || 0;
    const currentVoters = resource.context?.custom?.voters ? JSON.parse(resource.context.custom.voters) : [];

    if (currentVoters.includes(voterId)) {
      return res.status(400).json({ error: 'User has already voted.' });
    }

    currentVoters.push(voterId);

    await cloudinary.uploader.update(memeId, {
      context: {
        ...resource.context.custom,
        votes: (currentVotes + 1).toString(),
        voters: JSON.stringify(currentVoters),
      }
    });

    res.json({ success: true, newVotes: currentVotes + 1 });
  } catch (error) {
    console.error('Error updating vote:', error);
    res.status(500).json({ error: 'Failed to update vote.' });
  }
});
// روت دریافت اطلاعات آپلود (در صورت نیاز)
app.post('/upload', (req, res) => {
  const { memeUrl, title, telegramUsername, telegramId, likes, votes, uploadTime, voters } = req.body;
  
  if (!memeUrl || !title || !telegramId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  console.log('New Meme Uploaded:', { title, telegramUsername, telegramId, memeUrl, likes, votes, uploadTime, voters });
  res.json({ success: true });
});
app.get('/memes', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('resource_type:image')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    const memes = result.resources.map((resource) => {
      const context = resource.context?.custom || {};
      return {
        id: resource.public_id,
        url: resource.secure_url,
        title: context.title || '',
        telegramUsername: context.telegramUsername || '',
        telegramId: context.telegramId || '',
        likes: parseInt(context.likes) || 0,
        votes: parseInt(context.votes) || 0,
        voters: context.voters ? JSON.parse(context.voters) : [],
        uploadTime: context.uploadTime || resource.created_at,
      };
    });

    res.json(memes);
  } catch (error) {
    console.error('Error fetching memes:', error);
    res.status(500).json({ error: 'Failed to fetch memes.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});