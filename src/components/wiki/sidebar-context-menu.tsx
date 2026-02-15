"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Ellipsis,
  FolderPlus,
  FilePlus,
  Pencil,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/wiki/category-actions";
import {
  createArticle,
  renameArticle,
  deleteArticle,
  moveArticle,
} from "@/lib/wiki/article-actions";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

// =============================================================================
// Flatten categories for the "Move to" picker
// =============================================================================

interface FlatCategory {
  id: string;
  name: string;
  depth: number;
}

function flattenCategories(
  categories: CategoryWithArticles[],
  depth = 0,
): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of categories) {
    result.push({ id: cat.id, name: cat.name, depth });
    if (cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, depth + 1));
    }
  }
  return result;
}

// =============================================================================
// CategoryContextMenu
// =============================================================================

export function CategoryContextMenu({
  category,
  isAdmin,
}: {
  category: { id: string; name: string; slug: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [newName, setNewName] = useState(category.name);
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  async function handleAddSubcategory() {
    if (!subName.trim()) return;
    setLoading(true);
    const result = await createCategory({
      name: subName.trim(),
      parentCategoryId: category.id,
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Subcategory created");
      setSubName("");
      setAddSubOpen(false);
      router.refresh();
    }
  }

  async function handleAddArticle() {
    if (!articleTitle.trim()) return;
    setLoading(true);
    const result = await createArticle({
      title: articleTitle.trim(),
      categoryId: category.id,
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Article created");
      setArticleTitle("");
      setAddArticleOpen(false);
      router.push(`/wiki/${result.slug}/edit`);
    }
  }

  async function handleRename() {
    if (!newName.trim()) return;
    setLoading(true);
    const result = await renameCategory({
      id: category.id,
      name: newName.trim(),
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Category renamed");
      setRenameOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteCategory({ id: category.id });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Category deleted");
      router.refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover/item:opacity-100 transition-opacity inline-flex items-center justify-center size-6 rounded-sm hover:bg-accent shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="size-4" />
            <span className="sr-only">Category actions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAddSubOpen(true);
            }}
          >
            <FolderPlus className="size-4" />
            Add Subcategory
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAddArticleOpen(true);
            }}
          >
            <FilePlus className="size-4" />
            Add Article
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNewName(category.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Subcategory Dialog */}
      <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Subcategory</DialogTitle>
            <DialogDescription>
              Create a new subcategory under &ldquo;{category.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSubcategory();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sub-name">Name</Label>
                <Input
                  id="sub-name"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="Subcategory name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddSubOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !subName.trim()}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Article Dialog */}
      <Dialog open={addArticleOpen} onOpenChange={setAddArticleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Article</DialogTitle>
            <DialogDescription>
              Create a new article in &ldquo;{category.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddArticle();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="article-title">Title</Label>
                <Input
                  id="article-title"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Article title"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddArticleOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !articleTitle.trim()}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Category</DialogTitle>
            <DialogDescription>
              Enter a new name for this category.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-category">Name</Label>
                <Input
                  id="rename-category"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !newName.trim()}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// SubcategoryContextMenu
// =============================================================================

export function SubcategoryContextMenu({
  subcategory,
  isAdmin,
}: {
  subcategory: { id: string; name: string; slug: string };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [addArticleOpen, setAddArticleOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [newName, setNewName] = useState(subcategory.name);
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  async function handleAddArticle() {
    if (!articleTitle.trim()) return;
    setLoading(true);
    const result = await createArticle({
      title: articleTitle.trim(),
      categoryId: subcategory.id,
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Article created");
      setArticleTitle("");
      setAddArticleOpen(false);
      router.push(`/wiki/${result.slug}/edit`);
    }
  }

  async function handleRename() {
    if (!newName.trim()) return;
    setLoading(true);
    const result = await renameCategory({
      id: subcategory.id,
      name: newName.trim(),
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Subcategory renamed");
      setRenameOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteCategory({ id: subcategory.id });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Subcategory deleted");
      router.refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover/item:opacity-100 transition-opacity inline-flex items-center justify-center size-6 rounded-sm hover:bg-accent shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Plus className="size-4" />
            <span className="sr-only">Subcategory actions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setAddArticleOpen(true);
            }}
          >
            <FilePlus className="size-4" />
            Add Article
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNewName(subcategory.name);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Article Dialog */}
      <Dialog open={addArticleOpen} onOpenChange={setAddArticleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Article</DialogTitle>
            <DialogDescription>
              Create a new article in &ldquo;{subcategory.name}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddArticle();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sub-article-title">Title</Label>
                <Input
                  id="sub-article-title"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                  placeholder="Article title"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddArticleOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !articleTitle.trim()}>
                {loading ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Subcategory</DialogTitle>
            <DialogDescription>
              Enter a new name for this subcategory.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-subcategory">Name</Label>
                <Input
                  id="rename-subcategory"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !newName.trim()}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// ArticleContextMenu
// =============================================================================

export function ArticleContextMenu({
  article,
  categories,
  isAdmin,
}: {
  article: { id: string; title: string; slug: string };
  categories: CategoryWithArticles[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(article.title);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const flatCategories = flattenCategories(categories);

  async function handleRename() {
    if (!newTitle.trim()) return;
    setLoading(true);
    const result = await renameArticle({
      id: article.id,
      title: newTitle.trim(),
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Article renamed");
      setRenameOpen(false);
      router.refresh();
    }
  }

  async function handleMove() {
    if (!selectedCategoryId) return;
    setLoading(true);
    const result = await moveArticle({
      id: article.id,
      categoryId: selectedCategoryId,
    });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Article moved");
      setSelectedCategoryId("");
      setMoveOpen(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteArticle({ id: article.id });
    setLoading(false);
    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Article deleted");
      setDeleteOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover/item:opacity-100 transition-opacity inline-flex items-center justify-center size-6 rounded-sm hover:bg-accent shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Ellipsis className="size-4" />
            <span className="sr-only">Article actions</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNewTitle(article.title);
              setRenameOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setSelectedCategoryId("");
              setMoveOpen(true);
            }}
          >
            <ArrowRightLeft className="size-4" />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Article</DialogTitle>
            <DialogDescription>
              Enter a new title for this article. The URL will not change.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rename-article">Title</Label>
                <Input
                  id="rename-article"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !newTitle.trim()}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Article</DialogTitle>
            <DialogDescription>
              Select a category to move &ldquo;{article.title}&rdquo; to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Destination</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {flatCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.depth > 0 ? "\u00A0\u00A0".repeat(cat.depth) + "- " : ""}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMoveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={loading || !selectedCategoryId}
            >
              {loading ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{article.title}&rdquo;?
              This action cannot be undone. All versions, comments, and
              annotations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {loading ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
