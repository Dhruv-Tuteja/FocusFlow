
import React, { useState } from "react";
import { User, LogOut, Moon, Sun } from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/types/task";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { generateId } from "@/utils/taskUtils";

interface UserProfileProps {
  currentUser: UserProfile | null;
  profiles: UserProfile[];
  darkMode: boolean;
  onLogin: (profile: UserProfile) => void;
  onLogout: () => void;
  onCreateProfile: (profile: UserProfile) => void;
  onToggleDarkMode: () => void;
}

const UserProfileComponent: React.FC<UserProfileProps> = ({
  currentUser,
  profiles,
  darkMode,
  onLogin,
  onLogout,
  onCreateProfile,
  onToggleDarkMode,
}) => {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);

  const handleCreateProfile = () => {
    if (!newName || !newEmail) return;

    const newProfile: UserProfile = {
      id: generateId(),
      name: newName,
      email: newEmail,
      darkMode: false,
    };

    onCreateProfile(newProfile);
    setNewName("");
    setNewEmail("");
    setRegisterDialogOpen(false);
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="mb-8">
      {currentUser ? (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{getUserInitials(currentUser.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{currentUser.name}</p>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onToggleDarkMode}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <User size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Focus Flow</h2>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onToggleDarkMode}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </Button>
            
            <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Log in</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Select Profile</DialogTitle>
                  <DialogDescription>
                    Choose a profile to continue or create a new one.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-3 my-4">
                  {profiles.length > 0 ? (
                    profiles.map(profile => (
                      <div 
                        key={profile.id} 
                        className="flex items-center justify-between p-3 border rounded-md cursor-pointer hover:bg-muted"
                        onClick={() => {
                          onLogin(profile);
                          setLoginDialogOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getUserInitials(profile.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{profile.name}</p>
                            <p className="text-sm text-muted-foreground">{profile.email}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No profiles found</p>
                  )}
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setLoginDialogOpen(false);
                      setRegisterDialogOpen(true);
                    }}
                  >
                    Create New Profile
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Profile</DialogTitle>
                  <DialogDescription>
                    Create a new profile to start tracking your tasks.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                      id="name" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)} 
                      placeholder="John Doe" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={newEmail} 
                      onChange={(e) => setNewEmail(e.target.value)} 
                      placeholder="john@example.com" 
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRegisterDialogOpen(false);
                      setLoginDialogOpen(true);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProfile}>Create Profile</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileComponent;
