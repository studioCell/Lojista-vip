
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Offer, Supplier, VipProduct, Course, CourseModule, Lesson, ChatMessage, UserRole, Story, Comment } from './types';
import { INITIAL_OFFERS, INITIAL_VIP_PRODUCTS, INITIAL_COURSES, INITIAL_SUPPLIERS } from './mockData';
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
  Unsubscribe
} from 'firebase/firestore';

interface AppContextType {
  user: User | null;
  allUsers: User[];
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string, whatsapp: string) => Promise<void>;
  logout: () => void;
  
  offers: Offer[];
  suppliers: Supplier[];
  vipProducts: VipProduct[];
  courses: Course[];
  stories: Story[];
  
  communityMessages: ChatMessage[];
  privateMessages: ChatMessage[];
  
  onlineCount: number;

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

// Helper to load from local storage (Legacy support for non-chat items)
const loadFromStorage = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    return fallback;
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data States - Users and Chat are now Realtime via Firestore
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);

  // Legacy LocalStorage States (can be migrated to Firestore later if needed)
  const [offers, setOffers] = useState<Offer[]>(() => loadFromStorage('lv_offers', INITIAL_OFFERS));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('lv_suppliers', INITIAL_SUPPLIERS));
  const [vipProducts, setVipProducts] = useState<VipProduct[]>(() => loadFromStorage('lv_vip_products', INITIAL_VIP_PRODUCTS));
  const [courses, setCourses] = useState<Course[]>(() => loadFromStorage('lv_courses', INITIAL_COURSES));
  const [stories, setStories] = useState<Story[]>(() => loadFromStorage('lv_stories', []));
  
  const [onlineCount, setOnlineCount] = useState(24);

  // --- 1. AUTHENTICATION & USER PROFILE SYNC ---
  useEffect(() => {
    let userUnsub: Unsubscribe | null = null;

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            const userRef = doc(db, 'users', firebaseUser.uid);
            // Listen to my own profile changes
            userUnsub = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = { id: firebaseUser.uid, ...docSnap.data() } as User;
                    // Force Admin Role logic
                    if (firebaseUser.email === 'm.mateushugo123@gmail.com') {
                         userData.role = UserRole.ADMIN;
                         userData.permissions = { suppliers: true, courses: true };
                    }
                    setCurrentUser(userData);
                } else {
                     // Create profile if missing
                     const isHardcodedAdmin = firebaseUser.email === 'm.mateushugo123@gmail.com';
                     const newUser: User = {
                        id: firebaseUser.uid,
                        name: firebaseUser.displayName || 'Lojista',
                        email: firebaseUser.email!,
                        role: isHardcodedAdmin ? UserRole.ADMIN : UserRole.USER,
                        avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'L')}&background=FACC15&color=000`,
                        permissions: { suppliers: isHardcodedAdmin, courses: isHardcodedAdmin },
                        subscriptionDueDate: '',
                        allowedSuppliers: [],
                        allowedCourses: []
                    };
                    setDoc(doc(db, 'users', firebaseUser.uid), newUser);
                    setCurrentUser(newUser);
                }
                setIsLoading(false);
            });
        } else {
            setCurrentUser(null);
            setIsLoading(false);
            if (userUnsub) userUnsub();
        }
    });

    return () => {
        authUnsub();
        if (userUnsub) userUnsub();
    };
  }, []);

  // --- 2. REAL-TIME DATA LISTENERS ---

  // Sync All Users (Required for Chat List)
  useEffect(() => {
      const q = query(collection(db, 'users'));
      const unsub = onSnapshot(q, (snap) => {
          setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      });
      return () => unsub();
  }, []);

  // Sync All Messages
  useEffect(() => {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc')); 
      const unsub = onSnapshot(q, (snap) => {
          const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
          
          setCommunityMessages(allMsgs.filter(m => m.channelId === 'community'));
          setPrivateMessages(allMsgs.filter(m => m.channelId !== 'community'));
      });
      return () => unsub();
  }, []);

  // Simulate Online Count
  useEffect(() => {
    const interval = setInterval(() => {
        setOnlineCount(prev => Math.max(10, prev + (Math.floor(Math.random() * 5) - 2)));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- PERSISTENCE FOR LEGACY DATA ---
  useEffect(() => { localStorage.setItem('lv_offers', JSON.stringify(offers)); }, [offers]);
  useEffect(() => { localStorage.setItem('lv_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('lv_vip_products', JSON.stringify(vipProducts)); }, [vipProducts]);
  useEffect(() => { localStorage.setItem('lv_courses', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('lv_stories', JSON.stringify(stories)); }, [stories]);

  // --- ACTIONS ---

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
  };

  const register = async (name: string, email: string, password: string, whatsapp: string) => {
      setIsLoading(true);
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        
        const isHardcodedAdmin = email.toLowerCase() === 'm.mateushugo123@gmail.com';
        const newUser: User = {
            id: userCred.user.uid,
            name,
            email,
            whatsapp,
            role: isHardcodedAdmin ? UserRole.ADMIN : UserRole.USER,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FACC15&color=000`,
            permissions: { suppliers: isHardcodedAdmin, courses: isHardcodedAdmin },
            subscriptionDueDate: '',
            allowedSuppliers: [],
            allowedCourses: []
        };

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

  const sendCommunityMessage = async (text: string, imageUrl?: string) => {
      if (!currentUser) return;
      const newMsg = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar || '',
          text,
          imageUrl: imageUrl || null,
          channelId: 'community',
          createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'messages'), newMsg);
  };

  const sendPrivateMessage = async (text: string, targetUserId: string, imageUrl?: string) => {
      if (!currentUser) return;
      const newMsg = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar || '',
          text,
          imageUrl: imageUrl || null,
          channelId: targetUserId, // Convention: Support chat channel name is the USER's ID
          createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'messages'), newMsg);
  };

  // Legacy Data Actions (LocalStorage)
  const addOffer = async (offer: Offer) => setOffers([offer, ...offers]);
  const deleteOffer = async (id: string) => setOffers(offers.filter(o => o.id !== id));
  const addHeat = async (offerId: string) => setOffers(offers.map(o => o.id === offerId ? { ...o, likes: o.likes + 1 } : o));
  const addComment = async (offerId: string, text: string) => {
      if (!currentUser) return;
      setOffers(offers.map(o => {
          if (o.id === offerId) {
              const newComment: Comment = {
                  id: Date.now().toString(),
                  userId: currentUser.id,
                  userName: currentUser.name,
                  userAvatar: currentUser.avatar || '',
                  text,
                  timestamp: 'Agora'
              };
              return { ...o, comments: [...o.comments, newComment] };
          }
          return o;
      }));
  };
  const addSupplier = async (supplier: Supplier) => setSuppliers([...suppliers, supplier]);
  const updateSupplier = async (id: string, updates: Partial<Supplier>) => setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s));
  const addProduct = async (product: VipProduct) => setVipProducts([...vipProducts, product]);
  const addCourse = async (course: Course) => setCourses([...courses, course]);
  const addModule = async (courseId: string, title: string) => {
    setCourses(courses.map(c => c.id === courseId ? { ...c, modules: [...c.modules, { id: Date.now().toString(), title, lessons: [] }] } : c));
  };
  const addLesson = async (courseId: string, moduleId: string, lesson: Lesson) => {
    setCourses(courses.map(c => c.id === courseId ? {
        ...c, modules: c.modules.map(m => m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m), lessonCount: c.lessonCount + 1
    } : c));
  };
  const updateLesson = async (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setCourses(courses.map(c => c.id === courseId ? {
        ...c, modules: c.modules.map(m => m.id === moduleId ? { ...m, lessons: m.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l) } : m)
    } : c));
  };
  const addStory = async (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser) return;
    setStories([{ id: Date.now().toString(), userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatar || '', mediaUrl, mediaType, timestamp: 'Agora', isViewed: false }, ...stories]);
  };
  const toggleUserPermission = async (userId: string, permission: 'suppliers' | 'courses') => {};
  const updateUserAccess = async (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => {};

  return (
    <AppContext.Provider value={{
      user: currentUser, allUsers, isLoading, login, loginWithGoogle, register, logout,
      offers, suppliers, vipProducts, courses, stories, communityMessages, privateMessages, onlineCount,
      addOffer, deleteOffer, addHeat, addComment, addSupplier, updateSupplier, addProduct, addCourse, addModule, addLesson, updateLesson, addStory,
      sendCommunityMessage, sendPrivateMessage, toggleUserPermission, updateUserAccess
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
