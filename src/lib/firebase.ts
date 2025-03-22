import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Task, DailyProgress, StreakData, Bookmark, TaskTag } from '@/types/task';

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
    // First get the current user data
    const userDoc = await getDoc(doc(db, 'users', userId));
    const currentData = userDoc.exists() ? userDoc.data() : {};
    
    // Merge the new data with existing data
    await setDoc(doc(db, 'users', userId), {
      ...currentData,
      ...data,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: unknown) {
    console.error('Error saving user data:', error);
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
export const saveTasks = async (userId: string, tasks: Task[]) => {
  try {
    console.log('Saving tasks to Firestore:', tasks.length, 'tasks for user', userId);
    
    if (!userId) {
      console.error('Cannot save tasks: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Remove undefined values from tasks
    const cleanedTasks = removeUndefinedValues(tasks);
    console.log('Cleaned tasks for Firestore:', cleanedTasks.length);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      // Create the document with tasks if it doesn't exist
      console.log('Creating new user document with tasks');
      await setDoc(doc(db, 'users', userId), { 
        tasks: cleanedTasks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing document
      console.log('Updating existing user document with tasks');
      try {
        await updateDoc(doc(db, 'users', userId), { 
          tasks: cleanedTasks,
          updatedAt: serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error during updateDoc operation:', updateError);
        // If update fails, try setDoc as a fallback
        console.log('Attempting setDoc as fallback...');
        const existingData = userDoc.data() || {};
        await setDoc(doc(db, 'users', userId), { 
          ...existingData,
          tasks: cleanedTasks,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Verify the save was successful by reading the data back
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().tasks) {
      console.log('Tasks saved and verified successfully. Count:', verifyDoc.data().tasks.length);
      return { success: true };
    } else {
      console.error('Tasks were not saved properly');
      return { success: false, error: 'Tasks were not saved properly' };
    }
  } catch (error: unknown) {
    console.error('Error saving tasks:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
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

// Bookmarks
export const saveBookmarks = async (userId: string, bookmarks: Bookmark[]) => {
  try {
    console.log('Saving bookmarks to Firestore:', bookmarks.length, 'bookmarks for user', userId);
    
    if (!userId) {
      console.error('Cannot save bookmarks: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Remove undefined values from bookmarks
    const cleanedBookmarks = removeUndefinedValues(bookmarks);
    console.log('Cleaned bookmarks for Firestore:', cleanedBookmarks.length);
    
    // Check if user document exists
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      // Create the document with bookmarks if it doesn't exist
      console.log('Creating new user document with bookmarks');
      await setDoc(doc(db, 'users', userId), { 
        bookmarks: cleanedBookmarks,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // Update existing document
      console.log('Updating existing user document with bookmarks');
      try {
        await updateDoc(doc(db, 'users', userId), { 
          bookmarks: cleanedBookmarks,
          updatedAt: serverTimestamp()
        });
      } catch (updateError) {
        console.error('Error during updateDoc operation:', updateError);
        // If update fails, try setDoc as a fallback
        console.log('Attempting setDoc as fallback...');
        const existingData = userDoc.data() || {};
        await setDoc(doc(db, 'users', userId), { 
          ...existingData,
          bookmarks: cleanedBookmarks,
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Verify the save was successful by reading the data back
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().bookmarks) {
      console.log('Bookmarks saved and verified successfully. Count:', verifyDoc.data().bookmarks.length);
      return { success: true };
    } else {
      console.error('Bookmarks were not saved properly');
      return { success: false, error: 'Bookmarks were not saved properly' };
    }
  } catch (error: unknown) {
    console.error('Error saving bookmarks:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
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
    console.log('Initializing user data for:', userId);
    
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
      updatedAt: serverTimestamp(),
    };
    
    await setDoc(doc(db, 'users', userId), {
      ...defaultData,
      ...userData
    });
    
    console.log('User data initialized successfully');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error initializing user data:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export { auth, onAuthStateChanged, db }; 