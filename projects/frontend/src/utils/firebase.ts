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
  approvers: string[] // 3 wallet addresses that must all approve milestone releases
  createdAt: number
  blockchainTxId?: string
}

export interface MilestoneApproval {
  campaignAppId: string
  milestoneNumber: number
  approvals: {
    [address: string]: {
      approved: boolean
      timestamp: number
    }
  }
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

// Milestone approval operations
export const approveMilestone = async (
  campaignAppId: string,
  milestoneNumber: number,
  approverAddress: string
): Promise<boolean> => {
  try {
    const db = getFirebaseDatabase()
    if (!db) return false

    const approvalRef = ref(db, `milestoneApprovals/${campaignAppId}_milestone${milestoneNumber}/approvals/${approverAddress}`)
    await set(approvalRef, {
      approved: true,
      timestamp: Date.now()
    })
    
    console.log(`✅ Milestone ${milestoneNumber} approved by ${approverAddress}`)
    return true
  } catch (error) {
    console.error('❌ Failed to approve milestone:', error)
    return false
  }
}

export const listenToMilestoneApprovals = (
  campaignAppId: string,
  milestoneNumber: number,
  callback: (approvals: { [address: string]: { approved: boolean; timestamp: number } }) => void
) => {
  const db = getFirebaseDatabase()
  if (!db) {
    console.warn('⚠️ Firebase not configured - returning empty approvals')
    callback({})
    return () => {}
  }

  const approvalRef = ref(db, `milestoneApprovals/${campaignAppId}_milestone${milestoneNumber}/approvals`)
  
  const unsubscribe = onValue(approvalRef, (snapshot: any) => {
    const data = snapshot.val()
    if (data) {
      console.log(`🔥 Milestone ${milestoneNumber} approvals updated:`, Object.keys(data).length)
      callback(data)
    } else {
      callback({})
    }
  })

  return () => off(approvalRef, 'value', unsubscribe)
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
  organizers: string[] // Array of wallet addresses who can scan tickets
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
