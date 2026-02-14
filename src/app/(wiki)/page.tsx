export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome to UltraWiki</h1>
      <p className="text-muted-foreground">
        Browse articles using the sidebar navigation, or run a sync from the
        admin panel to populate the wiki with AI-generated documentation.
      </p>
    </div>
  );
}
