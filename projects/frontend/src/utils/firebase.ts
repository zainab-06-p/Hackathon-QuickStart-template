// @ts-ignore - Firebase types are available at runtime
import { initializeApp } from 'firebase/app'
// @ts-ignore - Firebase types are available at runtime
import { getDatabase, ref, push, set, onValue, off, remove } from 'firebase/database'

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

// Initialize Firebase
let app: any = null
let database: any = null

export const initializeFirebase = () => {
  if (!app && firebaseConfig.apiKey) {
    try {
      app = initializeApp(firebaseConfig)
      database = getDatabase(app)
      console.log('🔥 Firebase initialized successfully')
      return true
    } catch (error) {
      console.warn('⚠️ Firebase initialization failed:', error)
      return false
    }
  }
  return !!app
}

export const getFirebaseDatabase = () => {
  if (!database) {
    initializeFirebase()
  }
  return database
}

// Campaign operations
export interface FirebaseCampaign {
  appId: string
  title: string
  description: string
  goal: string
  creator: string
  createdAt: number
  blockchainTxId?: string
}

export const saveCampaignToFirebase = async (campaign: FirebaseCampaign): Promise<boolean> => {
  try {
    const db = getFirebaseDatabase()
    if (!db) return false

    const campaignsRef = ref(db, 'campaigns')
    const newCampaignRef = push(campaignsRef)
    await set(newCampaignRef, campaign)
    
    console.log('✅ Campaign saved to Firebase:', campaign.appId)
    return true
  } catch (error) {
    console.error('❌ Failed to save campaign to Firebase:', error)
    return false
  }
}

export const listenToCampaigns = (callback: (campaigns: FirebaseCampaign[]) => void) => {
  const db = getFirebaseDatabase()
  if (!db) {
    console.warn('⚠️ Firebase not configured - returning empty campaigns')
    callback([]) // Call callback with empty array so loading state resolves
    return () => {}
  }

  const campaignsRef = ref(db, 'campaigns')
  
  const unsubscribe = onValue(campaignsRef, (snapshot: any) => {
    const data = snapshot.val()
    if (data) {
      const campaigns: FirebaseCampaign[] = Object.values(data)
      console.log('🔥 Firebase campaigns updated:', campaigns.length)
      callback(campaigns)
    } else {
      callback([])
    }
  })

  return () => off(campaignsRef, 'value', unsubscribe)
}

// Event operations
export interface FirebaseEvent {
  appId: string
  title: string
  description: string
  venue: string
  eventDate: string
  totalTickets: string
  ticketPrice: string
  creator: string
  createdAt: number
  blockchainTxId?: string
}

export const saveEventToFirebase = async (event: FirebaseEvent): Promise<boolean> => {
  try {
    const db = getFirebaseDatabase()
    if (!db) return false

    const eventsRef = ref(db, 'events')
    const newEventRef = push(eventsRef)
    await set(newEventRef, event)
    
    console.log('✅ Event saved to Firebase:', event.appId)
    return true
  } catch (error) {
    console.error('❌ Failed to save event to Firebase:', error)
    return false
  }
}

export const listenToEvents = (callback: (events: FirebaseEvent[]) => void) => {
  const db = getFirebaseDatabase()
  if (!db) {
    console.warn('⚠️ Firebase not configured - returning empty events')
    callback([]) // Call callback with empty array so loading state resolves
    return () => {}
  }

  const eventsRef = ref(db, 'events')
  
  const unsubscribe = onValue(eventsRef, (snapshot: any) => {
    const data = snapshot.val()
    if (data) {
      const events: FirebaseEvent[] = Object.values(data)
      console.log('🔥 Firebase events updated:', events.length)
      callback(events)
    } else {
      callback([])
    }
  })

  return () => off(eventsRef, 'value', unsubscribe)
}

// Utility to check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey && !!firebaseConfig.projectId
}
