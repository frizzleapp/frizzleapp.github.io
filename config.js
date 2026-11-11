// The one address this site needs. Empty until Frizzle Cloud is deployed: the download
// buttons then say so instead of leading nowhere.
window.FRIZZLE_SITE = {
  // Frizzle Cloud's public address (PUBLIC_URL in server/wrangler.toml), no trailing slash,
  // e.g. "https://frizzle-cloud.example.workers.dev". The download buttons go to
  // <cloud>/download, which counts the download and redirects to the disk image
  // (DOWNLOAD_URL on the server): that count is the "downloads" number on the admin page.
  cloud: "",
};
