import { Outlet } from "react-router-dom";
import "./Layout.css";

const Layout = () => {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo-container">
            <div className="logo-icon"></div>
            <h2>HyrAI Platform</h2>
        </div>
        <div className="header-status">
          <span className="pulse-dot"></span> System Ready
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
