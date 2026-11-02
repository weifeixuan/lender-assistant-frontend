import { Navigate, Route, Routes } from 'react-router-dom';
import { KnowledgeProvider } from '@/lib/knowledge';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { ChatPage } from '@/features/chat/ChatPage';

export default function App() {
  return (
    <KnowledgeProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/documents" replace />} />
      </Routes>
    </KnowledgeProvider>
  );
}
