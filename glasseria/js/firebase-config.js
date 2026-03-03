// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBaQbwRvxuraWb2ax6ijFNoxE6OXKhgVm8",
    authDomain: "glasseria-3761f.firebaseapp.com",
    projectId: "glasseria-3761f",
    storageBucket: "glasseria-3761f.firebasestorage.app",
    messagingSenderId: "1039571860801",
    appId: "1:1039571860801:web:1bb49bbf44bfd560ddb5c0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Enable offline persistence for faster loading & mobile reliability
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence: not supported by browser');
    }
});

// Initialize Storage (only available when SDK is loaded - admin pages)
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null;

// Initialize Auth (only available when SDK is loaded - admin pages)
const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;

// Collections References
const categoriesCollection = db.collection('glasseria_categories');
const subcategoriesCollection = db.collection('glasseria_subcategories');
const productsCollection = db.collection('glasseria_products');

// Storage References (only available when storage SDK is loaded - admin pages)
const storageRef = storage ? storage.ref() : null;
const categoriesImagesRef = storageRef ? storageRef.child('glasseria/categories') : null;
const subcategoriesImagesRef = storageRef ? storageRef.child('glasseria/subcategories') : null;
const productsImagesRef = storageRef ? storageRef.child('glasseria/products') : null;
