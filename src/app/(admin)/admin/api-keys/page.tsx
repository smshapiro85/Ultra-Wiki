import { loadSettings } from "../settings/actions";
import { ApiKeysSettings } from "../settings/api-keys-settings";

export default async function ApiKeysPage() {
  const settings = await loadSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          API Keys
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage API keys for external service integrations.
        </p>
      </div>

      <ApiKeysSettings settings={settings} />
    </div>
  );
}
