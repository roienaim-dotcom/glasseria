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

// Initialize Storage
const storage = firebase.storage();

// Initialize Auth
const auth = firebase.auth();

// Collections References
const categoriesCollection = db.collection('glasseria_categories');
const subcategoriesCollection = db.collection('glasseria_subcategories');
const productsCollection = db.collection('glasseria_products');

// Storage References
const storageRef = storage.ref();
const categoriesImagesRef = storageRef.child('glasseria/categories');
const subcategoriesImagesRef = storageRef.child('glasseria/subcategories');
const productsImagesRef = storageRef.child('glasseria/products');
