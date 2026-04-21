export async function fetchFirstStorybookPdf(folderId: string, token: string): Promise<{id: string, name: string, mimeType: string}> {
  // Query for PDF or Text files inside folder
  const query = `'${folderId}' in parents and (mimeType='application/pdf' or mimeType='text/plain') and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime desc&pageSize=1&fields=files(id,name,mimeType)`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch folder: " + res.statusText);
  const data = await res.json();
  if (!data.files || data.files.length === 0) throw new Error("No PDF or TXT storybook found in this folder");

  return data.files[0];
}

export async function downloadFileBytes(fileId: string, token: string): Promise<Uint8Array> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to download file: " + res.statusText);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

export async function uploadAudioToDrive(blob: Blob, folderId: string, originalName: string, token: string): Promise<string> {
  const metadata = {
    name: originalName + " - Audio Narration.wav",
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) throw new Error("Failed to upload spatial audio: " + res.statusText);
  const result = await res.json();

  // Try to set file to anyone with link can view so the user has an easy shareable link
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
  } catch(e) {
    console.warn("Failed to set public permission", e);
  }

  return result.webViewLink;
}

export function extractFolderId(urlOrId: string): string {
  if (!urlOrId.includes("http")) return urlOrId;
  const match = urlOrId.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const urlParams = new URL(urlOrId).searchParams;
  return urlParams.get("id") || urlOrId;
}
