import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import Home from '../pages/Home'
import Profile from '../pages/Profile'
import RankConverter from '../pages/RankConverter'
import Recommend from '../pages/Recommend'
import VolunteerList from '../pages/VolunteerList'
import RiskReport from '../pages/RiskReport'
import Chat from '../pages/Chat'
import DataCenter from '../pages/DataCenter'
import Assessment from '../pages/Assessment'
import Settings from '../pages/Settings'
import SchemeCompare from '../pages/SchemeCompare'

const basename =
  import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Layout />,
      children: [
        { index: true, element: <Home /> },
        { path: 'profile', element: <Profile /> },
        { path: 'rank', element: <RankConverter /> },
        { path: 'recommend', element: <Recommend /> },
        { path: 'volunteer-list', element: <VolunteerList /> },
        { path: 'risk', element: <RiskReport /> },
        { path: 'chat', element: <Chat /> },
        { path: 'data', element: <DataCenter /> },
        { path: 'assessment', element: <Assessment /> },
        { path: 'settings', element: <Settings /> },
        { path: 'schemes', element: <SchemeCompare /> },
      ],
    },
  ],
  { basename }
)
