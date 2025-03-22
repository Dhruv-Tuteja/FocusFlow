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
  DialogDescription
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
  MoreVertical
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [bookmarkUrl, setBookmarkUrl] = useState("");
  const [bookmarkTitle, setBookmarkTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
  const { toast } = useToast();

  const handleAddBookmark = () => {
    if (!bookmarkUrl) return;

    try {
      // Ensure URL has a protocol
      let url = bookmarkUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Validate URL
      new URL(url);
      
      const domain = extractDomain(url);
      const title = bookmarkTitle || domain;
      const color = generateColorFromString(domain);
      
      const newBookmark: Bookmark = {
        id: generateId(),
        title,
        url,
        color
      };
      
      onAddBookmark(newBookmark);
      setBookmarkUrl("");
      setBookmarkTitle("");
      setDialogOpen(false);
      
      toast({
        title: "Bookmark added",
        description: `"${title}" has been added to your bookmarks.`,
      });
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
    }
  };

  const handleEditBookmarkClick = (bookmark: Bookmark) => {
    setCurrentBookmark(bookmark);
    setBookmarkUrl(bookmark.url);
    setBookmarkTitle(bookmark.title);
    setEditDialogOpen(true);
  };

  const handleSaveEditedBookmark = () => {
    if (!currentBookmark || !bookmarkUrl) return;

    try {
      // Ensure URL has a protocol
      let url = bookmarkUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      // Validate URL
      new URL(url);
      
      const domain = extractDomain(url);
      const title = bookmarkTitle || domain;
      
      // Keep the original color if the domain hasn't changed
      const color = extractDomain(currentBookmark.url) === domain 
        ? currentBookmark.color 
        : generateColorFromString(domain);
      
      const updatedBookmark: Bookmark = {
        ...currentBookmark,
        title,
        url,
        color
      };
      
      onEditBookmark(updatedBookmark);
      setEditDialogOpen(false);
      resetForm();
      
      toast({
        title: "Bookmark updated",
        description: `"${title}" has been updated.`,
      });
    } catch (error) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setBookmarkUrl("");
    setBookmarkTitle("");
    setCurrentBookmark(null);
  };

  const handleBookmarkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Bookmarks</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Plus size={18} />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Bookmark</DialogTitle>
              <DialogDescription>
                Add a website to your bookmarks for quick access.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="url"
                    value={bookmarkUrl}
                    onChange={(e) => setBookmarkUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  placeholder="My Bookmark"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="secondary" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddBookmark}>
                Add Bookmark
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Bookmark Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Bookmark</DialogTitle>
              <DialogDescription>
                Update your bookmark details.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-url">Website URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-url"
                    value={bookmarkUrl}
                    onChange={(e) => setBookmarkUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input
                  id="edit-title"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  placeholder="My Bookmark"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="secondary" onClick={() => {
                setEditDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditedBookmark}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {bookmarks.map(bookmark => (
          <div 
            key={bookmark.id}
            style={{ 
              borderLeft: `4px solid ${bookmark.color || '#4C51BF'}`,
              background: `linear-gradient(90deg, ${bookmark.color}15, transparent)`
            }} 
            className="relative flex items-center justify-between p-3 rounded-md border border-border hover:shadow-sm transition-shadow"
          >
            <div 
              className="flex items-center gap-3 cursor-pointer w-full"
              onClick={() => handleBookmarkClick(bookmark.url)}
            >
              <div 
                className="flex items-center justify-center w-8 h-8 rounded-md"
                style={{ backgroundColor: `${bookmark.color}25` }}
              >
                {bookmark.iconUrl ? (
                  <img 
                    src={bookmark.iconUrl} 
                    alt={bookmark.title} 
                    className="w-4 h-4"
                  />
                ) : (
                  <Globe size={16} style={{ color: bookmark.color || '#4C51BF' }} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-medium truncate">{bookmark.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {extractDomain(bookmark.url)}
                </p>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditBookmarkClick(bookmark);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBookmark(bookmark.id);
                  }}
                  className="text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        
        {bookmarks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-md">
            <BookmarkIcon className="h-8 w-8 mb-2" />
            <p>No bookmarks yet</p>
            <p className="text-sm mt-1">Add websites you frequently visit</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add bookmark
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookmarkManager;
