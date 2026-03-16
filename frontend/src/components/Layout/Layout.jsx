import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function Layout() {
  return (
    <>
      <Sidebar />
      <div className="main-wrapper">
        <Topbar />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
