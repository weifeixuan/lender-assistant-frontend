/** docId 规则（PRD FR-01）：小写，空格与非法字符转 _，仅 a-z0-9_-，长度 ≤ 64 */

export const DOC_ID_MAX_LENGTH = 64;
const DOC_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot <= 0 ? fileName : fileName.slice(0, dot);
}

/** 由文件名生成默认 docId；中文等非法字符会被折叠为下划线 */
export function docIdFromFileName(fileName: string): string {
  const base = stripExtension(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, DOC_ID_MAX_LENGTH)
    .replace(/_+$/, '');
  return base || 'doc';
}

/** 返回 null 表示合法；否则返回就地提示文案 */
export function validateDocId(value: string): string | null {
  if (!value) return 'docId 不能为空';
  if (value.length > DOC_ID_MAX_LENGTH) return `docId 长度不能超过 ${DOC_ID_MAX_LENGTH} 个字符`;
  if (!DOC_ID_PATTERN.test(value)) return 'docId 只能包含小写字母、数字、下划线和短横线';
  return null;
}

const ACCEPTED_EXTENSIONS = ['docx', 'txt', 'md'];

/** 上传前本地校验；返回 null 表示可提交 */
export function validateUploadFile(file: File): string | null {
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return '文件缺少扩展名，仅支持 docx / txt / md';
  const ext = file.name.slice(dot + 1).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return '仅支持 docx / txt / md 文件';
  if (file.size === 0) return '文件内容为空';
  return null;
}
