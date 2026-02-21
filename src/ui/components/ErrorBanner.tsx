import styles from "./ErrorBanner.module.css";

function friendlyMessage(raw: string): string {
  if (raw.includes("ECONNREFUSED") || raw.includes("fetch failed") || raw.includes("Failed to fetch"))
    return "Cannot reach the API server. Make sure `npm run server` is running on port 3001.";
  if (raw.includes("Wind start failed") || raw.includes("Connection failed"))
    return "Wind terminal is not running or not logged in. Start Wind and try again.";
  if (raw.includes("Invalid security code") || raw.includes("-40521009"))
    return "One or more security codes are invalid. Check the format (e.g. 000001.SZ).";
  if (raw.includes("Invalid field") || raw.includes("-40522003"))
    return "One or more field names are invalid for this function.";
  if (raw.includes("No permission") || raw.includes("-40520007"))
    return "Your Wind account does not have permission for this data.";
  if (raw.includes("No data") || raw.includes("-4"))
    return "No data returned. The date range may be outside available history.";
  return raw;
}

export default function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={styles.banner} role="alert">
      <strong>Error:</strong> {friendlyMessage(message)}
    </div>
  );
}
