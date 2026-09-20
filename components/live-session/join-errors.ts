export function liveSessionJoinErrorMessageKey(
  errorCode: string | undefined,
):
  | "errors.notParticipant"
  | "errors.accountInactive"
  | "errors.notJoinable"
  | "errors.windowNotOpen"
  | "errors.windowClosed"
  | "errors.notConfigured"
  | "errors.untrustedOrigin"
  | "errors.unauthorized"
  | "errors.invalidResponse"
  | "errors.network"
  | "errors.generic" {
  switch (errorCode) {
    case "JOIN_NOT_PARTICIPANT":
      return "errors.notParticipant";
    case "ACCOUNT_INACTIVE":
      return "errors.accountInactive";
    case "SESSION_NOT_JOINABLE":
      return "errors.notJoinable";
    case "JOIN_WINDOW_NOT_OPEN":
      return "errors.windowNotOpen";
    case "JOIN_WINDOW_CLOSED":
      return "errors.windowClosed";
    case "LIVE_SESSION_NOT_CONFIGURED":
      return "errors.notConfigured";
    case "UNTRUSTED_ORIGIN":
      return "errors.untrustedOrigin";
    case "UNAUTHORIZED":
      return "errors.unauthorized";
    default:
      return "errors.generic";
  }
}
