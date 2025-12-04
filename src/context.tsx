
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Offer, Supplier, VipProduct, Course, Lesson, ChatMessage, UserRole, Story, Comment } from './types';
import { auth, db } from './firebase'; // Import Firebase
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  setDoc,
  getDoc,
  arrayUnion
} from 'firebase/firestore';

// --- MOCK DATA FOR FALLBACK OR SEEDING ---
import { INITIAL_OFFERS, INITIAL_SUPPLIERS, INITIAL_VIP_PRODUCTS, INITIAL_COURSES } from './mockData';

interface AppContextType {
  user: User | null;
  allUsers: User[];
  login: (email: string, password?: string) => Promise<boolean>;
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
  addOffer: (offer: Offer) => void;
  addSupplier: (supplier: Supplier) => void;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;
  addProduct: (product: VipProduct) => void;
  addCourse: (course: Course) => void;
  addModule: (courseId: string, title: string) => void;
  addLesson: (courseId: string, moduleId: string, lesson: Lesson) => void;
  updateLesson: (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => void;
  addStory: (mediaUrl: string, mediaType: 'image' | 'video') => void;
  deleteOffer: (id: string) => void;
  addHeat: (offerId: string) => void;
  addComment: (offerId: string, text: string) => void;
  sendCommunityMessage: (text: string, imageUrl?: string) => void;
  sendPrivateMessage: (text: string, targetUserId: string, imageUrl?: string) => void;
  toggleUserPermission: (userId: string, permission: 'suppliers' | 'courses') => void;
  updateUserAccess: (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to compress images before saving to Firestore (limit 1MB per doc)
const compressImage = async (base64Str: string, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(base64Str); // Fallback
    });
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vipProducts, setVipProducts] = useState<VipProduct[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(24);

  // --- FIREBASE LISTENERS (REAL-TIME SYNC) ---

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch extra user details from 'users' collection
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
           const userData = userDoc.data() as User;
           setUser({ ...userData, id: firebaseUser.uid });
        } else {
           // Fallback if doc doesn't exist (shouldn't happen with register)
           setUser({
               id: firebaseUser.uid,
               name: firebaseUser.displayName || 'Usuário',
               email: firebaseUser.email || '',
               role: UserRole.USER,
               avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.email}`,
               permissions: { suppliers: false, courses: false }
           });
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Listeners
  useEffect(() => {
    // Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
       const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
       setAllUsers(usersList);
    });

    // Offers (Ordered by timestamp desc)
    // Note: Firestore string timestamps might not sort perfectly if not ISO, but good enough for now.
    const qOffers = query(collection(db, 'offers')); 
    const unsubOffers = onSnapshot(qOffers, (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Offer));
       // Sort client-side to handle potentially mixed timestamp formats during migration
       setOffers(list.sort((a,b) => (b.id > a.id ? 1 : -1))); 
    });

    // Suppliers
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
       setSuppliers(list);
    });

    // Products
    const unsubProducts = onSnapshot(collection(db, 'vip_products'), (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VipProduct));
       setVipProducts(list);
    });

    // Courses
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
       setCourses(list);
    });

    // Stories
    const unsubStories = onSnapshot(collection(db, 'stories'), (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
       setStories(list.sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
    });

    // Community Messages
    const qComm = query(collection(db, 'community_messages'), orderBy('timestamp', 'asc'));
    const unsubComm = onSnapshot(qComm, (snapshot) => {
       const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
       // Calculate isMine dynamically based on current logged in user
       const enrichedList = list.map(msg => ({
           ...msg,
           isMine: auth.currentUser ? msg.senderId === auth.currentUser.uid : false
       }));
       setCommunityMessages(enrichedList);
    });
    
    // Private Messages
    // In a real app, we would query 'where participants array-contains myId'
    // For this demo, we fetch all and filter in memory for simplicity (security note: requires rules in prod)
    const unsubPriv = onSnapshot(collection(db, 'private_messages'), (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        // We will filter these in the View/Component, but let's enrich isMine here
        const enrichedList = list.map(msg => ({
            ...msg,
            isMine: auth.currentUser ? msg.senderId === auth.currentUser.uid : false
        }));
        setPrivateMessages(enrichedList);
    });

    return () => {
        unsubUsers();
        unsubOffers();
        unsubSuppliers();
        unsubProducts();
        unsubCourses();
        unsubStories();
        unsubComm();
        unsubPriv();
    };
  }, []);

  // --- ACTIONS ---

  const login = async (email: string, password?: string): Promise<boolean> => {
    try {
        await signInWithEmailAndPassword(auth, email, password || '');
        return true;
    } catch (error) {
        console.error("Login failed", error);
        return false;
    }
  };

  const register = async (name: string, email: string, password: string, whatsapp: string) => {
      try {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await updateProfile(userCred.user, { displayName: name });
          
          const newUser: User = {
              id: userCred.user.uid,
              name,
              email,
              whatsapp,
              role: UserRole.USER, // Default role
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FACC15&color=000`,
              permissions: { suppliers: false, courses: false }
          };

          // Admin Override check (Hardcoded for demo)
          if (email === 'm.mateushugo123@gmail.com') {
              newUser.role = UserRole.ADMIN;
              newUser.permissions = { suppliers: true, courses: true };
          }

          await setDoc(doc(db, 'users', userCred.user.uid), newUser);
          // Auto login happens by Firebase listener
      } catch (error: any) {
          throw new Error(error.message);
      }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const addOffer = async (offer: Offer) => {
      // Compress image if base64
      if (offer.mediaUrl.startsWith('data:image')) {
          offer.mediaUrl = await compressImage(offer.mediaUrl);
      }
      await addDoc(collection(db, 'offers'), offer);
  };
  
