export function parseDbDate(value: string): number {
  if (!value.includes("T")) {
    return new Date(value.replace(" ", "T") + "Z").getTime();
  }

  return new Date(value).getTime();
}
