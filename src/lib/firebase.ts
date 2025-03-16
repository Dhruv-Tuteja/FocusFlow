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
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { Task, DailyProgress, StreakData, Bookmark } from '@/types/task';

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
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() };
    } else {
      // Create empty user document if it doesn't exist
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
      };
      await setDoc(doc(db, 'users', userId), emptyUserData);
      return { success: true, data: emptyUserData };
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
      await updateDoc(doc(db, 'users', userId), { 
        tasks: cleanedTasks,
        updatedAt: serverTimestamp()
      });
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
    
    // Remove undefined values from progress
    const cleanedProgress = removeUndefinedValues(progress);
    
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
      await updateDoc(doc(db, 'users', userId), { 
        progress: cleanedProgress,
        updatedAt: serverTimestamp()
      });
    }
    
    // Verify the save was successful
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().progress) {
      console.log('Progress saved and verified successfully. Count:', verifyDoc.data().progress.length);
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
    
    if (!userId) {
      console.error('Cannot save streak: User ID is null or undefined');
      return { success: false, error: 'User ID is required' };
    }
    
    // Remove undefined values from streak
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
      await updateDoc(doc(db, 'users', userId), { 
        streak: cleanedStreak,
        updatedAt: serverTimestamp()
      });
    }
    
    // Verify the save was successful
    const verifyDoc = await getDoc(doc(db, 'users', userId));
    if (verifyDoc.exists() && verifyDoc.data().streak) {
      console.log('Streak saved and verified successfully:', verifyDoc.data().streak);
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
      await updateDoc(doc(db, 'users', userId), { 
        bookmarks: cleanedBookmarks,
        updatedAt: serverTimestamp()
      });
    }
    
    console.log('Bookmarks saved successfully');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error saving bookmarks:', error);
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