  const deleteOffer = async (id: string) => {
      await deleteDoc(doc(db, 'offers', id));
  };

  const addHeat = async (offerId: string) => {
      const offerRef = doc(db, 'offers', offerId);
      const offer = offers.find(o => o.id === offerId);
      if(offer) {
          await updateDoc(offerRef, { likes: (offer.likes || 0) + 1 });
      }
  };

  const addComment = async (offerId: string, text: string) => {
      if (!user) return;
      const offerRef = doc(db, 'offers', offerId);
      const newComment: Comment = {
          id: Date.now().toString(),
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar || '',
          text,
          timestamp: new Date().toLocaleTimeString()
      };
      await updateDoc(offerRef, {
          comments: arrayUnion(newComment)
      });
  };

  const addSupplier = async (supplier: Supplier) => {
      if (supplier.imageUrl.startsWith('data:image')) {
          supplier.imageUrl = await compressImage(supplier.imageUrl);
      }
      // Compress gallery
      const compressedImages = await Promise.all(supplier.images.map(img => 
        img.startsWith('data:image') ? compressImage(img) : img
      ));
      supplier.images = compressedImages;

      await addDoc(collection(db, 'suppliers'), supplier);
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
      await updateDoc(doc(db, 'suppliers', id), updates);
  };

  const addProduct = async (product: VipProduct) => {
      await addDoc(collection(db, 'vip_products'), product);
  };

  const addCourse = async (course: Course) => {
      await addDoc(collection(db, 'courses'), course);
  };

  const addModule = async (courseId: string, title: string) => {
      const course = courses.find(c => c.id === courseId);
      if(course) {
         const newModule = { id: Date.now().toString(), title, lessons: [] };
         const updatedModules = [...course.modules, newModule];
         await updateDoc(doc(db, 'courses', courseId), { modules: updatedModules });
      }
  };

  const addLesson = async (courseId: string, moduleId: string, lesson: Lesson) => {
     const course = courses.find(c => c.id === courseId);
     if(course) {
         const updatedModules = course.modules.map(m => {
             if(m.id === moduleId) {
                 return { ...m, lessons: [...m.lessons, lesson] };
             }
             return m;
         });
         await updateDoc(doc(db, 'courses', courseId), { 
             modules: updatedModules,
             lessonCount: (course.lessonCount || 0) + 1 
         });
     }
  };

  const updateLesson = async (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
      const course = courses.find(c => c.id === courseId);
      if(course) {
          const updatedModules = course.modules.map(m => {
              if(m.id === moduleId) {
                  const updatedLessons = m.lessons.map(l => {
                      if(l.id === lessonId) return { ...l, ...updates };
                      return l;
                  });
                  return { ...m, lessons: updatedLessons };
              }
              return m;
          });
          await updateDoc(doc(db, 'courses', courseId), { modules: updatedModules });
      }
  };

  const addStory = async (mediaUrl: string, mediaType: 'image' | 'video') => {
      if (!user) return;
      if (mediaType === 'image' && mediaUrl.startsWith('data:image')) {
          mediaUrl = await compressImage(mediaUrl);
      }
      const newStory: Story = {
          id: Date.now().toString(),
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar || '',
          mediaUrl,
          mediaType,
          timestamp: new Date().toISOString(), // Standardize
          isViewed: false
      };
      await addDoc(collection(db, 'stories'), newStory);
  };

  const sendCommunityMessage = async (text: string, imageUrl?: string) => {
      if (!user) return;
      if (imageUrl && imageUrl.startsWith('data:image')) {
          imageUrl = await compressImage(imageUrl);
      }
      const newMessage: ChatMessage = {
          id: Date.now().toString(), // Firestore auto-ID is better but this works for sort
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          text,
          imageUrl,
          timestamp: new Date().toISOString(),
          isMine: true,
          channelId: 'community'
      };
      await addDoc(collection(db, 'community_messages'), newMessage);
  };

  const sendPrivateMessage = async (text: string, targetUserId: string, imageUrl?: string) => {
      if (!user) return;
      if (imageUrl && imageUrl.startsWith('data:image')) {
          imageUrl = await compressImage(imageUrl);
      }
      const newMessage: ChatMessage = {
          id: Date.now().toString(),
          senderId: user.id,
          senderName: user.name,
          senderAvatar: user.avatar,
          text,
          imageUrl,
          timestamp: new Date().toISOString(),
          isMine: true,
          channelId: targetUserId // IMPORTANT: In this simplified schema, channelId is the target user
      };
      await addDoc(collection(db, 'private_messages'), newMessage);
  };

  const toggleUserPermission = async (userId: string, permission: 'suppliers' | 'courses') => {
      const targetUser = allUsers.find(u => u.id === userId);
      if(targetUser) {
          const newPerms = { 
              ...targetUser.permissions, 
              [permission]: !targetUser.permissions[permission] 
          };
          await updateDoc(doc(db, 'users', userId), { permissions: newPerms });
      }
  };

  const updateUserAccess = async (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => {
      await updateDoc(doc(db, 'users', userId), {
          subscriptionDueDate: dueDate,
          allowedSuppliers: supplierIds,
          allowedCourses: courseIds
      });
  };

  // Simulate Online Count (Mock)
  useEffect(() => {
    const interval = setInterval(() => {
        setOnlineCount(prev => Math.max(10, prev + (Math.floor(Math.random() * 5) - 2)));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider value={{
      user, allUsers, login, register, logout,
      offers, suppliers, vipProducts, courses, stories, communityMessages, privateMessages, onlineCount,
      addOffer, addSupplier, updateSupplier, addProduct, addCourse, addModule, addLesson, updateLesson, addStory, deleteOffer,
      addHeat, addComment,
      sendCommunityMessage, sendPrivateMessage, toggleUserPermission, updateUserAccess
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
