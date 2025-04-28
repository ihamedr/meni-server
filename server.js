import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import cloudinary from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// تنظیمات Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// تنظیمات Google Sheets
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

// روت اصلی
app.get('/', (req, res) => {
  res.send('MENI Server is running...');
});

// گرفتن لیست میم‌ها
app.get('/memes', async (req, res) => {
  try {
    const result = await cloudinary.v2.search
      .expression('resource_type:image')
      .sort_by('created_at','desc')
      .max_results(30)
      .execute();

    const memes = result.resources.map(meme => ({
      memeUrl: meme.secure_url,
      title: meme.context?.custom?.title || 'Untitled',
      telegramUsername: meme.context?.custom?.telegramUsername || 'Unknown',
      telegramId: meme.context?.custom?.telegramId || 'Unknown',
      likes: parseInt(meme.context?.custom?.likes || '0'),
      votes: parseInt(meme.context?.custom?.votes || '0'),
      id: meme.public_id
    }));

    res.json(memes);
  } catch (error) {
    console.error('Error fetching memes:', error);
    res.status(500).json({ error: 'Server error fetching memes' });
  }
});

// آپلود میم
app.post('/upload', async (req, res) => {
  try {
    const { memeBase64, telegramId, telegramUsername } = req.body;
    if (!memeBase64 || !telegramId || !telegramUsername) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const uploadResult = await cloudinary.v2.uploader.upload(memeBase64, {
      folder: 'meni_memes',
      context: {
        telegramId,
        telegramUsername,
        title: 'Untitled',
        likes: 0,
        votes: 0
      }
    });

    res.json({ message: 'Meme uploaded successfully', memeUrl: uploadResult.secure_url });
  } catch (error) {
    console.error('Error uploading meme:', error);
    res.status(500).json({ error: 'Server error uploading meme' });
  }
});

// رای دادن به میم
app.post('/vote', async (req, res) => {
  try {
    const { memeId, telegramId } = req.body;
    if (!memeId || !telegramId) {
      return res.status(400).json({ error: 'Missing memeId or telegramId' });
    }

    const meme = await cloudinary.v2.api.resource(memeId, { resource_type: 'image' });

    let currentVotes = parseInt(meme.context?.custom?.votes || '0');
    currentVotes++;

    await cloudinary.v2.uploader.explicit(memeId, {
      type: 'upload',
      context: {
        ...meme.context.custom,
        votes: currentVotes
      }
    });

    res.json({ message: 'Vote counted', votes: currentVotes });
  } catch (error) {
    console.error('Error voting meme:', error);
    res.status(500).json({ error: 'Server error voting meme' });
  }
});

// چک آپلود برای جلوگیری از آپلود دوباره
app.get('/check-upload/:telegramId', async (req, res) => {
  try {
    const telegramId = req.params.telegramId;
    const result = await cloudinary.v2.search
      .expression(`resource_type:image AND context.telegramId=${telegramId}`)
      .execute();

    res.json({ hasUploaded: result.total_count > 0 });
  } catch (error) {
    console.error('Error checking upload:', error);
    res.status(500).json({ error: 'Server error checking upload' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});