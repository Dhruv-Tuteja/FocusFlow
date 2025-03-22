import React, { useState } from "react";
import { Bookmark } from "@/types/task";
import { 
  extractDomain, 
  generateColorFromString, 
  generateId 
} from "@/utils/taskUtils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Globe, 
  Bookmark as BookmarkIcon, 
  Plus,
  ExternalLink,
  X,
  Link,
  Edit,
  MoreVertical,
  Pencil,
  PlusCircle,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { v4 as uuidv4 } from "uuid";

interface BookmarkManagerProps {
  bookmarks: Bookmark[];
  onAddBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onEditBookmark: (bookmark: Bookmark) => void;
}

const BookmarkManager: React.FC<BookmarkManagerProps> = ({
  bookmarks,
  onAddBookmark,
  onDeleteBookmark,
  onEditBookmark
}) => {
  const [newBookmarkUrl, setNewBookmarkUrl] = useState("");
  const [newBookmarkTitle, setNewBookmarkTitle] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editBookmarkUrl, setEditBookmarkUrl] = useState("");
  const [editBookmarkTitle, setEditBookmarkTitle] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleAddBookmark = () => {
    if (!newBookmarkUrl.trim()) {
      return;
    }

    // Simple URL validation
    let url = newBookmarkUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Default title to URL if not provided
    const title = newBookmarkTitle.trim() || new URL(url).hostname;

    const newBookmark: Bookmark = {
      id: uuidv4(),
      title,
      url,
      createdAt: new Date().toISOString(),
    };

    onAddBookmark(newBookmark);
    setNewBookmarkUrl("");
    setNewBookmarkTitle("");
    setIsAddDialogOpen(false);
    
    toast({
      title: "Bookmark added",
      description: `"${title}" has been added to your bookmarks.`,
    });
  };

  const openEditDialog = (bookmark: Bookmark) => {
    setEditingBookmark(bookmark);
    setEditBookmarkTitle(bookmark.title);
    setEditBookmarkUrl(bookmark.url);
    setIsEditDialogOpen(true);
  };

  const handleEditBookmark = () => {
    if (!editingBookmark || !editBookmarkUrl.trim()) {
      return;
    }

    // Simple URL validation
    let url = editBookmarkUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // Default title to URL if not provided
    const title = editBookmarkTitle.trim() || new URL(url).hostname;

    const updatedBookmark: Bookmark = {
      ...editingBookmark,
      title,
      url,
    };

    onEditBookmark(updatedBookmark);
    setEditingBookmark(null);
    setEditBookmarkTitle("");
    setEditBookmarkUrl("");
    setIsEditDialogOpen(false);
    
    toast({
      title: "Bookmark updated",
      description: `"${title}" has been updated.`,
    });
  };

  const handleBookmarkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Bookmarks</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a new bookmark</DialogTitle>
              <DialogDescription>
                Enter the details for your new bookmark.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={newBookmarkTitle}
                  onChange={(e) => setNewBookmarkTitle(e.target.value)}
                  placeholder="My Bookmark"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={newBookmarkUrl}
                  onChange={(e) => setNewBookmarkUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleAddBookmark}>Add Bookmark</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Bookmark Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bookmark</DialogTitle>
            <DialogDescription>
              Update the details for your bookmark.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editBookmarkTitle}
                onChange={(e) => setEditBookmarkTitle(e.target.value)}
                placeholder="My Bookmark"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={editBookmarkUrl}
                onChange={(e) => setEditBookmarkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleEditBookmark}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {bookmarks.map((bookmark) => (
          <div
            key={bookmark.id}
            className="flex items-center justify-between rounded-md border p-3 shadow-sm"
          >
            <div className="flex-1 overflow-hidden mr-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleBookmarkClick(bookmark.url)}
                      className="w-full text-left"
                    >
                      <h3 className="truncate font-medium hover:underline">
                        {bookmark.title}
                      </h3>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{bookmark.url}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center space-x-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleBookmarkClick(bookmark.url)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openEditDialog(bookmark)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteBookmark(bookmark.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
        {bookmarks.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <PlusCircle className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No bookmarks yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your first bookmark to quickly access your favorite websites.
            </p>
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="mt-4"
              variant="outline"
            >
              Add Bookmark
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookmarkManager;
