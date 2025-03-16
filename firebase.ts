import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  onSnapshot,
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

// Your Firebase configuration
// Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyBUdn27QMRO2TyNcU7x-9kfmFHCfwfLg7E",
  authDomain: "focusflow-ed406.firebaseapp.com",
  projectId: "focusflow-ed406",
  storageBucket: "focusflow-ed406.firebasestorage.app",
  messagingSenderId: "394273807903",
  appId: "1:394273807903:web:74813abdc1c313fb08ff2a",
  measurementId: "G-X8QX3DCX95"
};

/* 
  IMPORTANT: Replace the placeholder values above with your actual Firebase configuration.
  You can find these values in your Firebase project settings:
  1. Go to the Firebase console (https://console.firebase.google.com/)
  2. Select your project
  3. Click on the gear icon (⚙️) next to "Project Overview" to access project settings
  4. Scroll down to the "Your apps" section and select your web app
  5. Copy the configuration values from the Firebase SDK snippet
*/

// Initialize Firebase
let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase initialization error:", error);
  // We'll use localStorage as a fallback
}

// Auth providers
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();

// Demo mode helpers using localStorage
const USERS_KEY = 'focusflow_users';
const TASKS_KEY = 'focusflow_tasks';
const BOOKMARKS_KEY = 'focusflow_bookmarks';
const CURRENT_USER_KEY = 'focusflow_current_user';

// Initialize localStorage if needed
if (!localStorage.getItem(USERS_KEY)) {
  localStorage.setItem(USERS_KEY, JSON.stringify({}));
}
if (!localStorage.getItem(TASKS_KEY)) {
  localStorage.setItem(TASKS_KEY, JSON.stringify([]));
}
if (!localStorage.getItem(BOOKMARKS_KEY)) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([]));
}

// Helper functions for demo mode
const getUsers = () => {
  return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
};

const saveUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const getTasks = () => {
  return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
};

const saveTasks = (tasks) => {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
};

const getBookmarks = () => {
  return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
};

const saveBookmarks = (bookmarks) => {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
};

