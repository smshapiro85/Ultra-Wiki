"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createArticle } from "@/lib/wiki/article-actions";
import { createCategory } from "@/lib/wiki/category-actions";
import type { CategoryWithArticles } from "@/lib/wiki/queries";

interface CreateArticleModalProps {
  categories: CategoryWithArticles[];
}

export function CreateArticleModal({ categories }: CreateArticleModalProps) {
  const router = useRouter();

  // Dialog state
  const [open, setOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Inline category creation state
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Inline subcategory creation state
  const [showNewSubcategory, setShowNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false);

  // Local categories state (can be augmented when inline creation adds new ones)
  const [localCategories, setLocalCategories] =
    useState<CategoryWithArticles[]>(categories);

  // Get root categories (no parent)
  const rootCategories = localCategories.filter(
    (c) => c.parentCategoryId === null
  );

  // Get subcategories for currently selected category
  const selectedCategory = rootCategories.find((c) => c.id === categoryId);
  const subcategories = selectedCategory?.children ?? [];
  const hasSubcategories = subcategories.length > 0;

  // Reset form state
  function resetForm() {
    setTitle("");
    setCategoryId("");
    setSubcategoryId("");
    setShowNewCategory(false);
    setNewCategoryName("");
    setShowNewSubcategory(false);
    setNewSubcategoryName("");
  }

  // Handle dialog open change
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  // Handle category change
  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setSubcategoryId("");
    setShowNewSubcategory(false);
    setNewSubcategoryName("");
  }

  // Handle inline category creation
  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;

    setIsCreatingCategory(true);
    try {
      const result = await createCategory({ name });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Add to local state
      const newCat: CategoryWithArticles = {
        id: result.id,
        name,
        slug: result.slug,
        icon: null,
        sortOrder: null,
        parentCategoryId: null,
        articles: [],
        children: [],
      };
      setLocalCategories((prev) => [...prev, newCat]);
      setCategoryId(result.id);
      setShowNewCategory(false);
      setNewCategoryName("");
      router.refresh();
    } catch {
      toast.error("Failed to create category");
    } finally {
      setIsCreatingCategory(false);
    }
  }

  // Handle inline subcategory creation
  async function handleCreateSubcategory() {
    const name = newSubcategoryName.trim();
    if (!name || !categoryId) return;

    setIsCreatingSubcategory(true);
    try {
      const result = await createCategory({
        name,
        parentCategoryId: categoryId,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      // Add subcategory to local state under the selected category
      const newSubcat: CategoryWithArticles = {
        id: result.id,
        name,
        slug: result.slug,
        icon: null,
        sortOrder: null,
        parentCategoryId: categoryId,
        articles: [],
        children: [],
      };
      setLocalCategories((prev) =>
        prev.map((cat) =>
          cat.id === categoryId
            ? { ...cat, children: [...cat.children, newSubcat] }
            : cat
        )
      );
      setSubcategoryId(result.id);
      setShowNewSubcategory(false);
      setNewSubcategoryName("");
      router.refresh();
    } catch {
      toast.error("Failed to create subcategory");
    } finally {
      setIsCreatingSubcategory(false);
    }
  }

  // Handle article creation
  async function handleCreateArticle() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !categoryId) return;

    setIsCreating(true);
    try {
      const result = await createArticle({
        title: trimmedTitle,
        categoryId,
        subcategoryId: subcategoryId && subcategoryId !== "none" ? subcategoryId : null,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Article created");
      setOpen(false);
      resetForm();
      router.refresh();
      router.push(`/wiki/${result.slug}/edit`);
    } catch {
      toast.error("Failed to create article");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Create
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Article</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor="article-title">Title</Label>
            <Input
              id="article-title"
              placeholder="Article title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && title.trim() && categoryId) {
                  handleCreateArticle();
                }
              }}
            />
          </div>

          {/* Category select */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {rootCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <button
                  className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground select-none"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowNewCategory(true);
                  }}
                >
                  <Plus className="size-4" />
                  New Category
                </button>
              </SelectContent>
            </Select>

            {/* Inline new category creation */}
            {showNewCategory && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCategory();
                    if (e.key === "Escape") {
                      setShowNewCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleCreateCategory}
                  disabled={
                    !newCategoryName.trim() || isCreatingCategory
                  }
                >
                  {isCreatingCategory ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowNewCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Subcategory select (only when selected category has children) */}
          {categoryId && (hasSubcategories || showNewSubcategory) && (
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None (direct in category)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    None (direct in category)
                  </SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <button
                    className="relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground select-none"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowNewSubcategory(true);
                    }}
                  >
                    <Plus className="size-4" />
                    New Subcategory
                  </button>
                </SelectContent>
              </Select>

              {/* Inline new subcategory creation */}
              {showNewSubcategory && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Subcategory name"
                    value={newSubcategoryName}
                    onChange={(e) =>
                      setNewSubcategoryName(e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateSubcategory();
                      if (e.key === "Escape") {
                        setShowNewSubcategory(false);
                        setNewSubcategoryName("");
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateSubcategory}
                    disabled={
                      !newSubcategoryName.trim() ||
                      isCreatingSubcategory
                    }
                  >
                    {isCreatingSubcategory ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewSubcategory(false);
                      setNewSubcategoryName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Show "Add Subcategory" link when category is selected but has no subcategories */}
          {categoryId && !hasSubcategories && !showNewSubcategory && (
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={() => setShowNewSubcategory(true)}
            >
              <Plus className="size-3" />
              Add subcategory (optional)
            </button>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreateArticle}
            disabled={!title.trim() || !categoryId || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Article"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
