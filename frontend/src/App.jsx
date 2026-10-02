import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import RoomPage from "./pages/RoomPage";
import PrivateChatPage from "./pages/PrivateChatPage";
import ConversationsPage from "./pages/ConversationsPage";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/conversations"
          element={<ConversationsPage />}
        />

        <Route
          path="/room/create"
          element={<CreateRoomPage />}
        />

        <Route
          path="/room/join"
          element={<JoinRoomPage />}
        />

        <Route
          path="/room/:roomId"
          element={<RoomPage />}
        />

        <Route
          path="/private/:chatId"
          element={<PrivateChatPage />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;