// Attachment processing — reads files and prepares them for agents

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'document' | 'text' | 'folder' | 'spreadsheet';
  size: number;          // bytes
  content?: string;      // extracted text content
  base64?: string;       // for images only
  mimeType: string;
  fileCount?: number;    // for folders: how many files inside
  preview?: string;      // first 200 chars of text content
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_SIZE = 500 * 1024;
const MAX_FOLDER_SIZE = 2 * 1024 * 1024;

async function resizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1024;

        if (width > height) {
          if (width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ base64: base64.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function processFile(file: File): Promise<Attachment> {
  const id = Math.random().toString(36).substring(7);
  const name = file.name;
  const size = file.size;
  const mimeType = file.type;
  
  let type: Attachment['type'] = 'text';
  if (mimeType.startsWith('image/')) type = 'image';
  else if (mimeType === 'application/pdf') type = 'pdf';
  else if (name.endsWith('.docx') || name.endsWith('.doc')) type = 'document';
  else if (name.endsWith('.xlsx') || name.endsWith('.csv')) type = 'spreadsheet';

  if (type === 'image') {
    if (size > MAX_IMAGE_SIZE) throw new Error('File too large / تجاوزت حد الحجم المسموح به');
    const { base64 } = await resizeImage(file);
    return { id, name, type, size, base64, mimeType };
  }

  if (size > MAX_TEXT_SIZE) throw new Error('File too large / تجاوزت حد الحجم المسموح به');

  const content = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsText(file);
  });

  return {
    id,
    name,
    type,
    size,
    content,
    mimeType,
    preview: content.substring(0, 200)
  };
}

export async function processFolder(files: FileList): Promise<Attachment> {
  const id = Math.random().toString(36).substring(7);
  const name = files[0].webkitRelativePath.split('/')[0] || 'folder';
  let totalSize = 0;
  let fileCount = 0;
  let combinedContent = '';

  for (let i = 0; i < Math.min(files.length, 20); i++) {
    const file = files[i];
    if (file.size > MAX_TEXT_SIZE) continue;
    
    const content = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsText(file);
    });

    combinedContent += `\nFILE: ${file.webkitRelativePath}\nCONTENT:\n${content}\n---\n`;
    totalSize += file.size;
    fileCount++;
  }

  if (totalSize > MAX_FOLDER_SIZE) throw new Error('Folder too large / تجاوزت حد الحجم المسموح به');

  return {
    id,
    name,
    type: 'folder',
    size: totalSize,
    content: combinedContent,
    mimeType: 'application/x-directory',
    fileCount,
    preview: combinedContent.substring(0, 200)
  };
}

export function buildAttachmentContext(attachments: Attachment[]): string {
  if (!attachments || attachments.length === 0) return '';
  
  let context = 'ATTACHED FILES:\n';
  attachments.forEach(att => {
    if (att.type !== 'image') {
      context += `[${att.name}]: ${att.content}\n`;
    }
  });
  return context;
}
