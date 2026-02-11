export function formatEventType(type) {
  const normalized = String(type || "").trim();
  if (!normalized) return "Other";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatDueDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function getDueContextLabel(isoDate) {
  const target = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return "";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = target.getTime() - today.getTime();
  const dayDiff = Math.round(diffMs / 86400000);

  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  if (dayDiff > 1) return `Due in ${dayDiff} days`;
  if (dayDiff === -1) return "Due yesterday";
  return `${Math.abs(dayDiff)} days ago`;
}
