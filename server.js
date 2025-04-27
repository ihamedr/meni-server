require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// میدلورها
app.use(cors());
app.use(express.json()); // این رو اضافه کن حتماً

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

// روت اصلی: چک کردن آپلود کاربر
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

// سرور گوش بده
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT})`;
});