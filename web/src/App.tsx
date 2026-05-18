import { Navigate, Route, Routes } from 'react-router-dom'

import { QueryPage } from '@/pages/QueryPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<QueryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
