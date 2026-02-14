import { FileCode, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getArticleFileLinks,
  getArticleDbTables,
} from "@/lib/wiki/queries";
import { getRepoConfig } from "@/lib/github/client";
import { FileLinkCard } from "./file-link-card";
import { DbTableCard } from "./db-table-card";

interface TechnicalViewProps {
  articleId: string;
}

/**
 * Server component rendering the Technical View tab content.
 *
 * Displays:
 * - Related source files with relevance explanations and GitHub deep links
 * - Related database tables with column details
 */
export async function TechnicalView({ articleId }: TechnicalViewProps) {
  const [fileLinks, dbTables] = await Promise.all([
    getArticleFileLinks(articleId),
    getArticleDbTables(articleId),
  ]);

  // Build GitHub deep links
  let repoConfig: { owner: string; repo: string; branch: string } | null =
    null;
  try {
    repoConfig = await getRepoConfig();
  } catch {
    // Repo not configured -- skip GitHub links
  }

  function buildGithubUrl(filePath: string): string {
    if (!repoConfig) return "#";
    return `https://github.com/${repoConfig.owner}/${repoConfig.repo}/blob/${repoConfig.branch}/${filePath}`;
  }

  return (
    <div className="mt-6 space-y-8">
      {/* Source Files section */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <FileCode className="size-5" />
          Related Source Files
          <Badge variant="secondary">{fileLinks.length}</Badge>
        </h3>

        {fileLinks.length > 0 ? (
          <div className="space-y-2">
            {fileLinks.map((link) => (
              <FileLinkCard
                key={link.githubFileId}
                filePath={link.filePath}
                relevanceExplanation={link.relevanceExplanation}
                aiSummary={link.aiSummary}
                githubUrl={buildGithubUrl(link.filePath)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No source files linked to this article.
          </p>
        )}
      </section>

      {/* DB Tables section */}
      <section>
        <h3 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Database className="size-5" />
          Related Database Tables
          <Badge variant="secondary">{dbTables.length}</Badge>
        </h3>

        {dbTables.length > 0 ? (
          <div className="space-y-2">
            {dbTables.map((table) => (
              <DbTableCard
                key={table.tableName}
                tableName={table.tableName}
                columns={table.columns}
                relevanceExplanation={table.relevanceExplanation}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No database tables linked to this article.
          </p>
        )}
      </section>
    </div>
  );
}
