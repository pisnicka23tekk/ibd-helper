import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Plus, SendHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { buildHealthContext } from "@/lib/health-context";
import type { Tables } from "@/integrations/supabase/types";

type Thread = Pick<Tables<"threads">, "id" | "title" | "updated_at">;

export const Route = createFileRoute("/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "Konzultace — IBD Kompas" },
      {
        name: "description",
        content:
          "Konzultace s multidisciplinárním IBD asistentem nad vaším deníkem a laboratorními výsledky.",
      },
      { property: "og:title", content: "Konzultace — IBD Kompas" },
      {
        property: "og:description",
        content: "Analýza symptomů, trendů a laboratorních hodnot u Crohnovy choroby.",
      },
    ],
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <ChatPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Attachment = { name: string; mediaType: string; url: string };

const ACCEPTED = "image/*,application/pdf";
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function messageFiles(message: UIMessage): Attachment[] {
  return message.parts.flatMap((part) =>
    part.type === "file"
      ? [
          {
            name: (part as { filename?: string }).filename ?? "příloha",
            mediaType: (part as { mediaType: string }).mediaType,
            url: (part as { url: string }).url,
          },
        ]
      : [],
  );
}

function messageText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

function ChatPage() {
  const { threadId } = useParams({ from: "/chat/$threadId" });
  const { user } = useAuthSession();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);

  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error("Nepodařilo se načíst konzultace: " + error.message);
      return;
    }
    setThreads(data ?? []);
  }, []);

  useEffect(() => {
    if (user) void loadThreads();
  }, [user, loadThreads]);

  useEffect(() => {
    if (!user) return;
    setInitial(null);
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Nepodařilo se načíst zprávy: " + error.message);
        setInitial([]);
        return;
      }
      setInitial(
        (data ?? []).map((row) => ({
          id: row.id,
          role: row.role === "assistant" ? "assistant" : "user",
          parts: [{ type: "text", text: row.content }],
        })) as UIMessage[],
      );
    })();
  }, [threadId, user]);

  async function newThread() {
    if (!user) return;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: user.id, title: "Nová konzultace" })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Nepodařilo se vytvořit konzultaci");
      return;
    }
    await loadThreads();
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function deleteThread(id: string) {
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) {
      toast.error("Nepodařilo se smazat konzultaci: " + error.message);
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === threadId) {
      const next = remaining[0];
      if (next) {
        navigate({ to: "/chat/$threadId", params: { threadId: next.id } });
      } else {
        navigate({ to: "/chat" });
      }
    }

  }

  return (
    <div className="grid flex-1 gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="panel h-fit p-3">
        <button onClick={newThread} className="btn-primary w-full">
          <Plus className="size-4" /> Nová konzultace
        </button>
        <ul className="mt-3 space-y-1">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className={`flex items-center gap-1 rounded-md px-1 ${
                thread.id === threadId ? "bg-secondary" : "hover:bg-secondary/60"
              }`}
            >
              <button
                onClick={() =>
                  navigate({ to: "/chat/$threadId", params: { threadId: thread.id } })
                }
                className="flex-1 truncate px-2 py-2 text-left text-sm"
              >
                {thread.title}
              </button>
              <button
                onClick={() => deleteThread(thread.id)}
                aria-label={`Smazat konzultaci ${thread.title}`}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {initial ? (
        <ChatWindow
          key={threadId}
          threadId={threadId}
          userId={user!.id}
          initialMessages={initial}
          onThreadsChanged={loadThreads}
        />
      ) : (
        <div className="panel flex items-center justify-center p-8 text-sm text-muted-foreground">
          Načítám konverzaci…
        </div>
      )}
    </div>
  );
}

function ChatWindow({
  threadId,
  userId,
  initialMessages,
  onThreadsChanged,
}: {
  threadId: string;
  userId: string;
  initialMessages: UIMessage[];
  onThreadsChanged: () => void;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const savedIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const context = await buildHealthContext();
          return {
            headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
            body: { messages, context },
          };
        },
      }),
    [],
  );

  const persist = useCallback(
    async (message: UIMessage) => {
      if (savedIds.current.has(message.id)) return;
      const text = messageText(message);
      if (!text) return;
      savedIds.current.add(message.id);
      const { error } = await supabase.from("messages").insert({
        thread_id: threadId,
        user_id: userId,
        role: message.role === "assistant" ? "assistant" : "user",
        content: text,
        client_message_id: message.id,
      });
      if (error) {
        savedIds.current.delete(message.id);
        toast.error("Zprávu se nepodařilo uložit: " + error.message);
        return;
      }
      await supabase
        .from("threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId);
    },
    [threadId, userId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: ({ message }) => {
      void persist(message);
      onThreadsChanged();
    },
    onError: (err) => toast.error(err.message || "Asistent teď není dostupný"),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading, threadId]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} je větší než 10 MB`);
        continue;
      }
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(`${file.name}: podporované jsou obrázky a PDF`);
        continue;
      }
      next.push({ name: file.name, mediaType: file.type, url: await readAsDataUrl(file) });
    }
    if (next.length) setAttachments((prev) => [...prev, ...next]);
  }

  async function submit() {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isLoading) return;
    const files = attachments;
    const promptText =
      text || "Přikládám dokument s výsledky, prosím o jeho vyhodnocení v kontextu mé léčby.";
    setInput("");
    setAttachments([]);

    const isFirst = messages.length === 0;
    await sendMessage({
      text: promptText,
      files: files.map((file) => ({
        type: "file" as const,
        mediaType: file.mediaType,
        filename: file.name,
        url: file.url,
      })),
    });
    const storedContent = files.length
      ? `${promptText}\n\n_Přílohy: ${files.map((f) => f.name).join(", ")}_`
      : promptText;
    await supabase.from("messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "user",
      content: storedContent,
    });
    if (isFirst) {
      await supabase
        .from("threads")
        .update({ title: promptText.slice(0, 60) })
        .eq("id", threadId);
      onThreadsChanged();
    }
  }

  return (
    <section className="panel flex min-h-[70vh] flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-lg py-10 text-center">
            <h2 className="text-lg font-semibold">Začněme výchozím profilem</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Napište, co se právě děje, nebo požádejte o vytvoření výchozího zdravotního profilu a
              prvního monitorovacího plánu. Asistent zohlední váš deník a laboratorní výsledky.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {[
                "Vytvoř můj výchozí zdravotní profil a první monitorovací plán.",
                "Poslední týden mám více bolesti a častější stolici — co to může znamenat?",
                "Zhodnoť moje laboratorní výsledky a trendy z deníku.",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="btn-ghost text-left"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[95%] rounded-2xl bg-surface px-4 py-3 text-surface-foreground"
              }
            >
              {message.role === "user" ? (
                <p className="whitespace-pre-wrap">{messageText(message)}</p>
              ) : (
                <Markdown>{messageText(message) || "…"}</Markdown>
              )}
            </div>
          </div>
        ))}

        {status === "submitted" ? (
          <p className="text-sm text-muted-foreground">Analyzuji…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            rows={2}
            placeholder="Popište symptomy, léky, výsledky nebo otázku…"
            className="field field-focus resize-none"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            onClick={() => void submit()}
            disabled={isLoading || !input.trim()}
            className="btn-primary"
            aria-label="Odeslat"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
