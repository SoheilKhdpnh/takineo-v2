export const ADMIN_REVIEW_PLAYBACK_TTL_SECONDS = 300;

export function rejectionIncludesProfile(target: "PROFILE" | "VIDEO" | "BOTH") {
  return target === "PROFILE" || target === "BOTH";
}

export function rejectionIncludesVideo(target: "PROFILE" | "VIDEO" | "BOTH") {
  return target === "VIDEO" || target === "BOTH";
}
