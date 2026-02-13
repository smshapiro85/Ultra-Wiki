import { loadSettings } from "./actions";
import { GeneralSettings } from "./general-settings";
import { ApiKeysSettings } from "./api-keys-settings";
import { AiPromptsSettings } from "./ai-prompts-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function SettingsPage() {
  const settings = await loadSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Settings
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Configure integrations, API keys, and AI behavior.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="ai-prompts">AI Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings settings={settings} />
        </TabsContent>

        <TabsContent value="api-keys">
          <ApiKeysSettings settings={settings} />
        </TabsContent>

        <TabsContent value="ai-prompts">
          <AiPromptsSettings settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
