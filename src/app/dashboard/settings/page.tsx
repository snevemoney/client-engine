export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-neutral-400 mt-1">System configuration.</p>
      </div>
      <div className="border border-neutral-800 rounded-lg p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-1">OpenAI API Key</h3>
          <p className="text-xs text-neutral-500">Set via OPENAI_API_KEY environment variable on the server.</p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-1">Capture API Key</h3>
          <p className="text-xs text-neutral-500">Set via CAPTURE_API_KEY environment variable. Used for the URL capture endpoint.</p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-1">Admin Email</h3>
          <p className="text-xs text-neutral-500">Set via ADMIN_EMAIL environment variable. Used for initial login.</p>
        </div>
      </div>
    </div>
  );
}
