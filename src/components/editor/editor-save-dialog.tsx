"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface EditorSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (changeSummary: string) => Promise<void>;
}

/**
 * Dialog shown when the user clicks Save in the editor.
 * Prompts for an optional change summary before saving.
 */
export function EditorSaveDialog({
  open,
  onOpenChange,
  onSave,
}: EditorSaveDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSave(changeSummary);
      setChangeSummary("");
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Changes</DialogTitle>
          <DialogDescription>
            Describe what you changed. This helps others understand the edit
            history.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          placeholder="Describe your changes (optional)"
          value={changeSummary}
          onChange={(e) => setChangeSummary(e.target.value)}
          rows={3}
          disabled={isSaving}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
