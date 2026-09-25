// Conexión a Firebase. Este es el ÚNICO archivo que hay que editar para
// conectar el sitio: pega aquí la configuración de tu proyecto.
//
// La encuentras en: Firebase Console > Configuración del proyecto (engranaje)
// > General > "Tus apps" > app web (</>) > "Configuración del SDK" > Config.
//
// Estos valores son PÚBLICOS a propósito (están hechos para ir en el
// frontend). La seguridad la dan las reglas de Firestore (firestore.rules).

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyChTd-YAf-O0huWT0n5wFNXNMFZe7kEwWY',
  authDomain: 'matrimonio-ayj.firebaseapp.com',
  projectId: 'matrimonio-ayj',
  storageBucket: 'matrimonio-ayj.firebasestorage.app',
  messagingSenderId: '270994443837',
  appId: '1:270994443837:web:f0c6c0a28062a85397a454'
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Correos que pueden entrar al panel /admin (con Google o con contraseña).
// Cualquier otra cuenta será rechazada. Debe ser la misma lista que está
// en firestore.rules.
export const CORREOS_AUTORIZADOS = [
  'correo-de-alondra@gmail.com',
  'correo-de-julio@gmail.com'
];

// Se re-exportan las funciones del SDK para que el resto del sitio solo
// importe desde este archivo (y la versión del SDK se cambie en un solo lugar).
export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  Timestamp
};
