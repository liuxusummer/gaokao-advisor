import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type RecommendationItem, type RiskItem, type College, type Major } from '../data/mock'
import { type RealDataCache, loadProvinceData } from '../services/dataLoader'
import { type SubjectAssessmentResult, type IntegratedAssessment } from '../features/assessment/types'
import { type RecommendWeights, DEFAULT_WEIGHTS } from '../services/rankScorer'

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
  mbtiType: string | null
}

export interface VolunteerItem {
  id: string
  college: College
  major: Major
  tier: 'rush' | 'stable' | 'safe'
  probability: number
  minRank?: number
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

  subjectAssessmentResult: SubjectAssessmentResult | null
  setSubjectAssessmentResult: (result: SubjectAssessmentResult | null) => void

  integratedAssessment: IntegratedAssessment | null
  setIntegratedAssessment: (result: IntegratedAssessment | null) => void

  recommendWeights: RecommendWeights
  setRecommendWeights: (w: Partial<RecommendWeights>) => void
  resetRecommendWeights: () => void

  dataCache: RealDataCache | null
  dataLoading: boolean
  dataError: string | null
  loadProvinceData: (provinceId: string) => Promise<RealDataCache | null>
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
  mbtiType: null,
}

export const useAppStore = create<AppState>()(
  persist(
    (set): AppState => ({
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
          role: 'assistant' as const,
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

      subjectAssessmentResult: null,
      setSubjectAssessmentResult: (result) => set({ subjectAssessmentResult: result }),

      integratedAssessment: null,
      setIntegratedAssessment: (result) => set({ integratedAssessment: result }),

      recommendWeights: DEFAULT_WEIGHTS,
      setRecommendWeights: (w) => set((state) => ({
        recommendWeights: { ...state.recommendWeights, ...w },
      })),
      resetRecommendWeights: () => set({ recommendWeights: DEFAULT_WEIGHTS }),

      dataCache: null,
      dataLoading: false,
      dataError: null,
      loadProvinceData: async (provinceId) => {
        const state = useAppStore.getState()
        if (state.dataCache?.province === provinceId) return state.dataCache
        set({ dataLoading: true, dataError: null })
        try {
          const cache = await loadProvinceData(provinceId)
          set({ dataCache: cache, dataLoading: false, dataError: null })
          return cache
        } catch (err) {
          const message = err instanceof Error ? err.message : '数据加载失败'
          set({ dataLoading: false, dataError: message, dataCache: null })
          return null
        }
      },
    }),
    {
      name: 'volunteer-assistant-store',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['dataCache', 'dataLoading', 'dataError'].includes(key)
          )
        ) as Partial<AppState>,
    }
  )
)
