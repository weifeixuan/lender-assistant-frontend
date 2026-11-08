/** 窄屏（< 1024px）强制折叠对话页左右两栏，避免 420px 下三列横向溢出 */
export function shouldAutoCollapse(width: number): boolean {
  return width < 1024;
}