const getCurrentUser = () => {
  const userJson = localStorage.getItem(CURRENT_USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
};

const saveCurrentUser = (user) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

// Authentication functions
export const signInWithEmail = async (email, password) => {
  try {
    // Try Firebase first
    if (auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    }
    
    // Fallback to localStorage
    const users = getUsers();
    const user = Object.values(users).find(u => u.email === email);
    
    if (!user || user.password !== password) {
      throw new Error("Invalid email or password");
    }
    
    saveCurrentUser(user);
    
    // Simulate auth state change
    if (authStateListeners.length > 0) {
      authStateListeners.forEach(callback => callback(user));
    }
    
    return { success: true, user };
  } catch (error) {
    console.error("Error signing in:", error);
    return { success: false, error };
  }
};

export const signUpWithEmail = async (name, email, password) => {
  try {
    // Try Firebase first
    if (auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update profile with name
      await updateProfile(user, { displayName: name });
      
      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return { success: true, user };
    }
    
    // Fallback to localStorage
    const users = getUsers();
    
    // Check if email already exists
    if (Object.values(users).some(u => u.email === email)) {
      throw new Error("Email already in use");
    }
    
    const userId = 'user_' + Date.now();
    const newUser = {
      uid: userId,
      displayName: name,
      email,
      password, // In a real app, never store passwords in plain text
      photoURL: null,
      createdAt: new Date().toISOString(),
      providerData: [{ providerId: 'password' }]
    };
    
    users[userId] = newUser;
    saveUsers(users);
    
    // Also create user data
    const userData = {
      name,
      email,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createUserDocument(userId, userData);
    
    saveCurrentUser(newUser);
    
    // Simulate auth state change
    if (authStateListeners.length > 0) {
      authStateListeners.forEach(callback => callback(newUser));
    }
    
    return { success: true, user: newUser };
  } catch (error) {
    console.error("Error signing up:", error);
    return { success: false, error };
  }
};

export const signInWithGoogle = async () => {
  try {
    // Try Firebase first
    if (auth) {
      const userCredential = await signInWithPopup(auth, googleProvider);
      const user = userCredential.user;
      
      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      return { success: true, user };
    }
    
    // Fallback to localStorage - create a demo Google user
    const userId = 'google_user_' + Date.now();
    const newUser = {
      uid: userId,
      displayName: 'Google User',
      email: 'google.user@example.com',
      photoURL: 'https://lh3.googleusercontent.com/a/default-user',
      createdAt: new Date().toISOString(),
      providerData: [{ providerId: 'google.com' }]
    };
    
    const users = getUsers();
    users[userId] = newUser;
    saveUsers(users);
    
    // Also create user data
    const userData = {
      name: newUser.displayName,
      email: newUser.email,
      avatar: newUser.photoURL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createUserDocument(userId, userData);
    
    saveCurrentUser(newUser);
    
    // Simulate auth state change
    if (authStateListeners.length > 0) {
      authStateListeners.forEach(callback => callback(newUser));
    }
    
    return { success: true, user: newUser };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    return { success: false, error };
  }
};

export const signInWithGithub = async () => {
  try {
    // Try Firebase first
    if (auth) {
      const userCredential = await signInWithPopup(auth, githubProvider);
      const user = userCredential.user;
      
      // Check if user document exists, if not create it
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName,
          email: user.email,
          avatar: user.photoURL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      return { success: true, user };
    }
    
    // Fallback to localStorage - create a demo GitHub user
    const userId = 'github_user_' + Date.now();
    const newUser = {
      uid: userId,
      displayName: 'GitHub User',
      email: 'github.user@example.com',
      photoURL: 'https://avatars.githubusercontent.com/u/default',
      createdAt: new Date().toISOString(),
      providerData: [{ providerId: 'github.com' }]
    };
    
    const users = getUsers();
    users[userId] = newUser;
    saveUsers(users);
    
    // Also create user data
    const userData = {
      name: newUser.displayName,
      email: newUser.email,
      avatar: newUser.photoURL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await createUserDocument(userId, userData);
    
    saveCurrentUser(newUser);
    
    // Simulate auth state change
    if (authStateListeners.length > 0) {
      authStateListeners.forEach(callback => callback(newUser));
    }
    
    return { success: true, user: newUser };
  } catch (error) {
    console.error("Error signing in with GitHub:", error);
    return { success: false, error };
  }
};

export const logOut = async () => {
  try {
    // Try Firebase first
    if (auth) {
      await signOut(auth);
      return { success: true };
    }
    
    // Fallback to localStorage
    saveCurrentUser(null);
    
    // Simulate auth state change
    if (authStateListeners.length > 0) {
      authStateListeners.forEach(callback => callback(null));
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error signing out:", error);
    return { success: false, error };
  }
};

export const updateUserProfile = async (userId, userData) => {
  try {
    // Try Firebase first
    if (db) {
      await updateDoc(doc(db, "users", userId), {
        ...userData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    }
    
    // Fallback to localStorage
    const userDoc = await getUserDocument(userId);
    if (userDoc) {
      const updatedUserDoc = {
        ...userDoc,
        ...userData,
        updatedAt: new Date().toISOString()
      };
      
      await updateUserDocument(userId, updatedUserDoc);
      
      // Also update the current user if it's the same user
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.uid === userId) {
        currentUser.displayName = userData.name || currentUser.displayName;
        currentUser.photoURL = userData.avatar || currentUser.photoURL;
        saveCurrentUser(currentUser);
      }
      
      return { success: true };
    }
    
    throw new Error("User not found");
  } catch (error) {
    console.error("Error updating user profile:", error);
    return { success: false, error };
  }
};

// Task Functions
export const addTask = async (taskData) => {
  try {
    // Try Firebase first
    if (db) {
      const taskRef = doc(collection(db, "tasks"));
      await setDoc(taskRef, {
        ...taskData,
        id: taskRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: taskRef.id };
    }
    
    // Fallback to localStorage
    const tasks = getTasks();
    const newTask = {
      ...taskData,
      id: 'task_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tasks.push(newTask);
    saveTasks(tasks);
    
    // Notify listeners
    if (taskListeners[taskData.userId]) {
      const userTasks = tasks.filter(task => task.userId === taskData.userId);
      taskListeners[taskData.userId].forEach(callback => callback(userTasks));
    }
    
    return { success: true, id: newTask.id };
  } catch (error) {
    console.error("Error adding task:", error);
    return { success: false, error };
  }
};

export const updateTask = async (taskId, taskData) => {
  try {
    // Try Firebase first
    if (db) {
      await updateDoc(doc(db, "tasks", taskId), {
        ...taskData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    }
    
    // Fallback to localStorage
    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error("Task not found");
    }
    
    const userId = tasks[taskIndex].userId;
    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...taskData,
      updatedAt: new Date().toISOString()
    };
    
    saveTasks(tasks);
    
    // Notify listeners
    if (taskListeners[userId]) {
      const userTasks = tasks.filter(task => task.userId === userId);
      taskListeners[userId].forEach(callback => callback(userTasks));
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error updating task:", error);
    return { success: false, error };
  }
};

export const deleteTask = async (taskId) => {
  try {
    // Try Firebase first
    if (db) {
      await deleteDoc(doc(db, "tasks", taskId));
      return { success: true };
    }
    
    // Fallback to localStorage
    const tasks = getTasks();
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error("Task not found");
    }
    
    const userId = tasks[taskIndex].userId;
    tasks.splice(taskIndex, 1);
    saveTasks(tasks);
    
    // Notify listeners
    if (taskListeners[userId]) {
      const userTasks = tasks.filter(task => task.userId === userId);
      taskListeners[userId].forEach(callback => callback(userTasks));
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { success: false, error };
  }
};

// Keep track of task listeners
const taskListeners = {};

export const listenToTasks = (userId, callback) => {
  // Try Firebase first
  if (db) {
    const q = query(collection(db, "tasks"), where("userId", "==", userId));
    
    return onSnapshot(q, (querySnapshot) => {
      const tasks = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      callback(tasks);
    });
  }
  
  // Fallback to localStorage
  if (!taskListeners[userId]) {
    taskListeners[userId] = [];
  }
  
  taskListeners[userId].push(callback);
  
  // Initial call with current data
  const tasks = getTasks();
  const userTasks = tasks.filter(task => task.userId === userId);
  callback(userTasks);
  
  // Return unsubscribe function
  return () => {
    if (taskListeners[userId]) {
      const index = taskListeners[userId].indexOf(callback);
      if (index !== -1) {
        taskListeners[userId].splice(index, 1);
      }
    }
  };
};

// Bookmark Functions
export const addBookmark = async (bookmarkData) => {
  try {
    // Try Firebase first
    if (db) {
      const bookmarkRef = doc(collection(db, "bookmarks"));
      await setDoc(bookmarkRef, {
        ...bookmarkData,
        id: bookmarkRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, id: bookmarkRef.id };
    }
    
    // Fallback to localStorage
    const bookmarks = getBookmarks();
    const newBookmark = {
      ...bookmarkData,
      id: 'bookmark_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    bookmarks.push(newBookmark);
    saveBookmarks(bookmarks);
    
    // Notify listeners
    if (bookmarkListeners[bookmarkData.userId]) {
      const userBookmarks = bookmarks.filter(bookmark => bookmark.userId === bookmarkData.userId);
      bookmarkListeners[bookmarkData.userId].forEach(callback => callback(userBookmarks));
    }
    
    return { success: true, id: newBookmark.id };
  } catch (error) {
    console.error("Error adding bookmark:", error);
    return { success: false, error };
  }
};

export const updateBookmark = async (bookmarkId, bookmarkData) => {
  try {
    // Try Firebase first
    if (db) {
      await updateDoc(doc(db, "bookmarks", bookmarkId), {
        ...bookmarkData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    }
    
    // Fallback to localStorage
    const bookmarks = getBookmarks();
    const bookmarkIndex = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
    
    if (bookmarkIndex === -1) {
      throw new Error("Bookmark not found");
    }
    
    const userId = bookmarks[bookmarkIndex].userId;
    bookmarks[bookmarkIndex] = {
      ...bookmarks[bookmarkIndex],
      ...bookmarkData,
      updatedAt: new Date().toISOString()
    };
    
    saveBookmarks(bookmarks);
    
    // Notify listeners
    if (bookmarkListeners[userId]) {
      const userBookmarks = bookmarks.filter(bookmark => bookmark.userId === userId);
      bookmarkListeners[userId].forEach(callback => callback(userBookmarks));
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error updating bookmark:", error);
    return { success: false, error };
  }
};

export const deleteBookmark = async (bookmarkId) => {
  try {
    // Try Firebase first
    if (db) {
      await deleteDoc(doc(db, "bookmarks", bookmarkId));
      return { success: true };
    }
    
    // Fallback to localStorage
    const bookmarks = getBookmarks();
    const bookmarkIndex = bookmarks.findIndex(bookmark => bookmark.id === bookmarkId);
    
    if (bookmarkIndex === -1) {
      throw new Error("Bookmark not found");
    }
    
    const userId = bookmarks[bookmarkIndex].userId;
    bookmarks.splice(bookmarkIndex, 1);
    saveBookmarks(bookmarks);
    
    // Notify listeners
    if (bookmarkListeners[userId]) {
      const userBookmarks = bookmarks.filter(bookmark => bookmark.userId === userId);
      bookmarkListeners[userId].forEach(callback => callback(userBookmarks));
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error deleting bookmark:", error);
    return { success: false, error };
  }
};

// Keep track of bookmark listeners
const bookmarkListeners = {};

export const listenToBookmarks = (userId, callback) => {
  // Try Firebase first
  if (db) {
    const q = query(collection(db, "bookmarks"), where("userId", "==", userId));
    
    return onSnapshot(q, (querySnapshot) => {
      const bookmarks = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
      callback(bookmarks);
    });
  }
  
  // Fallback to localStorage
  if (!bookmarkListeners[userId]) {
    bookmarkListeners[userId] = [];
  }
  
  bookmarkListeners[userId].push(callback);
  
  // Initial call with current data
  const bookmarks = getBookmarks();
  const userBookmarks = bookmarks.filter(bookmark => bookmark.userId === userId);
  callback(userBookmarks);
  
  // Return unsubscribe function
  return () => {
    if (bookmarkListeners[userId]) {
      const index = bookmarkListeners[userId].indexOf(callback);
      if (index !== -1) {
        bookmarkListeners[userId].splice(index, 1);
      }
    }
  };
};

// Firestore functions
export const createUserDocument = async (userId, data) => {
  // Try Firebase first
  if (db) {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      createdAt: Timestamp.now()
    });
    return userRef;
  }
  
  // Fallback to localStorage
  const users = getUsers();
  const user = users[userId];
  
  if (user) {
    user.userData = {
      ...data,
      createdAt: data.createdAt || new Date().toISOString()
    };
    saveUsers(users);
  }
  
  return { id: userId };
};

export const getUserDocument = async (userId) => {
  // Try Firebase first
  if (db) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  }
  
  // Fallback to localStorage
  const users = getUsers();
  const user = users[userId];
  
  return user ? (user.userData || {
    name: user.displayName,
    email: user.email,
    avatar: user.photoURL,
    createdAt: user.createdAt
  }) : null;
};

export const updateUserDocument = async (userId, data) => {
  // Try Firebase first
  if (db) {
    const userRef = doc(db, 'users', userId);
    return updateDoc(userRef, data);
  }
  
  // Fallback to localStorage
  const users = getUsers();
  const user = users[userId];
  
  if (user) {
    user.userData = {
      ...(user.userData || {}),
      ...data,
      updatedAt: new Date().toISOString()
    };
    saveUsers(users);
  }
  
  return { success: true };
};

// Keep track of auth state listeners
const authStateListeners = [];

// Auth state observer
export const onAuthStateChange = (callback) => {
  // Try Firebase first
  if (auth) {
    return onAuthStateChanged(auth, callback);
  }
  
  // Fallback to localStorage
  authStateListeners.push(callback);
  
  // Initial call with current data
  const currentUser = getCurrentUser();
  callback(currentUser);
  
  // Return unsubscribe function
  return () => {
    const index = authStateListeners.indexOf(callback);
    if (index !== -1) {
      authStateListeners.splice(index, 1);
    }
  };
};

export { auth, db }; 