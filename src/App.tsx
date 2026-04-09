import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import PreCheck from "./components/PreCheck";
import Proctoring from "./components/Proctoring";
import ReviewSubmit from "./components/ReviewSubmit";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<PreCheck />} />
          <Route path="interview" element={<Proctoring />} />
          <Route path="review" element={<ReviewSubmit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;