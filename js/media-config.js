// KAMWENGE LIVE™ media configuration.
// Safe values only. Never put API secrets in browser JavaScript.

// -----------------------------------------------------
// CLOUDINARY
// Used ONLY for broadcaster profile photos.
// -----------------------------------------------------
export const cloudinaryConfig = {
  cloudName: "qlxhf4mv",
  unsignedUploadPreset: "kamwenge_live_profiles",
  folder: "kamwenge-live/broadcasters"
};

export const cloudinaryConfigured =
  Boolean(cloudinaryConfig.cloudName) &&
  !cloudinaryConfig.cloudName.startsWith("YOUR_") &&
  Boolean(cloudinaryConfig.unsignedUploadPreset) &&
  !cloudinaryConfig.unsignedUploadPreset.startsWith("YOUR_");


// -----------------------------------------------------
// LIVEKIT
// Token endpoint is hosted securely on Cloudflare Worker.
// The LiveKit API secret stays inside Cloudflare,
// never in this frontend file.
// -----------------------------------------------------
export const livekitConfig = {
  tokenEndpoint:
    "https://kamwenge-live-token.tumwekwaseamiim.workers.dev"
};

export const livekitConfigured =
  Boolean(livekitConfig.tokenEndpoint) &&
  livekitConfig.tokenEndpoint.startsWith("https://");