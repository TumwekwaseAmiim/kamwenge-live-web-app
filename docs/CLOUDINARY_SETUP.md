# Cloudinary Setup — Broadcaster Profile Photo Only

Kamwenge Live uses Cloudinary only for broadcaster profile photos.

## 1. Create/open a Cloudinary account
From the Cloudinary Console note your **Cloud name**.

## 2. Create an unsigned upload preset
Create an unsigned upload preset dedicated to Kamwenge Live broadcaster avatars.

Recommended restrictions:
- unsigned uploads enabled
- image resource type only
- small maximum file size (the app also rejects files above 5 MB)
- folder such as `kamwenge-live/broadcasters`
- restrict formats to normal web images such as JPG, PNG and WebP where your Cloudinary settings allow it

## 3. Configure the frontend
Open `js/media-config.js` and set:

```js
export const cloudinaryConfig = {
  cloudName: "YOUR_REAL_CLOUD_NAME",
  unsignedUploadPreset: "YOUR_REAL_UNSIGNED_PRESET",
  folder: "kamwenge-live/broadcasters"
};
```

Do **not** put a Cloudinary API secret in browser JavaScript.

## 4. Test
Sign in → Profile → choose photo → Upload Photo → Save Profile.

The returned `secure_url` is saved in the Firebase user profile and shown beside broadcasts.
