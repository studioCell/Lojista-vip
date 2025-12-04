import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ------------------------------------------------------------------
// ATENÇÃO: COLE AQUI A CONFIGURAÇÃO WEB DO SEU PROJETO FIREBASE
// Vá em: Console Firebase > Configurações do Projeto > Seus Aplicativos > Web (</>)
// ------------------------------------------------------------------

const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "lojista-vip.firebaseapp.com",
  projectId: "lojista-vip",
  storageBucket: "lojista-vip.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exports
export const auth = getAuth(app);
export const db = getFirestore(app);
