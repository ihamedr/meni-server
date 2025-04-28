require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['https://meni-test.onrender.com'] // دامنه فرانت خودتو اینجا اضافه کن
}));
app.use(express.json());

// تنظیمات Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// روت ساده
app.get('/', (req, res) => {
  res.send('MENI Server is running...');
});

// چک آپلود قبلی
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

// دریافت لیست میم‌ها
app.get('/memes', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('resource_type:image')
      .sort_by('created_at', 'desc')
      .max_results(100)
      .execute();

    const memes = result.resources.map((meme) => ({
      id: meme.public_id,
      url: meme.secure_url,
      title: meme.context?.custom?.title || '',
      telegramId: meme.context?.custom?.telegramId || '',
      telegramUsername: meme.context?.custom?.telegramUsername || '',
      likes: parseInt(meme.context?.custom?.likes || '0', 10),
      votes: parseInt(meme.context?.custom?.votes || '0', 10),
      voters: meme.context?.custom?.voters ? meme.context.custom.voters.split(',') : [],
      uploadTime: meme.created_at,
    }));

    res.json(memes);
  } catch (error) {
    console.error('Error fetching memes:', error);
    res.status(500).json({ error: 'Failed to fetch memes.' });
  }
});

// آپلود میم جدید
app.post('/upload', async (req, res) => {
  const { memeUrl, title, telegramUsername, telegramId, likes, votes, uploadTime } = req.body;
  
  if (!memeUrl || !title || !telegramId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    // آپدیت context روی فایل
    const publicId = memeUrl.split('/').pop().split('.')[0];
    await cloudinary.uploader.update(publicId, {
      context: {
        title,
        telegramUsername,
        telegramId,
        likes: likes || 0,
        votes: votes || 0,
        voters: '',
        uploadTime,
      }
    });

    console.log('New Meme Uploaded:', { title, telegramUsername, telegramId, memeUrl, likes, votes, uploadTime });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating meme context:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// لایک میم
app.post('/like', async (req, res) => {
  const { memeId, increment } = req.body;
  if (!memeId || typeof increment !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }

  try {
    const meme = await cloudinary.api.resource(memeId, { context: true });
    let likes = parseInt(meme.context?.custom?.likes || '0', 10);

    likes = increment ? likes + 1 : Math.max(likes - 1, 0);

    await cloudinary.uploader.update(memeId, {
      context: {
        ...meme.context.custom,
        likes,
      }
    });

    res.json({ success: true, likes });
  } catch (error) {
    console.error('Error updating likes:', error);
    res.status(500).json({ success: false, message: 'Failed to update likes.' });
  }
});

// ووت دادن به میم
app.post('/vote', async (req, res) => {
  const { memeId, userTelegramId } = req.body;
  if (!memeId || !userTelegramId) {
    return res.status(400).json({ success: false, message: 'Invalid request.' });
  }

  try {
    // چک کنیم کاربر قبلا رای داده یا نه
    const result = await cloudinary.search
      .expression('resource_type:image')
      .max_results(500)
      .execute();

    for (let meme of result.resources) {
      const voters = meme.context?.custom?.voters ? meme.context.custom.voters.split(',') : [];
      if (voters.includes(userTelegramId.toString())) {
        return res.status(400).json({ success: false, message: 'User already voted.' });
      }
    }

    // اگر رای نداده بود:
    const meme = await cloudinary.api.resource(memeId, { context: true });
    let votes = parseInt(meme.context?.custom?.votes || '0', 10);
    let voters = meme.context?.custom?.voters ? meme.context.custom.voters.split(',') : [];

    votes += 1;
    voters.push(userTelegramId.toString());

    await cloudinary.uploader.update(memeId, {
      context: {
        ...meme.context.custom,
        votes,
        voters: voters.join(',')
      }
    });

    res.json({ success: true, votes });
  } catch (error) {
    console.error('Error voting meme:', error);
    res.status(500).json({ success: false, message: 'Failed to vote.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});