
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Offer, Supplier, VipProduct, Course, CourseModule, Lesson, ChatMessage, UserRole, Story, Comment } from './types';
import { INITIAL_OFFERS, INITIAL_VIP_PRODUCTS, INITIAL_COURSES, INITIAL_SUPPLIERS, MOCK_USERS_LIST } from './mockData';
import { auth, db } from './firebase';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged, 
    User as FirebaseUser,
    createUserWithEmailAndPassword,
    updateProfile,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  arrayUnion,
  query,
  orderBy,
  onSnapshot,
  increment,
  writeBatch
} from 'firebase/firestore';

// --- Types & Context Definition ---

interface AppContextType {
  user: User | null;
  allUsers: User[];
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string, whatsapp: string) => Promise<void>;
  logout: () => void;
  
  // Data
  offers: Offer[];
  suppliers: Supplier[];
  vipProducts: VipProduct[];
  courses: Course[];
  stories: Story[];
  communityMessages: ChatMessage[];
  privateMessages: ChatMessage[]; 
  onlineCount: number;

  // Actions
  addOffer: (offer: Offer) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  addHeat: (offerId: string) => Promise<void>;
  addComment: (offerId: string, text: string) => Promise<void>;

  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (id: string, updates: Partial<Supplier>) => Promise<void>;
  
  addProduct: (product: VipProduct) => Promise<void>;
  
  addCourse: (course: Course) => Promise<void>;
  addModule: (courseId: string, title: string) => Promise<void>;
  addLesson: (courseId: string, moduleId: string, lesson: Lesson) => Promise<void>;
  updateLesson: (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => Promise<void>;
  
  addStory: (mediaUrl: string, mediaType: 'image' | 'video') => Promise<void>;
  
  sendCommunityMessage: (text: string, imageUrl?: string) => Promise<void>;
  sendPrivateMessage: (text: string, targetUserId: string, imageUrl?: string) => Promise<void>;
  
  toggleUserPermission: (userId: string, permission: 'suppliers' | 'courses') => Promise<void>;
  updateUserAccess: (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Provider ---

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  // Data States (initialized empty, filled by Firestore)
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vipProducts, setVipProducts] = useState<VipProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  
  const [onlineCount, setOnlineCount] = useState(24);

  // --- 1. AUTHENTICATION LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user) {
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const userData = { id: user.uid, ...docSnap.data() } as User;
                    // FORCE ADMIN
                    if (user.uid === 'EfskGEgsJiPW6A5gVkv5YklBLHs2') {
                         userData.role = UserRole.ADMIN;
                         userData.permissions = { suppliers: true, courses: true };
                    }
                    setCurrentUser(userData);
                } else {
                     // Fallback creation if not in DB yet
                     const isHardcodedAdmin = user.uid === 'EfskGEgsJiPW6A5gVkv5YklBLHs2';
                     const newUser: User = {
                        id: user.uid,
                        name: user.displayName || 'Lojista',
                        email: user.email!,
                        role: isHardcodedAdmin ? UserRole.ADMIN : UserRole.USER,
                        avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'L')}&background=FACC15&color=000`,
                        permissions: { suppliers: true, courses: true }
                    };
                    await setDoc(doc(db, 'users', user.uid), newUser);
                    setCurrentUser(newUser);
                }
            } catch (error) {
                console.error("Auth Error", error);
            }
        } else {
            setCurrentUser(null);
        }
        setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // --- 2. DATA LISTENERS (REAL-TIME DATABASE) ---

  // Sync Users
  useEffect(() => {
      const q = query(collection(db, 'users'));
      const unsub = onSnapshot(q, (snap) => {
          setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      });
      return () => unsub();
  }, []);

  // Sync Offers
  useEffect(() => {
      const q = query(collection(db, 'offers'), orderBy('timestamp', 'desc')); // Assuming ISO string works for order, or use createdAt
      const unsub = onSnapshot(q, (snap) => {
          // This ensures that whenever the DB changes, the state updates automatically
          setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Offer)));
      });
      return () => unsub();
  }, []);

  // Sync Suppliers
  useEffect(() => {
      const q = query(collection(db, 'suppliers'));
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
          setSuppliers(list);
          
          // SEEDING: If empty, populate with Mock Data
          if (list.length === 0 && !isLoading) {
             // seedSuppliers(); // Call explicitly or handle elsewhere
          }
      });
      return () => unsub();
  }, [isLoading]);

  // Sync Products
  useEffect(() => {
      const q = query(collection(db, 'vip_products'));
      const unsub = onSnapshot(q, (snap) => setVipProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as VipProduct))));
      return () => unsub();
  }, []);

  // Sync Courses
  useEffect(() => {
      const q = query(collection(db, 'courses'));
      const unsub = onSnapshot(q, (snap) => setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course))));
      return () => unsub();
  }, []);

  // Sync Stories
  useEffect(() => {
      const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
          setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Story)));
      });
      return () => unsub();
  }, []);

  // Sync Messages
  useEffect(() => {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc')); 
      const unsub = onSnapshot(q, (snap) => {
          const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
          setCommunityMessages(allMsgs.filter(m => m.channelId === 'community'));
          setPrivateMessages(allMsgs.filter(m => m.channelId !== 'community'));
      });
      return () => unsub();
  }, []);

  // --- 3. SEEDING FUNCTION (Auto-populate DB if empty) ---
  useEffect(() => {
      // Simple timeout to allow firestore to connect before deciding it's empty
      const timer = setTimeout(() => {
          setDataLoading(false);
          // Only seed if absolutely empty to avoid duplicates
          if (suppliers.length === 0 && !isLoading) {
             // INITIAL_SUPPLIERS.forEach(s => setDoc(doc(db, 'suppliers', s.id), s));
          }
          if (offers.length === 0 && !isLoading) {
             // INITIAL_OFFERS.forEach(o => setDoc(doc(db, 'offers', o.id), o));
          }
      }, 3000);
      
      return () => clearTimeout(timer);
  }, []); 

  // Simulate Online Count
  useEffect(() => {
    const interval = setInterval(() => {
        setOnlineCount(prev => Math.max(10, prev + (Math.floor(Math.random() * 5) - 2)));
    }, 5000);
    return () => clearInterval(interval);
  }, []);


  // --- 4. AUTH ACTIONS ---

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
        await signInWithEmailAndPassword(auth, email, password || '');
        return true; 
    } catch (error) {
        setIsLoading(false);
        throw error;
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // User creation handled in onAuthStateChanged
  };

  const register = async (name: string, email: string, password: string, whatsapp: string) => {
      setIsLoading(true);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        
        const isHardcodedAdmin = userCred.user.uid === 'EfskGEgsJiPW6A5gVkv5YklBLHs2';
        const newUser: User = {
            id: userCred.user.uid,
            name,
            email,
            whatsapp,
            role: isHardcodedAdmin ? UserRole.ADMIN : UserRole.USER,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FACC15&color=000`,
            permissions: { suppliers: isHardcodedAdmin, courses: isHardcodedAdmin }
        };

        if (email.toLowerCase() === 'm.mateushugo123@gmail.com') {
            newUser.role = UserRole.ADMIN;
            newUser.permissions = { suppliers: true, courses: true };
        }

        await setDoc(doc(db, 'users', userCred.user.uid), newUser);
      } catch (error) {
          setIsLoading(false);
          throw error;
      }
  };

  const logout = async () => {
      setIsLoading(true);
      await signOut(auth);
  };

  // --- 5. DATA ACTIONS (FIRESTORE) ---

  // USERS
  const toggleUserPermission = async (userId: string, permission: 'suppliers' | 'courses') => {
      const u = allUsers.find(user => user.id === userId);
      if (!u) return;
      
      const newPermissions = {
          ...u.permissions,
          [permission]: !u.permissions[permission]
      };
      
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
  };

  const updateUserAccess = async (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => {
      await updateDoc(doc(db, 'users', userId), {
          subscriptionDueDate: dueDate,
          allowedSuppliers: supplierIds,
          allowedCourses: courseIds
      });
  };

  // OFFERS
  const addOffer = async (offer: Offer) => {
      const cleanOffer = JSON.parse(JSON.stringify(offer));
      delete cleanOffer.id; 
      
      // Add server timestamp for sorting
      cleanOffer.timestamp = new Date().toISOString(); 
      cleanOffer.createdAt = new Date().toISOString();

      await addDoc(collection(db, 'offers'), cleanOffer);
  };

  const deleteOffer = async (id: string) => {
      await deleteDoc(doc(db, 'offers', id));
  };

  const addHeat = async (offerId: string) => {
      await updateDoc(doc(db, 'offers', offerId), {
          likes: increment(1)
      });
  };

  const addComment = async (offerId: string, text: string) => {
      if (!currentUser) return;
      const newComment: Comment = {
          id: Date.now().toString(),
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar || '',
          text,
          timestamp: 'Agora' 
      };
      await updateDoc(doc(db, 'offers', offerId), {
          comments: arrayUnion(newComment)
      });
  };

  // SUPPLIERS
  const addSupplier = async (supplier: Supplier) => {
      const clean = JSON.parse(JSON.stringify(supplier));
      await setDoc(doc(db, 'suppliers', supplier.id), clean);
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
      await updateDoc(doc(db, 'suppliers', id), updates);
  };

  // VIP PRODUCTS
  const addProduct = async (product: VipProduct) => {
      const clean = JSON.parse(JSON.stringify(product));
      await setDoc(doc(db, 'vip_products', product.id), clean);
  };

  // COURSES
  const addCourse = async (course: Course) => {
      const clean = JSON.parse(JSON.stringify(course));
      await setDoc(doc(db, 'courses', course.id), clean);
  };

  const addModule = async (courseId: string, title: string) => {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      if (!courseSnap.exists()) return;

      const courseData = courseSnap.data() as Course;
      const newModule: CourseModule = {
          id: Date.now().toString(),
          title,
          lessons: []
      };
      const updatedModules = [...courseData.modules, newModule];
      
      await updateDoc(courseRef, { modules: updatedModules });
  };

  const addLesson = async (courseId: string, moduleId: string, lesson: Lesson) => {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      if (!courseSnap.exists()) return;

      const courseData = courseSnap.data() as Course;
      const updatedModules = courseData.modules.map(m => {
          if (m.id === moduleId) {
              return { ...m, lessons: [...m.lessons, lesson] };
          }
          return m;
      });

      await updateDoc(courseRef, { 
          modules: updatedModules,
          lessonCount: increment(1)
      });
  };

  const updateLesson = async (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      if (!courseSnap.exists()) return;

      const courseData = courseSnap.data() as Course;
      const updatedModules = courseData.modules.map(m => {
          if (m.id === moduleId) {
              const updatedLessons = m.lessons.map(l => {
                  if (l.id === lessonId) return { ...l, ...updates };
                  return l;
              });
              return { ...m, lessons: updatedLessons };
          }
          return m;
      });

      await updateDoc(courseRef, { modules: updatedModules });
  };

  // STORIES
  const addStory = async (mediaUrl: string, mediaType: 'image' | 'video') => {
      if (!currentUser) return;
      
      await addDoc(collection(db, 'stories'), {
          userId: currentUser.id,
          userName: currentUser.name,
          userAvatar: currentUser.avatar || '',
          mediaUrl,
          mediaType,
          timestamp: 'Agora', 
          createdAt: new Date().toISOString(),
          isViewed: false
      });
  };

  // MESSAGES
  const sendCommunityMessage = async (text: string, imageUrl?: string) => {
      if (!currentUser) return;
      const newMsg: ChatMessage = {
          id: Date.now().toString(),
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          text,
          imageUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channelId: 'community'
      };
      
      const { isMine, id, ...msgData } = newMsg; 
      await addDoc(collection(db, 'messages'), { ...msgData, createdAt: new Date().toISOString() });
  };

  const sendPrivateMessage = async (text: string, targetUserId: string, imageUrl?: string) => {
      if (!currentUser) return;
      const newMsg: ChatMessage = {
          id: Date.now().toString(),
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          text,
          imageUrl,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channelId: targetUserId 
      };
      
      const { isMine, id, ...msgData } = newMsg;
      await addDoc(collection(db, 'messages'), { ...msgData, createdAt: new Date().toISOString() });
  };

  // Transform messages for UI (calculate isMine dynamically)
  const uiCommunityMessages = communityMessages.map(m => ({
      ...m,
      isMine: currentUser ? m.senderId === currentUser.id : false
  }));

  const uiPrivateMessages = privateMessages.map(m => ({
      ...m,
      isMine: currentUser ? m.senderId === currentUser.id : false
  }));

  return (
    <AppContext.Provider value={{
      user: currentUser, 
      allUsers, 
      isLoading,
      login,
      loginWithGoogle, 
      register, 
      logout,
      
      offers, 
      suppliers, 
      vipProducts, 
      courses, 
      stories, 
      communityMessages: uiCommunityMessages, 
      privateMessages: uiPrivateMessages, 
      onlineCount,

      addOffer, 
      deleteOffer,
      addHeat, 
      addComment,
      
      addSupplier, 
      updateSupplier, 
      
      addProduct, 
      
      addCourse, 
      addModule, 
      addLesson, 
      updateLesson, 
      
      addStory, 
      
      sendCommunityMessage, 
      sendPrivateMessage, 
      
      toggleUserPermission, 
      updateUserAccess
    }}>
      {isLoading ? (
          <div className="min-h-screen bg-black flex items-center justify-center text-yellow-500 font-bold text-xl animate-pulse">
              Carregando Lojista VIP...
          </div>
      ) : children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
