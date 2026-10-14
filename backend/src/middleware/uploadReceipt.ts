import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = Number(process.env.MINIO_PORT || 9000);
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const minioBucket = process.env.MINIO_BUCKET || 'receipts';
// URL publik yang disimpan ke DB & dikirim ke browser.
// Pakai path relatif '/storage' supaya ikut domain frontend (localhost / tunnel),
// lalu di-proxy oleh Next.js rewrite ke MinIO (MINIO_URL di docker-compose).
const minioPublicUrl = process.env.MINIO_PUBLIC_URL || `/storage`;

const s3 = new S3Client({
  endpoint: `http://${minioEndpoint}:${minioPort}`,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: minioAccessKey,
    secretAccessKey: minioSecretKey,
  },
});

const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Bukti harus berupa JPG, PNG, atau PDF.') as Error & { statusCode?: number };
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

export async function uploadReceiptToMinio(file: Express.Multer.File): Promise<string> {
  const extension = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  const key = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  await s3.send(new PutObjectCommand({
    Bucket: minioBucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `${minioPublicUrl}/${key}`;
}

export async function uploadAvatarToMinio(file: Express.Multer.File): Promise<string> {
  const extension = (file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
  const key = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  await s3.send(new PutObjectCommand({
    Bucket: minioBucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `${minioPublicUrl}/${key}`;
}

export default uploadReceipt;
