require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

console.log('Bucket:', process.env.S3_BUCKET_NAME);
console.log('Region:', process.env.AWS_REGION);
console.log('Key ID:', process.env.AWS_ACCESS_KEY_ID);

s3.send(new PutObjectCommand({
  Bucket:      process.env.S3_BUCKET_NAME,
  Key:         'test-upload.txt',
  Body:        Buffer.from('hello from EC2'),
  ContentType: 'text/plain',
}))
  .then(r  => console.log('UPLOAD OK ✅', JSON.stringify(r)))
  .catch(e => console.error('UPLOAD FAIL ❌', e.message));
