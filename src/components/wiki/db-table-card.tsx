import { Database } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface DbTableCardProps {
  tableName: string;
  columns: Array<{ name: string; description: string }> | null;
  relevanceExplanation: string | null;
}

/**
 * Card displaying a related database table with its columns and
 * relevance explanation. Columns are shown in a compact list with
 * monospace column names and descriptions.
 */
export function DbTableCard({
  tableName,
  columns,
  relevanceExplanation,
}: DbTableCardProps) {
  return (
    <Card className="py-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-mono">
          <Database className="size-4 shrink-0 text-muted-foreground" />
          {tableName}
        </CardTitle>
        {relevanceExplanation && (
          <CardDescription className="line-clamp-2">
            {relevanceExplanation}
          </CardDescription>
        )}
      </CardHeader>

      {columns && columns.length > 0 && (
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-1.5 text-left font-medium">Column</th>
                  <th className="px-3 py-1.5 text-left font-medium">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => (
                  <tr key={col.name} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-mono text-xs">
                      {col.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {col.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
