import { Navigate, Route, Routes } from 'react-router-dom'
import { PublicOnly, RequireAdmin, RequireAuth } from './components/Guards'
import Layout from './components/Layout'
import { AdminLogin, Forgot, Login, Register, ResetPassword } from './pages/AuthPages'
import Home from './pages/Home'
import Create from './pages/Create'
import NewPost from './pages/NewPost'
import PostPage from './pages/PostPage'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import EventForm from './pages/EventForm'
import Boost from './pages/Boost'
import Hangouts from './pages/Hangouts'
import Chats from './pages/Chats'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Admin from './pages/admin/Admin'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot" element={<PublicOnly><Forgot /></PublicOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<PublicOnly><AdminLogin /></PublicOnly>} />
      <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />

      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="create" element={<Create />} />
        <Route path="post/new" element={<NewPost />} />
        <Route path="post/:id" element={<PostPage />} />
        <Route path="events" element={<Events />} />
        <Route path="events/new" element={<EventForm />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="events/:id/edit" element={<EventForm />} />
        <Route path="events/:id/boost" element={<Boost />} />
        <Route path="hangouts" element={<Hangouts />} />
        <Route path="chats" element={<Chats />} />
        <Route path="chats/:id" element={<ChatRoom />} />
        <Route path="profile" element={<Profile />} />
        <Route path="profile/edit" element={<EditProfile />} />
        <Route path="u/:username" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notifications" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
