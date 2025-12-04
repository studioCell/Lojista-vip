
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
  allMessages: ChatMessage[]; // Unified message stream
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
  
  sendMessage: (text: string, targetId: string, imageUrl?: string) => Promise<void>;
  
  toggleUserPermission: (userId: string, permission: 'suppliers' | 'courses') => Promise<void>;
  updateUserAccess: (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vipProducts, setVipProducts] = useState<VipProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  
  // Real-time Chat
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  
  const [onlineCount, setOnlineCount] = useState(24);

  // --- 1. AUTHENTICATION & CURRENT USER LISTENER ---
  useEffect(() => {
    let userUnsub: Unsubscribe | null = null;

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            const userRef = doc(db, 'users', firebaseUser.uid);
            userUnsub = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = { id: firebaseUser.uid, ...docSnap.data() } as User;
                    // Force Admin Role check
                    if (firebaseUser.email === 'm.mateushugo123@gmail.com') {
                         userData.role = UserRole.ADMIN;
                         userData.permissions = { suppliers: true, courses: true };
                    }
                    setCurrentUser(userData);
                } else {
                     // Create DB entry if it doesn't exist
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
            }, (error) => {
                console.error("User Snapshot Error:", error);
                setIsLoading(false);
            });
        } else {
            setCurrentUser(null);
            setIsLoading(false);
            if (userUnsub) {
                userUnsub();
                userUnsub = null;
            }
        }
    });

    return () => {
        authUnsub();
        if (userUnsub) userUnsub();
    };
  }, []);

  // --- 2. DATA LISTENERS (REAL-TIME DATABASE) ---

  useEffect(() => {
      const q = query(collection(db, 'users'));
      return onSnapshot(q, (snap) => setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User))));
  }, []);

  useEffect(() => {
      const q = query(collection(db, 'offers'), orderBy('createdAt', 'desc')); 
      return onSnapshot(q, (snap) => setOffers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Offer))));
  }, []);

  useEffect(() => {
      const q = query(collection(db, 'suppliers'));
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
          setSuppliers(list);
          // Initial Seed if empty
          if (list.length === 0 && !isLoading) {
             INITIAL_SUPPLIERS.forEach(s => setDoc(doc(db, 'suppliers', s.id), s));
          }
      });
      return () => unsub();
  }, [isLoading]);

  useEffect(() => {
      const q = query(collection(db, 'vip_products'));
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as VipProduct));
          setVipProducts(list);
          if (list.length === 0 && !isLoading) {
             INITIAL_VIP_PRODUCTS.forEach(p => setDoc(doc(db, 'vip_products', p.id), p));
          }
      });
      return () => unsub();
  }, [isLoading]);

  useEffect(() => {
      const q = query(collection(db, 'courses'));
      const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
          setCourses(list);
          if (list.length === 0 && !isLoading) {
             INITIAL_COURSES.forEach(c => setDoc(doc(db, 'courses', c.id), c));
          }
      });
      return () => unsub();
  }, [isLoading]);

  useEffect(() => {
      const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snap) => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Story))));
  }, []);

  // --- REAL TIME MESSAGES ---
  useEffect(() => {
      // Listen to ALL messages ordered by time.
      // Filtering happens in the UI component for performance/simplicity in this architecture.
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'asc')); 
      const unsub = onSnapshot(q, (snap) => {
          const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
          setAllMessages(msgs);
      });
      return () => unsub();
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

  // --- 5. DATA ACTIONS (FIRESTORE) ---

  const toggleUserPermission = async (userId: string, permission: 'suppliers' | 'courses') => {
      const u = allUsers.find(user => user.id === userId);
      if (!u) return;
      const newPermissions = { ...u.permissions, [permission]: !u.permissions[permission] };
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
  };

  const updateUserAccess = async (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => {
      await updateDoc(doc(db, 'users', userId), {
          subscriptionDueDate: dueDate,
          allowedSuppliers: supplierIds,
          allowedCourses: courseIds
      });
  };

  const addOffer = async (offer: Offer) => {
      const cleanOffer = JSON.parse(JSON.stringify(offer));
      delete cleanOffer.id; 
      cleanOffer.createdAt = new Date().toISOString(); 
      await addDoc(collection(db, 'offers'), cleanOffer);
  };

  const deleteOffer = async (id: string) => {
      await deleteDoc(doc(db, 'offers', id));
  };

  const addHeat = async (offerId: string) => {
      await updateDoc(doc(db, 'offers', offerId), { likes: increment(1) });
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
      await updateDoc(doc(db, 'offers', offerId), { comments: arrayUnion(newComment) });
  };

  const addSupplier = async (supplier: Supplier) => {
      const clean = JSON.parse(JSON.stringify(supplier));
      await setDoc(doc(db, 'suppliers', supplier.id), clean);
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
      await updateDoc(doc(db, 'suppliers', id), updates);
  };

  const addProduct = async (product: VipProduct) => {
      const clean = JSON.parse(JSON.stringify(product));
      await setDoc(doc(db, 'vip_products', product.id), clean);
  };

  const addCourse = async (course: Course) => {
      const clean = JSON.parse(JSON.stringify(course));
      await setDoc(doc(db, 'courses', course.id), clean);
  };

  const addModule = async (courseId: string, title: string) => {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      if (!courseSnap.exists()) return;
      const courseData = courseSnap.data() as Course;
      const newModule: CourseModule = { id: Date.now().toString(), title, lessons: [] };
      const updatedModules = [...courseData.modules, newModule];
      await updateDoc(courseRef, { modules: updatedModules });
  };

  const addLesson = async (courseId: string, moduleId: string, lesson: Lesson) => {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      if (!courseSnap.exists()) return;
      const courseData = courseSnap.data() as Course;
      const updatedModules = courseData.modules.map(m => {
          if (m.id === moduleId) return { ...m, lessons: [...m.lessons, lesson] };
          return m;
      });
      await updateDoc(courseRef, { modules: updatedModules, lessonCount: increment(1) });
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

  // Unified Send Message Function
  const sendMessage = async (text: string, targetId: string, imageUrl?: string) => {
      if (!currentUser) return;
      
      // Determine Channel ID
      let channelId = 'community';
      if (targetId !== 'community') {
          // Private chat: Create a unique ID derived from both user IDs
          // Example: userA + userB => sort => "userA_userB"
          // This ensures both users look at the same channel
          channelId = [currentUser.id, targetId].sort().join('_');
      }

      const newMsg = {
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar || '',
          text,
          imageUrl: imageUrl || null,
          channelId: channelId,
          createdAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'messages'), newMsg);
  };

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
      allMessages, // Expose raw messages
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
      
      sendMessage, 
      
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
