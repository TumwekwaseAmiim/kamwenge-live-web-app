import { requireBroadcaster, logout } from './auth.js';
import { saveProfile } from './store.js';
import { uploadBroadcasterPhoto } from './cloudinary.js';
import { cloudinaryConfigured } from './media-config.js';
import { toast } from './app.js';

let session;
let uploadedPhotoURL = '';

const form = document.querySelector('#profile-form');
const fileInput = document.querySelector('#profile-photo-file');
const uploadBtn = document.querySelector('#upload-profile-photo');
const uploadState = document.querySelector('#photo-upload-state');
const preview = document.querySelector('#profile-preview');
const previewName = document.querySelector('#preview-name');


// =====================================================
// LOAD CURRENT BROADCASTER PROFILE
// =====================================================

(async () => {
  try {
    session = await requireBroadcaster();

    const p = session.profile || {};

    form.displayName.value = p.displayName || '';
    form.bio.value = p.bio || '';
    form.location.value = p.location || '';

    uploadedPhotoURL = p.photoURL || '';

    if (!cloudinaryConfigured) {
      uploadState.textContent =
        'Cloudinary needs configuration before photo upload.';
    }

    renderPreview();

  } catch (e) {
    console.error(e);
    toast(e.message);
  }
})();


// =====================================================
// PROFILE PREVIEW
// =====================================================

function renderPreview() {
  if (preview) {
    preview.src =
      uploadedPhotoURL ||
      'assets/images/avatar-placeholder.svg';
  }

  if (previewName) {
    previewName.textContent =
      form?.displayName?.value?.trim() ||
      'Broadcaster';
  }
}


// =====================================================
// UPDATE NAME PREVIEW
// =====================================================

form?.addEventListener('input', () => {
  if (previewName) {
    previewName.textContent =
      form?.displayName?.value?.trim() ||
      'Broadcaster';
  }
});


// =====================================================
// PREVIEW PHOTO IMMEDIATELY WHEN SELECTED
// =====================================================

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    toast('Please choose an image file.');
    fileInput.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    toast('Profile photo must be 5 MB or smaller.');
    fileInput.value = '';
    return;
  }

  const localURL = URL.createObjectURL(file);

  if (preview) {
    preview.src = localURL;
  }

  uploadState.textContent =
    'Photo selected. Press Save Profile to upload it.';
});


// =====================================================
// MANUAL PHOTO UPLOAD BUTTON
// =====================================================

uploadBtn?.addEventListener('click', async () => {
  if (!session) {
    return;
  }

  const file = fileInput?.files?.[0];

  if (!file) {
    toast('Choose a profile photo first.');
    return;
  }

  if (!cloudinaryConfigured) {
    toast('Cloudinary is not configured.');
    return;
  }

  try {
    uploadBtn.disabled = true;

    uploadState.textContent =
      'Uploading photo…';

    uploadedPhotoURL =
      await uploadBroadcasterPhoto(
        file,
        session.user.uid
      );

    renderPreview();

    uploadState.textContent =
      'Photo uploaded. Save profile to publish it.';

    toast('Profile photo uploaded ✅');

  } catch (e) {
    console.error(e);

    uploadState.textContent =
      e.message || 'Photo upload failed.';

    toast(
      e.message ||
      'Photo upload failed.'
    );

  } finally {
    uploadBtn.disabled = false;
  }
});


// =====================================================
// SAVE PROFILE
// Automatically uploads selected photo first
// =====================================================

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!session) {
    return;
  }

  const saveBtn =
    form.querySelector('button[type="submit"]');

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ Saving...';
    }

    const selectedFile =
      fileInput?.files?.[0];

    // ---------------------------------------------
    // Upload new photo automatically if selected
    // ---------------------------------------------

    if (selectedFile) {
      if (!cloudinaryConfigured) {
        throw new Error(
          'Cloudinary is not configured.'
        );
      }

      uploadState.textContent =
        'Uploading profile photo…';

      uploadedPhotoURL =
        await uploadBroadcasterPhoto(
          selectedFile,
          session.user.uid
        );

      uploadState.textContent =
        'Photo uploaded successfully ✅';
    }

    // ---------------------------------------------
    // SAVE PROFILE TO FIRESTORE
    // ---------------------------------------------

    const profileData = {
      displayName:
        form.displayName.value.trim(),

      photoURL:
        uploadedPhotoURL || '',

      bio:
        form.bio.value.trim(),

      location:
        form.location.value.trim()
    };

    await saveProfile(
      session.user.uid,
      profileData
    );

    // Update local session copy too
    session.profile = {
      ...session.profile,
      ...profileData
    };

    renderPreview();

    if (fileInput) {
      fileInput.value = '';
    }

    uploadState.textContent =
      'Profile saved successfully ✅';

    toast('Profile saved ✅');

  } catch (e) {
    console.error(e);

    uploadState.textContent =
      e.message ||
      'Unable to save profile.';

    toast(
      e.message ||
      'Unable to save profile.'
    );

  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent =
        '💾 Save Profile';
    }
  }
});


// =====================================================
// LOGOUT
// =====================================================

document
  .querySelector('#logout')
  ?.addEventListener(
    'click',
    async () => {
      try {
        await logout();
        location.href = 'login.html';
      } catch (e) {
        console.error(e);
        toast(e.message);
      }
    }
  );