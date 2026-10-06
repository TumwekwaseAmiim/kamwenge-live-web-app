import { cloudinaryConfig, cloudinaryConfigured } from './media-config.js';

export async function uploadBroadcasterPhoto(file, uid) {
  if (!cloudinaryConfigured) {
    throw new Error('Cloudinary is not configured yet. Add your cloud name and unsigned profile upload preset in js/media-config.js.');
  }
  if (!file?.type?.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Profile photo must be 5 MB or smaller.');

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', cloudinaryConfig.unsignedUploadPreset);
  body.append('folder', cloudinaryConfig.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryConfig.cloudName)}/image/upload`, {
    method: 'POST',
    body
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Cloudinary upload failed.');
  return data.secure_url;
}
