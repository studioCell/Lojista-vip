
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Offer, Supplier, VipProduct, Course, CourseModule, Lesson, ChatMessage, UserRole, Story, Comment } from './types';
import { INITIAL_OFFERS, INITIAL_VIP_PRODUCTS, INITIAL_COURSES, MOCK_ADMIN, MOCK_USERS_LIST } from './mockData';
import { auth, db } from './firebase'; // Importa o serviço de autenticação
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
  arrayUnion
} from 'firebase/firestore';

// Updated Initial Suppliers with Addresses and Cities
const INITIAL_SUPPLIERS_WITH_ADDRESS: Supplier[] = [
  {
    id: 's1',
    name: 'Atacado Moda Sul',
    category: 'Moda',
    city: 'Brás - SP',
    imageUrl: 'https://picsum.photos/200/200?random=3',
    rating: 4.8,
    isVerified: true,
    whatsapp: '5511999999999',
    bio: 'Somos referência em moda feminina no sul do país. Enviamos para todo Brasil.',
    address: 'Rua Miller, 500 - Brás, São Paulo - SP',
    mapsUrl: '',
    cnpj: '12.345.678/0001-90',
    images: ['https://picsum.photos/400/400?random=10', 'https://picsum.photos/400/400?random=11']
  },
  {
    id: 's2',
    name: 'Jeans & Cia',
    category: 'Moda',
    city: 'Goiânia - GO',
    imageUrl: 'https://picsum.photos/200/200?random=4',
    rating: 4.5,
    isVerified: false,
    whatsapp: '5511977777777',
    bio: 'Fábrica de Jeans premium. Atacado mínimo 12 peças.',
    address: 'Galeria 44, Goiânia - GO',
    mapsUrl: '',
    cnpj: '98.765.432/0001-01',
    images: ['https://picsum.photos/400/400?random=12']
  }
];

