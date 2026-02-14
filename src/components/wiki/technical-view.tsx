import Link from "next/link";
import { Pencil, FileCode, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/auth";
import {
  getArticleFileLinks,
  getArticleDbTables,
} from "@/lib/wiki/queries";
import { getRepoConfig } from "@/lib/github/client";
import { ArticleContent } from "./article-content";
import { FileLinkCard } from "./file-link-card";
import { DbTableCard } from "./db-table-card";

interface TechnicalViewProps {
  articleId: string;
  articleSlug: string;
  technicalViewMarkdown: string | null;
}

/**
 * Server component rendering the Technical View tab content.
 *
 * Displays:
 * - AI-generated technical view markdown (if exists)
 * - Edit button for authenticated users
 * - Related source files section with file link cards
 * - Related database tables section with DB table cards
 */
export async function TechnicalView({
  articleId,
  articleSlug,
  technicalViewMarkdown,
}: TechnicalViewProps) {
  const [fileLinks, dbTables, session] = await Promise.all([
    getArticleFileLinks(articleId),
    getArticleDbTables(articleId),
    auth(),
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
    <div className="space-y-8">
      {/* Technical view markdown content */}
      {technicalViewMarkdown && (
        <ArticleContent markdown={technicalViewMarkdown} />
      )}

      {/* Edit button */}
      {session?.user && (
        <div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/wiki/${articleSlug}/edit?mode=technical`}>
              <Pencil className="size-4" />
              Edit Technical View
            </Link>
          </Button>
        </div>
      )}

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
