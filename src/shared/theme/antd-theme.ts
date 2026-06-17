import type { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#059669',
    colorSuccess: '#16a34a',
    colorWarning: '#f59e0b',
    colorError: '#dc2626',
    colorInfo: '#3b82f6',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Card: {
      borderRadius: 10,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 44,
    },
    Steps: {
      colorPrimary: '#059669',
    },
  },
}
