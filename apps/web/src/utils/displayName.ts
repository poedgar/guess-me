export function getDisplayName(fullName: string, showSurnames: boolean): string {
  if (showSurnames) return fullName;
  return fullName.split(' ')[0];
}
