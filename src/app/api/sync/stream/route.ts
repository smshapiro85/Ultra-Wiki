import { auth } from "@/lib/auth";
import { runSync } from "@/lib/github/sync";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: string, data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
        } catch {
          closed = true;
        }
      };

      try {
        send("log", "Starting sync...");
        await runSync("manual", {
          onLog: (message) => send("log", message),
          onSyncLogId: (id) => send("syncLogId", id),
        });
        send("done", "complete");
      } catch (error) {
        send("error", error instanceof Error ? error.message : "Sync failed");
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
