import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RecommendationItem, type RiskItem, type College, type Major } from '../data/mock'

export interface UserProfile {
  provinceId: string
  provinceName: string
  subjectType: 'physics' | 'history' | 'comprehensive'
  subjects: string[]
  score: number | null
  rank: number | null
  regions: string[]
  levels: string[]
  categories: string[]
  maxTuition: number | null
  physicalExam: 'normal' | 'colorWeak' | 'colorBlind' | 'vision' | 'height' | 'other'
  riskPreference: 'conservative' | 'balanced' | 'aggressive'
}

export interface VolunteerItem {
  id: string
  college: College
  major: Major
  tier: 'rush' | 'stable' | 'safe'
  probability: number
  obeyAdjust?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
}

interface AppState {
  darkMode: boolean
  setDarkMode: (v: boolean) => void

  profile: UserProfile
  updateProfile: (p: Partial<UserProfile>) => void
  resetProfile: () => void

  recommendations: RecommendationItem[]
  setRecommendations: (items: RecommendationItem[]) => void

  volunteerList: VolunteerItem[]
  addVolunteer: (item: Omit<VolunteerItem, 'id' | 'obeyAdjust'>) => void
  removeVolunteer: (id: string) => void
  moveVolunteer: (from: number, to: number) => void
  updateVolunteer: (id: string, patch: Partial<VolunteerItem>) => void
  clearVolunteerList: () => void

  riskReport: RiskItem[]
  setRiskReport: (items: RiskItem[]) => void

  chatMessages: ChatMessage[]
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  clearChat: () => void

  aiConfig: AiConfig
  setAiConfig: (config: Partial<AiConfig>) => void
  updateLastAssistantMessage: (content: string) => void

  assessmentResult: Record<string, number> | null
  setAssessmentResult: (result: Record<string, number> | null) => void
}

const defaultProfile: UserProfile = {
  provinceId: '',
  provinceName: '',
  subjectType: 'physics',
  subjects: [],
  score: null,
  rank: null,
  regions: [],
  levels: [],
  categories: [],
  maxTuition: null,
  physicalExam: 'normal',
  riskPreference: 'balanced',
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      darkMode: false,
      setDarkMode: (v) => {
        set({ darkMode: v })
        document.documentElement.classList.toggle('dark', v)
      },

      profile: defaultProfile,
      updateProfile: (p) => set((state) => ({ profile: { ...state.profile, ...p } })),
      resetProfile: () => set({ profile: defaultProfile }),

      recommendations: [],
      setRecommendations: (items) => set({ recommendations: items }),

      volunteerList: [],
      addVolunteer: (item) =>
        set((state) => ({
          volunteerList: [
            ...state.volunteerList,
            { ...item, id: `${item.college.id}-${item.major.id}-${Date.now()}`, obeyAdjust: true },
          ],
        })),
      removeVolunteer: (id) =>
        set((state) => ({
          volunteerList: state.volunteerList.filter((v) => v.id !== id),
        })),
      moveVolunteer: (from, to) =>
        set((state) => {
          const list = [...state.volunteerList]
          const [removed] = list.splice(from, 1)
          list.splice(to, 0, removed)
          return { volunteerList: list }
        }),
      updateVolunteer: (id, patch) =>
        set((state) => ({
          volunteerList: state.volunteerList.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        })),
      clearVolunteerList: () => set({ volunteerList: [] }),

      riskReport: [],
      setRiskReport: (items) => set({ riskReport: items }),

      chatMessages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: '你好！我是智填助手。你可以问我关于志愿推荐、院校专业、填报规则的问题。',
          timestamp: Date.now(),
        },
      ],
      addChatMessage: (msg) =>
        set((state) => ({
          chatMessages: [
            ...state.chatMessages,
            { ...msg, id: `${msg.role}-${Date.now()}`, timestamp: Date.now() },
          ],
        })),
      clearChat: () =>
        set({
          chatMessages: [
            {
              id: 'welcome',
              role: 'assistant',
              content: '你好！我是智填助手。你可以问我关于志愿推荐、院校专业、填报规则的问题。',
              timestamp: Date.now(),
            },
          ],
        }),

      aiConfig: { baseUrl: '', apiKey: '', model: '' },
      setAiConfig: (config) =>
        set((state) => ({ aiConfig: { ...state.aiConfig, ...config } })),
      updateLastAssistantMessage: (content) =>
        set((state) => {
          const msgs = [...state.chatMessages]
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') {
              msgs[i] = { ...msgs[i], content }
              break
            }
          }
          return { chatMessages: msgs }
        }),

      assessmentResult: null,
      setAssessmentResult: (result) => set({ assessmentResult: result }),
    }),
    {
      name: 'volunteer-assistant-store',
    }
  )
)
