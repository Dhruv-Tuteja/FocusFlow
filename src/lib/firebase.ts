import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  type User,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp,
  writeBatch,
  collection,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import { Task, DailyProgress, StreakData, Bookmark, TaskTag } from '@/types/task';
import { getTodayDateString, isTaskDueToday } from '@/utils/taskUtils';
import type { FirebaseError } from 'firebase/app';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

console.log('Initializing Firebase with production configuration...');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Force production mode
auth.useDeviceLanguage();

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Helper function to remove undefined values from objects before saving to Firestore
const removeUndefinedValues = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues);
  }
  
  if (typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => [key, removeUndefinedValues(value)])
    );
  }
  
  return obj;
};

// Firestore helper functions
export const saveUserData = async (userId: string, data: Record<string, unknown>) => {
  try {
    console.log('[FIREBASE DATA] Saving user data for:', userId);
    
    // Check if userId is valid
    if (!userId) {
      console.error('[FIREBASE ERROR] No user ID provided to saveUserData');
      return { success: false, error: 'User ID is required' };
    }
    
    // First get the current user data
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    let currentData = {};
    
    if (userDoc.exists()) {
      console.log('[FIREBASE DATA] User document exists');
      currentData = userDoc.data();
    } else {
      console.log('[FIREBASE DATA] User document does not exist, will create new');
    }
    
    // Clean data
    const cleanData = removeUndefinedValues(data);
    console.log('[FIREBASE DATA] Data prepared for save, fields:', Object.keys(cleanData));
    
    // Try using updateDoc first if document exists
    if (userDoc.exists()) {
      try {
        console.log('[FIREBASE DATA] Attempting updateDoc');
        await updateDoc(userDocRef, {
          ...cleanData,
          updatedAt: serverTimestamp()
        });
        console.log('[FIREBASE DATA] Successfully saved user data with updateDoc');
        return { success: true };
      } catch (updateError) {
        console.error('[FIREBASE ERROR] updateDoc failed:', updateError);
        // Fall back to setDoc
      }
    }
    
    // Try setDoc if update failed or document doesn't exist
    try {
      console.log('[FIREBASE DATA] Attempting setDoc');
      await setDoc(userDocRef, {
        ...currentData,
        ...cleanData,
        updatedAt: serverTimestamp(),
        ...(userDoc.exists() ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });
      
      console.log('[FIREBASE DATA] Successfully saved user data with setDoc');
      return { success: true };
    } catch (setDocError) {
      console.error('[FIREBASE ERROR] setDoc also failed:', setDocError);
      return { 
        success: false, 
        error: setDocError instanceof Error ? setDocError.message : String(setDocError)
      };
    }
  } catch (error: unknown) {
    console.error('[FIREBASE ERROR] Error in saveUserData:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const updateUserField = async (userId: string, field: string, value: unknown) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      [field]: value,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: unknown) {
    console.error(`Error updating ${field}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export const getUserData = async (userId: string) => {
  try {
    console.log('Getting user data for ID:', userId);
    if (!userId) {
      console.error('Cannot get user data: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      console.log('User document exists, retrieving data');
      const userData = userDoc.data();
      
      // Ensure all required fields exist in the data
      const completeUserData = {
        tasks: userData.tasks || [],
        progress: userData.progress || [],
        streak: userData.streak || {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
        },
        tags: userData.tags || [],
        bookmarks: userData.bookmarks || [],
        ...userData
      };
      
      // If any fields are missing in the document, update it
      if (!userData.tasks || !userData.progress || !userData.streak || 
          !userData.tags || !userData.bookmarks) {
        console.log('Some fields are missing in user data, updating document with complete data');
        try {
          await updateDoc(doc(db, 'users', userId), completeUserData);
        } catch (error) {
          console.warn('Could not update user document with complete data:', error);
          // Try setDoc as fallback
          await setDoc(doc(db, 'users', userId), completeUserData);
        }
      }
      
      return { success: true, data: completeUserData };
    } else {
      // Create empty user document if it doesn't exist
      console.log('User document does not exist, creating new one');
      const emptyUserData = {
        tasks: [],
        progress: [],
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastCompletionDate: null,
        },
        tags: [],
        bookmarks: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      try {
        await setDoc(doc(db, 'users', userId), emptyUserData);
        console.log('Empty user document created successfully');
        
        // Verify the document was created
        const verifyDoc = await getDoc(doc(db, 'users', userId));
        if (!verifyDoc.exists()) {
          console.error('Failed to create user document');
          return { 
            success: false, 
            error: 'Failed to create user document' 
          };
        }
        
        return { success: true, data: emptyUserData };
      } catch (error) {
        console.error('Error creating user document:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  } catch (error: unknown) {
    console.error('Error getting user data:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Tasks
export async function saveTasks(userId: string, tasks: Task[]): Promise<SaveResult> {
  if (!userId) {
    console.error('[FIREBASE ERROR] Cannot save tasks: userId is missing');
    return { success: false, error: 'User ID is required' };
  }

  // Add more logging and handle potential Firebase outages
  console.log(`[FIREBASE TASKS] Beginning save of ${tasks.length} tasks for user ${userId.substring(0, 5)}`);
  
  // First try the direct approach
  try {
    // Get a reference to the user document
    const userRef = doc(db, "users", userId);
    
    // Check if user document exists
    console.log(`[FIREBASE TASKS] Checking if user document exists...`);
    const userDoc = await getDoc(userRef);
    
    // Create basic document if it doesn't exist
    if (!userDoc.exists()) {
      console.log(`[FIREBASE TASKS] User document doesn't exist, creating it first`);
      try {
        await setDoc(userRef, { 
          tasks: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log(`[FIREBASE TASKS] Created basic user document`);
      } catch (createError) {
        console.error(`[FIREBASE ERROR] Failed to create user document:`, createError);
      }
    }
    
    // Now try to save the tasks - first with updateDoc
    console.log(`[FIREBASE TASKS] Attempting to save tasks with updateDoc`);
    try {
      await updateDoc(userRef, {
        tasks: tasks,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[FIREBASE SUCCESS] Tasks saved successfully with updateDoc`);
      return { success: true };
    } catch (updateError) {
      console.error(`[FIREBASE ERROR] updateDoc failed:`, updateError);
      
      // Try with setDoc as a fallback (merge to preserve other fields)
      console.log(`[FIREBASE TASKS] Falling back to setDoc`);
      try {
        // Get the current document data to preserve it
        const refreshedDoc = await getDoc(userRef);
        const existingData = refreshedDoc.exists() ? refreshedDoc.data() : {};
        
        await setDoc(userRef, {
          ...existingData,
          tasks: tasks,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log(`[FIREBASE SUCCESS] Tasks saved successfully with setDoc fallback`);
        return { success: true };
      } catch (setDocError) {
        console.error(`[FIREBASE ERROR] setDoc fallback also failed:`, setDocError);
        
        // One last attempt - save to a direct document path
        console.log(`[FIREBASE TASKS] Attempting last resort save method`);
        try {
          const timestamp = Date.now();
          const backupDocRef = doc(db, "userTasksBackup", `${userId}_${timestamp}`);
          
          await setDoc(backupDocRef, {
            userId: userId,
            tasks: tasks,
            timestamp: timestamp,
            savedAt: serverTimestamp()
          });
          
          console.log(`[FIREBASE SUCCESS] Tasks saved to backup location`);
          return { success: true, message: "Saved to backup location" };
        } catch (finalError) {
          console.error(`[FIREBASE ERROR] All save attempts failed:`, finalError);
          return { success: false, error: 'All save methods failed' };
        }
      }
    }
  } catch (error: any) {
    console.error('[FIREBASE ERROR] Error in saveTasks:', error);
    
    // Try the direct approach to userTasksBackup
    try {
      console.log(`[FIREBASE TASKS] Attempting emergency backup save`);
      const timestamp = Date.now();
      const backupDocRef = doc(db, "userTasksBackup", `${userId}_${timestamp}`);
      
      await setDoc(backupDocRef, {
        userId: userId,
        tasks: tasks,
        timestamp: timestamp,
        savedAt: serverTimestamp()
      });
      
      console.log(`[FIREBASE SUCCESS] Tasks saved to emergency backup location`);
      return { success: true, message: "Saved to emergency backup" };
    } catch (backupError) {
      console.error(`[FIREBASE ERROR] Even backup save failed:`, backupError);
      return { 
        success: false, 
        error: `Failed to save tasks: ${error?.message || 'Unknown error'}`
      };
    }
  }
}

// Load tasks with new structure
export const loadTasks = async (userId: string) => {
  try {
    console.log('Loading tasks for user', userId);
    
    if (!userId) {
      console.error('Cannot load tasks: User ID is null or undefined');
      return { success: false, error: 'User ID is required', data: [] };
    }
    
    // First try to load from the new structure
    const tasksByDateSnapshot = await getDocs(collection(db, 'users', userId, 'tasksByDate'));
    
    if (!tasksByDateSnapshot.empty) {
      console.log('Found tasks in new structure');
      // Combine all tasks from all dates
      const allTasks: Task[] = [];
      tasksByDateSnapshot.forEach(doc => {
        const dateTasks = doc.data().tasks || [];
        allTasks.push(...dateTasks);
      });
      
      return { success: true, data: allTasks };
    } else {
      // Fall back to old structure
      console.log('No tasks found in new structure, trying old structure');
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists() && userDoc.data().tasks) {
        return { success: true, data: userDoc.data().tasks };
      } else {
        return { success: true, data: [] };
      }
    }
  } catch (error: unknown) {
    console.error('Error loading tasks:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: []
    };
  }
};

// Progress
export const saveProgress = async (userId: string, progress: DailyProgress[]) => {
  try {
    console.log('Saving progress to Firestore:', progress.length, 'entries for user', userId);
    
    if (!userId) {
      console.error('Cannot save progress: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Check for hardcoded dates to help debug
    const march162025 = progress.find(p => p.date === '2025-03-16');
    if (march162025) {
      console.warn('Warning: Found hardcoded date 2025-03-16 in progress data:', march162025);
      console.warn('Entire progress data array:', progress);
    }
    
    // Log the raw progress data for debugging
    console.log('Progress data to save:', JSON.stringify(progress));
    
    // Remove undefined values from progress
    const cleanedProgress = removeUndefinedValues(progress);
    console.log('Cleaned progress data length:', cleanedProgress.length);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      // Create the document with progress if it doesn't exist
      console.log('Creating new user document with progress data');
      await setDoc(doc(db, 'users', userId), { 
        progress: cleanedProgress,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing document
      console.log('Updating existing user document with progress data');
      try {
        await updateDoc(doc(db, 'users', userId), { 
          progress: cleanedProgress,
          updatedAt: serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error during updateDoc operation:', updateError);
        // If update fails, try setDoc as a fallback
        console.log('Attempting setDoc as fallback...');
        const existingData = userDoc.data() || {};
        await setDoc(doc(db, 'users', userId), { 
          ...existingData,
          progress: cleanedProgress,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Verify the save was successful
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().progress) {
      const savedProgress = verifyDoc.data().progress;
      console.log('Progress saved and verified successfully:', savedProgress.length, 'entries');
      
      // Check if the saved data has colors
      const hasColorsData = savedProgress.some((p: any) => p.completion > 0);
      console.log('Progress data has completion values:', hasColorsData);
      
      return { success: true };
    } else {
      console.error('Progress data was not saved properly');
      return { success: false, error: 'Progress data was not saved properly' };
    }
  } catch (error: unknown) {
    console.error('Error saving progress:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Streak
export const saveStreak = async (userId: string, streak: StreakData) => {
  try {
    console.log('Saving streak data to Firestore for user', userId);
    console.log('Streak data:', streak);
    
    if (!userId) {
      console.error('Cannot save streak: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Clean streak data
    const cleanedStreak = removeUndefinedValues(streak);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      // Create the document with streak if it doesn't exist
      console.log('Creating new user document with streak data');
      await setDoc(doc(db, 'users', userId), { 
        streak: cleanedStreak,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing document
      console.log('Updating existing user document with streak data');
      try {
        await updateDoc(doc(db, 'users', userId), { 
          streak: cleanedStreak,
          updatedAt: serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error during updateDoc operation:', updateError);
        // If update fails, try setDoc as a fallback
        console.log('Attempting setDoc as fallback...');
        const existingData = userDoc.data() || {};
        await setDoc(doc(db, 'users', userId), { 
          ...existingData,
          streak: cleanedStreak,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Verify the save was successful
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().streak) {
      console.log('Streak saved and verified successfully');
      return { success: true };
    } else {
      console.error('Streak data was not saved properly');
      return { success: false, error: 'Streak data was not saved properly' };
    }
  } catch (error: unknown) {
    console.error('Error saving streak:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Add this interface if it doesn't exist
interface SaveResult {
  success: boolean;
  error?: string;
  message?: string;
}

// Bookmarks
export async function saveBookmarks(userId: string, bookmarks: Bookmark[]): Promise<SaveResult> {
  if (!userId) {
    console.error('[FIREBASE ERROR] Cannot save bookmarks: userId is missing');
    return { success: false, error: 'User ID is required' };
  }

  // Add more logging and handle potential Firebase outages
  console.log(`[FIREBASE BOOKMARKS] Beginning save of ${bookmarks.length} bookmarks for user ${userId.substring(0, 5)}`);
  
  // First try the direct approach
  try {
    // Get a reference to the user document
    const userRef = doc(db, "users", userId);
    
    // Check if user document exists
    console.log(`[FIREBASE BOOKMARKS] Checking if user document exists...`);
    const userDoc = await getDoc(userRef);
    
    // Create basic document if it doesn't exist
    if (!userDoc.exists()) {
      console.log(`[FIREBASE BOOKMARKS] User document doesn't exist, creating it first`);
      try {
        await setDoc(userRef, { 
          bookmarks: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log(`[FIREBASE BOOKMARKS] Created basic user document`);
      } catch (createError) {
        console.error(`[FIREBASE ERROR] Failed to create user document:`, createError);
      }
    }
    
    // Now try to save the bookmarks - first with updateDoc
    console.log(`[FIREBASE BOOKMARKS] Attempting to save bookmarks with updateDoc`);
    try {
      await updateDoc(userRef, {
        bookmarks: bookmarks,
        updatedAt: serverTimestamp()
      });
      
      console.log(`[FIREBASE SUCCESS] Bookmarks saved successfully with updateDoc`);
      return { success: true };
    } catch (updateError) {
      console.error(`[FIREBASE ERROR] updateDoc failed:`, updateError);
      
      // Try with setDoc as a fallback (merge to preserve other fields)
      console.log(`[FIREBASE BOOKMARKS] Falling back to setDoc`);
      try {
        // Get the current document data to preserve it
        const refreshedDoc = await getDoc(userRef);
        const existingData = refreshedDoc.exists() ? refreshedDoc.data() : {};
        
        await setDoc(userRef, {
          ...existingData,
          bookmarks: bookmarks,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        console.log(`[FIREBASE SUCCESS] Bookmarks saved successfully with setDoc fallback`);
        return { success: true };
      } catch (setDocError) {
        console.error(`[FIREBASE ERROR] setDoc fallback also failed:`, setDocError);
        
        // One last attempt - save to a direct document path
        console.log(`[FIREBASE BOOKMARKS] Attempting last resort save method`);
        try {
          const timestamp = Date.now();
          const backupDocRef = doc(db, "userBookmarksBackup", `${userId}_${timestamp}`);
          
          await setDoc(backupDocRef, {
            userId: userId,
            bookmarks: bookmarks,
            timestamp: timestamp,
            savedAt: serverTimestamp()
          });
          
          console.log(`[FIREBASE SUCCESS] Bookmarks saved to backup location`);
          return { success: true, message: "Saved to backup location" };
        } catch (finalError) {
          console.error(`[FIREBASE ERROR] All save attempts failed:`, finalError);
          return { success: false, error: 'All save methods failed' };
        }
      }
    }
  } catch (error: any) {
    console.error('[FIREBASE ERROR] Error in saveBookmarks:', error);
    
    // Try the direct approach to userBookmarksBackup
    try {
      console.log(`[FIREBASE BOOKMARKS] Attempting emergency backup save`);
      const timestamp = Date.now();
      const backupDocRef = doc(db, "userBookmarksBackup", `${userId}_${timestamp}`);
      
      await setDoc(backupDocRef, {
        userId: userId,
        bookmarks: bookmarks,
        timestamp: timestamp,
        savedAt: serverTimestamp()
      });
      
      console.log(`[FIREBASE SUCCESS] Bookmarks saved to emergency backup location`);
      return { success: true, message: "Saved to emergency backup" };
    } catch (backupError) {
      console.error(`[FIREBASE ERROR] Even backup save failed:`, backupError);
      return { 
        success: false, 
        error: `Failed to save bookmarks: ${error?.message || 'Unknown error'}`
      };
    }
  }
}

// Load bookmarks with new structure
export const loadBookmarks = async (userId: string) => {
  try {
    console.log('Loading bookmarks for user', userId);
    
    if (!userId) {
      console.error('Cannot load bookmarks: User ID is null or undefined');
      return { success: false, error: 'User ID is required', data: [] };
    }
    
    // First try to load from the new structure
    const bookmarksDoc = await getDoc(doc(db, 'users', userId, 'userData', 'bookmarks'));
    
    if (bookmarksDoc.exists() && bookmarksDoc.data().items) {
      console.log('Found bookmarks in new structure');
      return { success: true, data: bookmarksDoc.data().items };
    } else {
      // Fall back to old structure
      console.log('No bookmarks found in new structure, trying old structure');
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists() && userDoc.data().bookmarks) {
        return { success: true, data: userDoc.data().bookmarks };
      } else {
        return { success: true, data: [] };
      }
    }
  } catch (error: unknown) {
    console.error('Error loading bookmarks:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      data: []
    };
  }
};

// Tags
export const saveTags = async (userId: string, tags: TaskTag[]) => {
  try {
    console.log('Saving tags to Firestore:', tags.length, 'tags for user', userId);
    
    if (!userId) {
      console.error('Cannot save tags: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Remove undefined values from tags
    const cleanedTags = removeUndefinedValues(tags);
    console.log('Cleaned tags for Firestore:', cleanedTags.length);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      // Create the document with tags if it doesn't exist
      console.log('Creating new user document with tags');
      await setDoc(doc(db, 'users', userId), { 
        tags: cleanedTags,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing document
      console.log('Updating existing user document with tags');
      try {
        await updateDoc(doc(db, 'users', userId), { 
          tags: cleanedTags,
          updatedAt: serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error during updateDoc operation:', updateError);
        // If update fails, try setDoc as a fallback
        console.log('Attempting setDoc as fallback...');
        const existingData = userDoc.data() || {};
        await setDoc(doc(db, 'users', userId), { 
          ...existingData,
          tags: cleanedTags,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Verify the save was successful by reading the data back
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().tags) {
      console.log('Tags saved and verified successfully. Count:', verifyDoc.data().tags.length);
      return { success: true };
    } else {
      console.error('Tags were not saved properly');
      return { success: false, error: 'Tags were not saved properly' };
    }
  } catch (error: unknown) {
    console.error('Error saving tags:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Authentication functions
export const signInWithEmail = async (email: string, password: string) => {
  try {
    console.log('Attempting to sign in with email...');
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('Sign in successful:', result.user.email);
    return { success: true, user: result.user };
  } catch (error: unknown) {
    console.error('Sign in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Initialize user data in Firestore
    await initializeUserData(result.user.uid, {
      email: result.user.email,
      createdAt: serverTimestamp(),
    });
    
    return { success: true, user: result.user };
  } catch (error: unknown) {
    console.error('Sign up error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    
    // Check if user document exists, if not initialize it
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await initializeUserData(result.user.uid, {
        email: result.user.email,
        name: result.user.displayName,
        createdAt: serverTimestamp(),
      });
    }
    
    return { success: true, user: result.user };
  } catch (error: unknown) {
    console.error('Google sign in error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return { success: true };
  } catch (error: unknown) {
    console.error('Sign out error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

// Initialize user data with empty arrays for all collections
export const initializeUserData = async (userId: string, userData: Record<string, unknown> = {}) => {
  try {
    console.log('[FIREBASE INIT] Initializing user data for:', userId);
    
    // Check if user document already exists
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    const defaultData = {
      tasks: [],
      progress: [],
      streak: {
        currentStreak: 0,
        longestStreak: 0,
        lastCompletionDate: null,
      },
      tags: [],
      bookmarks: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Define default tags that all users should have
    const defaultTags = [
      { id: "1", name: "Work", color: "#4C51BF" },
      { id: "2", name: "Personal", color: "#38A169" },
      { id: "3", name: "Health", color: "#E53E3E" },
      { id: "4", name: "Learning", color: "#D69E2E" },
      { id: "5", name: "Family", color: "#DD6B20" },
      { id: "6", name: "Home", color: "#805AD5" },
      { id: "7", name: "Finance", color: "#2F855A" },
      { id: "8", name: "Urgent", color: "#F56565" },
      { id: "9", name: "Hobby", color: "#4299E1" },
      { id: "10", name: "Social", color: "#ED64A6" },
    ];
    
    // Merge with default tags
    const completeData = {
      ...defaultData,
      tags: defaultTags,
      ...userData
    };
    
    if (userDoc.exists()) {
      console.log('[FIREBASE INIT] User document already exists, updating with default data if needed');
      
      // Get current data
      const currentData = userDoc.data();
      const dataToUpdate: Record<string, any> = {};
      
      // Check what fields are missing and add them
      if (!currentData.tasks) dataToUpdate.tasks = completeData.tasks;
      if (!currentData.progress) dataToUpdate.progress = completeData.progress;
      if (!currentData.streak) dataToUpdate.streak = completeData.streak;
      if (!currentData.bookmarks) dataToUpdate.bookmarks = completeData.bookmarks;
      if (!currentData.tags || currentData.tags.length === 0) dataToUpdate.tags = completeData.tags;
      
      // Only update if we have fields to update
      if (Object.keys(dataToUpdate).length > 0) {
        console.log('[FIREBASE INIT] Updating missing fields:', Object.keys(dataToUpdate));
        await updateDoc(userRef, {
          ...dataToUpdate,
          updatedAt: serverTimestamp()
        });
      }
    } else {
      console.log('[FIREBASE INIT] Creating new user document with complete data');
      // Create new document with complete structure
      await setDoc(userRef, completeData);
    }
    
    // Verify the user document was created/updated properly
    const verifyDoc = await getDoc(userRef);
    if (!verifyDoc.exists()) {
      console.error('[FIREBASE INIT] Failed to create/update user document');
      return { success: false, error: 'Failed to initialize user data' };
    }
    
    console.log('[FIREBASE INIT] User data initialized successfully');
    return { success: true };
  } catch (error: unknown) {
    console.error('[FIREBASE INIT] Error initializing user data:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

// Add this new function to force save all user data at once
export const forceSaveAllUserData = async (userId: string, userData: {
  tasks?: Task[],
  bookmarks?: Bookmark[],
  progress?: DailyProgress[],
  streak?: StreakData,
  tags?: TaskTag[]
}) => {
  try {
    console.log('==========================================');
    console.log('FORCE SAVING ALL USER DATA');
    console.log('User ID:', userId);
    if (userData.tasks) console.log('Tasks count:', userData.tasks.length);
    if (userData.bookmarks) console.log('Bookmarks count:', userData.bookmarks.length);
    if (userData.progress) console.log('Progress entries:', userData.progress.length);
    if (userData.tags) console.log('Tags count:', userData.tags.length);
    console.log('==========================================');
    
    if (!userId) {
      console.error('Cannot save user data: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Clean all data
    const cleanedData = {
      ...(userData.tasks && { tasks: removeUndefinedValues(userData.tasks) }),
      ...(userData.bookmarks && { bookmarks: removeUndefinedValues(userData.bookmarks) }),
      ...(userData.progress && { progress: removeUndefinedValues(userData.progress) }),
      ...(userData.streak && { streak: removeUndefinedValues(userData.streak) }),
      ...(userData.tags && { tags: removeUndefinedValues(userData.tags) }),
      updatedAt: serverTimestamp()
    };
    
    // Check if user document exists
    console.log('Checking if user document exists...');
    const userDoc = await getDoc(doc(db, 'users', userId));
    console.log('User document exists:', userDoc.exists());
    
    try {
      if (userDoc.exists()) {
        // Get existing data
        const existingData = userDoc.data();
        console.log('Merging with existing data and saving...');
        
        // Combine existing data with new data, prioritizing new data
        await setDoc(doc(db, 'users', userId), {
          ...existingData,
          ...cleanedData
        }, { merge: true });
      } else {
        // Create new document with complete structure
        console.log('Creating new user document with complete data...');
        const completeData = {
          tasks: userData.tasks || [],
          bookmarks: userData.bookmarks || [],
          progress: userData.progress || [],
          streak: userData.streak || {
            currentStreak: 0,
            longestStreak: 0,
            lastCompletionDate: null
          },
          tags: userData.tags || [],
          createdAt: serverTimestamp(),
          ...cleanedData
        };
        
        await setDoc(doc(db, 'users', userId), completeData);
      }
      
      console.log('Force save operation completed. Verifying...');
      
      // Verify data was saved
      const verifyDoc = await getDoc(doc(db, 'users', userId));
      if (!verifyDoc.exists()) {
        console.error('User document does not exist after save!');
        return { success: false, error: 'Failed to save user data' };
      }
      
      const savedData = verifyDoc.data();
      let success = true;
      
      // Check if each data type was saved properly
      if (userData.tasks && (!savedData.tasks || savedData.tasks.length !== userData.tasks.length)) {
        console.error('Tasks were not saved properly');
        success = false;
      }
      
      if (userData.bookmarks && (!savedData.bookmarks || savedData.bookmarks.length !== userData.bookmarks.length)) {
        console.error('Bookmarks were not saved properly');
        success = false;
      }
      
      if (userData.progress && (!savedData.progress || savedData.progress.length !== userData.progress.length)) {
        console.error('Progress was not saved properly');
        success = false;
      }
      
      if (userData.tags && (!savedData.tags || savedData.tags.length !== userData.tags.length)) {
        console.error('Tags were not saved properly');
        success = false;
      }
      
      if (success) {
        console.log('All user data verified and saved successfully');
        console.log('==========================================');
        return { success: true };
      } else {
        console.error('Some user data was not saved properly');
        console.log('==========================================');
        return { success: false, error: 'Some user data was not saved properly' };
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      console.log('==========================================');
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (error: unknown) {
    console.error('Error in force save operation:', error);
    console.log('==========================================');
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export { auth, onAuthStateChanged, db }; 