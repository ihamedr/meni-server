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

// روت دریافت اطلاعات آپلود (در صورت نیاز)
app.post('/upload', (req, res) => {
  const { memeUrl, title, telegramUsername, telegramId, likes, votes, uploadTime } = req.body;
  
  if (!memeUrl || !title || !telegramId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  console.log('New Meme Uploaded:', { title, telegramUsername, telegramId, memeUrl, likes, votes, uploadTime });
  res.json({ success: true });
});

// روت برای ثبت لایک
app.post('/like', async (req, res) => {
  const { telegramId, memeId } = req.body;

  if (!telegramId || !memeId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const result = await cloudinary.search
      .expression(public_id=${memeId})
      .max_results(1)
      .execute();

    if (result.resources.length === 0) {
      return res.status(404).json({ success: false, message: 'Meme not found.' });
    }

    const meme = result.resources[0];
    const context = meme.context || {};  // بررسی کردن اگر context وجود داشته باشد
    const likes = context.likes ? parseInt(context.likes) : 0;  // اگر لایک وجود داشته باشد
    const likedBy = context.likedBy ? context.likedBy.split(',') : [];  // لیست کسانی که لایک کرده‌اند

    // چک کردن اینکه آیا این تلگرام آیدی قبلاً لایک کرده است یا نه
    if (likedBy.includes(telegramId)) {
      return res.status(400).json({ success: false, message: 'You have already liked this meme.' });
    }

    // اضافه کردن لایک جدید
    likedBy.push(telegramId);

    // آپدیت کردن context با آرایه جدید likedBy و افزایش تعداد لایک‌ها
    await cloudinary.uploader.explicit(meme.public_id, {
      context: {
        ...context,
        likedBy: likedBy.join(','),
        likes: (likes + 1).toString()
      }
    });

    res.json({ success: true, message: 'Like registered successfully.' });

  } catch (error) {
    console.error('Like Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// روت برای ثبت ووت
app.post('/vote', async (req, res) => {
  const { telegramId, memeId } = req.body;

  if (!telegramId || !memeId) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  try {
    const result = await cloudinary.search
      .expression(public_id=${memeId})
      .max_results(1)
      .execute();

    if (result.resources.length === 0) {
      return res.status(404).json({ success: false, message: 'Meme not found.' });
    }

    const meme = result.resources[0];
    const context = meme.context || {};  // بررسی کردن اگر context وجود داشته باشد
    const votedBy = context.votedBy ? context.votedBy.split(',') : [];  // اگر قبلاً رای داده باشیم

    // چک کردن اینکه آیا این تلگرام آیدی قبلاً رای داده است یا نه
    if (votedBy.includes(telegramId)) {
      return res.status(400).json({ success: false, message: 'You have already voted for this meme.' });
    }

    // اضافه کردن رای جدید
    votedBy.push(telegramId);

    // آپدیت کردن context با آرایه جدید votedBy و افزایش تعداد رای‌ها
    await cloudinary.uploader.explicit(meme.public_id, {
      context: {
        ...context,
        votedBy: votedBy.join(','),
        votes: (parseInt(context.votes || '0') + 1).toString()
      }
    });

    res.json({ success: true, message: 'Vote registered successfully.' });

  } catch (error) {
    console.error('Voting Error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});