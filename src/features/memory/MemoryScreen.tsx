"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldShell, SelectInput, TextArea, TextInput } from "@/components/ui/form-controls";
import { useAuth } from "@/lib/auth";
import { useCreateRecord, useRecords } from "@/lib/repository";

export function MemoryScreen() {
  const { company, user } = useAuth();
  const memories = useRecords("ai_memories", company?.id);
  const create = useCreateRecord("ai_memories", company?.id);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("business");

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    await create.mutateAsync({
      values: {
        site_id: null,
        memory_type: type,
        title,
        content,
        source_record_table: null,
        source_record_id: null,
        embedding: null,
        importance: 5
      } as never,
      userId: user?.id || null,
      source: "manual"
    });
    setTitle("");
    setContent("");
  };

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <Card>
        <CardHeader title="Smart Memory" subtitle="Confirmed business facts are stored company-wise and never mixed with another company or site." />
        <div style={{ display: "grid", gap: 12 }}>
          <FieldShell label="Memory Type">
            <SelectInput value={type} onChange={(event) => setType(event.target.value)}>
              {["business", "site", "labour", "supplier", "client", "payment", "material", "expense", "conversation", "activity", "reminder", "preference"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </FieldShell>
          <FieldShell label="Title">
            <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
          </FieldShell>
          <FieldShell label="Memory">
            <TextArea value={content} onChange={(event) => setContent(event.target.value)} />
          </FieldShell>
          <Button onClick={save}>Save Memory</Button>
        </div>
      </Card>
      {(memories.data || []).length ? (
        (memories.data || []).map((memory) => (
          <Card key={memory.id}>
            <CardHeader title={memory.title} subtitle={`${memory.memory_type} memory - importance ${memory.importance}`} />
            <p style={{ color: "var(--app-muted)", lineHeight: 1.45 }}>{memory.content}</p>
          </Card>
        ))
      ) : (
        <EmptyState title="No memory yet" description="Confirmed AI actions and manual notes can become long-term business memory." />
      )}
    </section>
  );
}