interface AppContextType {
  user: User | null;
  allUsers: User[];
  isLoading: boolean; // Added isLoading
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

// Helper to load from local storage or fallback to initial data
const loadFromStorage = (key: string, fallback: any) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.warn(`Error loading ${key} from storage, resetting to default.`, error);
    try { localStorage.removeItem(key); } catch (e) {}
    return fallback;
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [allUsers, setAllUsers] = useState<User[]>(() => loadFromStorage('lv_users', MOCK_USERS_LIST));
  const [offers, setOffers] = useState<Offer[]>(() => loadFromStorage('lv_offers', INITIAL_OFFERS));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadFromStorage('lv_suppliers', INITIAL_SUPPLIERS_WITH_ADDRESS));
  const [vipProducts, setVipProducts] = useState<VipProduct[]>(() => loadFromStorage('lv_vip_products', INITIAL_VIP_PRODUCTS));
  const [courses, setCourses] = useState<Course[]>(() => loadFromStorage('lv_courses', INITIAL_COURSES));
  const [stories, setStories] = useState<Story[]>(() => loadFromStorage('lv_stories', []));
  const [onlineCount, setOnlineCount] = useState(24);
  
  // Messages
  const [communityMessages, setCommunityMessages] = useState<ChatMessage[]>(() => loadFromStorage('lv_comm_msgs', [
    {
      id: 'm1',
      senderId: 'u2',
      senderName: 'Carla Modas',
      senderAvatar: 'https://picsum.photos/100/100?random=50',
      text: 'Alguém já comprou com o fornecedor do Brás novo?',
      timestamp: '10:30',
      isMine: false,
      channelId: 'community'
    },
    {
      id: 'm2',
      senderId: 'a1',
      senderName: 'Mateus Hugo (Admin)',
      senderAvatar: 'https://picsum.photos/100/100',
      text: 'Pessoal, acabei de postar novidade na aba Fornecedores!',
      timestamp: '10:35',
      isMine: false,
      channelId: 'community'
    }
  ]));

  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>(() => loadFromStorage('lv_priv_msgs', [
    {
      id: 'pm1',
      senderId: 'u2', 
      senderName: 'Carla Modas',
      senderAvatar: 'https://picsum.photos/100/100?random=50',
      text: 'Olá, gostaria de saber como funciona a área VIP.',
      timestamp: '09:00',
      isMine: false,
      channelId: 'u2' 
    },
    {
      id: 'pm2',
      senderId: 'a1', 
      senderName: 'Mateus Hugo (Admin)',
      senderAvatar: 'https://picsum.photos/100/100',
      text: 'Oi Carla! A área VIP libera produtos exclusivos. Posso te ajudar com o cadastro?',
      timestamp: '09:05',
      isMine: true,
      channelId: 'u2'
    }
  ]));

  // Simulate Online Count Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
        setOnlineCount(prev => {
            const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
            return Math.max(10, prev + change);
        });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- PERSISTENCE EFFECT ---
  useEffect(() => { localStorage.setItem('lv_users', JSON.stringify(allUsers)); }, [allUsers]);
  useEffect(() => { localStorage.setItem('lv_offers', JSON.stringify(offers)); }, [offers]);
  useEffect(() => { localStorage.setItem('lv_suppliers', JSON.stringify(suppliers)); }, [suppliers]);
  useEffect(() => { localStorage.setItem('lv_vip_products', JSON.stringify(vipProducts)); }, [vipProducts]);
  useEffect(() => { localStorage.setItem('lv_courses', JSON.stringify(courses)); }, [courses]);
  useEffect(() => { localStorage.setItem('lv_stories', JSON.stringify(stories)); }, [stories]);
  useEffect(() => { localStorage.setItem('lv_comm_msgs', JSON.stringify(communityMessages)); }, [communityMessages]);
  useEffect(() => { localStorage.setItem('lv_priv_msgs', JSON.stringify(privateMessages)); }, [privateMessages]);

  // --- AUTHENTICATION ---
  
  // EFEITO PARA MONITORAR O ESTADO DE AUTENTICAÇÃO DO FIREBASE
  useEffect(() => {
    // Isso garante que o estado do usuário (logado ou não) seja atualizado automaticamente
    const unsubscribe = onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
        if (user) {
            // Check Firestore for full profile
            try {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    setCurrentUser({ id: user.uid, ...docSnap.data() } as User);
                } else {
                    // Fallback or Basic Profile
                     setCurrentUser({
                        id: user.uid,
                        name: user.displayName || 'Lojista',
                        email: user.email!,
                        role: UserRole.USER,
                        permissions: { suppliers: true, courses: true }
                    });
                }
            } catch (error) {
                console.error("Error fetching user profile", error);
                // Fallback on error
                setCurrentUser({
                    id: user.uid,
                    name: user.displayName || 'Lojista',
                    email: user.email!,
                    role: UserRole.USER,
                    permissions: { suppliers: true, courses: true }
                });
            }
        } else {
            setCurrentUser(null);
        }
        setIsLoading(false);
    });
    return unsubscribe; // Limpa o listener ao desmontar
  }, []);

  // FUNÇÃO DE LOGIN REAL
  const login = async (email: string, password?: string) => {
    setIsLoading(true); // Force loading state immediately
    try {
        // Tenta fazer o login no Firebase
        await signInWithEmailAndPassword(auth, email, password || '');
        // O onAuthStateChanged (acima) irá atualizar o estado 'currentUser'
        // Mas o isLoading só vira false quando onAuthStateChanged terminar
        return true; 
    } catch (error) {
        setIsLoading(false); // Reset loading on error
        console.error("Erro de Login:", error);
        throw error;
    }
  };

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
        const provider = new GoogleAuthProvider();
        const userCred = await signInWithPopup(auth, provider);
        
        // Check if exists in DB, if not create
        const docRef = doc(db, 'users', userCred.user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
             const newUser: User = {
                id: userCred.user.uid,
                name: userCred.user.displayName || 'Lojista',
                email: userCred.user.email!,
                role: UserRole.USER,
                avatar: userCred.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCred.user.displayName || 'L')}&background=FACC15&color=000`,
                permissions: { suppliers: false, courses: false }
            };
            await setDoc(doc(db, 'users', userCred.user.uid), newUser);
        }
    } catch (error) {
        setIsLoading(false);
        throw error;
    }
  };

  const register = async (name: string, email: string, password: string, whatsapp: string) => {
      setIsLoading(true);
      try {
        // Create Auth User
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

        // Admin Override check
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

  // FUNÇÃO DE LOGOUT REAL
  const logout = async () => {
      setIsLoading(true);
      await signOut(auth);
      // O onAuthStateChanged (acima) irá setar o 'currentUser' para null
  };

  // --- ACTIONS ---

  const toggleUserPermission = (userId: string, permission: 'suppliers' | 'courses') => {
    const updatedUsers = allUsers.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          permissions: {
            ...u.permissions,
            [permission]: !u.permissions[permission]
          }
        };
      }
      return u;
    });
    setAllUsers(updatedUsers);
    if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUsers.find(u => u.id === userId) || null);
    }
  };

  const updateUserAccess = (userId: string, dueDate: string, supplierIds: string[], courseIds: string[]) => {
      const updatedUsers = allUsers.map(u => {
        if (u.id === userId) {
            return {
                ...u,
                subscriptionDueDate: dueDate,
                allowedSuppliers: supplierIds,
                allowedCourses: courseIds
            };
        }
        return u;
      });
      setAllUsers(updatedUsers);
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUsers.find(u => u.id === userId) || null);
      }
  };

  const addOffer = (offer: Offer) => setOffers([offer, ...offers]);
  const deleteOffer = (id: string) => setOffers(offers.filter(o => o.id !== id));
  
  const addHeat = (offerId: string) => {
    setOffers(offers.map(o => {
      if (o.id === offerId) {
        return { ...o, likes: o.likes + 1 };
      }
      return o;
    }));
  };

  const addComment = (offerId: string, text: string) => {
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

  const addSupplier = (supplier: Supplier) => setSuppliers([...suppliers, supplier]);
  
  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
      setSuppliers(suppliers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addProduct = (product: VipProduct) => setVipProducts([...vipProducts, product]);
  
  const addCourse = (course: Course) => setCourses([...courses, course]);
  
  const addModule = (courseId: string, title: string) => {
    setCourses(courses.map(c => {
      if (c.id === courseId) {
        return {
          ...c,
          modules: [...c.modules, { id: Date.now().toString(), title, lessons: [] }]
        };
      }
      return c;
    }));
  };

  const addLesson = (courseId: string, moduleId: string, lesson: Lesson) => {
    setCourses(courses.map(c => {
      if (c.id === courseId) {
        const updatedModules = c.modules.map(m => {
          if (m.id === moduleId) {
            return { ...m, lessons: [...m.lessons, lesson] };
          }
          return m;
        });
        return { ...c, modules: updatedModules, lessonCount: c.lessonCount + 1 };
      }
      return c;
    }));
  };

  const updateLesson = (courseId: string, moduleId: string, lessonId: string, updates: Partial<Lesson>) => {
    setCourses(courses.map(c => {
      if (c.id === courseId) {
        const updatedModules = c.modules.map(m => {
          if (m.id === moduleId) {
            const updatedLessons = m.lessons.map(l => {
                if (l.id === lessonId) {
                    return { ...l, ...updates };
                }
                return l;
            });
            return { ...m, lessons: updatedLessons };
          }
          return m;
        });
        return { ...c, modules: updatedModules };
      }
      return c;
    }));
  };

  const addStory = (mediaUrl: string, mediaType: 'image' | 'video') => {
    if (!currentUser) return;
    const newStory: Story = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar || '',
      mediaUrl,
      mediaType,
      timestamp: 'Agora',
      isViewed: false
    };
    setStories([newStory, ...stories]);
  };

  const sendCommunityMessage = (text: string, imageUrl?: string) => {
    if (!currentUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text,
      imageUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true,
      channelId: 'community'
    };
    setCommunityMessages([...communityMessages, newMessage]);
  };

  const sendPrivateMessage = (text: string, targetUserId: string, imageUrl?: string) => {
    if (!currentUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      text,
      imageUrl,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMine: true, 
      channelId: targetUserId 
    };
    setPrivateMessages([...privateMessages, newMessage]);
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
      offers, suppliers, vipProducts, courses, stories, communityMessages, privateMessages, onlineCount,
      addOffer, addSupplier, updateSupplier, addProduct, addCourse, addModule, addLesson, updateLesson, addStory, deleteOffer,
      addHeat, addComment,
      sendCommunityMessage, sendPrivateMessage, toggleUserPermission, updateUserAccess
    }}>
      {isLoading && !currentUser ? (
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
